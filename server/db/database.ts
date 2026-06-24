import fs from 'fs';
import path from 'path';
import { DbSchema, User, Role, Department, Section, Team, Machine, Skill, EmployeeSkill, MachineCertification, EmployeeMachineMapping, EmployeeDefaultShiftPattern, Shift, ShiftAssignment, ShiftTemplate, SwapRequest, SwapVolunteer, LeaveRequest, LeaveBalance, Conversation, ConversationParticipant, Message, Notification, Holiday, AuditLog, SystemSetting } from '../../src/types';

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
    if (fs.existsSync(DB_PATH)) {
      try {
        const content = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(content);
      } catch (e) {
        console.error('Error reading database file, using empty/seeded schema', e);
      }
    }
    const seeded = this.getSeededState();
    this.saveState(seeded);
    return seeded;
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

    const teams: Team[] = [
      { id: 'team1', name: 'A-Shift Builders', supervisorId: 'sup1' },
      { id: 'team2', name: 'B-Shift Builders', supervisorId: 'sup1' }
    ];

    const machines: Machine[] = [
      { id: 'm1', name: 'Tyre Builder TBM-01', code: 'TBM-01', sectionId: 'sec1' },
      { id: 'm2', name: 'Tyre Builder TBM-02', code: 'TBM-02', sectionId: 'sec1' },
      { id: 'm3', name: 'Tyre Builder TBM-03', code: 'TBM-03', sectionId: 'sec1' },
      { id: 'm4', name: 'Curing Press CP-101', code: 'CP-101', sectionId: 'sec2' },
      { id: 'm5', name: 'Curing Press CP-102', code: 'CP-102', sectionId: 'sec2' }
    ];

    const skills: Skill[] = [
      { id: 'sk1', name: 'TBM-01 Operation', code: 'CERT-TBM01' },
      { id: 'sk2', name: 'TBM-02 Operation', code: 'CERT-TBM02' },
      { id: 'sk3', name: 'TBM-03 Operation', code: 'CERT-TBM03' },
      { id: 'sk4', name: 'CP-101/102 Operation', code: 'CERT-CP' }
    ];

    const machineCertifications: MachineCertification[] = [
      { id: 'mc1', name: 'Level 1 Tyre Building Certificate', code: 'LTB-1' },
      { id: 'mc2', name: 'Level 2 Specialized Curing', code: 'LSC-2' }
    ];

    // Password is 'password123' for all seeded users. In production they will be hashed.
    // In our app, we will use a simple hashed placeholder.
    const defaultPasswordHash = 'sha256_password123_placeholder';

    // Seeding 11 Employee Pilot Users, 1 Supervisor, 1 Admin
    const users: User[] = [
      {
        id: 'admin',
        clockId: 'ADM101',
        name: 'Arthur Pendragon',
        passwordHash: defaultPasswordHash,
        roleId: '3', // Admin
        status: 'active',
        createdAt: nowStr
      },
      {
        id: 'sup1',
        clockId: 'SUP901',
        name: 'Sarah Connor',
        passwordHash: defaultPasswordHash,
        roleId: '2', // Supervisor
        mobile: '+919876543210',
        email: 'sarah.connor@apollotyres.com',
        departmentId: 'dep1',
        sectionId: 'sec1',
        status: 'active',
        createdAt: nowStr
      },
      // 11 Pilot Builders
      { id: 'emp1', clockId: 'EMP001', name: 'John Doe', passwordHash: defaultPasswordHash, roleId: '1', mobile: '+919911223344', email: 'john.doe@apollotyres.com', departmentId: 'dep1', sectionId: 'sec1', machineId: 'm1', status: 'active', createdAt: nowStr },
      { id: 'emp2', clockId: 'EMP002', name: 'Amara Patel', passwordHash: defaultPasswordHash, roleId: '1', mobile: '+919911223345', email: 'amara.patel@apollotyres.com', departmentId: 'dep1', sectionId: 'sec1', machineId: 'm1', status: 'active', createdAt: nowStr },
      { id: 'emp3', clockId: 'EMP003', name: 'Bongani Dube', passwordHash: defaultPasswordHash, roleId: '1', mobile: '+919911223346', email: 'bongani.dube@apollotyres.com', departmentId: 'dep1', sectionId: 'sec1', machineId: 'm2', status: 'active', createdAt: nowStr },
      { id: 'emp4', clockId: 'EMP004', name: 'Chen Wei', passwordHash: defaultPasswordHash, roleId: '1', mobile: '+919911223347', email: 'chen.wei@apollotyres.com', departmentId: 'dep1', sectionId: 'sec1', machineId: 'm2', status: 'active', createdAt: nowStr },
      { id: 'emp5', clockId: 'EMP005', name: 'David Silva', passwordHash: defaultPasswordHash, roleId: '1', mobile: '+919911223348', email: 'david.silva@apollotyres.com', departmentId: 'dep1', sectionId: 'sec1', machineId: 'm3', status: 'active', createdAt: nowStr },
      { id: 'emp6', clockId: 'EMP006', name: 'Elena Petrova', passwordHash: defaultPasswordHash, roleId: '1', mobile: '+919911223349', email: 'elena.petrova@apollotyres.com', departmentId: 'dep1', sectionId: 'sec1', machineId: 'm3', status: 'onboarding_step1', createdAt: nowStr },
      { id: 'emp7', clockId: 'EMP007', name: 'Fatima Al-Sayed', passwordHash: defaultPasswordHash, roleId: '1', mobile: '+919911223350', email: 'fatima.alsayed@apollotyres.com', departmentId: 'dep1', sectionId: 'sec1', machineId: 'm1', status: 'onboarding_step1', createdAt: nowStr },
      { id: 'emp8', clockId: 'EMP008', name: 'George Mwangi', passwordHash: defaultPasswordHash, roleId: '1', mobile: '+919911223351', email: 'george.mwangi@apollotyres.com', departmentId: 'dep1', sectionId: 'sec1', machineId: 'm2', status: 'onboarding_step2', createdAt: nowStr },
      { id: 'emp9', clockId: 'EMP009', name: 'Hiroshi Tanaka', passwordHash: defaultPasswordHash, roleId: '1', mobile: '+919911223352', email: 'hiroshi.tanaka@apollotyres.com', departmentId: 'dep1', sectionId: 'sec1', machineId: 'm3', status: 'onboarding_step3', createdAt: nowStr },
      { id: 'emp10', clockId: 'EMP010', name: 'Isabella Rossi', passwordHash: defaultPasswordHash, roleId: '1', mobile: '+919911223353', email: 'isabella.rossi@apollotyres.com', departmentId: 'dep1', sectionId: 'sec1', machineId: 'm1', status: 'active', createdAt: nowStr },
      { id: 'emp11', clockId: 'EMP011', name: 'Jack Vance', passwordHash: defaultPasswordHash, roleId: '1', mobile: '+919911223354', email: 'jack.vance@apollotyres.com', departmentId: 'dep1', sectionId: 'sec1', machineId: 'm2', status: 'active', createdAt: nowStr }
    ];

    // Employee Skills Map
    const employeeSkills: EmployeeSkill[] = [
      { id: 'es1', userId: 'emp1', skillId: 'sk1', certificationDate: '2026-01-01', expiryDate: '2027-01-01' },
      { id: 'es2', userId: 'emp1', skillId: 'sk2', certificationDate: '2026-01-01', expiryDate: '2027-01-01' },
      { id: 'es3', userId: 'emp2', skillId: 'sk1', certificationDate: '2026-01-01', expiryDate: '2027-01-01' },
      { id: 'es4', userId: 'emp3', skillId: 'sk2', certificationDate: '2026-02-01', expiryDate: '2027-02-01' },
      { id: 'es5', userId: 'emp4', skillId: 'sk2', certificationDate: '2026-02-01', expiryDate: '2027-02-01' },
      { id: 'es6', userId: 'emp5', skillId: 'sk3', certificationDate: '2026-03-01', expiryDate: '2027-03-01' },
      { id: 'es7', userId: 'emp10', skillId: 'sk1', certificationDate: '2026-01-10', expiryDate: '2027-01-10' },
      { id: 'es8', userId: 'emp11', skillId: 'sk2', certificationDate: '2026-01-10', expiryDate: '2027-01-10' }
    ];

    // Employee Machine Certified Mapping
    const employeeMachineMapping: EmployeeMachineMapping[] = [
      { id: 'emm1', userId: 'emp1', machineId: 'm1', isCertified: true },
      { id: 'emm2', userId: 'emp1', machineId: 'm2', isCertified: true },
      { id: 'emm3', userId: 'emp2', machineId: 'm1', isCertified: true },
      { id: 'emm4', userId: 'emp2', machineId: 'm2', isCertified: false },
      { id: 'emm5', userId: 'emp3', machineId: 'm2', isCertified: true },
      { id: 'emm6', userId: 'emp4', machineId: 'm2', isCertified: true },
      { id: 'emm7', userId: 'emp5', machineId: 'm3', isCertified: true },
      { id: 'emm8', userId: 'emp10', machineId: 'm1', isCertified: true },
      { id: 'emm9', userId: 'emp11', machineId: 'm2', isCertified: true }
    ];

    // Default Weekly Shift Patterns (0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat)
    // Shift Codes: A=Morning, B=Noon, C=Night, OFF=Weekly Off
    const defaultPatterns: { [userId: string]: ('A' | 'B' | 'C' | 'OFF')[] } = {
      emp1: ['OFF', 'A', 'A', 'A', 'A', 'A', 'OFF'], // Sun off, Sat off, Mon-Fri morning
      emp2: ['OFF', 'A', 'A', 'A', 'A', 'A', 'OFF'],
      emp3: ['OFF', 'B', 'B', 'B', 'B', 'B', 'OFF'], // Sun off, Sat off, Mon-Fri noon
      emp4: ['OFF', 'B', 'B', 'B', 'B', 'B', 'OFF'],
      emp5: ['OFF', 'C', 'C', 'C', 'C', 'C', 'OFF'], // Sun off, Sat off, Mon-Fri night
      emp10: ['OFF', 'A', 'A', 'A', 'B', 'B', 'OFF'], // Hybrid morning/noon
      emp11: ['OFF', 'B', 'B', 'C', 'C', 'C', 'OFF'] // Hybrid noon/night
    };

    const employeeDefaultShiftPatterns: EmployeeDefaultShiftPattern[] = [];
    Object.keys(defaultPatterns).forEach(userId => {
      const pattern = defaultPatterns[userId];
      pattern.forEach((shiftCode, dayOfWeek) => {
        employeeDefaultShiftPatterns.push({
          id: `dsp_${userId}_${dayOfWeek}`,
          userId,
          dayOfWeek,
          shiftCode
        });
      });
    });

    const shifts: Shift[] = [
      { id: 's_a', name: 'Morning Shift', code: 'A', startTime: '06:00:00', endTime: '14:00:00' },
      { id: 's_b', name: 'Noon Shift', code: 'B', startTime: '14:00:00', endTime: '22:00:00' },
      { id: 's_c', name: 'Night Shift', code: 'C', startTime: '22:00:00', endTime: '06:00:00' },
      { id: 's_off', name: 'Weekly Off', code: 'OFF', startTime: '00:00:00', endTime: '00:00:00' }
    ];

    // Dynamic Shift Assignments generation for a month centered on 2026-06-24
    const shiftAssignments: ShiftAssignment[] = [];
    const baseDate = new Date('2026-06-01');
    const endDate = new Date('2026-07-15');

    const activeEmployees = ['emp1', 'emp2', 'emp3', 'emp4', 'emp5', 'emp10', 'emp11'];

    for (let d = new Date(baseDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay();

      activeEmployees.forEach(userId => {
        const pattern = defaultPatterns[userId];
        const shiftCode = pattern ? pattern[dayOfWeek] : 'OFF';
        const user = users.find(u => u.id === userId);

        shiftAssignments.push({
          id: `sa_${userId}_${dateStr}`,
          userId,
          date: dateStr,
          shiftCode,
          machineId: user?.machineId
        });
      });
    }

    const shiftTemplates: ShiftTemplate[] = [
      { id: 'st1', name: 'Standard Builders 3-Shift Template', rotationDays: 7 }
    ];

    // Seed Swap Requests
    const swapRequests: SwapRequest[] = [
      {
        id: 'sr1',
        requesterId: 'emp1',
        date: '2026-06-25', // Thursday shift
        shiftCode: 'A',
        swapType: 'open',
        status: 'pending',
        incentiveOffered: true,
        incentiveAmount: 300,
        remarks: 'Need Thursday off for a family ceremony. Can pay ₹300 incentive.',
        createdAt: new Date('2026-06-23T08:00:00Z').toISOString(),
        updatedAt: new Date('2026-06-23T08:00:00Z').toISOString()
      },
      {
        id: 'sr2',
        requesterId: 'emp3',
        date: '2026-06-26', // Friday shift
        shiftCode: 'B',
        swapType: 'direct',
        targetUserId: 'emp4',
        status: 'pending',
        incentiveOffered: false,
        remarks: 'Let swap shifts direct! I work morning, you work noon.',
        createdAt: new Date('2026-06-23T10:30:00Z').toISOString(),
        updatedAt: new Date('2026-06-23T10:30:00Z').toISOString()
      },
      {
        id: 'sr3',
        requesterId: 'emp2',
        date: '2026-06-20', // Past Swap Approved
        shiftCode: 'A',
        swapType: 'open',
        status: 'approved',
        incentiveOffered: false,
        remarks: 'Past approved swap.',
        supervisorId: 'sup1',
        supervisorComment: 'Approved for production balancing',
        createdAt: new Date('2026-06-18T14:00:00Z').toISOString(),
        updatedAt: new Date('2026-06-19T09:00:00Z').toISOString()
      }
    ];

    const swapVolunteers: SwapVolunteer[] = [
      {
        id: 'sv1',
        swapRequestId: 'sr1',
        volunteerId: 'emp2',
        status: 'pending',
        createdAt: new Date('2026-06-23T12:00:00Z').toISOString()
      }
    ];

    // Seed Leave Requests
    const leaveRequests: LeaveRequest[] = [
      {
        id: 'lr1',
        userId: 'emp5',
        startDate: '2026-06-28',
        endDate: '2026-06-30',
        leaveType: 'Casual',
        status: 'pending',
        remarks: 'Attending friend marriage.',
        createdAt: new Date('2026-06-22T09:00:00Z').toISOString()
      },
      {
        id: 'lr2',
        userId: 'emp10',
        startDate: '2026-06-22',
        endDate: '2026-06-23',
        leaveType: 'Sick',
        status: 'approved',
        remarks: 'Suffering from seasonal fever.',
        supervisorComment: 'Approved. Get well soon.',
        createdAt: new Date('2026-06-22T06:00:00Z').toISOString()
      }
    ];

    // Seed Leave Balances
    const leaveBalances: LeaveBalance[] = [];
    const leaveTypes: ('Casual' | 'Sick' | 'Earned' | 'Emergency' | 'Unpaid')[] = ['Casual', 'Sick', 'Earned', 'Emergency', 'Unpaid'];
    activeEmployees.forEach(userId => {
      leaveTypes.forEach(type => {
        let allocated = 12;
        if (type === 'Sick') allocated = 10;
        if (type === 'Earned') allocated = 15;
        if (type === 'Emergency') allocated = 5;
        if (type === 'Unpaid') allocated = 99;

        const used = userId === 'emp10' && type === 'Sick' ? 2 : 0;
        const pending = userId === 'emp5' && type === 'Casual' ? 3 : 0;

        leaveBalances.push({
          id: `lb_${userId}_${type}`,
          userId,
          leaveType: type,
          allocated,
          used,
          pending
        });
      });
    });

    // Seed Conversations
    const conversations: Conversation[] = [
      { id: 'c_global', type: 'group', title: 'Builders Section Group', createdAt: nowStr },
      { id: 'c_night', type: 'group', title: 'Night Shift Team', createdAt: nowStr },
      { id: 'c_sr1', type: 'swap', title: 'Swap Discussion: sr1', swapRequestId: 'sr1', createdAt: nowStr }
    ];

    const conversationParticipants: ConversationParticipant[] = [
      // Builders Group (All pilot users + Supervisor)
      ...users.filter(u => u.roleId === '1' || u.roleId === '2').map((u, i) => ({
        id: `cp_global_${i}`,
        conversationId: 'c_global',
        userId: u.id
      })),
      // Night shift group (emp5 is night, plus others)
      { id: 'cpn_1', conversationId: 'c_night', userId: 'emp5' },
      { id: 'cpn_2', conversationId: 'c_night', userId: 'emp11' },
      { id: 'cpn_3', conversationId: 'c_night', userId: 'sup1' },
      // Swap discussion
      { id: 'cps_1', conversationId: 'c_sr1', userId: 'emp1' }, // Requester
      { id: 'cps_2', conversationId: 'c_sr1', userId: 'emp2' }, // Volunteer
      { id: 'cps_3', conversationId: 'c_sr1', userId: 'sup1' }  // Supervisor
    ];

    const messages: Message[] = [
      {
        id: 'msg1',
        conversationId: 'c_global',
        senderId: 'sup1',
        text: 'Welcome to the Builders Section shift swap pilot. Please log in, complete onboarding and double-check your default pattern.',
        isReadBy: ['sup1', 'emp1', 'emp2'],
        createdAt: new Date('2026-06-22T08:00:00Z').toISOString()
      },
      {
        id: 'msg2',
        conversationId: 'c_global',
        senderId: 'emp1',
        text: 'Thanks Connor! This system looks extremely simple to use, like WhatsApp!',
        isReadBy: ['sup1', 'emp1'],
        createdAt: new Date('2026-06-22T08:05:00Z').toISOString()
      },
      {
        id: 'msg3',
        conversationId: 'c_sr1',
        senderId: 'emp1',
        text: 'Hey Isabella/Amara, can any of you cover my Thursday shift? Offered ₹300 incentive.',
        isReadBy: ['emp1'],
        createdAt: new Date('2026-06-23T08:05:00Z').toISOString()
      },
      {
        id: 'msg4',
        conversationId: 'c_sr1',
        senderId: 'emp2',
        text: 'Hey John, I volunteered for it! Let me know if you select me.',
        isReadBy: ['emp1', 'emp2'],
        createdAt: new Date('2026-06-23T12:05:00Z').toISOString()
      }
    ];

    const notifications: Notification[] = [
      {
        id: 'not1',
        userId: 'emp2',
        title: 'New Swap Opportunity',
        body: 'John Doe requested a swap for Thursday 2026-06-25 (A Shift). You are eligible to volunteer.',
        type: 'swap',
        isRead: false,
        link: '/swap-marketplace',
        createdAt: new Date('2026-06-23T08:00:00Z').toISOString()
      },
      {
        id: 'not2',
        userId: 'sup1',
        title: 'Leave Request Pending',
        body: 'David Silva has applied for Casual Leave from 2026-06-28 to 2026-06-30.',
        type: 'leave',
        isRead: false,
        link: '/supervisor/approvals',
        createdAt: new Date('2026-06-22T09:00:00Z').toISOString()
      }
    ];

    const holidays: Holiday[] = [
      { id: 'h1', date: '2026-01-01', name: 'New Year Day', isCompanyPaid: true },
      { id: 'h2', date: '2026-05-01', name: 'Labor Day', isCompanyPaid: true },
      { id: 'h3', date: '2026-08-15', name: 'Independence Day', isCompanyPaid: true },
      { id: 'h4', date: '2026-10-02', name: 'Gandhi Jayanti', isCompanyPaid: true },
      { id: 'h5', date: '2026-12-25', name: 'Christmas', isCompanyPaid: false }
    ];

    const auditLogs: AuditLog[] = [
      {
        id: 'al1',
        userId: 'sup1',
        action: 'APPROVE_LEAVE',
        timestamp: new Date('2026-06-22T10:00:00Z').toISOString(),
        oldValue: 'status: pending',
        newValue: 'status: approved'
      }
    ];

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
      users
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

  // Generic Save wrapper
  public updateState(updater: (state: DbSchema) => void) {
    updater(this.state);
    this.save();
  }
}

export const dbInstance = new Database();
