import { Router } from 'express';
import * as ChatController from './chat.controller';
import { authenticateToken } from '../../middlewares/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Demasiados mensajes en poco tiempo.' },
});

router.get('/conversations', authenticateToken, ChatController.getConversations);
router.get('/conversations/:conversationId/messages', authenticateToken, ChatController.getMessages);
router.post('/conversations/:conversationId/messages', authenticateToken, sendMessageLimiter, ChatController.sendMessage);
router.post('/conversations/messages/:messageId/react', authenticateToken, ChatController.reactToMessage);
router.get('/conversations/:conversationId/search', authenticateToken, ChatController.searchMessages);
router.post('/conversations', authenticateToken, ChatController.getOrCreateConversation);

export default router;
