import { Request, Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middlewares/auth';
import { sendPushNotification } from '../../utils/fcm';

export const createStory = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { mediaUrl, mediaType } = req.body;

  if (!mediaUrl || !mediaType) return res.status(400).json({ error: 'mediaUrl and mediaType are required' });

  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = await prisma.story.create({
      data: {
        authorId: authReq.user!.id,
        mediaUrl,
        mediaType,
        expiresAt,
      },
      include: { author: { select: { id: true, username: true, avatarUrl: true } } },
    });
    res.status(201).json(story);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const reactToStory = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { storyId } = req.params;
  const { emoji } = req.body;

  if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

  try {
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      include: { author: true },
    });

    if (!story) return res.status(404).json({ error: 'Historia no encontrada' });
    if (story.expiresAt < new Date()) return res.status(410).json({ error: 'Historia expirada' });

    // Crear notificación en DB
    await prisma.notification.create({
      data: {
        userId: story.authorId,
        type: 'story_reaction',
        content: `@${authReq.user!.username} reaccionó ${emoji} a tu historia`,
        referenceId: story.id,
      },
    });

    // Enviar Push si tiene token
    if (story.author.fcmToken && story.author.notifyPush) {
      await sendPushNotification(
        story.author.fcmToken,
        'Nueva reacción 🔥',
        `@${authReq.user!.username} reaccionó ${emoji} a tu historia`,
        { type: 'story_reaction', storyId: story.id }
      );
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const replyToStory = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { storyId } = req.params;
  const { content } = req.body;

  if (!content) return res.status(400).json({ error: 'Content is required' });

  try {
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      include: { author: true },
    });

    if (!story) return res.status(404).json({ error: 'Historia no encontrada' });
    if (story.expiresAt < new Date()) return res.status(410).json({ error: 'Historia expirada' });

    // Buscar o crear conversación entre los dos usuarios
    let conversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: authReq.user!.id } } },
          { participants: { some: { id: story.authorId } } },
        ],
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participants: {
            connect: [{ id: authReq.user!.id }, { id: story.authorId }],
          },
        },
      });
    }

    // Crear mensaje de chat que referencia la historia
    const message = await prisma.message.create({
      data: {
        content: `Respondió a tu historia: ${content}`,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        senderId: authReq.user!.id,
        receiverId: story.authorId,
        conversationId: conversation.id,
      },
    });

    // Notificación Push para el mensaje
    if (story.author.fcmToken && story.author.notifyMessages) {
      await sendPushNotification(
        story.author.fcmToken,
        'Respuesta a tu historia 💬',
        `@${authReq.user!.username}: ${content}`,
        { type: 'message', conversationId: conversation.id, messageId: message.id }
      );
    }

    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getStoriesFeed = async (req: Request, res: Response) => {
  const now = new Date();
  try {
    const stories = await prisma.story.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: [{ createdAt: 'desc' }],
      include: { author: { select: { id: true, username: true, avatarUrl: true } } },
      take: 200,
    });

    const byAuthor = new Map<string, any[]>();
    for (const s of stories) {
      const arr = byAuthor.get(s.authorId) || [];
      arr.push(s);
      byAuthor.set(s.authorId, arr);
    }

    const payload = Array.from(byAuthor.entries()).map(([authorId, items]) => {
      const author = items[0].author;
      return {
        authorId,
        author,
        stories: items.map((s) => ({
          id: s.id,
          mediaUrl: s.mediaUrl,
          mediaType: s.mediaType,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
        })),
      };
    });

    res.json(payload);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserStories = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const now = new Date();
  try {
    const stories = await prisma.story.findMany({
      where: { authorId: userId, expiresAt: { gt: now } },
      orderBy: [{ createdAt: 'asc' }],
    });
    res.json(stories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
