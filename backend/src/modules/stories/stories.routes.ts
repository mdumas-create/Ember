import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth';
import * as StoriesController from './stories.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

const createStoryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas historias en poco tiempo.' },
});

router.get('/', authenticateToken, StoriesController.getStoriesFeed);
router.get('/:userId', authenticateToken, StoriesController.getUserStories);
router.post('/', authenticateToken, createStoryLimiter, StoriesController.createStory);
router.post('/:storyId/react', authenticateToken, StoriesController.reactToStory);
router.post('/:storyId/reply', authenticateToken, StoriesController.replyToStory);

export default router;
