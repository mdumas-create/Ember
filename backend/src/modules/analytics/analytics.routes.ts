import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth';
import { z } from 'zod';
import { trackEvent } from '../../utils/analytics';
import { AuthRequest } from '../../middlewares/auth';

const router = Router();

const TrackSchema = z.object({
  event: z.string().min(1).max(120),
  properties: z.record(z.string(), z.any()).optional(),
});

router.post('/event', authenticateToken, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const validated = TrackSchema.parse(req.body);
    await trackEvent(validated.event, authReq.user!.id, validated.properties || {});
    res.json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
