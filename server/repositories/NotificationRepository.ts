import { query } from '../db/mysql';
import { Mapper } from './Mapper';
import { Notification } from '../../src/types';

export class NotificationRepository {
  public static async getNotifications(userId?: string): Promise<Notification[]> {
    let sql = 'SELECT * FROM notifications';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await query(sql, params);
    return rows.map(Mapper.mapNotification);
  }

  public static async saveNotification(n: Notification): Promise<void> {
    await query(
      `INSERT INTO notifications (id, user_id, title, body, type, is_read, link, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_read = VALUES(is_read)`,
      [
        n.id,
        n.userId,
        n.title,
        n.body,
        n.type,
        n.isRead ? 1 : 0,
        n.link || null,
        n.createdAt ? new Date(n.createdAt) : new Date()
      ]
    );
  }

  public static async markAsRead(id: string): Promise<void> {
    await query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
  }

  public static async markAllAsRead(userId: string): Promise<void> {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
  }
}
