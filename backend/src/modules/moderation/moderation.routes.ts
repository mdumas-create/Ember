import { Router } from 'express';
import { authenticateToken, requireRoles } from '../../middlewares/auth';
import * as ModerationController from './moderation.controller';

const router = Router();

router.post('/reports', authenticateToken, ModerationController.createReport);

router.get('/mod/reports', authenticateToken, requireRoles(['MODERATOR', 'ADMIN']), ModerationController.listReports);
router.post('/mod/reports/:reportId/review', authenticateToken, requireRoles(['MODERATOR', 'ADMIN']), ModerationController.reviewReport);

export default router;
