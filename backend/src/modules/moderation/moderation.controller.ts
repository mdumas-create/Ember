import { Request, Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middlewares/auth';
import { z } from 'zod';

const CreateReportSchema = z.object({
  targetType: z.enum(['POST', 'COMMENT', 'USER']),
  targetId: z.string().min(1),
  reason: z.string().min(3).max(500),
});

const ReviewReportSchema = z.object({
  action: z.enum(['HIDE_POST', 'HIDE_COMMENT', 'SUSPEND_USER', 'NO_ACTION']),
});

export const createReport = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const validated = CreateReportSchema.parse(req.body);

    // Verify target exists
    if (validated.targetType === 'POST') {
      const exists = await prisma.post.findUnique({ where: { id: validated.targetId } });
      if (!exists) return res.status(404).json({ error: 'Post not found' });
    } else if (validated.targetType === 'COMMENT') {
      const exists = await prisma.comment.findUnique({ where: { id: validated.targetId } });
      if (!exists) return res.status(404).json({ error: 'Comment not found' });
    } else if (validated.targetType === 'USER') {
      const exists = await prisma.user.findUnique({ where: { id: validated.targetId } });
      if (!exists) return res.status(404).json({ error: 'User not found' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: authReq.user!.id,
        targetType: validated.targetType,
        targetId: validated.targetId,
        reason: validated.reason,
      },
    });
    res.status(201).json(report);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const listReports = async (req: Request, res: Response) => {
  const cursor = req.query.cursor as string | undefined;
  const status = (req.query.status as string | undefined) || 'OPEN';
  const limit = 20;

  try {
    const reports = await prisma.report.findMany({
      where: status ? { status: status as any } : undefined,
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, username: true } },
        reviewer: { select: { id: true, username: true } },
      },
    });

    const nextCursor = reports.length === limit ? reports[reports.length - 1].id : null;
    res.json({ reports, nextCursor });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const reviewReport = async (req: Request, res: Response) => {
  const { reportId } = req.params;
  const authReq = req as AuthRequest;

  try {
    const validated = ReviewReportSchema.parse(req.body);
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const now = new Date();
    let status: any = 'REVIEWED';
    if (validated.action !== 'NO_ACTION') status = 'ACTIONED';

    if (validated.action === 'HIDE_POST' && report.targetType === 'POST') {
      await prisma.post.updateMany({ where: { id: report.targetId }, data: { hidden: true } });
    }
    if (validated.action === 'HIDE_COMMENT' && report.targetType === 'COMMENT') {
      await prisma.comment.updateMany({ where: { id: report.targetId }, data: { hidden: true } });
    }
    if (validated.action === 'SUSPEND_USER' && report.targetType === 'USER') {
      await prisma.user.updateMany({ where: { id: report.targetId }, data: { suspended: true } });
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        reviewedAt: now,
        reviewerId: authReq.user!.id,
        action: validated.action,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
