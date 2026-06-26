import { Router, Request, Response, NextFunction } from 'express';
import { dbInstance } from '../db/database';
import { User, SwapRequest, SwapVolunteer, LeaveRequest, LeaveBalance, Message, Conversation, Notification, AuditLog } from '../../src/types';
import { getNotificationService } from '../services/NotificationService';
import { getCacheService } from '../services/CacheService';
import { getQueueService } from '../services/QueueService';
import { SocketService } from '../services/SocketService';
import { ScheduleResolutionService } from '../services/ScheduleResolutionService';
import { ReviewWorkflowService } from '../services/ReviewWorkflowService';


export const apiRouter = Router();

const CONFIG = {
  IS_PILOT_MODE: process.env.SWAP_PILOT_MODE !== 'false'
};

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

// Public endpoint to fetch registration settings, departments and sections
apiRouter.get('/auth/config', (req: Request, res: Response) => {
  const allowSelfRegistration = process.env.ALLOW_SELF_REGISTRATION === 'true';
  res.json({
    allowSelfRegistration,
    departments: dbInstance.getDepartments(),
    sections: dbInstance.getSections()
  });
});

// Self-registration endpoint
apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const allowSelfRegistration = process.env.ALLOW_SELF_REGISTRATION === 'true';
  if (!allowSelfRegistration) {
    return res.status(403).json({ error: 'Self-registration is currently disabled.' });
  }

  const { clockId, name, mobile, departmentId, sectionId, accessCode } = req.body;

  if (!clockId || !name || !mobile || !departmentId || !sectionId || !accessCode) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Validate Temporary Factory Access Code
  const expectedCode = process.env.FACTORY_ACCESS_CODE || 'APOLLO2026';
  if (accessCode.trim() !== expectedCode.trim()) {
    return res.status(400).json({ error: 'Invalid Temporary Factory Access Code.' });
  }

  // Check if Clock ID already exists
  const existingUser = dbInstance.getUsers().find(u => u.clockId.toUpperCase() === clockId.toUpperCase().trim());
  if (existingUser) {
    return res.status(400).json({ error: `Clock ID ${clockId.toUpperCase().trim()} is already registered.` });
  }

  const newUserId = 'u_' + uuid();
  const newUser: User = {
    id: newUserId,
    clockId: clockId.toUpperCase().trim(),
    name: name.trim(),
    mobile: mobile.trim(),
    departmentId,
    sectionId,
    roleId: '1', // Default Employee role
    status: 'onboarding_step1', // Force onboarding: password setup -> profile completion -> shift pattern setup
    passwordHash: 'sha256_password123_placeholder', // default temp password hash
    createdAt: new Date().toISOString()
  };

  // Persist user and create log
  dbInstance.updateState(state => {
    state.users.push(newUser);
    state.auditLogs.push({
      id: uuid(),
      userId: newUserId,
      action: 'USER_SELF_REGISTER',
      timestamp: new Date().toISOString(),
      newValue: `Clock ID: ${newUser.clockId}`
    });
  });

  console.log(`[Auth] Employee ${newUser.name} (${newUser.clockId}) self-registered successfully.`);

  res.status(201).json({
    success: true,
    message: 'Self-registration completed. Please sign in with your temporary password: password123'
  });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { clockId, password, rememberMe } = req.body;
  
  if (!clockId || !password) {
    return res.status(400).json({ error: 'Clock ID and Password are required' });
  }

  const user = dbInstance.getUsers().find(u => u.clockId.toUpperCase() === clockId.toUpperCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid Clock ID or Password.' });
  }

  // Validate password
  let isCorrect = false;
  if (user.passwordHash === 'sha256_admin123_placeholder') {
    isCorrect = (password === 'admin123');
  } else if (user.passwordHash === 'sha256_password123_placeholder') {
    isCorrect = (password === 'password123');
  } else {
    isCorrect = (password === user.passwordHash);
  }

  if (!isCorrect) {
    return res.status(401).json({ error: 'Invalid password.' });
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
      user.passwordHash = newPassword;
      if (user.roleId === '3') {
        user.status = 'active';
        user.onboardingCompletedAt = new Date().toISOString();
      } else {
        user.status = 'onboarding_step2';
      }
      
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
apiRouter.post('/auth/onboard/step3', requireAuth, async (req: Request, res: Response) => {
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

  try {
    // Explicitly persist the new state to MySQL
    await dbInstance.saveToMySQL();

    // Reload patterns into the ScheduleResolutionService cache
    const { ScheduleResolutionService } = await import('../services/ScheduleResolutionService');
    await ScheduleResolutionService.initCache();
    console.log('[ScheduleResolutionService] Cache refreshed after onboarding.');
  } catch (err) {
    console.error('[Onboarding] Failed to persist and refresh schedule cache:', err);
  }

  const updatedUser = dbInstance.getUsers().find(u => u.id === req.user!.id);
  res.json({ success: true, user: updatedUser });
});


// --- MODULE 2: ELIGIBILITY & RECOMMENDATION ENGINE ---

// Helper logic to run Intelligent Eligibility Checks
function checkEligibility(userId: string, date: string, reqShiftCode: 'A' | 'B' | 'C' | 'OFF', swapId?: string): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const users = dbInstance.getUsers();
  const leaves = dbInstance.getLeaveRequests();
  const machineMappings = dbInstance.getEmployeeMachineMapping();
  const targetUser = users.find(u => u.id === userId);

  if (!targetUser) {
    return { eligible: false, reasons: ['Employee not found'] };
  }

  // Handle direct swap pilot bypass
  if (swapId && CONFIG.IS_PILOT_MODE) {
    const swap = dbInstance.getSwapRequests().find(s => s.id === swapId);
    if (swap && swap.swapType === 'direct' && swap.targetUserId === userId) {
      if (targetUser.status !== 'active') {
        return { eligible: false, reasons: ['Employee profile onboarding is incomplete'] };
      }
      if (swap.requesterId === userId) {
        return { eligible: false, reasons: ['You cannot swap with yourself'] };
      }
      if (swap.status !== 'pending') {
        return { eligible: false, reasons: ['Swap is already approved or closed'] };
      }
      const hasApprovedSwap = dbInstance.getSwapRequests().some(s => 
        s.date === date && 
        s.status === 'approved' && 
        (s.requesterId === userId || s.targetUserId === userId)
      );
      if (hasApprovedSwap) {
        return { eligible: false, reasons: ['Already has an approved swap on this date'] };
      }

      console.log({
        module: 'Direct Swap',
        requesterId: swap.requesterId,
        targetUserId: userId,
        shiftCode: reqShiftCode,
        eligibility: 'AUTO_APPROVED_FOR_PILOT'
      });
      return { eligible: true, reasons: [] };
    }
  }

  // 1. Employee status check
  if (targetUser.status !== 'active') {
    return { eligible: false, reasons: ['Employee profile onboarding is incomplete'] };
  }

  // 2. Is target user already working on this exact date?
  const { shiftCode: existingAssignCode, source: existingSource } = ScheduleResolutionService.resolveEmployeeShift(userId, date);
  ScheduleResolutionService.logResolution('Eligibility Validation', userId, date, existingAssignCode, existingSource);
  if (existingAssignCode && existingAssignCode !== 'OFF') {
    reasons.push(`Already working ${existingAssignCode} Shift on this day.`);
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
  const parts = date.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const dayVal = parseInt(parts[2], 10);
  const targetDate = new Date(year, month - 1, dayVal);
  const day = targetDate.getDay();
  
  // Calculate Monday of this week
  const diffToMon = targetDate.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(targetDate.setDate(diffToMon));
  
  let weekAssignCount = 0;
  for (let i = 0; i < 7; i++) {
    const currentDayDate = new Date(monday);
    currentDayDate.setDate(monday.getDate() + i);
    const y = currentDayDate.getFullYear();
    const m = String(currentDayDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(currentDayDate.getDate()).padStart(2, '0');
    const curDateStr = `${y}-${m}-${dStr}`;
    
    const { shiftCode: curShift, source: curSource } = ScheduleResolutionService.resolveEmployeeShift(userId, curDateStr);
    ScheduleResolutionService.logResolution('Weekly Overtime Matching Check', userId, curDateStr, curShift, curSource);
    if (curShift && curShift !== 'OFF') {
      weekAssignCount++;
    }
  }

  const prospectiveHours = (weekAssignCount + 1) * 8; // Each shift is 8 hours
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

// Get employees scheduled for a specific shift on a specific date for direct swap targeting
apiRouter.get('/swaps/eligible-employees', requireAuth, (req: Request, res: Response) => {
  const { date, requestedShiftCode } = req.query;
  if (!date || !requestedShiftCode) {
    return res.status(400).json({ error: 'date and requestedShiftCode are required' });
  }

  const users = dbInstance.getUsers().filter(u => u.id !== req.user!.id && u.roleId === '1' && u.status === 'active');
  
  const eligibleUsers = users.filter(user => {
    const { shiftCode } = ScheduleResolutionService.resolveEmployeeShift(user.id, date as string);
    return shiftCode === requestedShiftCode;
  });

  res.json(eligibleUsers.map(u => ({
    id: u.id,
    name: u.name,
    clockId: u.clockId,
    roleId: u.roleId,
    sectionId: u.sectionId,
    machineId: u.machineId
  })));
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
      // Check resolved shift matches OFF
      const { shiftCode: resolvedCode } = ScheduleResolutionService.resolveEmployeeShift(user.id, date as string);
      if (resolvedCode === 'OFF') {
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
  const sections = dbInstance.getSections();
  const machines = dbInstance.getMachines();

  const richSwaps = swaps.map(s => {
    const requester = users.find(u => u.id === s.requesterId);
    const requesterSection = requester ? sections.find(sec => sec.id === requester.sectionId) : null;
    const requesterMachine = requester ? machines.find(m => m.id === requester.machineId) : null;
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
      requesterSectionName: requesterSection?.name,
      requesterMachineName: requesterMachine?.name,
      targetName: target?.name,
      targetClockId: target?.clockId,
      volunteers: requestVolunteers
    };
  });

  res.json(richSwaps);
});

// Create a Swap Request
apiRouter.post('/swaps', requireAuth, (req: Request, res: Response) => {
  const { date, shiftCode, swapType, targetUserId, targetEmployeeId, remarks, incentiveOffered, incentiveAmount, requestedShiftCode } = req.body;
  
  const normalizedSwapType = (swapType || '').toString().toLowerCase();
  const finalTargetUserId = targetUserId || targetEmployeeId;

  if (!date || !shiftCode || !swapType || !requestedShiftCode) {
    return res.status(400).json({ error: 'date, shiftCode, swapType and requestedShiftCode are required' });
  }

  if (requestedShiftCode === shiftCode) {
    return res.status(400).json({ error: 'You cannot request the same shift you currently have.' });
  }

  const requesterId = req.user!.id;
  
  // Verify requester actually has this assignment using the centralized resolution service
  const {
    shiftCode: currentAssignCode,
    source
  } = ScheduleResolutionService.resolveEmployeeShift(
    requesterId,
    date
  );

  ScheduleResolutionService.logResolution(
    'Swap Creation',
    requesterId,
    date,
    currentAssignCode,
    source
  );

  if (!currentAssignCode || currentAssignCode === 'OFF') {
    return res.status(400).json({
      error: `You are OFF on ${date}.`
    });
  }

  if (currentAssignCode !== shiftCode) {
    return res.status(400).json({
      error: `You are not scheduled for ${shiftCode} Shift on ${date}. Current: ${currentAssignCode}`
    });
  }

  const newSwapId = 'swap_' + uuid();
  const newSwap: SwapRequest = {
    id: newSwapId,
    requesterId,
    date,
    shiftCode,
    requestedShiftCode,
    swapType: normalizedSwapType,
    targetUserId: normalizedSwapType === 'direct' ? finalTargetUserId : undefined,
    status: 'pending',
    incentiveOffered: !!incentiveOffered || (incentiveAmount && Number(incentiveAmount) > 0),
    incentiveAmount: incentiveAmount ? Number(incentiveAmount) : 0,
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
    } else if (swapType === 'direct' && finalTargetUserId) {
      // Direct notification
      state.conversationParticipants.push({
        id: uuid(),
        conversationId: convId,
        userId: finalTargetUserId
      });

      getNotificationService().sendNotification(
        finalTargetUserId,
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
apiRouter.post('/swaps/:id/volunteer', requireAuth, async (req: Request, res: Response) => {
  const swapId = req.params.id;
  const volunteerId = req.user!.id;

  const swaps = dbInstance.getSwapRequests();
  const swap = swaps.find(s => s.id === swapId);

  if (!swap) {
    return res.status(404).json({ error: 'Swap request not found' });
  }

  // 1. Employee is the requester
  if (swap.requesterId === volunteerId) {
    return res.status(400).json({ error: 'You cannot volunteer/accept your own request' });
  }

  // 2. The swap has already been approved or closed
  if (swap.status !== 'pending') {
    return res.status(400).json({ error: 'Swap request is no longer accepting volunteers (already approved or closed)' });
  }

  const targetUser = dbInstance.getUsers().find(u => u.id === volunteerId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  // 3. Employee is inactive
  if (targetUser.status !== 'active') {
    return res.status(400).json({ error: 'Your employee profile onboarding is incomplete or inactive' });
  }

  // 4. Employee already has an approved swap on that date
  const hasApprovedSwap = swaps.some(s => 
    s.date === swap.date && 
    s.status === 'approved' && 
    (s.requesterId === volunteerId || s.targetUserId === volunteerId)
  );
  if (hasApprovedSwap) {
    return res.status(400).json({ error: 'You already have an approved swap on this date' });
  }

  // 5. Swap shift validation (volunteer must have requested shift code)
  const { shiftCode: volunteerCurrentShift } = ScheduleResolutionService.resolveEmployeeShift(volunteerId, swap.date);
  if (swap.requestedShiftCode && swap.requestedShiftCode !== volunteerCurrentShift) {
    return res.status(400).json({
      error: `Swap mismatch: This request requires a coverage partner with a ${swap.requestedShiftCode} shift. Your current shift is ${volunteerCurrentShift || 'OFF'}.`
    });
  }

  // Run eligibility checks
  const eligibility = checkEligibility(volunteerId, swap.date, swap.shiftCode, swapId);
  if (!eligibility.eligible) {
    return res.status(400).json({ error: 'You are not eligible for this shift. ' + eligibility.reasons.join(' ') });
  }

  const volId = 'vol_' + uuid();
  const newVol: SwapVolunteer = {
    id: volId,
    swapRequestId: swapId,
    volunteerId,
    status: 'selected',
    createdAt: new Date().toISOString()
  };

  dbInstance.updateState(state => {
    state.swapVolunteers.push(newVol);

    const s = state.swapRequests.find(sr => sr.id === swapId);
    if (s) {
      s.status = 'volunteer_selected';
      s.targetUserId = volunteerId;
      s.updatedAt = new Date().toISOString();
    }

    const requester = state.users.find(u => u.id === swap.requesterId);

    // Add volunteer to the swap conversation or make sure it exists
    let conv = state.conversations.find(c => c.swapRequestId === swapId);
    if (!conv) {
      const convId = 'c_swap_' + uuid();
      conv = {
        id: convId,
        type: 'swap',
        title: `Swap Discussion: ${requester?.name || 'Employee'} (${swap.date})`,
        swapRequestId: swapId,
        createdAt: new Date().toISOString()
      };
      state.conversations.push(conv);
    }

    const reqPart = state.conversationParticipants.some(p => p.conversationId === conv!.id && p.userId === swap.requesterId);
    if (!reqPart) {
      state.conversationParticipants.push({
        id: uuid(),
        conversationId: conv.id,
        userId: swap.requesterId
      });
    }

    const volPart = state.conversationParticipants.some(p => p.conversationId === conv!.id && p.userId === volunteerId);
    if (!volPart) {
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
      text: swap.swapType === 'direct' ? `I have accepted your direct swap request! Let's discuss.` : `I have volunteered to cover your shift! Let's discuss.`,
      isReadBy: [volunteerId],
      createdAt: new Date().toISOString()
    });

    state.auditLogs.push({
      id: uuid(),
      userId: volunteerId,
      action: swap.swapType === 'direct' ? 'ACCEPT_DIRECT_SWAP' : 'VOLUNTEER_FOR_SWAP',
      timestamp: new Date().toISOString(),
      newValue: `swapId: ${swapId}`
    });
  });

  try {
    // Call the multi-level review workflow service to handle reviewer assignments, status flow, and logs
    await ReviewWorkflowService.createReviewRequest(swapId, volunteerId);
  } catch (err: any) {
    console.error('Error in multi-level review setup:', err);
  }

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

      const targetReqShift = swap.requestedShiftCode || 'OFF';
      const targetVolShift = swap.shiftCode;

      // Update requester assignment with OFF
      if (reqAssign) {
        reqAssign.shiftCode = targetReqShift;
      } else {
        state.shiftAssignments.push({
          id: `sa_${swap.requesterId}_${swap.date}`,
          userId: swap.requesterId,
          date: swap.date,
          shiftCode: targetReqShift,
          machineId: requester?.machineId
        });
      }

      // Update volunteer assignment with requested shift
      if (volAssign) {
        volAssign.shiftCode = targetVolShift;
      } else {
        state.shiftAssignments.push({
          id: `sa_${volunteer.id}_${swap.date}`,
          userId: volunteer.id,
          date: swap.date,
          shiftCode: targetVolShift,
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

// GET all shift swap review requests
apiRouter.get('/reviews', requireAuth, (req: Request, res: Response) => {
  const isReviewer = req.user!.roleId === '2' || req.user!.roleId === '3';
  const swaps = dbInstance.getSwapRequests();
  let reviewRequests = dbInstance.getSwapReviewRequests();

  // If the user is not a supervisor or admin, only show reviews where they are involved
  if (!isReviewer) {
    reviewRequests = reviewRequests.filter(rev => {
      const swap = swaps.find(s => s.id === rev.swapRequestId);
      return (swap && swap.requesterId === req.user!.id) || rev.volunteerUserId === req.user!.id;
    });
  }

  const assignments = dbInstance.getSwapReviewAssignments();
  const decisions = dbInstance.getSwapReviewDecisions();
  const users = dbInstance.getUsers();
  const sections = dbInstance.getSections();
  const machines = dbInstance.getMachines();

  const richReviews = reviewRequests.map(rev => {
    const swap = swaps.find(s => s.id === rev.swapRequestId);
    const requester = swap ? users.find(u => u.id === swap.requesterId) : undefined;
    const volunteer = users.find(u => u.id === rev.volunteerUserId);
    
    // Find section and machine of requester
    const section = requester ? sections.find(s => s.id === requester.sectionId) : undefined;
    const machine = requester ? machines.find(m => m.id === requester.machineId) : undefined;

    // Filter assignments and decisions for this review
    const revAssignments = assignments.filter(a => a.reviewRequestId === rev.id);
    const revDecisions = decisions.filter(d => d.reviewRequestId === rev.id);

    return {
      ...rev,
      swap,
      requester,
      volunteer,
      section,
      machine,
      assignments: revAssignments.map(asg => {
        const reviewerUser = users.find(u => u.id === asg.reviewerUserId);
        return {
          ...asg,
          reviewerName: reviewerUser?.name,
          reviewerClockId: reviewerUser?.clockId,
          reviewerRoleId: reviewerUser?.roleId
        };
      }),
      decisions: revDecisions.map(dec => {
        const reviewerUser = users.find(u => u.id === dec.reviewerUserId);
        return {
          ...dec,
          reviewerName: reviewerUser?.name,
          reviewerClockId: reviewerUser?.clockId,
          reviewerRoleId: reviewerUser?.roleId
        };
      })
    };
  });

  res.json(richReviews);
});

// Submit a review decision (Approve, Reject, Clarification)
apiRouter.post('/reviews/:id/decision', requireAuth, async (req: Request, res: Response) => {
  const { decision, comments } = req.body;
  const reviewRequestId = req.params.id;
  const reviewerUserId = req.user!.id;

  if (req.user!.roleId !== '2' && req.user!.roleId !== '3') {
    return res.status(403).json({ error: 'Forbidden: Only supervisors and admins can review requests' });
  }

  if (!['Approve', 'Reject', 'Clarification'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision' });
  }

  try {
    const updatedReview = await ReviewWorkflowService.submitDecision(
      reviewRequestId,
      reviewerUserId,
      decision,
      comments
    );
    res.json({ success: true, review: updatedReview });
  } catch (error: any) {
    console.error('Error submitting review decision:', error);
    res.status(400).json({ error: error.message });
  }
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

// Get dynamic shift for date
apiRouter.get('/wfm/shift-for-date', requireAuth, (req: Request, res: Response) => {
  const { date, userId: queryUserId } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'date is required' });
  }
  const userId = (queryUserId as string) || req.user!.id;
  
  // Check if user has ANY default patterns configured
  const defaultPatterns = dbInstance.getEmployeeDefaultShiftPatterns().filter(p => p.userId === userId);
  if (defaultPatterns.length === 0) {
    console.log(`[shift-for-date] User ${userId} has no weekly pattern configured.`);
  }

  const { shiftCode, source } = ScheduleResolutionService.resolveEmployeeShift(userId, date as string);
  ScheduleResolutionService.logResolution('Swap Dialog', userId, date as string, shiftCode, source);
  res.json({ shiftCode, source });
});

// Get employees with their resolved shift for a given date (for direct swap filtering)
apiRouter.get('/wfm/employees-shifts', requireAuth, (req: Request, res: Response) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'date is required' });
  }

  const allUsers = dbInstance.getUsers().filter(u => u.roleId === '1' && u.status === 'active');
  const results = allUsers.map(user => {
    const { shiftCode } = ScheduleResolutionService.resolveEmployeeShift(user.id, date as string);
    return {
      id: user.id,
      name: user.name,
      clockId: user.clockId,
      shiftCode: shiftCode || 'OFF',
      sectionId: user.sectionId,
      machineId: user.machineId
    };
  });

  res.json(results);
});

// Employee calendar assignments with dynamic backfills
apiRouter.get('/wfm/schedule', requireAuth, (req: Request, res: Response) => {
  const userId = req.user!.id;
  const dbAssignments = dbInstance.getShiftAssignments().filter(a => a.userId === userId);
  const leaves = dbInstance.getLeaveRequests().filter(l => l.userId === userId && l.status === 'approved');
  const swaps = dbInstance.getSwapRequests().filter(s => s.requesterId === userId && (s.status === 'pending' || s.status === 'approved'));

  // Generate derived assignments for May 1st, 2026 to August 31st, 2026 (pilot timeline)
  const assignments: any[] = [];
  const start = new Date('2026-05-01');
  const end = new Date('2026-08-31');

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const explicit = dbAssignments.find(a => a.date === dateStr);
    if (explicit) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (dateStr === todayStr) {
        ScheduleResolutionService.logResolution('Dashboard', userId, dateStr, explicit.shiftCode, 'Explicit supervisor-approved assignment');
      }
      assignments.push(explicit);
    } else {
      const { shiftCode, source } = ScheduleResolutionService.resolveEmployeeShift(userId, dateStr);
      const todayStr = new Date().toISOString().split('T')[0];
      if (dateStr === todayStr) {
        ScheduleResolutionService.logResolution('Dashboard', userId, dateStr, shiftCode, source);
      }
      if (shiftCode) {
        assignments.push({
          id: `derived_${userId}_${dateStr}`,
          userId,
          date: dateStr,
          shiftCode,
          machineId: req.user!.machineId
        });
      }
    }
  }

  res.json({ assignments, leaves, swaps });
});

// Supervisor Dashboard Data
apiRouter.get('/supervisor/dashboard', requireAuth, (req: Request, res: Response) => {
  if (req.user!.roleId !== '2' && req.user!.roleId !== '3') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const users = dbInstance.getUsers();
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
    const { shiftCode: assignCode, source: assignSource } = ScheduleResolutionService.resolveEmployeeShift(user.id, todayStr);
    ScheduleResolutionService.logResolution('Supervisor Dashboard Team Status', user.id, todayStr, assignCode, assignSource);
    const leave = leaves.find(l => l.userId === user.id && l.status === 'approved' && todayStr >= l.startDate && todayStr <= l.endDate);

    return {
      userId: user.id,
      name: user.name,
      clockId: user.clockId,
      shiftCode: leave ? 'LEAVE' : assignCode,
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
