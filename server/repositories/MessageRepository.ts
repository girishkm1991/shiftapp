import { query, useMySQL } from '../db/mysql';
import { dbInstance } from '../db/database';
import { Mapper } from './Mapper';
import { Message } from '../../src/types';

export class MessageRepository {
  public static async getMessages(conversationId?: string): Promise<Message[]> {
    if (useMySQL()) {
      let sql = 'SELECT * FROM messages';
      const params: any[] = [];
      if (conversationId) {
        sql += ' WHERE conversation_id = ?';
        params.push(conversationId);
      }
      sql += ' ORDER BY created_at ASC';
      const rows = await query(sql, params);
      return rows.map(Mapper.mapMessage);
    } else {
      const all = dbInstance.getMessages();
      const filtered = conversationId ? all.filter(m => m.conversationId === conversationId) : all;
      return [...filtered].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  }

  public static async saveMessage(msg: Message): Promise<void> {
    if (useMySQL()) {
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
    } else {
      dbInstance.updateState(state => {
        const idx = state.messages.findIndex(m => m.id === msg.id);
        if (idx !== -1) {
          state.messages[idx] = msg;
        } else {
          state.messages.push(msg);
        }
      });
    }
  }
}
