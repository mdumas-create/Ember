import { Request, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth';
import prisma from '../../config/database';
import redisClient from '../../config/redis';
import { z } from 'zod';
import logger from '../../utils/logger';
import { addNotificationToQueue } from '../../utils/queue';
import { sanitizeText } from '../../utils/sanitize';
import { trackEvent } from '../../utils/analytics';
import { containsBannedWords } from '../../utils/profanity';
import { extractHashtags, extractMentions } from '../../utils/text';
import { triggerWebhook } from '../../utils/webhooks';

const CreatePostSchema = z.object({
  content: z.string().min(1).max(280),
  imageUrl: z.string().nullable().optional().or(z.literal('')),
  media: z.array(z.object({ url: z.string().min(1), type: z.string().min(1) })).max(5).optional(),
});

export const createPost = async (req: Request, res: Response) => {
  try {
    const validated = CreatePostSchema.parse(req.body);
    if (containsBannedWords(validated.content)) {
      return res.status(400).json({ error: 'Contenido no permitido' });
    }
    const authReq = req as AuthRequest;
    const cleanContent = sanitizeText(validated.content) as string;
    const hashtags = extractHashtags(cleanContent);
    const mentions = extractMentions(cleanContent);
    const post = await prisma.post.create({
      data: {
        content: cleanContent,
        imageUrl: validated.imageUrl,
        authorId: authReq.user!.id,
        media: validated.media?.length
          ? {
              create: validated.media.map((m) => ({
                url: m.url,
                type: m.type,
              })),
            }
          : undefined,
        hashtags: hashtags.length
          ? {
              create: hashtags.map((tag) => ({
                hashtag: {
                  connectOrCreate: {
                    where: { tag },
                    create: { tag },
                  },
                },
              })),
            }
          : undefined,
      },
      include: { author: { select: { username: true, avatarUrl: true } }, media: { select: { id: true, url: true, type: true } } },
    });

    // Invalidate feed cache
    await redisClient.del('feed:latest');
    const followers = await prisma.follows.findMany({
      where: { followingId: authReq.user!.id },
      select: { followerId: true },
    });
    if (followers.length) {
      await redisClient.del(followers.map((f) => `feed:following:${f.followerId}`));
    }

    if (mentions.length) {
      const mentionedUsers = await prisma.user.findMany({
        where: { username: { in: mentions, mode: 'insensitive' } as any },
        select: { id: true, fcmToken: true, notifyPush: true, notifyComments: true },
      });
      await Promise.all(
        mentionedUsers
          .filter((u) => u.id !== authReq.user!.id)
          .map(async (u) => {
            const body = `@${post.author.username} te mencionó en un post`;
            await prisma.notification.create({
              data: { userId: u.id, type: 'mention', content: body, referenceId: post.id },
            });
            if (u.notifyPush && u.notifyComments && u.fcmToken) {
              addNotificationToQueue({ userId: u.id, title: 'Mención', body, fcmToken: u.fcmToken });
            }
          })
      );
    }

    // Gamification: Update streak and reputation
    const user = await prisma.user.findUnique({ where: { id: authReq.user!.id } });
    if (user) {
      let newStreak = user.streak;
      const today = new Date();
      today.setHours(0,0,0,0);
      
      if (user.lastPostAt) {
        const last = new Date(user.lastPostAt);
        last.setHours(0,0,0,0);
        const diff = (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
        
        if (diff === 1) newStreak += 1;
        else if (diff > 1) newStreak = 1;
      } else {
        newStreak = 1;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          reputation: { increment: 10 },
          streak: newStreak,
          lastPostAt: new Date(),
        }
      });
    }

    trackEvent('post_created', authReq.user!.id, { postId: post.id }).catch(() => {});
    triggerWebhook('new_post', {
      postId: post.id,
      author: post.author.username,
      content: post.content.substring(0, 100),
    }).catch(() => {});
    res.status(201).json(post);
  } catch (error: any) {
    logger.error('Error creating post:', error);
    res.status(400).json({ error: error.message });
  }
};

export const getFeed = async (req: Request, res: Response) => {
  const cursor = req.query.cursor as string | undefined;
  const type = (req.query.type as string) || 'global';
  const limit = 10;
  const authReq = req as AuthRequest;
  const userId = authReq.user?.id;

  try {
    // Basic caching for the first page of the GLOBAL feed
    if (!cursor && type === 'global') {
      const cachedFeed = await redisClient.get('feed:latest');
      if (cachedFeed) {
        return res.json(JSON.parse(cachedFeed));
      }
    }

    if (!cursor && type === 'following' && userId) {
      const cachedFeed = await redisClient.get(`feed:following:${userId}`);
      if (cachedFeed) {
        return res.json(JSON.parse(cachedFeed));
      }
    }

    // If type is following, we need to get the list of users followed
    let whereClause: any = { hidden: false };
    if (type === 'following' && userId) {
      const following = await prisma.follows.findMany({
        where: { followerId: userId },
        select: { followingId: true }
      });
      const followingIds = following.map(f => f.followingId);
      whereClause = { ...whereClause, authorId: { in: followingIds } };
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        media: { select: { id: true, url: true, type: true } },
        hashtags: { include: { hashtag: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }).catch(err => {
      // If cursor is invalid, Prisma throws P2025. We return empty first page or error.
      if (err.code === 'P2025') return [];
      throw err;
    });

    const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;
    const response = { posts, nextCursor };

    // Cache the first page of global feed for 60 seconds
    if (!cursor && type === 'global') {
      await redisClient.setEx('feed:latest', 60, JSON.stringify(response));
    }

    if (!cursor && type === 'following' && userId) {
      await redisClient.setEx(`feed:following:${userId}`, 30, JSON.stringify(response));
    }

    res.json(response);
  } catch (error: any) {
    logger.error('Error fetching feed:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getPostById = async (req: Request, res: Response) => {
  const { postId } = req.params;
  const authReq = req as AuthRequest;
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        media: { select: { id: true, url: true, type: true } },
        hashtags: { include: { hashtag: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.hidden && post.authorId !== authReq.user?.id) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const likePost = async (req: Request, res: Response) => {
  const { postId } = req.params;
  const { type } = req.body; // "like" or "fire"
  const authReq = req as AuthRequest;

  try {
    const likeType = type || 'like';
    
    // Verify post exists
    const targetPost = await prisma.post.findUnique({ where: { id: postId } });
    if (!targetPost) return res.status(404).json({ error: 'Post not found' });

    const existing = await prisma.like.findUnique({
      where: {
        userId_postId_type: { userId: authReq.user!.id, postId, type: likeType },
      },
    });

    if (existing) {
      // Toggle like: if exists, delete it (unlike)
      await prisma.like.delete({
        where: { id: existing.id }
      });
      return res.json({ message: 'Like removed' });
    }

    const like = await prisma.like.create({
      data: { userId: authReq.user!.id, postId, type: likeType },
    });

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        author: {
          select: {
            id: true,
            username: true,
            fcmToken: true,
            notifyPush: true,
            notifyLikes: true,
          }
        }
      }
    });

    if (
      post &&
      post.authorId !== authReq.user!.id &&
      post.author.notifyPush &&
      post.author.notifyLikes &&
      post.author.fcmToken
    ) {
      const liker = await prisma.user.findUnique({
        where: { id: authReq.user!.id },
        select: { username: true },
      });

      const title = 'Nuevo like';
      const body = `${liker?.username || 'Alguien'} le dio like a tu publicación`;

      await prisma.notification.create({
        data: {
          userId: post.authorId,
          type: 'like',
          content: body,
          referenceId: postId,
        }
      });

      addNotificationToQueue({
        userId: post.authorId,
        title,
        body,
        fcmToken: post.author.fcmToken,
      });
    }

    trackEvent('post_liked', authReq.user!.id, { postId, type: likeType }).catch(() => {});
    res.json(like);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const commentPost = async (req: Request, res: Response) => {
  const { postId } = req.params;
  const { content, parentId } = req.body;
  const authReq = req as AuthRequest;

  try {
    if (typeof content === 'string' && containsBannedWords(content)) {
      return res.status(400).json({ error: 'Contenido no permitido' });
    }
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        author: {
          select: {
            id: true,
            username: true,
            fcmToken: true,
            notifyPush: true,
            notifyComments: true,
          }
        }
      }
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const comment = await prisma.comment.create({
      data: { 
        content: sanitizeText(content) as string, 
        userId: authReq.user!.id, 
        postId, 
        parentId 
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } }
      }
    });

    if (
      post.authorId !== authReq.user!.id &&
      post.author.notifyPush &&
      post.author.notifyComments &&
      post.author.fcmToken
    ) {
      const commenter = await prisma.user.findUnique({
        where: { id: authReq.user!.id },
        select: { username: true },
      });

      const title = 'Nuevo comentario';
      const body = `${commenter?.username || 'Alguien'}: ${comment.content}`;

      await prisma.notification.create({
        data: {
          userId: post.authorId,
          type: 'comment',
          content: body,
          referenceId: postId,
        }
      });

      addNotificationToQueue({
        userId: post.authorId,
        title,
        body,
        fcmToken: post.author.fcmToken,
      });
    }
    trackEvent('post_commented', authReq.user!.id, { postId, commentId: comment.id, parentId: parentId || null }).catch(() => {});
    res.status(201).json(comment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updatePost = async (req: Request, res: Response) => {
  const { postId } = req.params;
  const { content } = req.body;
  const authReq = req as AuthRequest;

  try {
    if (typeof content === 'string' && containsBannedWords(content)) {
      return res.status(400).json({ error: 'Contenido no permitido' });
    }
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== authReq.user!.id) return res.status(403).json({ error: 'Unauthorized' });

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { content: sanitizeText(content) as string },
    });

    await redisClient.del('feed:latest');
    const followers = await prisma.follows.findMany({
      where: { followingId: authReq.user!.id },
      select: { followerId: true },
    });
    if (followers.length) {
      await redisClient.del(followers.map((f) => `feed:following:${f.followerId}`));
    }
    res.json(updatedPost);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deletePost = async (req: Request, res: Response) => {
  const { postId } = req.params;
  const authReq = req as AuthRequest;

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== authReq.user!.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Gracias a onDelete: Cascade en el schema, borrar el post
    // eliminará automáticamente sus likes, comentarios, media y hashtags asociados.
    await prisma.post.delete({
      where: { id: postId },
    });

    await redisClient.del('feed:latest');
    const followers = await prisma.follows.findMany({
      where: { followingId: authReq.user!.id },
      select: { followerId: true },
    });
    if (followers.length) {
      await redisClient.del(followers.map((f) => `feed:following:${f.followerId}`));
    }
    res.json({ message: 'Post deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateComment = async (req: Request, res: Response) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const authReq = req as AuthRequest;

  try {
    if (typeof content === 'string' && containsBannedWords(content)) {
      return res.status(400).json({ error: 'Contenido no permitido' });
    }
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.userId !== authReq.user!.id) return res.status(403).json({ error: 'Unauthorized' });

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content: sanitizeText(content) as string },
    });
    res.json(updatedComment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteComment = async (req: Request, res: Response) => {
  const { commentId } = req.params;
  const authReq = req as AuthRequest;

  try {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.userId !== authReq.user!.id) return res.status(403).json({ error: 'Unauthorized' });

    // Gracias a onDelete: Cascade en el schema (parentId), borrar el comentario padre
    // eliminará automáticamente todas sus respuestas de forma recursiva.
    await prisma.comment.delete({
      where: { id: commentId },
    });
    
    res.json({ message: 'Comment deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getComments = async (req: Request, res: Response) => {
  const { postId } = req.params;
  try {
    const comments = await prisma.comment.findMany({
      where: { postId, hidden: false },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byId = new Map<string, any>();
    const roots: any[] = [];

    for (const c of comments) {
      byId.set(c.id, { ...c, replies: [] });
    }

    for (const c of comments) {
      const node = byId.get(c.id);
      if (!c.parentId) {
        roots.push(node);
        continue;
      }
      const parent = byId.get(c.parentId);
      if (parent) parent.replies.push(node);
      else roots.push(node);
    }

    res.json(roots);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
