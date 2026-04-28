import { Router } from 'express';
import * as PostsController from './posts.controller';
import { authenticateToken } from '../../middlewares/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

const createPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas publicaciones en poco tiempo.' },
});

router.post('/', authenticateToken, createPostLimiter, PostsController.createPost);
router.get('/', authenticateToken, PostsController.getFeed);
router.put('/:postId', authenticateToken, PostsController.updatePost);
router.delete('/:postId', authenticateToken, PostsController.deletePost);
router.post('/:postId/like', authenticateToken, PostsController.likePost);
router.get('/:postId/comments', authenticateToken, PostsController.getComments);
router.post('/:postId/comment', authenticateToken, PostsController.commentPost);
router.put('/comments/:commentId', authenticateToken, PostsController.updateComment);
router.delete('/comments/:commentId', authenticateToken, PostsController.deleteComment);
router.get('/:postId', authenticateToken, PostsController.getPostById);

export default router;
