import { query } from '../db/mysql';
import { Mapper } from './Mapper';
import { Conversation, ConversationParticipant } from '../../src/types';

export class ConversationRepository {
  public static async getConversations(): Promise<Conversation[]> {
    const rows = await query('SELECT * FROM conversations ORDER BY created_at DESC');
    return rows.map(Mapper.mapConversation);
  }

  public static async getConversationById(id: string): Promise<Conversation | null> {
    const rows = await query('SELECT * FROM conversations WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return Mapper.mapConversation(rows[0]);
  }

  public static async saveConversation(conversation: Conversation): Promise<void> {
    await query(
      `INSERT INTO conversations (id, type, title, swap_request_id, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), swap_request_id = VALUES(swap_request_id)`,
      [
        conversation.id,
        conversation.type,
        conversation.title || null,
        conversation.swapRequestId || null,
        conversation.createdAt ? new Date(conversation.createdAt) : new Date()
      ]
    );
  }

  public static async getConversationParticipants(conversationId?: string): Promise<ConversationParticipant[]> {
    let sql = 'SELECT * FROM conversation_participants';
    const params: any[] = [];
    if (conversationId) {
      sql += ' WHERE conversation_id = ?';
      params.push(conversationId);
    }
    const rows = await query(sql, params);
    return rows.map(Mapper.mapConversationParticipant);
  }

  public static async saveConversationParticipant(participant: ConversationParticipant): Promise<void> {
    await query(
      `INSERT INTO conversation_participants (id, conversation_id, user_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`, // No op on duplicate
      [participant.id, participant.conversationId, participant.userId]
    );
  }
}
