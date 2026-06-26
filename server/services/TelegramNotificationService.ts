export class TelegramNotificationService {
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
