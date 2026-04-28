import { Request, Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middlewares/auth';

export const getTrending = async (req: Request, res: Response) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await prisma.postHashtag.groupBy({
      by: ['hashtagId'],
      _count: { hashtagId: true },
      where: {
        post: {
          createdAt: { gt: since },
          hidden: false,
        },
      },
      orderBy: { _count: { hashtagId: 'desc' } },
      take: limit,
    });

    const ids = rows.map((r) => r.hashtagId);
    const tags = await prisma.hashtag.findMany({ where: { id: { in: ids } } });
    const byId = new Map(tags.map((t) => [t.id, t.tag]));

    res.json(
      rows.map((r) => ({
        tag: byId.get(r.hashtagId) || '',
        count: r._count.hashtagId,
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPostsByHashtag = async (req: Request, res: Response) => {
  const { tag } = req.params;
  const cursor = req.query.cursor as string | undefined;
  const limit = 10;
  const authReq = req as AuthRequest;
  const userId = authReq.user?.id;

  try {
    const hashtag = await prisma.hashtag.findUnique({ where: { tag: tag.toLowerCase() } });
    if (!hashtag) return res.json({ posts: [], nextCursor: null });

    const posts = await prisma.post.findMany({
      where: {
        hidden: false,
        hashtags: { some: { hashtagId: hashtag.id } },
      },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        media: { select: { id: true, url: true, type: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;
    res.json({ posts, nextCursor });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
