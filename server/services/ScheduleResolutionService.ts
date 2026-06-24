import { dbInstance } from '../db/database';

export class ScheduleResolutionService {
  /**
   * Resolves the shift code for an employee on a given date using the defined priority:
   * 1. Explicit supervisor-approved assignment (shiftAssignments).
   * 2. Employee weekly default pattern (employeeDefaultShiftPatterns).
   * 3. OFF (Default fallback).
   */
  public static resolveEmployeeShift(employeeId: string, dateStr: string): { shiftCode: 'A' | 'B' | 'C' | 'OFF'; source: string } {
    // 1. Explicit supervisor-approved assignment
    const assignments = dbInstance.getShiftAssignments();
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

      const defaultPatterns = dbInstance.getEmployeeDefaultShiftPatterns();
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
