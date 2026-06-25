import fs from 'fs';
import path from 'path';
import { DbSchema, User, Role, Department, Section, Team, Machine, Skill, EmployeeSkill, MachineCertification, EmployeeMachineMapping, EmployeeDefaultShiftPattern, Shift, ShiftAssignment, ShiftTemplate, SwapRequest, SwapVolunteer, LeaveRequest, LeaveBalance, Conversation, ConversationParticipant, Message, Notification, Holiday, AuditLog, SystemSetting, SwapReviewRequest, SwapReviewAssignment, SwapReviewDecision } from '../../src/types';

const DB_PATH = path.join(process.cwd(), 'data', 'imvelo_db.json');

// Ensure database directory exists
function ensureDbDirectory() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class Database {
  private state: DbSchema;

  constructor() {
    this.state = this.load();
  }

  private load(): DbSchema {
    ensureDbDirectory();
    let loadedState: DbSchema;
    if (fs.existsSync(DB_PATH)) {
      try {
        const content = fs.readFileSync(DB_PATH, 'utf-8');
        loadedState = JSON.parse(content);
      } catch (e) {
        console.error('Error reading database file, using empty/seeded schema', e);
        loadedState = this.getSeededState();
      }
    } else {
      loadedState = this.getSeededState();
    }

    // Ensure new fields exist for backward compatibility
    if (!loadedState.swapReviewRequests) loadedState.swapReviewRequests = [];
    if (!loadedState.swapReviewAssignments) loadedState.swapReviewAssignments = [];
    if (!loadedState.swapReviewDecisions) loadedState.swapReviewDecisions = [];

    return loadedState;
  }

  private save() {
    ensureDbDirectory();
    this.saveState(this.state);
  }

  private saveState(state: DbSchema) {
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
  }

  private getSeededState(): DbSchema {
    const nowStr = new Date().toISOString();

    const roles: Role[] = [
      { id: '1', name: 'Employee' },
      { id: '2', name: 'Supervisor' },
      { id: '3', name: 'Admin' }
    ];

    const departments: Department[] = [
      { id: 'dep1', name: 'Production' },
      { id: 'dep2', name: 'Maintenance' },
      { id: 'dep3', name: 'Quality' }
    ];

    const sections: Section[] = [
      { id: 'sec1', name: 'Builders Section', departmentId: 'dep1' },
      { id: 'sec2', name: 'Curing Section', departmentId: 'dep1' },
      { id: 'sec3', name: 'Tread Extrusion', departmentId: 'dep1' }
    ];

    const teams: Team[] = [];

    const machines: Machine[] = [
      { id: 'm1', name: 'Tyre Builder TBM-01', code: 'TBM-01', sectionId: 'sec1' },
      { id: 'm2', name: 'Tyre Builder TBM-02', code: 'TBM-02', sectionId: 'sec1' },
      { id: 'm3', name: 'Tyre Builder TBM-03', code: 'TBM-03', sectionId: 'sec1' },
      { id: 'm4', name: 'Curing Press CP-101', code: 'CP-101', sectionId: 'sec2' },
      { id: 'm5', name: 'Curing Press CP-102', code: 'CP-102', sectionId: 'sec2' }
    ];

    const skills: Skill[] = [];

    const machineCertifications: MachineCertification[] = [];

    const users: User[] = [
      {
        id: 'admin',
        clockId: 'ADMIN001',
        name: 'System Administrator',
        passwordHash: 'sha256_admin123_placeholder',
        roleId: '3', // Admin
        status: 'onboarding_step1', // Force first login password change
        createdAt: nowStr
      }
    ];

    const employeeSkills: EmployeeSkill[] = [];
    const employeeMachineMapping: EmployeeMachineMapping[] = [];
    const employeeDefaultShiftPatterns: EmployeeDefaultShiftPattern[] = [];

    const shifts: Shift[] = [
      { id: 's_a', name: 'Morning Shift', code: 'A', startTime: '06:00:00', endTime: '14:00:00' },
      { id: 's_b', name: 'Noon Shift', code: 'B', startTime: '14:00:00', endTime: '22:00:00' },
      { id: 's_c', name: 'Night Shift', code: 'C', startTime: '22:00:00', endTime: '06:00:00' },
      { id: 's_off', name: 'Weekly Off', code: 'OFF', startTime: '00:00:00', endTime: '00:00:00' }
    ];

    const shiftAssignments: ShiftAssignment[] = [];
    const shiftTemplates: ShiftTemplate[] = [];
    const swapRequests: SwapRequest[] = [];
    const swapVolunteers: SwapVolunteer[] = [];
    const leaveRequests: LeaveRequest[] = [];
    const leaveBalances: LeaveBalance[] = [];

    const conversations: Conversation[] = [
      { id: 'c_global', type: 'group', title: 'Builders Section Group', createdAt: nowStr }
    ];

    const conversationParticipants: ConversationParticipant[] = [];
    const messages: Message[] = [];
    const notifications: Notification[] = [];

    const holidays: Holiday[] = [
      { id: 'h1', date: '2026-01-01', name: 'New Year Day', isCompanyPaid: true },
      { id: 'h2', date: '2026-05-01', name: 'Labor Day', isCompanyPaid: true },
      { id: 'h3', date: '2026-08-15', name: 'Independence Day', isCompanyPaid: true },
      { id: 'h4', date: '2026-10-02', name: 'Gandhi Jayanti', isCompanyPaid: true },
      { id: 'h5', date: '2026-12-25', name: 'Christmas', isCompanyPaid: false }
    ];

    const auditLogs: AuditLog[] = [];

    const systemSettings: SystemSetting[] = [
      { id: 'ss1', key: 'ENABLE_INCENTIVE_MODULE', value: 'true', description: 'Enable optional cash incentives for swap requests' },
      { id: 'ss2', key: 'MINIMUM_REST_HOURS', value: '11', description: 'Mandatory rest period in hours between shifts' },
      { id: 'ss3', key: 'MAX_WEEKLY_HOURS', value: '60', description: 'Maximum working hours in a single week' }
    ];

    return {
      roles,
      departments,
      sections,
      teams,
      machines,
      skills,
      employeeSkills,
      machineCertifications,
      employeeMachineMapping,
      employeeDefaultShiftPatterns,
      shifts,
      shiftAssignments,
      shiftTemplates,
      swapRequests,
      swapVolunteers,
      leaveRequests,
      leaveBalances,
      conversations,
      conversationParticipants,
      messages,
      notifications,
      holidays,
      auditLogs,
      systemSettings,
      users,
      swapReviewRequests: [],
      swapReviewAssignments: [],
      swapReviewDecisions: []
    };
  }

  // --- Core CRUD Operations helper ---

  public getUsers(): User[] { return this.state.users; }
  public getRoles(): Role[] { return this.state.roles; }
  public getDepartments(): Department[] { return this.state.departments; }
  public getSections(): Section[] { return this.state.sections; }
  public getTeams(): Team[] { return this.state.teams; }
  public getMachines(): Machine[] { return this.state.machines; }
  public getSkills(): Skill[] { return this.state.skills; }
  public getEmployeeSkills(): EmployeeSkill[] { return this.state.employeeSkills; }
  public getMachineCertifications(): MachineCertification[] { return this.state.machineCertifications; }
  public getEmployeeMachineMapping(): EmployeeMachineMapping[] { return this.state.employeeMachineMapping; }
  public getEmployeeDefaultShiftPatterns(): EmployeeDefaultShiftPattern[] { return this.state.employeeDefaultShiftPatterns; }
  public getShifts(): Shift[] { return this.state.shifts; }
  public getShiftAssignments(): ShiftAssignment[] { return this.state.shiftAssignments; }
  public getSwapRequests(): SwapRequest[] { return this.state.swapRequests; }
  public getSwapVolunteers(): SwapVolunteer[] { return this.state.swapVolunteers; }
  public getLeaveRequests(): LeaveRequest[] { return this.state.leaveRequests; }
  public getLeaveBalances(): LeaveBalance[] { return this.state.leaveBalances; }
  public getConversations(): Conversation[] { return this.state.conversations; }
  public getConversationParticipants(): ConversationParticipant[] { return this.state.conversationParticipants; }
  public getMessages(): Message[] { return this.state.messages; }
  public getNotifications(): Notification[] { return this.state.notifications; }
  public getHolidays(): Holiday[] { return this.state.holidays; }
  public getAuditLogs(): AuditLog[] { return this.state.auditLogs; }
  public getSystemSettings(): SystemSetting[] { return this.state.systemSettings; }
  public getSwapReviewRequests(): SwapReviewRequest[] { return this.state.swapReviewRequests || []; }
  public getSwapReviewAssignments(): SwapReviewAssignment[] { return this.state.swapReviewAssignments || []; }
  public getSwapReviewDecisions(): SwapReviewDecision[] { return this.state.swapReviewDecisions || []; }

  // Generic Save wrapper
  public updateState(updater: (state: DbSchema) => void) {
    updater(this.state);
    this.save();
  }
}

export const dbInstance = new Database();
