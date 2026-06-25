import { query, useMySQL } from '../db/mysql';
import { dbInstance } from '../db/database';
import { Mapper } from './Mapper';
import { AuditLog } from '../../src/types';

export class AuditRepository {
  public static async getAuditLogs(): Promise<AuditLog[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
      return rows.map(Mapper.mapAuditLog);
    } else {
      const all = dbInstance.getAuditLogs();
      return [...all].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  }

  public static async saveAuditLog(log: AuditLog): Promise<void> {
    if (useMySQL()) {
      await query(
        `INSERT INTO audit_logs (id, user_id, action, timestamp, old_value, new_value)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          log.id,
          log.userId,
          log.action,
          log.timestamp ? new Date(log.timestamp) : new Date(),
          log.oldValue || null,
          log.newValue || null
        ]
      );
    } else {
      dbInstance.updateState(state => {
        state.auditLogs.push(log);
      });
    }
  }
}
