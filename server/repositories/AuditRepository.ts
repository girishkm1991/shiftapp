import { query } from '../db/mysql';
import { Mapper } from './Mapper';
import { AuditLog } from '../../src/types';

export class AuditRepository {
  public static async getAuditLogs(): Promise<AuditLog[]> {
    const rows = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
    return rows.map(Mapper.mapAuditLog);
  }

  public static async saveAuditLog(log: AuditLog): Promise<void> {
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
  }
}
