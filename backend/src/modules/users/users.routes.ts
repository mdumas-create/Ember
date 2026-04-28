import { Router } from 'express';
import * as UsersController from './users.controller';
import { authenticateToken } from '../../middlewares/auth';

const router = Router();

router.get('/me', authenticateToken, UsersController.getMe);
router.put('/me', authenticateToken, UsersController.updateProfile);
router.post('/me/change-password', authenticateToken, UsersController.changePassword);
router.delete('/me', authenticateToken, UsersController.deleteAccount);
router.get('/search', authenticateToken, UsersController.searchUsers);
router.get('/me/notifications', authenticateToken, UsersController.getMyNotifications);
router.post('/me/notifications/read-all', authenticateToken, UsersController.markAllNotificationsRead);
router.post('/me/notifications/:notificationId/read', authenticateToken, UsersController.markNotificationRead);
router.get('/suggestions', authenticateToken, UsersController.getSuggestions);
router.get('/:id', authenticateToken, UsersController.getUserProfile);
router.post('/:id/follow', authenticateToken, UsersController.followUser);
router.post('/:id/unfollow', authenticateToken, UsersController.unfollowUser);

export default router;
