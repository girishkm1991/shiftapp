import { Server as SocketIOServer } from 'socket.io';
import { getNotificationService, NotificationService } from './NotificationService';

export class SocketService {
  private static io: SocketIOServer | null = null;

  public static init(server: any) {
    if (this.io) {
      console.warn('[SocketService] Already initialized.');
      return;
    }

    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    console.log('[SocketService] Socket.IO initialized.');

    // 1. Register real-time notifier callback in NotificationService
    NotificationService.registerRealtimeNotifier((userId, notification) => {
      this.broadcastNotification(userId, notification);
    });

    // 2. Handle connection events
    this.io.on('connection', (socket) => {
      console.log(`[SocketService] Client connected: ${socket.id}`);

      // User room joining
      socket.on('join_user', (userId: string) => {
        socket.join(`user_${userId}`);
        console.log(`[SocketService] Socket ${socket.id} joined user room: user_${userId}`);
      });

      // Conversation room joining
      socket.on('join_conversation', (conversationId: string) => {
        socket.join(`conv_${conversationId}`);
        console.log(`[SocketService] Socket ${socket.id} joined conversation room: conv_${conversationId}`);
      });

      // Conversation room leaving
      socket.on('leave_conversation', (conversationId: string) => {
        socket.leave(`conv_${conversationId}`);
        console.log(`[SocketService] Socket ${socket.id} left conversation room: conv_${conversationId}`);
      });

      socket.on('disconnect', () => {
        console.log(`[SocketService] Client disconnected: ${socket.id}`);
      });
    });
  }

  // Broadcast a real-time message to a specific conversation room
  public static broadcastMessage(conversationId: string, message: any) {
    if (this.io) {
      this.io.to(`conv_${conversationId}`).emit('message', message);
      console.log(`[SocketService] Broadcast message for conversation ${conversationId} to conv_${conversationId}`);
    } else {
      console.warn('[SocketService] Cannot broadcast message, socket.io not initialized.');
    }
  }

  // Broadcast a real-time notification to a specific user room
  public static broadcastNotification(userId: string, notification: any) {
    if (this.io) {
      this.io.to(`user_${userId}`).emit('notification', notification);
      console.log(`[SocketService] Broadcast notification to user_${userId}: "${notification.title}"`);
    } else {
      console.warn('[SocketService] Cannot broadcast notification, socket.io not initialized.');
    }
  }
}
