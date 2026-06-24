import { dbInstance } from '../db/database';
import { getQueueService } from './QueueService';
import { Notification } from '../../src/types';

const uuid = () => Math.random().toString(36).substring(2, 11);

export interface INotificationService {
  sendNotification(userId: string, title: string, body: string, type: Notification['type'], link?: string): Promise<void>;
}

type RealtimeNotifier = (userId: string, notification: Notification) => void;

export class NotificationService implements INotificationService {
  private static realtimeNotifiers: RealtimeNotifier[] = [];

  constructor() {
    // Register queue handler for background notification processing
    const queueService = getQueueService();
    queueService.processQueue('notifications', async (jobName, data) => {
      if (jobName === 'send') {
        await this.handleProcessedNotification(data);
      }
    });
  }

  // Register real-time communication channel (Socket.IO)
  public static registerRealtimeNotifier(notifier: RealtimeNotifier) {
    this.realtimeNotifiers.push(notifier);
    console.log('[NotificationService] Registered real-time Socket.IO notifier.');
  }

  // Queue a notification to be sent in the background
  async sendNotification(userId: string, title: string, body: string, type: Notification['type'], link?: string): Promise<void> {
    const queueService = getQueueService();
    await queueService.addJob('notifications', 'send', {
      userId,
      title,
      body,
      type,
      link,
      createdAt: new Date().toISOString()
    });
  }

  // Actually save to DB and trigger Socket.IO notification real-time
  private async handleProcessedNotification(data: {
    userId: string;
    title: string;
    body: string;
    type: Notification['type'];
    link?: string;
    createdAt: string;
  }): Promise<void> {
    const newNotification: Notification = {
      id: uuid(),
      userId: data.userId,
      title: data.title,
      body: data.body,
      type: data.type,
      isRead: false,
      link: data.link || '',
      createdAt: data.createdAt
    };

    // 1. Save to state database
    dbInstance.updateState(state => {
      state.notifications.push(newNotification);
    });

    console.log(`[NotificationService] Notification persisted for user ${data.userId}: "${data.title}"`);

    // 2. Broadcast via Socket.IO
    NotificationService.realtimeNotifiers.forEach(notifier => {
      try {
        notifier(data.userId, newNotification);
      } catch (err) {
        console.error('[NotificationService] Error broadcasting real-time notification:', err);
      }
    });
  }
}

// Global instance of NotificationService
let notificationServiceInstance: INotificationService;

export function getNotificationService(): INotificationService {
  if (!notificationServiceInstance) {
    console.log('[NotificationService] Initializing Notification Service...');
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}
