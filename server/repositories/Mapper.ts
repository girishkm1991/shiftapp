import { User, Role, Department, Section, Team, Machine, Skill, EmployeeSkill, EmployeeMachineMapping, EmployeeDefaultShiftPattern, Shift, ShiftAssignment, ShiftTemplate, SwapRequest, SwapVolunteer, LeaveRequest, LeaveBalance, Conversation, ConversationParticipant, Message, Notification, Holiday, AuditLog, SystemSetting, SwapReviewRequest, SwapReviewAssignment, SwapReviewDecision } from '../../src/types';

export class Mapper {
  public static mapUser(row: any): User {
    return {
      id: row.id,
      clockId: row.clock_id,
      name: row.name,
      passwordHash: row.password_hash,
      roleId: row.role_id,
      mobile: row.mobile || undefined,
      email: row.email || undefined,
      departmentId: row.department_id || undefined,
      sectionId: row.section_id || undefined,
      machineId: row.machine_id || undefined,
      status: row.status,
      rememberMeToken: row.remember_me_token || undefined,
      onboardingCompletedAt: row.onboarding_completed_at ? new Date(row.onboarding_completed_at).toISOString() : undefined,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  public static mapRole(row: any): Role {
    return {
      id: row.id,
      name: row.name
    };
  }

  public static mapDepartment(row: any): Department {
    return {
      id: row.id,
      name: row.name
    };
  }

  public static mapSection(row: any): Section {
    return {
      id: row.id,
      name: row.name,
      departmentId: row.department_id
    };
  }

  public static mapTeam(row: any): Team {
    return {
      id: row.id,
      name: row.name,
      supervisorId: row.supervisor_id
    };
  }

  public static mapMachine(row: any): Machine {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      sectionId: row.section_id
    };
  }

  public static mapSkill(row: any): Skill {
    return {
      id: row.id,
      name: row.name,
      code: row.code
    };
  }

  public static mapEmployeeSkill(row: any): EmployeeSkill {
    return {
      id: row.id,
      userId: row.user_id,
      skillId: row.skill_id,
      certificationDate: row.certification_date ? new Date(row.certification_date).toISOString().split('T')[0] : '',
      expiryDate: row.expiry_date ? new Date(row.expiry_date).toISOString().split('T')[0] : ''
    };
  }

  public static mapEmployeeMachineMapping(row: any): EmployeeMachineMapping {
    return {
      id: row.id,
      userId: row.user_id,
      machineId: row.machine_id,
      isCertified: !!row.is_certified
    };
  }

  public static mapEmployeeDefaultShiftPattern(row: any): EmployeeDefaultShiftPattern {
    return {
      id: row.id,
      userId: row.user_id,
      dayOfWeek: row.day_of_week,
      shiftCode: row.shift_code
    };
  }

  public static mapShift(row: any): Shift {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      startTime: row.start_time,
      endTime: row.end_time
    };
  }

  public static mapShiftAssignment(row: any): ShiftAssignment {
    return {
      id: row.id,
      userId: row.user_id,
      date: row.date ? new Date(row.date).toISOString().split('T')[0] : '',
      shiftCode: row.shift_code,
      machineId: row.machine_id || undefined
    };
  }

  public static mapShiftTemplate(row: any): ShiftTemplate {
    return {
      id: row.id,
      name: row.name,
      rotationDays: row.rotation_days
    };
  }

  public static mapSwapRequest(row: any): SwapRequest {
    return {
      id: row.id,
      requesterId: row.requester_id,
      date: row.date ? new Date(row.date).toISOString().split('T')[0] : '',
      shiftCode: row.shift_code,
      requestedShiftCode: row.requested_shift_code || undefined,
      swapType: row.swap_type as any,
      targetUserId: row.target_user_id || undefined,
      status: row.status as any,
      supervisorComment: row.supervisor_comment || undefined,
      incentiveOffered: !!row.incentive_offered,
      incentiveAmount: row.incentive_amount ? Number(row.incentive_amount) : 0,
      remarks: row.remarks || undefined,
      supervisorId: row.supervisor_id || undefined,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  public static mapSwapVolunteer(row: any): SwapVolunteer {
    return {
      id: row.id,
      swapRequestId: row.swap_request_id,
      volunteerId: row.volunteer_id,
      status: row.status as any,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  public static mapLeaveRequest(row: any): LeaveRequest {
    return {
      id: row.id,
      userId: row.user_id,
      startDate: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : '',
      endDate: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : '',
      leaveType: row.leave_type as any,
      status: row.status as any,
      remarks: row.remarks || undefined,
      supervisorComment: row.supervisor_comment || undefined,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  public static mapLeaveBalance(row: any): LeaveBalance {
    return {
      id: row.id,
      userId: row.user_id,
      leaveType: row.leave_type as any,
      allocated: row.allocated,
      used: row.used,
      pending: row.pending
    };
  }

  public static mapConversation(row: any): Conversation {
    return {
      id: row.id,
      type: row.type as any,
      title: row.title || undefined,
      swapRequestId: row.swap_request_id || undefined,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  public static mapConversationParticipant(row: any): ConversationParticipant {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      userId: row.user_id
    };
  }

  public static mapMessage(row: any): Message {
    let isReadBy: string[] = [];
    if (row.is_read_by) {
      try {
        isReadBy = JSON.parse(row.is_read_by);
      } catch (e) {
        if (typeof row.is_read_by === 'string') {
          isReadBy = row.is_read_by.split(',').filter(Boolean);
        }
      }
    }
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      text: row.text,
      attachmentUrl: row.attachment_url || undefined,
      attachmentName: row.attachment_name || undefined,
      isReadBy,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  public static mapNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      body: row.body,
      type: row.type as any,
      isRead: !!row.is_read,
      link: row.link || undefined,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  public static mapHoliday(row: any): Holiday {
    return {
      id: row.id,
      date: row.date ? new Date(row.date).toISOString().split('T')[0] : '',
      name: row.name,
      isCompanyPaid: !!row.is_company_paid
    };
  }

  public static mapAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      userId: row.user_id,
      action: row.action,
      timestamp: new Date(row.timestamp).toISOString(),
      oldValue: row.old_value || undefined,
      newValue: row.new_value || undefined
    };
  }

  public static mapSystemSetting(row: any): SystemSetting {
    return {
      id: row.id,
      key: row.key,
      value: row.value,
      description: row.description || undefined
    };
  }

  public static mapSwapReviewRequest(row: any): SwapReviewRequest {
    return {
      id: row.id,
      swapRequestId: row.swap_request_id,
      volunteerUserId: row.volunteer_user_id,
      status: row.status as any,
      approvalsRequired: row.approvals_required,
      approvalsReceived: row.approvals_received,
      rejectionsReceived: row.rejections_received,
      createdAt: new Date(row.created_at).toISOString(),
      finalizedAt: row.finalized_at ? new Date(row.finalized_at).toISOString() : undefined
    };
  }

  public static mapSwapReviewAssignment(row: any): SwapReviewAssignment {
    return {
      id: row.id,
      reviewRequestId: row.review_request_id,
      reviewerUserId: row.reviewer_user_id,
      assignedAt: new Date(row.assigned_at).toISOString()
    };
  }

  public static mapSwapReviewDecision(row: any): SwapReviewDecision {
    return {
      id: row.id,
      reviewRequestId: row.review_request_id,
      reviewerUserId: row.reviewer_user_id,
      decision: row.decision as any,
      comments: row.comments || undefined,
      decidedAt: new Date(row.decided_at).toISOString()
    };
  }
}
