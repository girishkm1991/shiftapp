import { query, useMySQL } from '../db/mysql';
import { dbInstance } from '../db/database';
import { Mapper } from './Mapper';
import { Notification } from '../../src/types';

export class NotificationRepository {
  public static async getNotifications(userId?: string): Promise<Notification[]> {
    if (useMySQL()) {
      let sql = 'SELECT * FROM notifications';
      const params: any[] = [];
      if (userId) {
        sql += ' WHERE user_id = ?';
        params.push(userId);
      }
      sql += ' ORDER BY created_at DESC';
      const rows = await query(sql, params);
      return rows.map(Mapper.mapNotification);
    } else {
      const all = dbInstance.getNotifications();
      const filtered = userId ? all.filter(n => n.userId === userId) : all;
      return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }

  public static async saveNotification(n: Notification): Promise<void> {
    if (useMySQL()) {
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
    } else {
      dbInstance.updateState(state => {
        const idx = state.notifications.findIndex(item => item.id === n.id);
        if (idx !== -1) {
          state.notifications[idx] = n;
        } else {
          state.notifications.push(n);
        }
      });
    }
  }

  public static async markAsRead(id: string): Promise<void> {
    if (useMySQL()) {
      await query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    } else {
      dbInstance.updateState(state => {
        const n = state.notifications.find(item => item.id === id);
        if (n) {
          n.isRead = true;
        }
      });
    }
  }

  public static async markAllAsRead(userId: string): Promise<void> {
    if (useMySQL()) {
      await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    } else {
      dbInstance.updateState(state => {
        state.notifications.forEach(n => {
          if (n.userId === userId) {
            n.isRead = true;
          }
        });
      });
    }
  }
}
