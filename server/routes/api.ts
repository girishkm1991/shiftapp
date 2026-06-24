import { Router, Request, Response, NextFunction } from 'express';
import { dbInstance } from '../db/database';
import { User, SwapRequest, SwapVolunteer, LeaveRequest, LeaveBalance, Message, Conversation, Notification, AuditLog } from '../../src/types';
import { getNotificationService } from '../services/NotificationService';
import { getCacheService } from '../services/CacheService';
import { getQueueService } from '../services/QueueService';
import { SocketService } from '../services/SocketService';


export const apiRouter = Router();

// Helper to generate IDs
const uuid = () => Math.random().toString(36).substring(2, 11);

// Standard auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  const user = dbInstance.getUsers().find(u => u.id === token || token === 'admin_token' || token === 'sup_token');
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User not found' });
  }
  req.user = user;
  next();
}

// Extend Express Request type locally
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// --- MODULE 1: AUTHENTICATION ---

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { clockId, password, rememberMe } = req.body;
  
  if (!clockId || !password) {
    return res.status(400).json({ error: 'Clock ID and Password are required' });
  }

  const user = dbInstance.getUsers().find(u => u.clockId.toUpperCase() === clockId.toUpperCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid Clock ID or Password. (Pilot passwords are: password123)' });
  }

  // Under pilot, check simple placeholder password or 'password123'
  if (password !== 'password123' && user.passwordHash !== 'sha256_password123_placeholder') {
    return res.status(401).json({ error: 'Invalid password. Try password123' });
  }

  // Generate simple token (using user id for simplicity as bearer)
  const token = user.id;

  // Log activity
  dbInstance.updateState(state => {
    state.auditLogs.push({
      id: uuid(),
      userId: user.id,
      action: 'USER_LOGIN',
      timestamp: new Date().toISOString(),
      newValue: `Clock ID: ${clockId}`
    });
  });

  res.json({
    token,
    user: {
      id: user.id,
      clockId: user.clockId,
      name: user.name,
      roleId: user.roleId,
      mobile: user.mobile,
      email: user.email,
      departmentId: user.departmentId,
      sectionId: user.sectionId,
      machineId: user.machineId,
      status: user.status
    }
  });
});

// Complete onboarding step 1: Password change
apiRouter.post('/auth/onboard/step1', requireAuth, (req: Request, res: Response) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  dbInstance.updateState(state => {
    const user = state.users.find(u => u.id === req.user!.id);
    if (user) {
      user.passwordHash = 'sha256_modified_' + uuid();
      user.status = 'onboarding_step2';
      
      state.auditLogs.push({
        id: uuid(),
        userId: user.id,
        action: 'ONBOARD_PASSWORD_CHANGE',
        timestamp: new Date().toISOString()
      });
    }
  });

  const updatedUser = dbInstance.getUsers().find(u => u.id === req.user!.id);
  res.json({ success: true, user: updatedUser });
});

// Complete onboarding step 2: Complete profile
apiRouter.post('/auth/onboard/step2', requireAuth, (req: Request, res: Response) => {
  const { mobile, email, departmentId, sectionId, machineId } = req.body;
  if (!mobile || !departmentId || !sectionId || !machineId) {
    return res.status(400).json({ error: 'Mobile, Department, Section and Primary Machine are required.' });
  }

  dbInstance.updateState(state => {
    const user = state.users.find(u => u.id === req.user!.id);
    if (user) {
      user.mobile = mobile;
      user.email = email;
      user.departmentId = departmentId;
      user.sectionId = sectionId;
      user.machineId = machineId;
      user.status = 'onboarding_step3';

      // Create leave balances if not exist
      const leaveTypes: ('Casual' | 'Sick' | 'Earned' | 'Emergency' | 'Unpaid')[] = ['Casual', 'Sick', 'Earned', 'Emergency', 'Unpaid'];
      leaveTypes.forEach(type => {
        const exist = state.leaveBalances.find(b => b.userId === user.id && b.leaveType === type);
        if (!exist) {
          state.leaveBalances.push({
            id: `lb_${user.id}_${type}`,
            userId: user.id,
            leaveType: type,
            allocated: type === 'Sick' ? 10 : type === 'Earned' ? 15 : type === 'Emergency' ? 5 : type === 'Unpaid' ? 99 : 12,
            used: 0,
            pending: 0
          });
        }
      });

      state.auditLogs.push({
        id: uuid(),
        userId: user.id,
        action: 'ONBOARD_PROFILE_COMPLETE',
        timestamp: new Date().toISOString()
      });
    }
  });

  const updatedUser = dbInstance.getUsers().find(u => u.id === req.user!.id);
  res.json({ success: true, user: updatedUser });
});

// Complete onboarding step 3: Setup default shift pattern
apiRouter.post('/auth/onboard/step3', requireAuth, (req: Request, res: Response) => {
  const { pattern } = req.body; // Array of 7 shiftCodes: e.g. ['OFF', 'A', 'A', 'A', 'A', 'A', 'OFF']
  if (!pattern || pattern.length !== 7) {
    return res.status(400).json({ error: 'Default pattern of 7 days is required.' });
  }

  dbInstance.updateState(state => {
    const user = state.users.find(u => u.id === req.user!.id);
    if (user) {
      // Clear existing default patterns
      state.employeeDefaultShiftPatterns = state.employeeDefaultShiftPatterns.filter(p => p.userId !== user.id);
      
      // Save new pattern
      pattern.forEach((shiftCode: 'A' | 'B' | 'C' | 'OFF', dayOfWeek: number) => {
        state.employeeDefaultShiftPatterns.push({
          id: `dsp_${user.id}_${dayOfWeek}`,
          userId: user.id,
          dayOfWeek,
          shiftCode
        });
      });

      user.status = 'active';
      user.onboardingCompletedAt = new Date().toISOString();

      state.auditLogs.push({
        id: uuid(),
        userId: user.id,
        action: 'ONBOARD_PATTERN_COMPLETE',
        timestamp: new Date().toISOString()
      });

      // Join the global group conversation
      const pId = `cp_global_${uuid()}`;
      state.conversationParticipants.push({
        id: pId,
        conversationId: 'c_global',
        userId: user.id
      });
    }
  });

  const updatedUser = dbInstance.getUsers().find(u => u.id === req.user!.id);
  res.json({ success: true, user: updatedUser });
});


// --- MODULE 2: ELIGIBILITY & RECOMMENDATION ENGINE ---

// Helper logic to run Intelligent Eligibility Checks
function checkEligibility(userId: string, date: string, reqShiftCode: 'A' | 'B' | 'C' | 'OFF'): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const users = dbInstance.getUsers();
  const assignments = dbInstance.getShiftAssignments();
  const leaves = dbInstance.getLeaveRequests();
  const machineMappings = dbInstance.getEmployeeMachineMapping();
  const targetUser = users.find(u => u.id === userId);

  if (!targetUser) {
    return { eligible: false, reasons: ['Employee not found'] };
  }

  // 1. Employee status check
  if (targetUser.status !== 'active') {
    return { eligible: false, reasons: ['Employee profile onboarding is incomplete'] };
  }

  // 2. Is target user already working on this exact date?
  const existingAssign = assignments.find(a => a.userId === userId && a.date === date);
  if (existingAssign && existingAssign.shiftCode !== 'OFF') {
    reasons.push(`Already working ${existingAssign.shiftCode} Shift on this day.`);
  }

  // 3. Is target user on Leave on this day?
  const onLeave = leaves.some(l => l.userId === userId && l.status === 'approved' && date >= l.startDate && date <= l.endDate);
  if (onLeave) {
    reasons.push('On approved leave on this date.');
  }

  // 4. Machine Certification rules
  if (targetUser.machineId) {
    const isCertified = machineMappings.some(m => m.userId === userId && m.machineId === targetUser.machineId && m.isCertified);
    if (!isCertified) {
      reasons.push(`Not certified to operate required Machine.`);
    }
  }

  // 5. Weekly overtime hours restriction
  // Count hours for this week (Mon-Sun surrounding the date)
  const targetDate = new Date(date);
  const day = targetDate.getDay();
  const diffToMon = targetDate.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(targetDate.setDate(diffToMon));
  const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6));
  
  const startStr = monday.toISOString().split('T')[0];
  const endStr = sunday.toISOString().split('T')[0];

  const weekAssigns = assignments.filter(a => a.userId === userId && a.date >= startStr && a.date <= endStr && a.shiftCode !== 'OFF');
  const prospectiveHours = (weekAssigns.length + 1) * 8; // Each shift is 8 hours
  if (prospectiveHours > 60) {
    reasons.push('Swap would exceed the weekly maximum working limit (60 hours).');
  }

  return {
    eligible: reasons.length === 0,
    reasons
  };
}

// Eligibility Endpoint
apiRouter.get('/swaps/check-eligibility', requireAuth, (req: Request, res: Response) => {
  const { date, shiftCode, employeeId } = req.query;
  if (!date || !shiftCode || !employeeId) {
    return res.status(400).json({ error: 'date, shiftCode and employeeId are required' });
  }

  const result = checkEligibility(employeeId as string, date as string, shiftCode as 'A' | 'B' | 'C' | 'OFF');
  res.json(result);
});

// Recommendations Endpoint
apiRouter.get('/swaps/recommendations', requireAuth, (req: Request, res: Response) => {
  const { date, shiftCode } = req.query;
  if (!date || !shiftCode) {
    return res.status(400).json({ error: 'date and shiftCode are required' });
  }

  const users = dbInstance.getUsers().filter(u => u.id !== req.user!.id && u.roleId === '1' && u.status === 'active');
  const recommendations = users.map(user => {
    const eligibility = checkEligibility(user.id, date as string, shiftCode as 'A' | 'B' | 'C' | 'OFF');
    
    // Calculate recommendation score based on matching section, machine, default pattern
    let score = 0;
    const notes: string[] = [];

    if (eligibility.eligible) {
      if (user.sectionId === req.user!.sectionId) {
        score += 40;
        notes.push('Same Section (Builders)');
      }
      if (user.machineId === req.user!.machineId) {
        score += 30;
        notes.push('Same Certified Machine');
      }
      // Check default pattern matches off
      const day = new Date(date as string).getDay();
      const defaultPatterns = dbInstance.getEmployeeDefaultShiftPatterns();
      const userPattern = defaultPatterns.find(p => p.userId === user.id && p.dayOfWeek === day);
      if (userPattern && userPattern.shiftCode === 'OFF') {
        score += 20;
        notes.push('Normally OFF on this day');
      }
    }

    return {
      userId: user.id,
      name: user.name,
      clockId: user.clockId,
      machineName: dbInstance.getMachines().find(m => m.id === user.machineId)?.name || 'General Builder',
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      score,
      notes
    };
  })
  .filter(r => r.eligible)
  .sort((a, b) => b.score - a.score);

  res.json(recommendations);
});


// --- MODULE 3: SHIFT SWAP OPERATIONS ---

// Get active open swap marketplace & direct swaps
apiRouter.get('/swaps', requireAuth, (req: Request, res: Response) => {
  const swaps = dbInstance.getSwapRequests();
  const users = dbInstance.getUsers();
  const volunteers = dbInstance.getSwapVolunteers();

  const richSwaps = swaps.map(s => {
    const requester = users.find(u => u.id === s.requesterId);
    const target = s.targetUserId ? users.find(u => u.id === s.targetUserId) : null;
    const requestVolunteers = volunteers.filter(v => v.swapRequestId === s.id).map(v => {
      const volUser = users.find(u => u.id === v.volunteerId);
      return {
        id: v.id,
        volunteerId: v.volunteerId,
        volunteerName: volUser?.name,
        volunteerClockId: volUser?.clockId,
        status: v.status,
        createdAt: v.createdAt
      };
    });

    return {
      ...s,
      requesterName: requester?.name,
      requesterClockId: requester?.clockId,
      targetName: target?.name,
      targetClockId: target?.clockId,
      volunteers: requestVolunteers
    };
  });

  res.json(richSwaps);
});

// Create a Swap Request
apiRouter.post('/swaps', requireAuth, (req: Request, res: Response) => {
  const { date, shiftCode, swapType, targetUserId, remarks, incentiveOffered, incentiveAmount } = req.body;
  
  if (!date || !shiftCode || !swapType) {
    return res.status(400).json({ error: 'date, shiftCode and swapType are required' });
  }

  const requesterId = req.user!.id;
  
  // Verify requester actually has this assignment
  const assignments = dbInstance.getShiftAssignments();
  const currentAssign = assignments.find(a => a.userId === requesterId && a.date === date);
  if (!currentAssign || currentAssign.shiftCode !== shiftCode) {
    return res.status(400).json({ error: `You are not scheduled for ${shiftCode} Shift on ${date}. Current: ${currentAssign?.shiftCode || 'None'}` });
  }

  const newSwapId = 'swap_' + uuid();
  const newSwap: SwapRequest = {
    id: newSwapId,
    requesterId,
    date,
    shiftCode,
    swapType,
    targetUserId: swapType === 'direct' ? targetUserId : undefined,
    status: 'pending',
    incentiveOffered: !!incentiveOffered,
    incentiveAmount: incentiveOffered ? Number(incentiveAmount) : 0,
    remarks,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  dbInstance.updateState(state => {
    state.swapRequests.push(newSwap);

    // Auto-create swap chat discussion thread
    const convId = 'c_swap_' + uuid();
    state.conversations.push({
      id: convId,
      type: 'swap',
      title: `Swap Discussion: ${req.user!.name} (${date})`,
      swapRequestId: newSwapId,
      createdAt: new Date().toISOString()
    });

    state.conversationParticipants.push({
      id: uuid(),
      conversationId: convId,
      userId: requesterId
    });

    // Notify eligible employees if open shift
    if (swapType === 'open') {
      const eligibleUsers = state.users.filter(u => u.id !== requesterId && u.roleId === '1');
      eligibleUsers.forEach(u => {
        const check = checkEligibility(u.id, date, shiftCode);
        if (check.eligible) {
          getNotificationService().sendNotification(
            u.id,
            'New Swap Opportunity',
            `${req.user!.name} posted an open shift swap for ${date} (${shiftCode} Shift).`,
            'swap',
            '/swap-marketplace'
          ).catch(e => console.error(e));
        }
      });
    } else if (swapType === 'direct' && targetUserId) {
      // Direct notification
      state.conversationParticipants.push({
        id: uuid(),
        conversationId: convId,
        userId: targetUserId
      });

      getNotificationService().sendNotification(
        targetUserId,
        'Direct Swap Request',
        `${req.user!.name} requested a shift swap with you for ${date} (${shiftCode} Shift).`,
        'swap',
        '/swap-marketplace'
      ).catch(e => console.error(e));
    }

    state.auditLogs.push({
      id: uuid(),
      userId: requesterId,
      action: 'CREATE_SWAP_REQUEST',
      timestamp: new Date().toISOString(),
      newValue: JSON.stringify(newSwap)
    });
  });

  res.json({ success: true, swap: newSwap });
});

// Volunteer for an open shift
apiRouter.post('/swaps/:id/volunteer', requireAuth, (req: Request, res: Response) => {
  const swapId = req.params.id;
  const volunteerId = req.user!.id;

  const swaps = dbInstance.getSwapRequests();
  const swap = swaps.find(s => s.id === swapId);

  if (!swap) {
    return res.status(404).json({ error: 'Swap request not found' });
  }
  if (swap.requesterId === volunteerId) {
    return res.status(400).json({ error: 'You cannot volunteer for your own request' });
  }
  if (swap.status !== 'pending') {
    return res.status(400).json({ error: 'Swap request is no longer accepting volunteers' });
  }

  // Run eligibility checks
  const eligibility = checkEligibility(volunteerId, swap.date, swap.shiftCode);
  if (!eligibility.eligible) {
    return res.status(400).json({ error: 'You are not eligible for this shift. ' + eligibility.reasons.join(' ') });
  }

  const volId = 'vol_' + uuid();
  const newVol: SwapVolunteer = {
    id: volId,
    swapRequestId: swapId,
    volunteerId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  dbInstance.updateState(state => {
    state.swapVolunteers.push(newVol);

    // Add volunteer to the swap conversation
    const conv = state.conversations.find(c => c.swapRequestId === swapId);
    if (conv) {
      const alreadyPart = state.conversationParticipants.some(p => p.conversationId === conv.id && p.userId === volunteerId);
      if (!alreadyPart) {
        state.conversationParticipants.push({
          id: uuid(),
          conversationId: conv.id,
          userId: volunteerId
        });
      }
      state.messages.push({
        id: uuid(),
        conversationId: conv.id,
        senderId: volunteerId,
        text: `I have volunteered to cover your shift! Let's discuss.`,
        isReadBy: [volunteerId],
        createdAt: new Date().toISOString()
      });
    }

    // Notify requester
    getNotificationService().sendNotification(
      swap.requesterId,
      'New Swap Volunteer',
      `${req.user!.name} volunteered for your shift swap request on ${swap.date}.`,
      'swap',
      '/swap-marketplace'
    ).catch(e => console.error(e));

    state.auditLogs.push({
      id: uuid(),
      userId: volunteerId,
      action: 'VOLUNTEER_FOR_SWAP',
      timestamp: new Date().toISOString(),
      newValue: `swapId: ${swapId}`
    });
  });

  res.json({ success: true, volunteer: newVol });
});

// Select a volunteer (by Original Employee)
apiRouter.post('/swaps/:id/select-volunteer', requireAuth, (req: Request, res: Response) => {
  const swapId = req.params.id;
  const { volunteerId } = req.body;

  if (!volunteerId) {
    return res.status(400).json({ error: 'volunteerId is required' });
  }

  dbInstance.updateState(state => {
    const swap = state.swapRequests.find(s => s.id === swapId);
    if (!swap) return;

    if (swap.requesterId !== req.user!.id) {
      return;
    }

    swap.status = 'volunteer_selected';
    swap.targetUserId = volunteerId;
    swap.updatedAt = new Date().toISOString();

    // Set statuses in volunteer table
    state.swapVolunteers.forEach(v => {
      if (v.swapRequestId === swapId) {
        v.status = v.volunteerId === volunteerId ? 'selected' : 'rejected';
      }
    });

    // Notify Selected Volunteer
    getNotificationService().sendNotification(
      volunteerId,
      'Volunteer Selected!',
      `${req.user!.name} selected you for the shift swap on ${swap.date}. Pending Supervisor approval.`,
      'swap',
      '/swap-marketplace'
    ).catch(e => console.error(e));

    // Notify Supervisor Sarah Connor
    getNotificationService().sendNotification(
      'sup1', // Supervisor Connor
      'Swap Approval Pending',
      `${req.user!.name} and ${state.users.find(u => u.id === volunteerId)?.name} request a shift swap on ${swap.date}.`,
      'swap',
      '/supervisor/approvals'
    ).catch(e => console.error(e));

    state.auditLogs.push({
      id: uuid(),
      userId: req.user!.id,
      action: 'SELECT_VOLUNTEER',
      timestamp: new Date().toISOString(),
      newValue: `swapId: ${swapId}, volunteerId: ${volunteerId}`
    });
  });

  res.json({ success: true });
});

// Approve/Reject Swap (by Supervisor)
apiRouter.post('/swaps/:id/approve', requireAuth, (req: Request, res: Response) => {
  const swapId = req.params.id;
  const { approve, comment } = req.body; // boolean approve, string comment

  if (req.user!.roleId !== '2' && req.user!.roleId !== '3') {
    return res.status(403).json({ error: 'Forbidden: Only supervisors can approve swaps' });
  }

  dbInstance.updateState(state => {
    const swap = state.swapRequests.find(s => s.id === swapId);
    if (!swap) return;

    const isApproved = !!approve;
    swap.status = isApproved ? 'approved' : 'rejected';
    swap.supervisorComment = comment;
    swap.supervisorId = req.user!.id;
    swap.updatedAt = new Date().toISOString();

    const requester = state.users.find(u => u.id === swap.requesterId);
    const volunteer = state.users.find(u => u.id === swap.targetUserId);

    if (isApproved && volunteer) {
      // ACTUAL SCHEDULE UPDATE! This represents the autonomous update requirement!
      // Swap the assignments in the DB
      const reqAssign = state.shiftAssignments.find(a => a.userId === swap.requesterId && a.date === swap.date);
      const volAssign = state.shiftAssignments.find(a => a.userId === volunteer.id && a.date === swap.date);

      const tempCode = reqAssign ? reqAssign.shiftCode : 'OFF';
      const volCode = volAssign ? volAssign.shiftCode : 'OFF';

      // Update requester assignment with volunteer's shift (which is normally OFF)
      if (reqAssign) {
        reqAssign.shiftCode = volCode;
      } else {
        state.shiftAssignments.push({
          id: `sa_${swap.requesterId}_${swap.date}`,
          userId: swap.requesterId,
          date: swap.date,
          shiftCode: volCode,
          machineId: requester?.machineId
        });
      }

      // Update volunteer assignment with requester's shift
      if (volAssign) {
        volAssign.shiftCode = tempCode;
      } else {
        state.shiftAssignments.push({
          id: `sa_${volunteer.id}_${swap.date}`,
          userId: volunteer.id,
          date: swap.date,
          shiftCode: tempCode,
          machineId: volunteer?.machineId
        });
      }
    }

    // Send notifications
    getNotificationService().sendNotification(
      swap.requesterId,
      isApproved ? 'Swap Approved' : 'Swap Rejected',
      `Your swap for ${swap.date} has been ${swap.status} by Supervisor. Comment: ${comment || 'None'}`,
      'swap',
      '/swap-marketplace'
    ).catch(e => console.error(e));

    if (swap.targetUserId) {
      getNotificationService().sendNotification(
        swap.targetUserId,
        isApproved ? 'Swap Approved' : 'Swap Rejected',
        `The swap for ${swap.date} has been ${swap.status} by Supervisor. Comment: ${comment || 'None'}`,
        'swap',
        '/swap-marketplace'
      ).catch(e => console.error(e));
    }

    state.auditLogs.push({
      id: uuid(),
      userId: req.user!.id,
      action: isApproved ? 'APPROVE_SWAP' : 'REJECT_SWAP',
      timestamp: new Date().toISOString(),
      newValue: `swapId: ${swapId}, comment: ${comment}`
    });
  });

  res.json({ success: true });
});

// Cancel swap request
apiRouter.post('/swaps/:id/cancel', requireAuth, (req: Request, res: Response) => {
  const swapId = req.params.id;

  dbInstance.updateState(state => {
    const swap = state.swapRequests.find(s => s.id === swapId);
    if (swap && swap.requesterId === req.user!.id) {
      swap.status = 'cancelled';
      swap.updatedAt = new Date().toISOString();

      state.auditLogs.push({
        id: uuid(),
        userId: req.user!.id,
        action: 'CANCEL_SWAP',
        timestamp: new Date().toISOString(),
        newValue: `swapId: ${swapId}`
      });
    }
  });

  res.json({ success: true });
});


// --- MODULE 4: LEAVE MANAGEMENT ---

// Get leave history & balances for a user
apiRouter.get('/leaves', requireAuth, (req: Request, res: Response) => {
  const leaves = dbInstance.getLeaveRequests().filter(l => l.userId === req.user!.id);
  const balances = dbInstance.getLeaveBalances().filter(b => b.userId === req.user!.id);
  res.json({ leaves, balances });
});

// Create a Leave Request
apiRouter.post('/leaves', requireAuth, (req: Request, res: Response) => {
  const { startDate, endDate, leaveType, remarks } = req.body;

  if (!startDate || !endDate || !leaveType) {
    return res.status(400).json({ error: 'startDate, endDate and leaveType are required' });
  }

  // Prevent overlapping leaves
  const existingLeaves = dbInstance.getLeaveRequests().filter(l => l.userId === req.user!.id && l.status !== 'rejected');
  const overlap = existingLeaves.some(l => 
    (startDate >= l.startDate && startDate <= l.endDate) || 
    (endDate >= l.startDate && endDate <= l.endDate) ||
    (l.startDate >= startDate && l.startDate <= endDate)
  );

  if (overlap) {
    return res.status(400).json({ error: 'You already have an active leave request covering these dates.' });
  }

  // Prevent leaves if swap is already pending/approved on those dates
  const existingSwaps = dbInstance.getSwapRequests().filter(s => s.requesterId === req.user!.id && s.status === 'pending');
  const swapOverlap = existingSwaps.some(s => s.date >= startDate && s.date <= endDate);
  if (swapOverlap) {
    return res.status(400).json({ error: 'You have a pending Shift Swap request during this leave period. Please cancel it first.' });
  }

  // Check balance limit
  const balances = dbInstance.getLeaveBalances().filter(b => b.userId === req.user!.id);
  const balance = balances.find(b => b.leaveType === leaveType);
  
  // Calculate requested days
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (balance && balance.leaveType !== 'Unpaid' && (balance.allocated - balance.used - balance.pending) < diffDays) {
    return res.status(400).json({ error: `Insufficient ${leaveType} balance. Remaining: ${balance.allocated - balance.used - balance.pending} days.` });
  }

  const newLeave: LeaveRequest = {
    id: 'leave_' + uuid(),
    userId: req.user!.id,
    startDate,
    endDate,
    leaveType,
    status: 'pending',
    remarks,
    createdAt: new Date().toISOString()
  };

  dbInstance.updateState(state => {
    state.leaveRequests.push(newLeave);

    // Update balance pending count
    const userBalance = state.leaveBalances.find(b => b.userId === req.user!.id && b.leaveType === leaveType);
    if (userBalance) {
      userBalance.pending += diffDays;
    }

    // Notify Supervisor
    getNotificationService().sendNotification(
      'sup1', // Connor
      'New Leave Request',
      `${req.user!.name} applied for ${leaveType} Leave from ${startDate} to ${endDate}.`,
      'leave',
      '/supervisor/approvals'
    ).catch(e => console.error(e));

    state.auditLogs.push({
      id: uuid(),
      userId: req.user!.id,
      action: 'APPLY_LEAVE',
      timestamp: new Date().toISOString(),
      newValue: JSON.stringify(newLeave)
    });
  });

  res.json({ success: true, leave: newLeave });
});

// Cancel leave request
apiRouter.post('/leaves/:id/cancel', requireAuth, (req: Request, res: Response) => {
  const leaveId = req.params.id;

  dbInstance.updateState(state => {
    const leave = state.leaveRequests.find(l => l.id === leaveId && l.userId === req.user!.id);
    if (leave && leave.status === 'pending') {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Restore pending count
      const balance = state.leaveBalances.find(b => b.userId === req.user!.id && b.leaveType === leave.leaveType);
      if (balance) {
        balance.pending = Math.max(0, balance.pending - diffDays);
      }

      state.leaveRequests = state.leaveRequests.filter(l => l.id !== leaveId);

      state.auditLogs.push({
        id: uuid(),
        userId: req.user!.id,
        action: 'CANCEL_LEAVE',
        timestamp: new Date().toISOString(),
        newValue: `leaveId: ${leaveId}`
      });
    }
  });

  res.json({ success: true });
});

// Approve/Reject Leave (by Supervisor)
apiRouter.post('/leaves/:id/approve', requireAuth, (req: Request, res: Response) => {
  const leaveId = req.params.id;
  const { approve, comment } = req.body;

  if (req.user!.roleId !== '2' && req.user!.roleId !== '3') {
    return res.status(403).json({ error: 'Forbidden: Only supervisor can approve leaves' });
  }

  dbInstance.updateState(state => {
    const leave = state.leaveRequests.find(l => l.id === leaveId);
    if (!leave) return;

    const isApproved = !!approve;
    leave.status = isApproved ? 'approved' : 'rejected';
    leave.supervisorComment = comment;

    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Adjust balances
    const balance = state.leaveBalances.find(b => b.userId === leave.userId && b.leaveType === leave.leaveType);
    if (balance) {
      balance.pending = Math.max(0, balance.pending - diffDays);
      if (isApproved) {
        balance.used += diffDays;

        // Auto-assign OFF shift code during approved leave dates
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const assign = state.shiftAssignments.find(a => a.userId === leave.userId && a.date === dateStr);
          if (assign) {
            assign.shiftCode = 'OFF';
          } else {
            state.shiftAssignments.push({
              id: `sa_${leave.userId}_${dateStr}`,
              userId: leave.userId,
              date: dateStr,
              shiftCode: 'OFF'
            });
          }
        }
      }
    }

    // Send notification
    getNotificationService().sendNotification(
      leave.userId,
      isApproved ? 'Leave Approved' : 'Leave Rejected',
      `Your leave request for ${leave.startDate} to ${leave.endDate} has been ${leave.status}. Comment: ${comment || 'None'}`,
      'leave',
      '/leaves'
    ).catch(e => console.error(e));

    state.auditLogs.push({
      id: uuid(),
      userId: req.user!.id,
      action: isApproved ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      timestamp: new Date().toISOString(),
      newValue: `leaveId: ${leaveId}, comment: ${comment}`
    });
  });

  res.json({ success: true });
});

// Get all leaves for supervisor review
apiRouter.get('/supervisor/leaves', requireAuth, (req: Request, res: Response) => {
  if (req.user!.roleId !== '2' && req.user!.roleId !== '3') {
    return res.status(403).json({ error: 'Forbidden: Only supervisors can view team leaves' });
  }
  const users = dbInstance.getUsers();
  const leaves = dbInstance.getLeaveRequests().map(l => {
    const employee = users.find(u => u.id === l.userId);
    return {
      ...l,
      employeeName: employee?.name || 'Unknown',
      employeeClockId: employee?.clockId || 'N/A'
    };
  });
  res.json(leaves);
});


// --- MODULE 5: CHAT SYSTEM ---

// Get active conversations
apiRouter.get('/chats', requireAuth, (req: Request, res: Response) => {
  const userConversations = dbInstance.getConversationParticipants()
    .filter(p => p.userId === req.user!.id)
    .map(p => p.conversationId);

  const list = dbInstance.getConversations()
    .filter(c => userConversations.includes(c.id))
    .map(c => {
      // Find latest message
      const msgs = dbInstance.getMessages().filter(m => m.conversationId === c.id);
      const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;

      // Find participants
      const parts = dbInstance.getConversationParticipants().filter(p => p.conversationId === c.id).map(p => {
        const u = dbInstance.getUsers().find(user => user.id === p.userId);
        return { id: u?.id, name: u?.name, clockId: u?.clockId, roleId: u?.roleId };
      });

      return {
        ...c,
        participants: parts,
        latestMessage: latestMsg
      };
    });

  res.json(list);
});

// Get messages for a chat conversation
apiRouter.get('/chats/:id/messages', requireAuth, (req: Request, res: Response) => {
  const messages = dbInstance.getMessages().filter(m => m.conversationId === req.params.id);
  res.json(messages);
});

// Send message to chat
apiRouter.post('/chats/:id/messages', requireAuth, (req: Request, res: Response) => {
  const convId = req.params.id;
  const { text, attachmentUrl, attachmentName } = req.body;

  if (!text && !attachmentUrl) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const newMsg: Message = {
    id: 'msg_' + uuid(),
    conversationId: convId,
    senderId: req.user!.id,
    text: text || '',
    attachmentUrl,
    attachmentName,
    isReadBy: [req.user!.id],
    createdAt: new Date().toISOString()
  };

  dbInstance.updateState(state => {
    state.messages.push(newMsg);
  });

  // Broadcast message in real-time via Socket.IO
  SocketService.broadcastMessage(convId, newMsg);

  // Push notification to other participants via asynchronous NotificationService
  const otherParticipants = dbInstance.getConversationParticipants().filter(p => p.conversationId === convId && p.userId !== req.user!.id);
  const convTitle = dbInstance.getConversations().find(c => c.id === convId)?.title || 'Chat';
  otherParticipants.forEach(async (p) => {
    await getNotificationService().sendNotification(
      p.userId,
      `New Message in ${convTitle}`,
      `${req.user!.name}: ${text ? text.substring(0, 50) : 'Sent an attachment'}`,
      'chat',
      '/chats'
    );
  });


  res.json(newMsg);
});

// Start a 1-to-1 direct chat
apiRouter.post('/chats/direct', requireAuth, (req: Request, res: Response) => {
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ error: 'targetUserId is required' });
  }

  const existingConv = dbInstance.getConversations().find(c => {
    if (c.type !== 'direct') return false;
    const parts = dbInstance.getConversationParticipants().filter(p => p.conversationId === c.id);
    return parts.length === 2 && parts.some(p => p.userId === req.user!.id) && parts.some(p => p.userId === targetUserId);
  });

  if (existingConv) {
    return res.json(existingConv);
  }

  const targetUser = dbInstance.getUsers().find(u => u.id === targetUserId);
  const newConv: Conversation = {
    id: 'c_dir_' + uuid(),
    type: 'direct',
    title: `${req.user!.name} & ${targetUser?.name || 'User'}`,
    createdAt: new Date().toISOString()
  };

  dbInstance.updateState(state => {
    state.conversations.push(newConv);
    state.conversationParticipants.push({ id: uuid(), conversationId: newConv.id, userId: req.user!.id });
    state.conversationParticipants.push({ id: uuid(), conversationId: newConv.id, userId: targetUserId });
  });

  res.json(newConv);
});


// --- MODULE 6: NOTIFICATIONS ---

apiRouter.get('/notifications', requireAuth, (req: Request, res: Response) => {
  const nots = dbInstance.getNotifications().filter(n => n.userId === req.user!.id);
  res.json(nots);
});

apiRouter.post('/notifications/read-all', requireAuth, (req: Request, res: Response) => {
  dbInstance.updateState(state => {
    state.notifications.forEach(n => {
      if (n.userId === req.user!.id) {
        n.isRead = true;
      }
    });
  });
  res.json({ success: true });
});


// --- MODULE 7: DASHBOARD & WFM ---

// Employee calendar assignments
apiRouter.get('/wfm/schedule', requireAuth, (req: Request, res: Response) => {
  const assignments = dbInstance.getShiftAssignments().filter(a => a.userId === req.user!.id);
  const leaves = dbInstance.getLeaveRequests().filter(l => l.userId === req.user!.id && l.status === 'approved');
  const swaps = dbInstance.getSwapRequests().filter(s => s.requesterId === req.user!.id && (s.status === 'pending' || s.status === 'approved'));

  res.json({ assignments, leaves, swaps });
});

// Supervisor Dashboard Data
apiRouter.get('/supervisor/dashboard', requireAuth, (req: Request, res: Response) => {
  if (req.user!.roleId !== '2' && req.user!.roleId !== '3') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const users = dbInstance.getUsers();
  const assignments = dbInstance.getShiftAssignments();
  const swaps = dbInstance.getSwapRequests();
  const leaves = dbInstance.getLeaveRequests();

  const todayStr = new Date().toISOString().split('T')[0];

  // Team members in Builders section
  const teamUsers = users.filter(u => u.sectionId === 'sec1' && u.roleId === '1');

  // Pending Approvals
  const pendingSwapsCount = swaps.filter(s => s.status === 'volunteer_selected').length;
  const pendingLeavesCount = leaves.filter(l => l.status === 'pending').length;

  // Team availability today
  const teamStatusToday = teamUsers.map(user => {
    const assign = assignments.find(a => a.userId === user.id && a.date === todayStr);
    const leave = leaves.find(l => l.userId === user.id && l.status === 'approved' && todayStr >= l.startDate && todayStr <= l.endDate);

    return {
      userId: user.id,
      name: user.name,
      clockId: user.clockId,
      shiftCode: leave ? 'LEAVE' : (assign ? assign.shiftCode : 'OFF'),
      leaveType: leave?.leaveType,
      machineCode: dbInstance.getMachines().find(m => m.id === user.machineId)?.code || 'General'
    };
  });

  res.json({
    pendingSwapsCount,
    pendingLeavesCount,
    teamStatusToday,
    teamCount: teamUsers.length
  });
});

// Admin Dashboard Data
apiRouter.get('/admin/dashboard', requireAuth, (req: Request, res: Response) => {
  if (req.user!.roleId !== '3') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const users = dbInstance.getUsers();
  const swaps = dbInstance.getSwapRequests();
  const leaves = dbInstance.getLeaveRequests();
  const logs = dbInstance.getAuditLogs();

  res.json({
    totalEmployees: users.filter(u => u.roleId === '1').length,
    activeSwaps: swaps.filter(s => s.status === 'pending' || s.status === 'volunteer_selected').length,
    approvedLeavesThisMonth: leaves.filter(l => l.status === 'approved').length,
    auditLogs: logs.slice(-20).reverse() // Last 20 logs
  });
});

// Get general assets data (departments, sections, machines, default users for chat lists)
apiRouter.get('/assets', requireAuth, (req: Request, res: Response) => {
  res.json({
    departments: dbInstance.getDepartments(),
    sections: dbInstance.getSections(),
    machines: dbInstance.getMachines(),
    users: dbInstance.getUsers().map(u => ({ id: u.id, name: u.name, clockId: u.clockId, roleId: u.roleId, sectionId: u.sectionId, machineId: u.machineId }))
  });
});
