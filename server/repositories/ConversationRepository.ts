import { query, useMySQL } from '../db/mysql';
import { dbInstance } from '../db/database';
import { Mapper } from './Mapper';
import { Conversation, ConversationParticipant } from '../../src/types';

export class ConversationRepository {
  public static async getConversations(): Promise<Conversation[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM conversations ORDER BY created_at DESC');
      return rows.map(Mapper.mapConversation);
    } else {
      return dbInstance.getConversations();
    }
  }

  public static async getConversationById(id: string): Promise<Conversation | null> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM conversations WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return Mapper.mapConversation(rows[0]);
    } else {
      return dbInstance.getConversations().find(c => c.id === id) || null;
    }
  }

  public static async saveConversation(conversation: Conversation): Promise<void> {
    if (useMySQL()) {
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
    } else {
      dbInstance.updateState(state => {
        const idx = state.conversations.findIndex(c => c.id === conversation.id);
        if (idx !== -1) {
          state.conversations[idx] = conversation;
        } else {
          state.conversations.push(conversation);
        }
      });
    }
  }

  public static async getConversationParticipants(conversationId?: string): Promise<ConversationParticipant[]> {
    if (useMySQL()) {
      let sql = 'SELECT * FROM conversation_participants';
      const params: any[] = [];
      if (conversationId) {
        sql += ' WHERE conversation_id = ?';
        params.push(conversationId);
      }
      const rows = await query(sql, params);
      return rows.map(Mapper.mapConversationParticipant);
    } else {
      const all = dbInstance.getConversationParticipants();
      return conversationId ? all.filter(cp => cp.conversationId === conversationId) : all;
    }
  }

  public static async saveConversationParticipant(participant: ConversationParticipant): Promise<void> {
    if (useMySQL()) {
      await query(
        `INSERT INTO conversation_participants (id, conversation_id, user_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE id = id`, // No op on duplicate
        [participant.id, participant.conversationId, participant.userId]
      );
    } else {
      dbInstance.updateState(state => {
        const idx = state.conversationParticipants.findIndex(cp => cp.id === participant.id);
        if (idx === -1) {
          state.conversationParticipants.push(participant);
        }
      });
    }
  }
}
