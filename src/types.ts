export interface Role {
  id: string;
  name: 'Employee' | 'Supervisor' | 'Admin';
}

export interface Department {
  id: string;
  name: string;
}

export interface Section {
  id: string;
  name: string;
  departmentId: string;
}

export interface Team {
  id: string;
  name: string;
  supervisorId: string;
}

export interface Machine {
  id: string;
  name: string;
  code: string;
  sectionId: string;
}

export interface Skill {
  id: string;
  name: string;
  code: string;
}

export interface EmployeeSkill {
  id: string;
  userId: string;
  skillId: string;
  certificationDate: string;
  expiryDate: string;
}

export interface MachineCertification {
  id: string;
  name: string;
  code: string;
}

export interface EmployeeMachineMapping {
  id: string;
  userId: string;
  machineId: string;
  isCertified: boolean;
}

export interface EmployeeDefaultShiftPattern {
  id: string;
  userId: string;
  dayOfWeek: number; // 0 (Sunday) to 6 (Saturday)
  shiftCode: 'A' | 'B' | 'C' | 'OFF';
}

export interface Shift {
  id: string;
  name: string;
  code: 'A' | 'B' | 'C' | 'OFF';
  startTime: string;
  endTime: string;
}

export interface ShiftAssignment {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  shiftCode: 'A' | 'B' | 'C' | 'OFF';
  machineId?: string;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  rotationDays: number;
}

export interface SwapRequest {
  id: string;
  requesterId: string;
  date: string; // YYYY-MM-DD
  shiftCode: 'A' | 'B' | 'C' | 'OFF';
  requestedShiftCode?: 'A' | 'B' | 'C' | 'OFF';
  swapType: 'direct' | 'open';
  targetUserId?: string; // For direct swaps
  status: 'pending' | 'volunteer_selected' | 'approved' | 'rejected' | 'cancelled';
  supervisorComment?: string;
  incentiveOffered: boolean;
  incentiveAmount?: number;
  remarks?: string;
  supervisorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SwapVolunteer {
  id: string;
  swapRequestId: string;
  volunteerId: string;
  status: 'pending' | 'selected' | 'rejected';
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  leaveType: 'Casual' | 'Sick' | 'Earned' | 'Emergency' | 'Unpaid';
  status: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  supervisorComment?: string;
  createdAt: string;
}

export interface LeaveBalance {
  id: string;
  userId: string;
  leaveType: 'Casual' | 'Sick' | 'Earned' | 'Emergency' | 'Unpaid';
  allocated: number;
  used: number;
  pending: number;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'swap';
  title?: string;
  swapRequestId?: string;
  createdAt: string;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachmentUrl?: string;
  attachmentName?: string;
  isReadBy: string[]; // List of userIds who read this
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'swap' | 'leave' | 'chat' | 'announcement';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  isCompanyPaid: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
}

// User schema with onboarding steps
export interface User {
  id: string;
  clockId: string;
  name: string;
  passwordHash: string;
  roleId: string; // Foreign key to Role
  mobile?: string;
  email?: string;
  departmentId?: string;
  sectionId?: string;
  machineId?: string; // Core machine
  status: 'onboarding_step1' | 'onboarding_step2' | 'onboarding_step3' | 'active';
  rememberMeToken?: string;
  onboardingCompletedAt?: string;
  createdAt: string;
  telegramChatId?: string;
  telegramNotificationsEnabled?: boolean;
  inAppNotificationsEnabled?: boolean;
  internalMessagesEnabled?: boolean;
}

export interface SwapReviewRequest {
  id: string;
  swapRequestId: string;
  volunteerUserId: string;
  status: 'PENDING_ADMIN_REVIEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  approvalsRequired: number;
  approvalsReceived: number;
  rejectionsReceived: number;
  createdAt: string;
  finalizedAt?: string;
}

export interface SwapReviewAssignment {
  id: string;
  reviewRequestId: string;
  reviewerUserId: string;
  assignedAt: string;
}

export interface SwapReviewDecision {
  id: string;
  reviewRequestId: string;
  reviewerUserId: string;
  decision: 'Approve' | 'Reject' | 'Clarification';
  comments?: string;
  decidedAt: string;
}

// Full DB State container
export interface DbSchema {
  roles: Role[];
  departments: Department[];
  sections: Section[];
  teams: Team[];
  machines: Machine[];
  skills: Skill[];
  employeeSkills: EmployeeSkill[];
  machineCertifications: MachineCertification[];
  employeeMachineMapping: EmployeeMachineMapping[];
  employeeDefaultShiftPatterns: EmployeeDefaultShiftPattern[];
  shifts: Shift[];
  shiftAssignments: ShiftAssignment[];
  shiftTemplates: ShiftTemplate[];
  swapRequests: SwapRequest[];
  swapVolunteers: SwapVolunteer[];
  leaveRequests: LeaveRequest[];
  leaveBalances: LeaveBalance[];
  conversations: Conversation[];
  conversationParticipants: ConversationParticipant[];
  messages: Message[];
  notifications: Notification[];
  holidays: Holiday[];
  auditLogs: AuditLog[];
  systemSettings: SystemSetting[];
  users: User[];
  swapReviewRequests?: SwapReviewRequest[];
  swapReviewAssignments?: SwapReviewAssignment[];
  swapReviewDecisions?: SwapReviewDecision[];
}
