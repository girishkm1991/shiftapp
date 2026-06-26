import { DbSchema, User, Role, Department, Section, Team, Machine, Skill, EmployeeSkill, MachineCertification, EmployeeMachineMapping, EmployeeDefaultShiftPattern, Shift, ShiftAssignment, ShiftTemplate, SwapRequest, SwapVolunteer, LeaveRequest, LeaveBalance, Conversation, ConversationParticipant, Message, Notification, Holiday, AuditLog, SystemSetting, SwapReviewRequest, SwapReviewAssignment, SwapReviewDecision } from '../../src/types';

export class Database {
  private state: DbSchema;

  constructor() {
    this.state = this.load();
  }

  private load(): DbSchema {
    // Return seeded state initially. We will load full state from MySQL asynchronously once connected.
    return this.getSeededState();
  }

  private save() {
    this.saveToMySQL().catch(err => {
      console.error('[Database] Failed to save state to MySQL:', err);
    });
  }

  public async upsertUser(u: User) {
    const { query } = await import('./mysql');
    await query(
      `INSERT INTO users (id, clock_id, name, password_hash, role_id, mobile, email, department_id, section_id, machine_id, status, remember_me_token, onboarding_completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         clock_id = VALUES(clock_id), name = VALUES(name), password_hash = VALUES(password_hash),
         role_id = VALUES(role_id), mobile = VALUES(mobile), email = VALUES(email),
         department_id = VALUES(department_id), section_id = VALUES(section_id), machine_id = VALUES(machine_id),
         status = VALUES(status), remember_me_token = VALUES(remember_me_token),
         onboarding_completed_at = VALUES(onboarding_completed_at)`,
      [
        u.id,
        u.clockId,
        u.name,
        u.passwordHash,
        u.roleId,
        u.mobile || null,
        u.email || null,
        u.departmentId || null,
        u.sectionId || null,
        u.machineId || null,
        u.status,
        u.rememberMeToken || null,
        u.onboardingCompletedAt ? new Date(u.onboardingCompletedAt) : null,
        u.createdAt ? new Date(u.createdAt) : new Date()
      ]
    );
  }

  public async saveToMySQL() {
    try {
      const { query } = await import('./mysql');

      // 1. Users
      for (const u of this.state.users) {
        await this.upsertUser(u);
      }

      // 2. Employee Default Shift Patterns
      for (const p of this.state.employeeDefaultShiftPatterns) {
        await query(
          'INSERT INTO employee_default_shift_patterns (id, user_id, day_of_week, shift_code) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE shift_code = VALUES(shift_code)',
          [p.id, p.userId, p.dayOfWeek, p.shiftCode]
        );
      }

      // 3. Shift Assignments
      for (const sa of this.state.shiftAssignments) {
        await query(
          'INSERT INTO shift_assignments (id, user_id, date, shift_code, machine_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE shift_code = VALUES(shift_code), machine_id = VALUES(machine_id)',
          [sa.id, sa.userId, sa.date, sa.shiftCode, sa.machineId || null]
        );
      }

      // 4. Swap Requests
      for (const sr of this.state.swapRequests) {
        await query(
          `INSERT INTO swap_requests (id, requester_id, date, shift_code, swap_type, target_user_id, status, supervisor_comment, incentive_offered, incentive_amount, remarks, supervisor_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), supervisor_comment = VALUES(supervisor_comment), target_user_id = VALUES(target_user_id), updated_at = VALUES(updated_at)`,
          [
            sr.id,
            sr.requesterId,
            sr.date,
            sr.shiftCode,
            sr.swapType,
            sr.targetUserId || null,
            sr.status,
            sr.supervisorComment || null,
            sr.incentiveOffered ? 1 : 0,
            sr.incentiveAmount || 0,
            sr.remarks || null,
            sr.supervisorId || null,
            sr.createdAt ? new Date(sr.createdAt) : new Date(),
            sr.updatedAt ? new Date(sr.updatedAt) : new Date()
          ]
        );
      }

      // 5. Swap Volunteers
      for (const sv of this.state.swapVolunteers) {
        await query(
          'INSERT INTO swap_volunteers (id, swap_request_id, volunteer_id, status, created_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)',
          [sv.id, sv.swapRequestId, sv.volunteerId, sv.status, sv.createdAt ? new Date(sv.createdAt) : new Date()]
        );
      }

      // 6. Leave Requests
      for (const lr of this.state.leaveRequests) {
        await query(
          `INSERT INTO leave_requests (id, user_id, start_date, end_date, leave_type, status, remarks, supervisor_comment, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), supervisor_comment = VALUES(supervisor_comment)`,
          [
            lr.id,
            lr.userId,
            lr.startDate,
            lr.endDate,
            lr.leaveType,
            lr.status,
            lr.remarks || null,
            lr.supervisorComment || null,
            lr.createdAt ? new Date(lr.createdAt) : new Date()
          ]
        );
      }

      // 7. Leave Balances
      for (const lb of this.state.leaveBalances) {
        await query(
          'INSERT INTO leave_balances (id, user_id, leave_type, allocated, used, pending) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE allocated = VALUES(allocated), used = VALUES(used), pending = VALUES(pending)',
          [lb.id, lb.userId, lb.leaveType, lb.allocated, lb.used, lb.pending]
        );
      }

      // 8. Conversations
      for (const conv of this.state.conversations) {
        await query(
          'INSERT INTO conversations (id, type, title, swap_request_id, created_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), swap_request_id = VALUES(swap_request_id)',
          [conv.id, conv.type, conv.title || null, conv.swapRequestId || null, conv.createdAt ? new Date(conv.createdAt) : new Date()]
        );
      }

      // 9. Conversation Participants
      for (const cp of this.state.conversationParticipants) {
        await query(
          'INSERT INTO conversation_participants (id, conversation_id, user_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
          [cp.id, cp.conversationId, cp.userId]
        );
      }

      // 10. Messages
      for (const msg of this.state.messages) {
        const isReadByStr = JSON.stringify(msg.isReadBy || []);
        await query(
          `INSERT INTO messages (id, conversation_id, sender_id, text, attachment_url, attachment_name, is_read_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE text = VALUES(text), is_read_by = VALUES(is_read_by)`,
          [
            msg.id,
            msg.conversationId,
            msg.senderId,
            msg.text,
            msg.attachmentUrl || null,
            msg.attachmentName || null,
            isReadByStr,
            msg.createdAt ? new Date(msg.createdAt) : new Date()
          ]
        );
      }

      // 11. Notifications
      for (const n of this.state.notifications) {
        await query(
          'INSERT INTO notifications (id, user_id, title, body, type, is_read, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE is_read = VALUES(is_read)',
          [n.id, n.userId, n.title, n.body, n.type, n.isRead ? 1 : 0, n.link || null, n.createdAt ? new Date(n.createdAt) : new Date()]
        );
      }

      // 12. Audit Logs
      for (const al of this.state.auditLogs) {
        await query(
          'INSERT INTO audit_logs (id, user_id, action, timestamp, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
          [al.id, al.userId, al.action, al.timestamp ? new Date(al.timestamp) : new Date(), al.oldValue || null, al.newValue || null]
        );
      }

      // 13. Swap Review Requests
      for (const srr of this.state.swapReviewRequests) {
        await query(
          `INSERT INTO swap_review_requests (id, swap_request_id, volunteer_user_id, status, approvals_required, approvals_received, rejections_received, created_at, finalized_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), approvals_received = VALUES(approvals_received), rejections_received = VALUES(rejections_received), finalized_at = VALUES(finalized_at)`,
          [
            srr.id,
            srr.swapRequestId,
            srr.volunteerUserId,
            srr.status,
            srr.approvalsRequired,
            srr.approvalsReceived,
            srr.rejectionsReceived,
            srr.createdAt ? new Date(srr.createdAt) : new Date(),
            srr.finalizedAt ? new Date(srr.finalizedAt) : null
          ]
        );
      }

      // 14. Swap Review Assignments
      for (const sra of this.state.swapReviewAssignments) {
        await query(
          'INSERT INTO swap_review_assignments (id, review_request_id, reviewer_user_id, assigned_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
          [sra.id, sra.reviewRequestId, sra.reviewerUserId, sra.assignedAt ? new Date(sra.assignedAt) : new Date()]
        );
      }

      // 15. Swap Review Decisions
      for (const srd of this.state.swapReviewDecisions) {
        await query(
          'INSERT INTO swap_review_decisions (id, review_request_id, reviewer_user_id, decision, comments, decided_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE decision = VALUES(decision), comments = VALUES(comments)',
          [srd.id, srd.reviewRequestId, srd.reviewerUserId, srd.decision, srd.comments || null, srd.decidedAt ? new Date(srd.decidedAt) : new Date()]
        );
      }

      // 16. Employee Skills
      for (const es of this.state.employeeSkills) {
        await query(
          'INSERT INTO employee_skills (id, user_id, skill_id, certification_date, expiry_date) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE certification_date = VALUES(certification_date), expiry_date = VALUES(expiry_date)',
          [es.id, es.userId, es.skillId, es.certificationDate, es.expiryDate]
        );
      }

      // 17. Employee Machine Mapping
      for (const emm of this.state.employeeMachineMapping) {
        await query(
          'INSERT INTO employee_machine_mapping (id, user_id, machine_id, is_certified) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE is_certified = VALUES(is_certified)',
          [emm.id, emm.userId, emm.machineId, emm.isCertified ? 1 : 0]
        );
      }

    } catch (err) {
      console.error('[Database] Failed to save state to MySQL:', err);
    }
  }

  public async loadFromMySQL() {
    try {
      const { query } = await import('./mysql');
      console.log('[Database] Loading state from MySQL...');

      // 1. Roles
      const rolesRows = await query('SELECT * FROM roles');
      const roles = rolesRows.map((r: any) => ({ id: r.id, name: r.name }));

      // 2. Departments
      const deptsRows = await query('SELECT * FROM departments');
      const departments = deptsRows.map((d: any) => ({ id: d.id, name: d.name }));

      // 3. Sections
      const secRows = await query('SELECT * FROM sections');
      const sections = secRows.map((s: any) => ({ id: s.id, name: s.name, departmentId: s.department_id }));

      // 4. Teams
      const teamsRows = await query('SELECT * FROM teams');
      const teams = teamsRows.map((t: any) => ({ id: t.id, name: t.name, supervisorId: t.supervisor_id }));

      // 5. Machines
      const machRows = await query('SELECT * FROM machines');
      const machines = machRows.map((m: any) => ({ id: m.id, name: m.name, code: m.code, sectionId: m.section_id }));

      // 6. Skills
      const skillRows = await query('SELECT * FROM skills');
      const skills = skillRows.map((s: any) => ({ id: s.id, name: s.name, code: s.code }));

      // 7. Users
      const usersRows = await query('SELECT * FROM users WHERE deleted_at IS NULL');
      const users = usersRows.map((u: any) => ({
        id: u.id,
        clockId: u.clock_id,
        name: u.name,
        passwordHash: u.password_hash,
        roleId: u.role_id,
        mobile: u.mobile || undefined,
        email: u.email || undefined,
        departmentId: u.department_id || undefined,
        sectionId: u.section_id || undefined,
        machineId: u.machine_id || undefined,
        status: u.status,
        rememberMeToken: u.remember_me_token || undefined,
        onboardingCompletedAt: u.onboarding_completed_at ? new Date(u.onboarding_completed_at).toISOString() : undefined,
        createdAt: u.created_at ? new Date(u.created_at).toISOString() : undefined
      }));

      // 8. Employee Skills
      const empSkillsRows = await query('SELECT * FROM employee_skills');
      const employeeSkills = empSkillsRows.map((es: any) => ({
        id: es.id,
        userId: es.user_id,
        skillId: es.skill_id,
        certificationDate: es.certification_date,
        expiryDate: es.expiry_date
      }));

      // 9. Employee Machine Mapping
      const mappingRows = await query('SELECT * FROM employee_machine_mapping');
      const employeeMachineMapping = mappingRows.map((emm: any) => ({
        id: emm.id,
        userId: emm.user_id,
        machineId: emm.machine_id,
        isCertified: emm.is_certified === 1
      }));

      // 10. Employee Default Shift Patterns
      const patternsRows = await query('SELECT * FROM employee_default_shift_patterns');
      const employeeDefaultShiftPatterns = patternsRows.map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        dayOfWeek: p.day_of_week,
        shiftCode: p.shift_code
      }));

      // 11. Shifts
      const shiftsRows = await query('SELECT * FROM shifts');
      const shifts = shiftsRows.map((s: any) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        startTime: s.start_time,
        endTime: s.end_time
      }));

      // 12. Shift Assignments
      const assignRows = await query('SELECT * FROM shift_assignments');
      const shiftAssignments = assignRows.map((sa: any) => ({
        id: sa.id,
        userId: sa.user_id,
        date: sa.date,
        shiftCode: sa.shift_code,
        machineId: sa.machine_id || undefined
      }));

      // 13. Shift Templates
      const templRows = await query('SELECT * FROM shift_templates');
      const shiftTemplates = templRows.map((st: any) => ({
        id: st.id,
        name: st.name,
        rotationDays: st.rotation_days
      }));

      // 14. Swap Requests
      const swapRows = await query('SELECT * FROM swap_requests');
      const swapRequests = swapRows.map((sr: any) => ({
        id: sr.id,
        requesterId: sr.requester_id,
        date: sr.date,
        shiftCode: sr.shift_code,
        swapType: sr.swap_type,
        targetUserId: sr.target_user_id || undefined,
        status: sr.status,
        supervisorComment: sr.supervisor_comment || undefined,
        incentiveOffered: sr.incentive_offered === 1,
        incentiveAmount: sr.incentive_amount,
        remarks: sr.remarks || undefined,
        supervisorId: sr.supervisor_id || undefined,
        createdAt: sr.created_at ? new Date(sr.created_at).toISOString() : undefined,
        updatedAt: sr.updated_at ? new Date(sr.updated_at).toISOString() : undefined
      }));

      // 15. Swap Volunteers
      const volRows = await query('SELECT * FROM swap_volunteers');
      const swapVolunteers = volRows.map((sv: any) => ({
        id: sv.id,
        swapRequestId: sv.swap_request_id,
        volunteerId: sv.volunteer_id,
        status: sv.status,
        createdAt: sv.created_at ? new Date(sv.created_at).toISOString() : undefined
      }));

      // 16. Leave Requests
      const leaveRows = await query('SELECT * FROM leave_requests');
      const leaveRequests = leaveRows.map((lr: any) => ({
        id: lr.id,
        userId: lr.user_id,
        startDate: lr.start_date,
        endDate: lr.end_date,
        leaveType: lr.leave_type,
        status: lr.status,
        remarks: lr.remarks || undefined,
        supervisorComment: lr.supervisor_comment || undefined,
        createdAt: lr.created_at ? new Date(lr.created_at).toISOString() : undefined
      }));

      // 17. Leave Balances
      const balanceRows = await query('SELECT * FROM leave_balances');
      const leaveBalances = balanceRows.map((lb: any) => ({
        id: lb.id,
        userId: lb.user_id,
        leaveType: lb.leave_type,
        allocated: lb.allocated,
        used: lb.used,
        pending: lb.pending
      }));

      // 18. Conversations
      const convRows = await query('SELECT * FROM conversations');
      const conversations = convRows.map((c: any) => ({
        id: c.id,
        type: c.type,
        title: c.title || undefined,
        swapRequestId: c.swap_request_id || undefined,
        createdAt: c.created_at ? new Date(c.created_at).toISOString() : undefined
      }));

      // 19. Conversation Participants
      const partRows = await query('SELECT * FROM conversation_participants');
      const conversationParticipants = partRows.map((cp: any) => ({
        id: cp.id,
        conversationId: cp.conversation_id,
        userId: cp.user_id
      }));

      // 20. Messages
      const msgRows = await query('SELECT * FROM messages');
      const messages = msgRows.map((m: any) => {
        let isReadBy: string[] = [];
        try {
          isReadBy = m.is_read_by ? JSON.parse(m.is_read_by) : [];
        } catch (e) {
          // fallback
        }
        return {
          id: m.id,
          conversationId: m.conversation_id,
          senderId: m.sender_id,
          text: m.text,
          attachmentUrl: m.attachment_url || undefined,
          attachmentName: m.attachment_name || undefined,
          isReadBy,
          createdAt: m.created_at ? new Date(m.created_at).toISOString() : undefined
        };
      });

      // 21. Notifications
      const notRows = await query('SELECT * FROM notifications');
      const notifications = notRows.map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        title: n.title,
        body: n.body,
        type: n.type,
        isRead: n.is_read === 1,
        link: n.link || undefined,
        createdAt: n.created_at ? new Date(n.created_at).toISOString() : undefined
      }));

      // 22. Holidays
      const holRows = await query('SELECT * FROM holidays');
      const holidays = holRows.map((h: any) => ({
        id: h.id,
        date: h.date,
        name: h.name,
        isCompanyPaid: h.is_company_paid === 1
      }));

      // 23. Audit Logs
      const auditRows = await query('SELECT * FROM audit_logs');
      const auditLogs = auditRows.map((al: any) => ({
        id: al.id,
        userId: al.user_id,
        action: al.action,
        timestamp: al.timestamp ? new Date(al.timestamp).toISOString() : undefined,
        oldValue: al.old_value || undefined,
        newValue: al.new_value || undefined
      }));

      // 24. System Settings
      const setRows = await query('SELECT * FROM system_settings');
      const systemSettings = setRows.map((ss: any) => ({
        id: ss.id,
        key: ss.key,
        value: ss.value,
        description: ss.description || undefined
      }));

      // 25. Swap Review Requests
      const revReqRows = await query('SELECT * FROM swap_review_requests');
      const swapReviewRequests = revReqRows.map((srr: any) => ({
        id: srr.id,
        swapRequestId: srr.swap_request_id,
        volunteerUserId: srr.volunteer_user_id,
        status: srr.status,
        approvalsRequired: srr.approvals_required,
        approvalsReceived: srr.approvals_received,
        rejectionsReceived: srr.rejections_received,
        createdAt: srr.created_at ? new Date(srr.created_at).toISOString() : undefined,
        finalizedAt: srr.finalized_at ? new Date(srr.finalized_at).toISOString() : undefined
      }));

      // 26. Swap Review Assignments
      const revAssignRows = await query('SELECT * FROM swap_review_assignments');
      const swapReviewAssignments = revAssignRows.map((sra: any) => ({
        id: sra.id,
        reviewRequestId: sra.review_request_id,
        reviewerUserId: sra.reviewer_user_id,
        assignedAt: sra.assigned_at ? new Date(sra.assigned_at).toISOString() : undefined
      }));

      // 27. Swap Review Decisions
      const revDecRows = await query('SELECT * FROM swap_review_decisions');
      const swapReviewDecisions = revDecRows.map((srd: any) => ({
        id: srd.id,
        reviewRequestId: srd.review_request_id,
        reviewerUserId: srd.reviewer_user_id,
        decision: srd.decision,
        comments: srd.comments || undefined,
        decidedAt: srd.decided_at ? new Date(srd.decided_at).toISOString() : undefined
      }));

      // Set state in memory
      this.state = {
        roles,
        departments,
        sections,
        teams,
        machines,
        skills,
        employeeSkills,
        machineCertifications: [],
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
        swapReviewRequests,
        swapReviewAssignments,
        swapReviewDecisions
      };

      console.log(`[Database] Loaded state from MySQL successfully. Users: ${users.length}, Swaps: ${swapRequests.length}, Messages: ${messages.length}`);

      // Ensure ADMIN001 exists in MySQL
      const existingAdmin = this.state.users.find(u => u.clockId && u.clockId.toUpperCase() === 'ADMIN001');
      if (!existingAdmin) {
        console.log('[Database] ADMIN001 admin account not found. Seeding admin account...');
        const newAdmin: User = {
          id: 'admin',
          clockId: 'ADMIN001',
          name: 'System Administrator',
          email: 'admin@imvelo.local',
          passwordHash: 't33th123!',
          roleId: '3', // Admin
          status: 'active',
          createdAt: new Date().toISOString()
        };
        this.state.users.push(newAdmin);
        await this.upsertUser(newAdmin);
        console.log('[Database] Seeded ADMIN001 admin account to MySQL.');
      } else {
        // Update admin details to match requirement
        let adminChanged = false;
        if (existingAdmin.status !== 'active') { existingAdmin.status = 'active'; adminChanged = true; }
        if (existingAdmin.roleId !== '3') { existingAdmin.roleId = '3'; adminChanged = true; }
        if (existingAdmin.email !== 'admin@imvelo.local') { existingAdmin.email = 'admin@imvelo.local'; adminChanged = true; }
        if (existingAdmin.passwordHash !== 't33th123!') { existingAdmin.passwordHash = 't33th123!'; adminChanged = true; }
        
        if (adminChanged) {
          console.log('[Database] Admin details out of date. Updating ADMIN001...');
          await this.upsertUser(existingAdmin);
        }
      }

      // Check if roles, departments, etc. need to be seeded
      if (this.state.roles.length === 0 || this.state.shifts.length === 0) {
        console.log('[Database] Empty tables found. Seeding initial metadata to MySQL...');
        const seeded = this.getSeededState();
        // Seed each one in MySQL
        for (const r of seeded.roles) await query('INSERT INTO roles (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [r.id, r.name]);
        for (const d of seeded.departments) await query('INSERT INTO departments (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [d.id, d.name]);
        for (const s of seeded.sections) await query('INSERT INTO sections (id, name, department_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), department_id = VALUES(department_id)', [s.id, s.name, s.departmentId]);
        for (const m of seeded.machines) await query('INSERT INTO machines (id, name, code, section_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code), section_id = VALUES(section_id)', [m.id, m.name, m.code, m.sectionId]);
        for (const s of seeded.shifts) await query('INSERT INTO shifts (id, name, code, start_time, end_time) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), start_time = VALUES(start_time), end_time = VALUES(end_time)', [s.id, s.name, s.code, s.startTime, s.endTime]);
        for (const h of seeded.holidays) await query('INSERT INTO holidays (id, date, name, is_company_paid) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), is_company_paid = VALUES(is_company_paid)', [h.id, h.date, h.name, h.isCompanyPaid ? 1 : 0]);
        for (const ss of seeded.systemSettings) await query('INSERT INTO system_settings (id, `key`, `value`, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), description = VALUES(description)', [ss.id, ss.key, ss.value, ss.description || null]);
        for (const c of seeded.conversations) await query('INSERT INTO conversations (id, type, title, created_at) VALUES (?, ?, ?, ?)', [c.id, c.type, c.title, new Date(c.createdAt || '')]);
        
        console.log('[Database] Seeded initial metadata successfully.');
        // Reload state
        await this.loadFromMySQL();
      }

    } catch (err) {
      console.error('[Database] Failed to load state from MySQL:', err);
    }
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
        status: 'active', // STATUS: ACTIVE
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
  public getShiftTemplates(): ShiftTemplate[] { return this.state.shiftTemplates || []; }
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
