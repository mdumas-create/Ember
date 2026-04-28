import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middlewares/auth';
import prisma from '../../config/database';

const router = Router();

router.get('/flags', authenticateToken, async (req: Request, res: Response) => {
  // In a real scenario, this could come from a database table 'FeatureFlag'
  // For now, we'll return a hardcoded list that can be easily modified or connected to DB later
  const flags = {
    'new-chat-ui': true,
    'voice-messages': true,
    'premium-filters': false,
    'experimental-feed': process.env.NODE_ENV === 'development',
  };
  
  res.json(flags);
});

export default router;
