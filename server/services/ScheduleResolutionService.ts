import { dbInstance } from '../db/database';
import { useMySQL, query } from '../db/mysql';
import { ShiftAssignment, EmployeeDefaultShiftPattern } from '../../src/types';

export class ScheduleResolutionService {
  private static cachedAssignments: ShiftAssignment[] = [];
  private static cachedPatterns: EmployeeDefaultShiftPattern[] = [];
  private static isInitialized = false;

  public static async initCache() {
    if (!useMySQL()) return;
    try {
      const assignRows = await query('SELECT * FROM shift_assignments');
      this.cachedAssignments = assignRows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        date: row.date,
        shiftCode: row.shift_code,
        machineId: row.machine_id
      }));

      const patternRows = await query('SELECT * FROM employee_default_shift_patterns');
      this.cachedPatterns = patternRows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        dayOfWeek: row.day_of_week,
        shiftCode: row.shift_code
      }));

      this.isInitialized = true;
      console.log('[ScheduleResolutionService] Cache initialized with MySQL data.');
    } catch (err) {
      console.error('[ScheduleResolutionService] Failed to initialize cache from MySQL:', err);
    }
  }

  public static updateAssignmentInCache(asg: ShiftAssignment) {
    const idx = this.cachedAssignments.findIndex(a => a.id === asg.id);
    if (idx !== -1) {
      this.cachedAssignments[idx] = asg;
    } else {
      this.cachedAssignments.push(asg);
    }
  }

  public static updatePatternInCache(pat: EmployeeDefaultShiftPattern) {
    const idx = this.cachedPatterns.findIndex(p => p.id === pat.id);
    if (idx !== -1) {
      this.cachedPatterns[idx] = pat;
    } else {
      this.cachedPatterns.push(pat);
    }
  }

  /**
   * Resolves the shift code for an employee on a given date using the defined priority:
   * 1. Explicit supervisor-approved assignment (shiftAssignments).
   * 2. Employee weekly default pattern (employeeDefaultShiftPatterns).
   * 3. OFF (Default fallback).
   */
  public static resolveEmployeeShift(employeeId: string, dateStr: string): { shiftCode: 'A' | 'B' | 'C' | 'OFF'; source: string } {
    // 1. Explicit supervisor-approved assignment
    const assignments = useMySQL() ? this.cachedAssignments : dbInstance.getShiftAssignments();
    const directAssign = assignments.find(a => a.userId === employeeId && a.date === dateStr);
    if (directAssign) {
      const result = {
        shiftCode: directAssign.shiftCode as 'A' | 'B' | 'C' | 'OFF',
        source: 'Explicit supervisor-approved assignment'
      };
      this.logResolution('Backend API / System', employeeId, dateStr, result.shiftCode, result.source);
      return result;
    }

    // 2. Employee weekly default pattern
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month - 1, day);
      const dayOfWeek = d.getDay(); // 0: Sun, 1: Mon, etc.

      const defaultPatterns = useMySQL() ? this.cachedPatterns : dbInstance.getEmployeeDefaultShiftPatterns();
      const pattern = defaultPatterns.find(p => p.userId === employeeId && p.dayOfWeek === dayOfWeek);
      if (pattern) {
        const result = {
          shiftCode: pattern.shiftCode as 'A' | 'B' | 'C' | 'OFF',
          source: 'Employee weekly default pattern'
        };
        this.logResolution('Backend API / System', employeeId, dateStr, result.shiftCode, result.source);
        return result;
      }
    }

    // 3. Fallback to OFF
    const result = {
      shiftCode: 'OFF' as const,
      source: 'OFF'
    };
    this.logResolution('Backend API / System', employeeId, dateStr, result.shiftCode, result.source);
    return result;
  }

  public static logResolution(moduleName: string, employeeId: string, date: string, shiftCode: string, source: string) {
    console.log(`Diagnostic Log:
Module: ${moduleName}
Employee: ${employeeId}
Date: ${date}
Resolved Shift: ${shiftCode}
Resolution Source: ${source}`);
  }
}
