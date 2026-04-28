import { Request, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth';
import prisma from '../../config/database';
import bcrypt from 'bcrypt';
import redisClient from '../../config/redis';
import { sanitizeText } from '../../utils/sanitize';
import { containsBannedWords } from '../../utils/profanity';
import { addNotificationToQueue } from '../../utils/queue';

export const getMe = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const user = await prisma.user.findUnique({
      where: { id: authReq.user!.id },
      include: { _count: { select: { posts: true } } },
    });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as AuthRequest;
  const currentUserId = authReq.user?.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        posts: { 
          orderBy: { createdAt: 'desc' }, 
          take: 20,
          include: {
            author: { select: { id: true, username: true, avatarUrl: true } },
            _count: { select: { comments: true, likes: true } }
          }
        },
        _count: { select: { posts: true, followers: true, following: true } },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    let isFollowing = false;
    if (currentUserId && currentUserId !== id) {
      const follow = await prisma.follows.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: id
          }
        }
      });
      isFollowing = !!follow;
    }

    // Privacy logic
    if (!user.isPublic && !isFollowing && currentUserId !== id) {
      return res.json({
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        isPublic: user.isPublic,
        isFollowing: false,
        isPrivate: true, // Flag for frontend
        _count: user._count,
        posts: [], // Empty posts for private accounts
      });
    }

    res.json({ ...user, isFollowing, isPrivate: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  const { username, displayName, bio, avatarUrl, coverUrl, interests, fcmToken, isPublic, notifyPush, notifyMessages, notifyLikes, notifyComments } = req.body;
  const authReq = req as AuthRequest;
  try {
    if (typeof username === 'string' && containsBannedWords(username)) return res.status(400).json({ error: 'Contenido no permitido' });
    if (typeof displayName === 'string' && containsBannedWords(displayName)) return res.status(400).json({ error: 'Contenido no permitido' });
    if (typeof bio === 'string' && containsBannedWords(bio)) return res.status(400).json({ error: 'Contenido no permitido' });
    
    // Objeto de actualización dinámica para evitar enviar undefined a Prisma
    const updateData: any = {};
    if (username !== undefined) updateData.username = sanitizeText(username) as string;
    if (displayName !== undefined) updateData.displayName = sanitizeText(displayName) as string;
    if (bio !== undefined) updateData.bio = sanitizeText(bio) as string;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (coverUrl !== undefined) updateData.coverUrl = coverUrl;
    if (interests !== undefined) updateData.interests = interests;
    if (fcmToken !== undefined) updateData.fcmToken = fcmToken;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (notifyPush !== undefined) updateData.notifyPush = notifyPush;
    if (notifyMessages !== undefined) updateData.notifyMessages = notifyMessages;
    if (notifyLikes !== undefined) updateData.notifyLikes = notifyLikes;
    if (notifyComments !== undefined) updateData.notifyComments = notifyComments;

    const user = await prisma.user.update({
      where: { id: authReq.user!.id },
      data: updateData,
    });
    await redisClient.del(`suggestions:${authReq.user!.id}`);
    res.json(user);
  } catch (error: any) {
    console.error('Update Profile Error:', error);
    res.status(400).json({ error: error.message });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const authReq = req as AuthRequest;
  try {
    const user = await prisma.user.findUnique({ where: { id: authReq.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: authReq.user!.id },
      data: { password: hashedPassword },
    });
    res.json({ message: 'Contraseña actualizada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const userId = authReq.user!.id;

    // Con onDelete: Cascade en el schema, Prisma/Postgres se encargan de borrar
    // automáticamente posts, comentarios, likes, mensajes, seguidores, etc.
    // Solo necesitamos borrar la conversación si se queda vacía o borrarla manualmente.
    
    await prisma.$transaction(async (tx) => {
      // Borramos el usuario y la cascada hará el resto
      await tx.user.delete({ where: { id: userId } });
      
      // Limpieza adicional de conversaciones que quedaron sin participantes (opcional)
      await tx.conversation.deleteMany({
        where: { participants: { none: {} } }
      });
    });

    res.json({ message: 'Cuenta eliminada y datos relacionados borrados' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const cursor = req.query.cursor as string | undefined;
  const limit = 20;
  const tokens = (query || '')
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { bio: { contains: query, mode: 'insensitive' } },
          ...(tokens.length ? [{ interests: { hasSome: tokens } }] : []),
        ]
      },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { username: 'asc' },
    });
    const nextCursor = users.length === limit ? users[users.length - 1].id : null;
    res.json({ users, nextCursor });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMyNotifications = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const cursor = req.query.cursor as string | undefined;
  const limit = 20;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: authReq.user!.id },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    const nextCursor = notifications.length === limit ? notifications[notifications.length - 1].id : null;
    res.json({ notifications, nextCursor });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markNotificationRead = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { notificationId } = req.params;

  try {
    const updated = await prisma.notification.updateMany({
      where: { id: notificationId, userId: authReq.user!.id },
      data: { isRead: true },
    });

    if (updated.count === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    await prisma.notification.updateMany({
      where: { userId: authReq.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const followUser = async (req: Request, res: Response) => {
  const { id: followingId } = req.params;
  const authReq = req as AuthRequest;
  const followerId = authReq.user!.id;

  if (followerId === followingId) return res.status(400).json({ error: "No puedes seguirte a ti mismo" });

  try {
    const existing = await prisma.follows.findUnique({
      where: { followerId_followingId: { followerId, followingId } }
    });

    if (existing) {
      await prisma.follows.delete({
        where: { followerId_followingId: { followerId, followingId } }
      });
      await redisClient.del(`feed:following:${followerId}`);
      await redisClient.del(`suggestions:${followerId}`);
      return res.json({ message: 'User unfollowed' });
    }

    await prisma.follows.create({
      data: { followerId, followingId }
    });
    await redisClient.del(`feed:following:${followerId}`);
    await redisClient.del(`suggestions:${followerId}`);

    // Notify user
    const followedUser = await prisma.user.findUnique({
      where: { id: followingId },
      select: { fcmToken: true, notifyPush: true }
    });

    if (followedUser?.notifyPush && followedUser.fcmToken) {
      const follower = await prisma.user.findUnique({ where: { id: followerId }, select: { username: true } });
      const body = `@${follower?.username} comenzó a seguirte`;
      await prisma.notification.create({
        data: { userId: followingId, type: 'follow', content: body, referenceId: followerId },
      });
      addNotificationToQueue({ userId: followingId, title: 'Nuevo seguidor', body, fcmToken: followedUser.fcmToken });
    }

    res.json({ message: 'User followed' });
  } catch (error: any) {
    res.status(400).json({ error: 'User not found' });
  }
};

export const unfollowUser = async (req: Request, res: Response) => {
  const { id: followingId } = req.params;
  const authReq = req as AuthRequest;
  const followerId = authReq.user!.id;

  try {
    await prisma.follows.delete({
      where: { followerId_followingId: { followerId, followingId } }
    });
    await redisClient.del(`feed:following:${followerId}`);
    await redisClient.del(`suggestions:${followerId}`);
    res.json({ message: 'User unfollowed' });
  } catch (error: any) {
    res.status(400).json({ error: 'Not following' });
  }
};

export const getSuggestions = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const cached = await redisClient.get(`suggestions:${authReq.user!.id}`);
    if (cached) return res.json(JSON.parse(cached));

    const currentUser = await prisma.user.findUnique({ where: { id: authReq.user!.id } });
    const currentFollowing = await prisma.follows.findMany({
      where: { followerId: authReq.user!.id },
      select: { followingId: true },
    });
    const currentFollowingIds = currentFollowing.map((f) => f.followingId);

    const suggestions = await prisma.user.findMany({
      where: {
        id: { not: authReq.user!.id },
        interests: { hasSome: currentUser?.interests || [] },
        followers: { none: { followerId: authReq.user!.id } } // Not following yet
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
        interests: true,
        _count: {
          select: {
            followers: {
              where: currentFollowingIds.length ? { followerId: { in: currentFollowingIds } } : undefined,
            },
          },
        },
      },
      take: 5,
    });
    const payload =
      suggestions.map((u: any) => ({
        ...u,
        mutualCount: u._count?.followers || 0,
        isFollowing: false,
      }));

    await redisClient.setEx(`suggestions:${authReq.user!.id}`, 60, JSON.stringify(payload));
    res.json(payload);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
