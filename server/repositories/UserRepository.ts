import { query } from '../db/mysql';
import { Mapper } from './Mapper';
import { User, Role, Department, Section, Team, Machine, Skill, EmployeeSkill, EmployeeMachineMapping, EmployeeDefaultShiftPattern, LeaveRequest, LeaveBalance, Holiday, SystemSetting } from '../../src/types';

export class UserRepository {
  public static async findById(id: string): Promise<User | null> {
    const rows = await query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
    if (rows.length === 0) return null;
    return Mapper.mapUser(rows[0]);
  }

  public static async findByClockId(clockId: string): Promise<User | null> {
    const rows = await query('SELECT * FROM users WHERE UPPER(clock_id) = ? AND deleted_at IS NULL', [clockId.toUpperCase().trim()]);
    if (rows.length === 0) return null;
    return Mapper.mapUser(rows[0]);
  }

  public static async findAll(): Promise<User[]> {
    const rows = await query('SELECT * FROM users WHERE deleted_at IS NULL');
    return rows.map(Mapper.mapUser);
  }

  public static async create(user: User): Promise<void> {
    await query(
      `INSERT INTO users (id, clock_id, name, password_hash, role_id, mobile, email, department_id, section_id, machine_id, status, remember_me_token, onboarding_completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.clockId,
        user.name,
        user.passwordHash,
        user.roleId,
        user.mobile || null,
        user.email || null,
        user.departmentId || null,
        user.sectionId || null,
        user.machineId || null,
        user.status,
        user.rememberMeToken || null,
        user.onboardingCompletedAt ? new Date(user.onboardingCompletedAt) : null,
        user.createdAt ? new Date(user.createdAt) : new Date()
      ]
    );
  }

  public static async update(id: string, updates: Partial<User>): Promise<void> {
    const setClause: string[] = [];
    const params: any[] = [];

    const fieldMap: Record<keyof User, string> = {
      id: 'id',
      clockId: 'clock_id',
      name: 'name',
      passwordHash: 'password_hash',
      roleId: 'role_id',
      mobile: 'mobile',
      email: 'email',
      departmentId: 'department_id',
      sectionId: 'section_id',
      machineId: 'machine_id',
      status: 'status',
      rememberMeToken: 'remember_me_token',
      onboardingCompletedAt: 'onboarding_completed_at',
      createdAt: 'created_at',
      telegramChatId: 'telegram_chat_id',
      telegramUsername: 'telegram_username',
      telegramNotificationsEnabled: 'telegram_notifications_enabled',
      inAppNotificationsEnabled: 'in_app_notifications_enabled',
      internalMessagesEnabled: 'internal_messages_enabled'
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMap[key as keyof User];
      if (dbField && dbField !== 'id') {
        setClause.push(`${dbField} = ?`);
        if (key === 'onboardingCompletedAt' || key === 'createdAt') {
          params.push(value ? new Date(value as string) : null);
        } else {
          params.push(value !== undefined ? value : null);
        }
      }
    }

    if (setClause.length === 0) return;

    params.push(id);
    await query(`UPDATE users SET ${setClause.join(', ')} WHERE id = ?`, params);
  }

  public static async delete(id: string): Promise<void> {
    await query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  }

  // Roles
  public static async getRoles(): Promise<Role[]> {
    const rows = await query('SELECT * FROM roles');
    return rows.map(Mapper.mapRole);
  }

  // Departments
  public static async getDepartments(): Promise<Department[]> {
    const rows = await query('SELECT * FROM departments');
    return rows.map(Mapper.mapDepartment);
  }

  // Sections
  public static async getSections(): Promise<Section[]> {
    const rows = await query('SELECT * FROM sections');
    return rows.map(Mapper.mapSection);
  }

  // Teams
  public static async getTeams(): Promise<Team[]> {
    const rows = await query('SELECT * FROM teams');
    return rows.map(Mapper.mapTeam);
  }

  // Machines
  public static async getMachines(): Promise<Machine[]> {
    const rows = await query('SELECT * FROM machines');
    return rows.map(Mapper.mapMachine);
  }

  // Skills
  public static async getSkills(): Promise<Skill[]> {
    const rows = await query('SELECT * FROM skills');
    return rows.map(Mapper.mapSkill);
  }

  // Employee Skills Mapping
  public static async getEmployeeSkills(): Promise<EmployeeSkill[]> {
    const rows = await query('SELECT * FROM employee_skills');
    return rows.map(Mapper.mapEmployeeSkill);
  }

  public static async saveEmployeeSkill(skill: EmployeeSkill): Promise<void> {
    await query(
      `INSERT INTO employee_skills (id, user_id, skill_id, certification_date, expiry_date)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE certification_date = VALUES(certification_date), expiry_date = VALUES(expiry_date)`,
      [skill.id, skill.userId, skill.skillId, skill.certificationDate, skill.expiryDate]
    );
  }

  // Employee Machine Certifications Mapping
  public static async getEmployeeMachineMappings(): Promise<EmployeeMachineMapping[]> {
    const rows = await query('SELECT * FROM employee_machine_mapping');
    return rows.map(Mapper.mapEmployeeMachineMapping);
  }

  public static async saveEmployeeMachineMapping(mapping: EmployeeMachineMapping): Promise<void> {
    await query(
      `INSERT INTO employee_machine_mapping (id, user_id, machine_id, is_certified)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_certified = VALUES(is_certified)`,
      [mapping.id, mapping.userId, mapping.machineId, mapping.isCertified ? 1 : 0]
    );
  }

  // Default Shift Patterns
  public static async getEmployeeDefaultShiftPatterns(userId?: string): Promise<EmployeeDefaultShiftPattern[]> {
    let sql = 'SELECT * FROM employee_default_shift_patterns';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }
    const rows = await query(sql, params);
    return rows.map(Mapper.mapEmployeeDefaultShiftPattern);
  }

  public static async saveEmployeeDefaultShiftPattern(pattern: EmployeeDefaultShiftPattern): Promise<void> {
    await query(
      `INSERT INTO employee_default_shift_patterns (id, user_id, day_of_week, shift_code)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE shift_code = VALUES(shift_code)`,
      [pattern.id, pattern.userId, pattern.dayOfWeek, pattern.shiftCode]
    );
    try {
      const { ScheduleResolutionService } = await import('../services/ScheduleResolutionService');
      ScheduleResolutionService.updatePatternInCache(pattern);
    } catch (e) {
      console.error('[UserRepository] Failed to update pattern in cache:', e);
    }
  }

  // Leave Requests
  public static async getLeaveRequests(userId?: string): Promise<LeaveRequest[]> {
    let sql = 'SELECT * FROM leave_requests';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }
    const rows = await query(sql, params);
    return rows.map(Mapper.mapLeaveRequest);
  }

  public static async saveLeaveRequest(leave: LeaveRequest): Promise<void> {
    await query(
      `INSERT INTO leave_requests (id, user_id, start_date, end_date, leave_type, status, remarks, supervisor_comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), supervisor_comment = VALUES(supervisor_comment)`,
      [
        leave.id,
        leave.userId,
        leave.startDate,
        leave.endDate,
        leave.leaveType,
        leave.status,
        leave.remarks || null,
        leave.supervisorComment || null,
        leave.createdAt ? new Date(leave.createdAt) : new Date()
      ]
    );
  }

  // Leave Balances
  public static async getLeaveBalances(userId?: string): Promise<LeaveBalance[]> {
    let sql = 'SELECT * FROM leave_balances';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }
    const rows = await query(sql, params);
    return rows.map(Mapper.mapLeaveBalance);
  }

  public static async saveLeaveBalance(balance: LeaveBalance): Promise<void> {
    await query(
      `INSERT INTO leave_balances (id, user_id, leave_type, allocated, used, pending)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE allocated = VALUES(allocated), used = VALUES(used), pending = VALUES(pending)`,
      [balance.id, balance.userId, balance.leaveType, balance.allocated, balance.used, balance.pending]
    );
  }

  // Holidays
  public static async getHolidays(): Promise<Holiday[]> {
    const rows = await query('SELECT * FROM holidays');
    return rows.map(Mapper.mapHoliday);
  }

  // System Settings
  public static async getSystemSettings(): Promise<SystemSetting[]> {
    const rows = await query('SELECT * FROM system_settings');
    return rows.map(Mapper.mapSystemSetting);
  }
}
