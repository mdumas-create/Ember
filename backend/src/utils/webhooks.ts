import axios from 'axios';
import logger from './logger';

export const triggerWebhook = async (event: string, payload: any) => {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await axios.post(webhookUrl, {
      event,
      payload,
      timestamp: new Date().toISOString(),
    });
    logger.info(`Webhook triggered: ${event}`);
  } catch (error: any) {
    logger.error(`Webhook failed: ${event}`, error.message);
  }
};
