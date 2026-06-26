import { query } from '../db/mysql';
import { Mapper } from './Mapper';
import { Message } from '../../src/types';

export class MessageRepository {
  public static async getMessages(conversationId?: string): Promise<Message[]> {
    let sql = 'SELECT * FROM messages';
    const params: any[] = [];
    if (conversationId) {
      sql += ' WHERE conversation_id = ?';
      params.push(conversationId);
    }
    sql += ' ORDER BY created_at ASC';
    const rows = await query(sql, params);
    return rows.map(Mapper.mapMessage);
  }

  public static async saveMessage(msg: Message): Promise<void> {
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
  }
}
