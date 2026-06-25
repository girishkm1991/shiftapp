import { query, useMySQL } from '../db/mysql';
import { dbInstance } from '../db/database';
import { Mapper } from './Mapper';
import { Shift, ShiftAssignment, ShiftTemplate } from '../../src/types';

export class ShiftRepository {
  public static async getShifts(): Promise<Shift[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM shifts');
      return rows.map(Mapper.mapShift);
    } else {
      return dbInstance.getShifts();
    }
  }

  public static async getShiftAssignments(userId?: string): Promise<ShiftAssignment[]> {
    if (useMySQL()) {
      let sql = 'SELECT * FROM shift_assignments';
      const params: any[] = [];
      if (userId) {
        sql += ' WHERE user_id = ?';
        params.push(userId);
      }
      const rows = await query(sql, params);
      return rows.map(Mapper.mapShiftAssignment);
    } else {
      const all = dbInstance.getShiftAssignments();
      return userId ? all.filter(a => a.userId === userId) : all;
    }
  }

  public static async saveShiftAssignment(assignment: ShiftAssignment): Promise<void> {
    if (useMySQL()) {
      await query(
        `INSERT INTO shift_assignments (id, user_id, date, shift_code, machine_id)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE shift_code = VALUES(shift_code), machine_id = VALUES(machine_id)`,
        [
          assignment.id,
          assignment.userId,
          assignment.date,
          assignment.shiftCode,
          assignment.machineId || null
        ]
      );
      try {
        const { ScheduleResolutionService } = await import('../services/ScheduleResolutionService');
        ScheduleResolutionService.updateAssignmentInCache(assignment);
      } catch (e) {
        console.error('[ShiftRepository] Failed to update assignment in cache:', e);
      }
    } else {
      dbInstance.updateState(state => {
        const idx = state.shiftAssignments.findIndex(sa => sa.id === assignment.id);
        if (idx !== -1) {
          state.shiftAssignments[idx] = assignment;
        } else {
          state.shiftAssignments.push(assignment);
        }
      });
    }
  }

  public static async getShiftTemplates(): Promise<ShiftTemplate[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM shift_templates');
      return rows.map(Mapper.mapShiftTemplate);
    } else {
      return dbInstance.getShiftTemplates();
    }
  }
}
