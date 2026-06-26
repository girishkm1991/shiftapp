import { query } from '../db/mysql';
import { dbInstance } from '../db/database';
import { SocketService } from './SocketService';

export class TelegramNotificationService {
  private static isPolling = false;
  private static lastUpdateId = 0;

  /**
   * Start long-polling Telegram API for updates.
   * Runs in the background and processes /link commands.
   */
  public static startPolling() {
    const enabled = process.env.TELEGRAM_ENABLED === 'true';
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!enabled) {
      console.log('[TelegramNotificationService] Polling not started: Telegram integration is disabled in env.');
      return;
    }

    if (!token) {
      console.warn('[TelegramNotificationService] Polling not started: TELEGRAM_BOT_TOKEN is not set.');
      return;
    }

    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    console.log('[TelegramNotificationService] Starting Telegram Bot polling loop...');
    this.poll().catch(err => {
      console.error('[TelegramNotificationService] Polling loop encountered critical error:', err);
    });
  }

  private static async poll() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    while (this.isPolling) {
      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.lastUpdateId}&timeout=15`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`getUpdates returned status ${res.status}`);
        }
        const data = await res.json();
        if (data.ok && data.result) {
          for (const update of data.result) {
            this.lastUpdateId = update.update_id + 1;
            await this.handleUpdate(update);
          }
        }
      } catch (err: any) {
        console.error('[TelegramNotificationService] Polling error:', err.message || err);
        // Wait 5 seconds before retrying to avoid aggressive looping on network errors
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private static async handleUpdate(update: any) {
    if (!update.message || !update.message.text) {
      return;
    }

    const chatId = String(update.message.chat.id);
    const text = update.message.text.trim();
    const from = update.message.from || {};
    const telegramUsername = from.username || '';
    const telegramName = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'User';

    // Matches any link code pattern LINK-[digits]-[alphanumeric]
    const linkMatch = text.match(/\b(LINK-\d+-[A-Za-z0-9]+)\b/i);

    if (text.startsWith('/start') || text.startsWith('/link')) {
      if (linkMatch) {
        const code = linkMatch[1].toUpperCase();
        await this.handleLinkCode(chatId, code, telegramUsername, telegramName);
      } else {
        await this.send(
          chatId,
          `👋 <b>Welcome to Imvelo Shift Bot!</b>\n\nTo link your account and receive secure shift alerts, please generate a linking code in your <b>Profile Settings</b> inside Imvelo Shift, then copy the code and send it here:\n\n<code>/link LINK-XXXXXX-YYYYYY</code>`
        );
      }
    } else if (linkMatch) {
      const code = linkMatch[1].toUpperCase();
      await this.handleLinkCode(chatId, code, telegramUsername, telegramName);
    } else {
      await this.send(
        chatId,
        `🤖 <b>Imvelo Shift Bot is Active</b>\n\nUse <code>/link &lt;code&gt;</code> to connect your account securely, or generate a link code in your Imvelo Shift web interface.`
      );
    }
  }

  private static async handleLinkCode(chatId: string, code: string, telegramUsername: string, telegramName: string) {
    const uuidHelper = () => Math.random().toString(36).substring(2, 11);
    const displayName = telegramUsername ? `@${telegramUsername}` : telegramName;

    try {
      // Find the pending, unexpired request matching the code
      const requests = await query<any[]>(
        'SELECT * FROM telegram_link_requests WHERE link_code = ? AND used = FALSE AND expires_at > NOW()',
        [code]
      );

      if (requests.length === 0) {
        await this.send(
          chatId,
          `❌ <b>Invalid or expired linking code.</b>\n\nPlease generate a new code from Imvelo Shift.`
        );
        return;
      }

      const request = requests[0];
      const userId = request.user_id;

      // Update user details in database
      await query(
        'UPDATE users SET telegram_chat_id = ?, telegram_username = ?, telegram_notifications_enabled = TRUE WHERE id = ?',
        [chatId, displayName, userId]
      );

      // Mark code as used
      await query(
        'UPDATE telegram_link_requests SET used = TRUE WHERE id = ?',
        [request.id]
      );

      // Insert audit log
      await query(
        'INSERT INTO telegram_link_audit (id, user_id, telegram_chat_id, action) VALUES (?, ?, ?, ?)',
        [uuidHelper(), userId, chatId, 'LINK']
      );

      // Update in-memory state
      dbInstance.updateState(state => {
        const u = state.users.find(user => user.id === userId);
        if (u) {
          u.telegramChatId = chatId;
          u.telegramUsername = displayName;
          u.telegramNotificationsEnabled = true;
        }

        // Add to standard system audit log so admins can see it immediately on dashboard
        state.auditLogs.push({
          id: uuidHelper(),
          userId: userId,
          action: 'TELEGRAM_LINK',
          oldValue: null,
          newValue: JSON.stringify({ chatId, username: displayName }),
          timestamp: new Date().toISOString()
        });
      });

      // Broadcast real-time update to the browser interface
      SocketService.broadcastToUser(userId, 'telegram_linked', {
        telegramChatId: chatId,
        telegramUsername: displayName,
        telegramNotificationsEnabled: true
      });

      // Reply confirming link
      await this.send(
        chatId,
        `✅ <b>Telegram successfully linked to Imvelo Shift.</b>\n\nYou will now receive:\n• Shift Swap Requests\n• Volunteer Requests\n• Approval Decisions\n• Admin Notifications`
      );

      console.log(`[TelegramNotificationService] Successfully linked user ${userId} to Telegram chat ${chatId} using code ${code}`);

    } catch (err) {
      console.error('[TelegramNotificationService] Error during link code execution:', err);
      await this.send(
        chatId,
        `❌ <b>Internal Linking Error</b>\n\nAn error occurred while linking your account. Please try generating a new code.`
      );
    }
  }

  /**
   * Send a telegram notification using the Telegram Bot API.
   * Failures are caught and logged so they do not break business workflows.
   */
  public static async send(chatId: string, message: string): Promise<boolean> {
    const enabled = process.env.TELEGRAM_ENABLED === 'true';
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!enabled) {
      console.log(`[TelegramNotificationService] Telegram is disabled. Message to ${chatId} skipped: "${message.substring(0, 40)}..."`);
      return false;
    }

    if (!token) {
      console.warn('[TelegramNotificationService] Telegram is enabled but TELEGRAM_BOT_TOKEN is not set.');
      return false;
    }

    if (!chatId) {
      console.warn('[TelegramNotificationService] No chatId provided for Telegram notification.');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML', // Supports basic HTML formatting
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelegramNotificationService] Telegram API responded with error: ${response.status} - ${errorText}`);
        return false;
      }

      console.log(`[TelegramNotificationService] Notification successfully sent to chatId ${chatId}`);
      return true;
    } catch (error) {
      console.error('[TelegramNotificationService] Failed to send Telegram notification:', error);
      return false;
    }
  }
}
