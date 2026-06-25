import { query, useMySQL } from '../db/mysql';
import { dbInstance } from '../db/database';
import { Mapper } from './Mapper';
import { User, Role, Department, Section, Team, Machine, Skill, EmployeeSkill, EmployeeMachineMapping, EmployeeDefaultShiftPattern, LeaveRequest, LeaveBalance, Holiday, SystemSetting } from '../../src/types';

export class UserRepository {
  public static async findById(id: string): Promise<User | null> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
      if (rows.length === 0) return null;
      return Mapper.mapUser(rows[0]);
    } else {
      return dbInstance.getUsers().find(u => u.id === id) || null;
    }
  }

  public static async findByClockId(clockId: string): Promise<User | null> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM users WHERE UPPER(clock_id) = ? AND deleted_at IS NULL', [clockId.toUpperCase().trim()]);
      if (rows.length === 0) return null;
      return Mapper.mapUser(rows[0]);
    } else {
      return dbInstance.getUsers().find(u => u.clockId.toUpperCase() === clockId.toUpperCase().trim()) || null;
    }
  }

  public static async findAll(): Promise<User[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM users WHERE deleted_at IS NULL');
      return rows.map(Mapper.mapUser);
    } else {
      return dbInstance.getUsers();
    }
  }

  public static async create(user: User): Promise<void> {
    if (useMySQL()) {
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
    } else {
      dbInstance.updateState(state => {
        state.users.push(user);
      });
    }
  }

  public static async update(id: string, updates: Partial<User>): Promise<void> {
    if (useMySQL()) {
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
        createdAt: 'created_at'
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
    } else {
      dbInstance.updateState(state => {
        const user = state.users.find(u => u.id === id);
        if (user) {
          Object.assign(user, updates);
        }
      });
    }
  }

  public static async delete(id: string): Promise<void> {
    if (useMySQL()) {
      await query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    } else {
      dbInstance.updateState(state => {
        state.users = state.users.filter(u => u.id !== id);
      });
    }
  }

  // Roles
  public static async getRoles(): Promise<Role[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM roles');
      return rows.map(Mapper.mapRole);
    } else {
      return dbInstance.getRoles();
    }
  }

  // Departments
  public static async getDepartments(): Promise<Department[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM departments');
      return rows.map(Mapper.mapDepartment);
    } else {
      return dbInstance.getDepartments();
    }
  }

  // Sections
  public static async getSections(): Promise<Section[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM sections');
      return rows.map(Mapper.mapSection);
    } else {
      return dbInstance.getSections();
    }
  }

  // Teams
  public static async getTeams(): Promise<Team[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM teams');
      return rows.map(Mapper.mapTeam);
    } else {
      return dbInstance.getTeams();
    }
  }

  // Machines
  public static async getMachines(): Promise<Machine[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM machines');
      return rows.map(Mapper.mapMachine);
    } else {
      return dbInstance.getMachines();
    }
  }

  // Skills
  public static async getSkills(): Promise<Skill[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM skills');
      return rows.map(Mapper.mapSkill);
    } else {
      return dbInstance.getSkills();
    }
  }

  // Employee Skills Mapping
  public static async getEmployeeSkills(): Promise<EmployeeSkill[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM employee_skills');
      return rows.map(Mapper.mapEmployeeSkill);
    } else {
      return dbInstance.getEmployeeSkills();
    }
  }

  public static async saveEmployeeSkill(skill: EmployeeSkill): Promise<void> {
    if (useMySQL()) {
      await query(
        `INSERT INTO employee_skills (id, user_id, skill_id, certification_date, expiry_date)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE certification_date = VALUES(certification_date), expiry_date = VALUES(expiry_date)`,
        [skill.id, skill.userId, skill.skillId, skill.certificationDate, skill.expiryDate]
      );
    } else {
      dbInstance.updateState(state => {
        const idx = state.employeeSkills.findIndex(es => es.id === skill.id);
        if (idx !== -1) {
          state.employeeSkills[idx] = skill;
        } else {
          state.employeeSkills.push(skill);
        }
      });
    }
  }

  // Employee Machine Certifications Mapping
  public static async getEmployeeMachineMappings(): Promise<EmployeeMachineMapping[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM employee_machine_mapping');
      return rows.map(Mapper.mapEmployeeMachineMapping);
    } else {
      return dbInstance.getEmployeeMachineMapping();
    }
  }

  public static async saveEmployeeMachineMapping(mapping: EmployeeMachineMapping): Promise<void> {
    if (useMySQL()) {
      await query(
        `INSERT INTO employee_machine_mapping (id, user_id, machine_id, is_certified)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE is_certified = VALUES(is_certified)`,
        [mapping.id, mapping.userId, mapping.machineId, mapping.isCertified ? 1 : 0]
      );
    } else {
      dbInstance.updateState(state => {
        const idx = state.employeeMachineMapping.findIndex(emm => emm.id === mapping.id);
        if (idx !== -1) {
          state.employeeMachineMapping[idx] = mapping;
        } else {
          state.employeeMachineMapping.push(mapping);
        }
      });
    }
  }

  // Default Shift Patterns
  public static async getEmployeeDefaultShiftPatterns(userId?: string): Promise<EmployeeDefaultShiftPattern[]> {
    if (useMySQL()) {
      let sql = 'SELECT * FROM employee_default_shift_patterns';
      const params: any[] = [];
      if (userId) {
        sql += ' WHERE user_id = ?';
        params.push(userId);
      }
      const rows = await query(sql, params);
      return rows.map(Mapper.mapEmployeeDefaultShiftPattern);
    } else {
      const all = dbInstance.getEmployeeDefaultShiftPatterns();
      return userId ? all.filter(p => p.userId === userId) : all;
    }
  }

  public static async saveEmployeeDefaultShiftPattern(pattern: EmployeeDefaultShiftPattern): Promise<void> {
    if (useMySQL()) {
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
    } else {
      dbInstance.updateState(state => {
        const idx = state.employeeDefaultShiftPatterns.findIndex(p => p.id === pattern.id);
        if (idx !== -1) {
          state.employeeDefaultShiftPatterns[idx] = pattern;
        } else {
          state.employeeDefaultShiftPatterns.push(pattern);
        }
      });
    }
  }

  // Leave Requests
  public static async getLeaveRequests(userId?: string): Promise<LeaveRequest[]> {
    if (useMySQL()) {
      let sql = 'SELECT * FROM leave_requests';
      const params: any[] = [];
      if (userId) {
        sql += ' WHERE user_id = ?';
        params.push(userId);
      }
      const rows = await query(sql, params);
      return rows.map(Mapper.mapLeaveRequest);
    } else {
      const all = dbInstance.getLeaveRequests();
      return userId ? all.filter(l => l.userId === userId) : all;
    }
  }

  public static async saveLeaveRequest(leave: LeaveRequest): Promise<void> {
    if (useMySQL()) {
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
    } else {
      dbInstance.updateState(state => {
        const idx = state.leaveRequests.findIndex(l => l.id === leave.id);
        if (idx !== -1) {
          state.leaveRequests[idx] = leave;
        } else {
          state.leaveRequests.push(leave);
        }
      });
    }
  }

  // Leave Balances
  public static async getLeaveBalances(userId?: string): Promise<LeaveBalance[]> {
    if (useMySQL()) {
      let sql = 'SELECT * FROM leave_balances';
      const params: any[] = [];
      if (userId) {
        sql += ' WHERE user_id = ?';
        params.push(userId);
      }
      const rows = await query(sql, params);
      return rows.map(Mapper.mapLeaveBalance);
    } else {
      const all = dbInstance.getLeaveBalances();
      return userId ? all.filter(b => b.userId === userId) : all;
    }
  }

  public static async saveLeaveBalance(balance: LeaveBalance): Promise<void> {
    if (useMySQL()) {
      await query(
        `INSERT INTO leave_balances (id, user_id, leave_type, allocated, used, pending)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE allocated = VALUES(allocated), used = VALUES(used), pending = VALUES(pending)`,
        [balance.id, balance.userId, balance.leaveType, balance.allocated, balance.used, balance.pending]
      );
    } else {
      dbInstance.updateState(state => {
        const idx = state.leaveBalances.findIndex(b => b.id === balance.id);
        if (idx !== -1) {
          state.leaveBalances[idx] = balance;
        } else {
          state.leaveBalances.push(balance);
        }
      });
    }
  }

  // Holidays
  public static async getHolidays(): Promise<Holiday[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM holidays');
      return rows.map(Mapper.mapHoliday);
    } else {
      return dbInstance.getHolidays();
    }
  }

  // System Settings
  public static async getSystemSettings(): Promise<SystemSetting[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM system_settings');
      return rows.map(Mapper.mapSystemSetting);
    } else {
      return dbInstance.getSystemSettings();
    }
  }
}
