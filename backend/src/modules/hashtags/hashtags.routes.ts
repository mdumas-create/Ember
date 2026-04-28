import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth';
import * as HashtagsController from './hashtags.controller';

const router = Router();

router.get('/trending', authenticateToken, HashtagsController.getTrending);
router.get('/:tag/posts', authenticateToken, HashtagsController.getPostsByHashtag);

export default router;
