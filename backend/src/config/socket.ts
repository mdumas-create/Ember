import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server as HttpServer } from 'http';
import prisma from './database';

export const setupSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: '*', // Adjust for production
      methods: ['GET', 'POST']
    }
  });

  const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.io Redis adapter connected');
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join', (userId: string) => {
      (socket.data as any).userId = userId;
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined room user:${userId}`);
      pubClient.sAdd('online_users', userId).catch(() => {});
      socket.broadcast.emit('user_online', { userId });
    });

    socket.on('is_online', async (data: { userId: string }, cb: (res: { online: boolean }) => void) => {
      try {
        const online = (await pubClient.sIsMember('online_users', data.userId)) === 1;
        cb({ online: online });
      } catch {
        cb({ online: false });
      }
    });

    socket.on('send_message', async (data: { conversationId: string, senderId: string, receiverId: string, content: string }) => {
      const { conversationId, senderId, receiverId, content } = data;

      try {
        const message = await prisma.message.create({
          data: { conversationId, senderId, receiverId, content },
        });

        // Update conversation's updatedAt
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        // Emit to both sender and receiver
        io.to(`user:${senderId}`).emit('new_message', message);
        io.to(`user:${receiverId}`).emit('new_message', message);

        // Notify for push
        // (Queueing push notification will be added later)
      } catch (error) {
        console.error('Socket: Error sending message:', error);
      }
    });

    socket.on('typing', (data: { conversationId: string, userId: string, receiverId: string }) => {
      io.to(`user:${data.receiverId}`).emit('user_typing', { conversationId: data.conversationId, userId: data.userId });
    });

    socket.on('stop_typing', (data: { conversationId: string, userId: string, receiverId: string }) => {
      io.to(`user:${data.receiverId}`).emit('user_stop_typing', { conversationId: data.conversationId, userId: data.userId });
    });

    socket.on('mark_read', async (data: { messageId: string, userId: string, senderId: string }) => {
      try {
        const updatedMessage = await prisma.message.update({
          where: { id: data.messageId },
          data: { isRead: new Date() },
        });
        io.to(`user:${data.senderId}`).emit('message_read', updatedMessage);
      } catch (error) {
        console.error('Socket: Error marking message as read:', error);
      }
    });

    socket.on('disconnect', () => {
      const userId = (socket.data as any).userId as string | undefined;
      if (userId) {
        pubClient.sRem('online_users', userId).catch(() => {});
        socket.broadcast.emit('user_offline', { userId });
      }
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
};
