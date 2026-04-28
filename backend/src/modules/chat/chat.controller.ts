import { Request, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth';
import prisma from '../../config/database';
import { addNotificationToQueue } from '../../utils/queue';
import { sanitizeText } from '../../utils/sanitize';
import { trackEvent } from '../../utils/analytics';
import { containsBannedWords } from '../../utils/profanity';

export const getConversations = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { id: authReq.user!.id } } },
      include: {
        participants: {
          where: { id: { not: authReq.user!.id } },
          select: { id: true, username: true, avatarUrl: true },
        },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Attach streak info to each conversation
    const conversationsWithStreaks = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = conv.participants[0];
        if (!otherUser) return conv;

        const streak = await prisma.userStreak.findUnique({
          where: {
            userId_partnerId: {
              userId: authReq.user!.id,
              partnerId: otherUser.id
            }
          }
        });

        return {
          ...conv,
          streak: streak ? streak.count : 0
        };
      })
    );

    res.json(conversationsWithStreaks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const cursor = req.query.cursor as string | undefined;
  const authReq = req as AuthRequest;
  const limit = 20;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { id: true } } }
    });

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    
    const isParticipant = conversation.participants.some(p => p.id === authReq.user!.id);
    if (!isParticipant) return res.status(403).json({ error: 'Unauthorized' });

    const messages = await prisma.message.findMany({
      where: { conversationId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        reactions: {
          include: { user: { select: { id: true, username: true } } }
        }
      }
    });

    // Get streak info for the chat screen
    let streakCount = 0;
    if (!cursor) {
      const otherUser = conversation.participants.find(p => p.id !== authReq.user!.id);
      if (otherUser) {
        const streak = await prisma.userStreak.findUnique({
          where: {
            userId_partnerId: {
              userId: authReq.user!.id,
              partnerId: otherUser.id
            }
          }
        });
        streakCount = streak ? streak.count : 0;
      }
    }

    res.json({
      messages: messages.reverse(),
      streak: streakCount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOrCreateConversation = async (req: Request, res: Response) => {
  const { participantId } = req.body;
  const authReq = req as AuthRequest;
  if (!participantId) return res.status(400).json({ error: 'Participant ID required' });

  try {
    // Check if conversation exists
    let conversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: authReq.user!.id } } },
          { participants: { some: { id: participantId } } },
        ],
      },
      include: { participants: { select: { id: true, username: true, avatarUrl: true } } },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participants: { connect: [{ id: authReq.user!.id }, { id: participantId }] },
        },
        include: { participants: { select: { id: true, username: true, avatarUrl: true } } },
      });
    }

    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { content, receiverId, mediaUrl, mediaType } = req.body;
  const authReq = req as AuthRequest;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { id: true } } }
    });

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    
    const isParticipant = conversation.participants.some(p => p.id === authReq.user!.id);
    if (!isParticipant) return res.status(403).json({ error: 'Unauthorized' });

    // Derive receiverId if not provided or to ensure it's correct
    const otherParticipant = conversation.participants.find(p => p.id !== authReq.user!.id);
    const actualReceiverId = receiverId || otherParticipant?.id;

    if (!actualReceiverId) return res.status(400).json({ error: 'Receiver not found' });

    if (typeof content === 'string' && containsBannedWords(content)) {
      return res.status(400).json({ error: 'Contenido no permitido' });
    }
    const message = await prisma.message.create({
      data: {
        content: sanitizeText(content) as string,
        mediaUrl,
        mediaType,
        senderId: authReq.user!.id,
        receiverId: actualReceiverId,
        conversationId,
      },
      include: {
        reactions: {
          include: { user: { select: { id: true, username: true } } }
        }
      }
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const receiver = await prisma.user.findUnique({
      where: { id: actualReceiverId },
      select: { id: true, fcmToken: true, notifyPush: true, notifyMessages: true },
    });

    if (receiver?.notifyPush && receiver?.notifyMessages && receiver?.fcmToken) {
      const sender = await prisma.user.findUnique({
        where: { id: authReq.user!.id },
        select: { username: true },
      });

      const title = 'Nuevo mensaje';
      const body = `${sender?.username || 'Alguien'}: ${message.content}`;

      await prisma.notification.create({
        data: {
          userId: actualReceiverId,
          type: 'message',
          content: body,
          referenceId: message.id,
        }
      });

      addNotificationToQueue({
        userId: actualReceiverId,
        title,
        body,
        fcmToken: receiver.fcmToken,
      });
    }

    trackEvent('message_sent', authReq.user!.id, { conversationId, receiverId: actualReceiverId, messageId: message.id, mediaType: mediaType || null }).catch(() => {});

    // --- Streak Logic (Mutual) ---
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // We only care about the receiver for the streak update
      const partnerId = actualReceiverId;

      const updateStreak = async (uId: string, pId: string) => {
        const existing = await prisma.userStreak.findUnique({
          where: { userId_partnerId: { userId: uId, partnerId: pId } }
        });

        if (existing) {
          const lastDate = new Date(existing.lastMessageAt);
          lastDate.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            await prisma.userStreak.update({
              where: { id: existing.id },
              data: { count: { increment: 1 }, lastMessageAt: new Date() }
            });
          } else if (diffDays > 1) {
            await prisma.userStreak.update({
              where: { id: existing.id },
              data: { count: 1, lastMessageAt: new Date() }
            });
          } else if (diffDays === 0) {
            // Already messaged today, just update timestamp if needed (optional)
            await prisma.userStreak.update({
              where: { id: existing.id },
              data: { lastMessageAt: new Date() }
            });
          }
        } else {
          await prisma.userStreak.create({
            data: { userId: uId, partnerId: pId, count: 1, lastMessageAt: new Date() }
          });
        }
      };

      // Update for both users to keep it mutual
      await updateStreak(authReq.user!.id, actualReceiverId);
      await updateStreak(actualReceiverId, authReq.user!.id);
      
    } catch (streakError) {
      console.error('Error updating mutual user streak:', streakError);
    }
    // --- End Streak Logic ---

    // Get final streak count to return to frontend
    const finalStreak = await prisma.userStreak.findUnique({
      where: {
        userId_partnerId: {
          userId: authReq.user!.id,
          partnerId: actualReceiverId
        }
      }
    });

    res.status(201).json({
      ...message,
      streak: finalStreak ? finalStreak.count : 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const reactToMessage = async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const authReq = req as AuthRequest;

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { participants: { select: { id: true } } } } }
    });

    if (!message) return res.status(404).json({ error: 'Message not found' });

    const isParticipant = message.conversation.participants.some(p => p.id === authReq.user!.id);
    if (!isParticipant) return res.status(403).json({ error: 'Unauthorized' });

    const reaction = await prisma.messageReaction.upsert({
      where: {
        userId_messageId: {
          userId: authReq.user!.id,
          messageId
        }
      },
      update: { emoji },
      create: {
        userId: authReq.user!.id,
        messageId,
        emoji
      }
    });
    res.json(reaction);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const searchMessages = async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { q } = req.query;
  const authReq = req as AuthRequest;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { id: true } } }
    });

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    
    const isParticipant = conversation.participants.some(p => p.id === authReq.user!.id);
    if (!isParticipant) return res.status(403).json({ error: 'Unauthorized' });

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        content: { contains: q as string, mode: 'insensitive' }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
