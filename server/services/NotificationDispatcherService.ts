import { dbInstance } from '../db/database';
import { getNotificationService } from './NotificationService';
import { SocketService } from './SocketService';
import { TelegramNotificationService } from './TelegramNotificationService';
import { Message, Notification } from '../../src/types';

export interface DispatchPayload {
  type: 'OPEN_MARKETPLACE_CREATED' | 'DIRECT_SWAP_CREATED' | 'VOLUNTEER_JOINED' | 'REVIEW_ASSIGNED' | 'SWAP_APPROVED' | 'SWAP_REJECTED' | 'SWAP_CANCELLED' | 'LEAVE_APPLIED' | 'LEAVE_DECISION' | 'CHAT_MESSAGE' | string;
  recipients: string[]; // Array of recipient User IDs
  title: string;
  message: string;
  link?: string;
}

export class NotificationDispatcherService {
  /**
   * Dispatches business events to all enabled notification channels.
   * Extensible for future WhatsApp, Email, and Push Notification channels.
   */
  public static async dispatch(payload: DispatchPayload): Promise<void> {
    const { type, recipients, title, message, link } = payload;
    console.log(`[NotificationDispatcherService] Dispatching event "${type}" with title "${title}" to ${recipients.length} recipients.`);

    for (const userId of recipients) {
      // 1. Retrieve the recipient User object directly from MySQL to prevent stale in-memory state
      let user: any = null;
      try {
        const { query } = await import('../db/mysql');
        const usersResult = await query<any[]>('SELECT * FROM users WHERE id = ?', [userId]);
        if (usersResult && usersResult.length > 0) {
          user = usersResult[0];
        }
      } catch (dbErr) {
        console.error(`[NotificationDispatcherService] Failed to fetch user ${userId} from MySQL:`, dbErr);
      }

      if (!user) {
        console.warn(`[NotificationDispatcherService] Recipient user with ID "${userId}" not found. Skipping.`);
        continue;
      }

      // 2. Read preferences supporting both camelCase and snake_case fields safely
      const inAppEnabled =
        user.in_app_notifications_enabled !== 0 &&
        user.inAppNotificationsEnabled !== false; // Default: ON

      const internalMessagesEnabled =
        user.internal_messages_enabled !== 0 &&
        user.internalMessagesEnabled !== false; // Default: ON

      const telegramEnabled =
        user.telegram_notifications_enabled === 1 ||
        user.telegramNotificationsEnabled === true; // Default: OFF

      const telegramChatId =
        user.telegram_chat_id ||
        user.telegramChatId;

      const recipientName =
        user.name ||
        user.username ||
        'Unknown';

      // 3. Detailed Diagnostic Logging
      console.log('--- [NotificationDispatcher] Diagnostic Log ---');
      console.log('[NotificationDispatcher] Event Type:', type);
      console.log('[NotificationDispatcher] Recipient ID:', userId);
      console.log('[NotificationDispatcher] Recipient Name:', recipientName);
      console.log('[NotificationDispatcher] Telegram Enabled:', telegramEnabled);
      console.log('[NotificationDispatcher] Chat ID:', telegramChatId);

      // --- CHANNEL 1: IN-APP NOTIFICATION ---
      if (inAppEnabled) {
        try {
          // Deliver using current in-app NotificationService (which handles DB state + Socket.IO real-time)
          const typeMapping: Notification['type'] = 
            type.includes('LEAVE') ? 'leave' :
            type.includes('CHAT') ? 'chat' : 'swap';

          await getNotificationService().sendNotification(userId, title, message, typeMapping, link);
          await this.logDelivery(userId, 'in-app', type, 'sent');
          console.log('[NotificationDispatcher] Channel "in-app" execution result: sent');
        } catch (error: any) {
          console.error(`[NotificationDispatcherService] Failed to send In-App notification to ${userId}:`, error);
          await this.logDelivery(userId, 'in-app', type, 'failed', error.message || String(error));
          console.log(`[NotificationDispatcher] Channel "in-app" execution result: failed (${error.message || String(error)})`);
        }
      } else {
        await this.logDelivery(userId, 'in-app', type, 'skipped', 'Disabled in user preferences');
        console.log('[NotificationDispatcher] Channel "in-app" execution result: skipped (disabled)');
      }

      // --- CHANNEL 2: INTERNAL MESSAGES ---
      if (internalMessagesEnabled) {
        try {
          const sysConvId = `conv_sys_${userId}`;
          const newMsg: Message = {
            id: 'msg_sys_' + Math.random().toString(36).substring(2, 11),
            conversationId: sysConvId,
            senderId: 'system',
            text: `System Notification\n\n${message}`,
            isReadBy: [],
            createdAt: new Date().toISOString()
          };

          // Save System conversation & message to dbInstance state (updates local state + saves to MySQL)
          dbInstance.updateState(state => {
            // Check and create system conversation if not exists
            if (!state.conversations.some(c => c.id === sysConvId)) {
              state.conversations.push({
                id: sysConvId,
                type: 'direct',
                title: 'System Notifications',
                createdAt: new Date().toISOString()
              });
              state.conversationParticipants.push({
                id: `part_sys_s_${userId}`,
                conversationId: sysConvId,
                userId: 'system'
              });
              state.conversationParticipants.push({
                id: `part_sys_u_${userId}`,
                conversationId: sysConvId,
                userId: userId
              });
            }
            state.messages.push(newMsg);
          });

          // Broadcast real-time message via existing Socket.IO room so chat updates instantly
          SocketService.broadcastMessage(sysConvId, newMsg);

          await this.logDelivery(userId, 'internal-message', type, 'sent');
          console.log('[NotificationDispatcher] Channel "internal-message" execution result: sent');
        } catch (error: any) {
          console.error(`[NotificationDispatcherService] Failed to send Internal Message to ${userId}:`, error);
          await this.logDelivery(userId, 'internal-message', type, 'failed', error.message || String(error));
          console.log(`[NotificationDispatcher] Channel "internal-message" execution result: failed (${error.message || String(error)})`);
        }
      } else {
        await this.logDelivery(userId, 'internal-message', type, 'skipped', 'Disabled in user preferences');
        console.log('[NotificationDispatcher] Channel "internal-message" execution result: skipped (disabled)');
      }

      // --- CHANNEL 3: TELEGRAM BOT NOTIFICATIONS ---
      if (telegramEnabled) {
        if (telegramChatId) {
          try {
            // Clean message for safe Telegram transmission (basic formatting support)
            const formattedMsg = `<b>${title}</b>\n\n${message}`;
            const success = await TelegramNotificationService.send(telegramChatId, formattedMsg);
            
            if (success) {
              await this.logDelivery(userId, 'telegram', type, 'sent');
              console.log('[NotificationDispatcher] Channel "telegram" execution result: sent');
            } else {
              await this.logDelivery(userId, 'telegram', type, 'failed', 'Telegram bot API returned unsuccessful status');
              console.log('[NotificationDispatcher] Channel "telegram" execution result: failed (API returned unsuccessful status)');
            }
          } catch (error: any) {
            console.error(`[NotificationDispatcherService] Failed to deliver Telegram notification to ${userId}:`, error);
            await this.logDelivery(userId, 'telegram', type, 'failed', error.message || String(error));
            console.log(`[NotificationDispatcher] Channel "telegram" execution result: failed (${error.message || String(error)})`);
          }
        } else {
          await this.logDelivery(userId, 'telegram', type, 'skipped', 'Enabled but missing telegram_chat_id');
          console.log('[NotificationDispatcher] Channel "telegram" execution result: skipped (missing chat ID)');
        }
      } else {
        await this.logDelivery(userId, 'telegram', type, 'skipped', 'Disabled in user preferences');
        console.log('[NotificationDispatcher] Channel "telegram" execution result: skipped (disabled)');
      }

      console.log('------------------------------------------------');
      // --- CHANNELS 4+: FUTURE CHANNELS EXTENSILITY GATEWAY (e.g., WhatsApp, Email) ---
      // These can be integrated by adding similar blocks here without altering any upstream code.
    }
  }

  /**
   * Inserts an execution audit log entry to notification_delivery_logs in MySQL database.
   */
  private static async logDelivery(
    userId: string,
    channel: string,
    eventType: string,
    status: 'sent' | 'skipped' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      const { query } = await import('../db/mysql');
      const logId = 'log_' + Math.random().toString(36).substring(2, 11);
      await query(
        `INSERT INTO notification_delivery_logs (id, user_id, channel, event_type, status, error_message, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [logId, userId, channel, eventType, status, errorMessage || null, new Date()]
      );
    } catch (err) {
      // Failures to log should never interrupt core business notifications
      console.error('[NotificationDispatcherService] Failed to save delivery log:', err);
    }
  }
}

console.log('[NotificationDispatcherService] Initialized successfully.');

