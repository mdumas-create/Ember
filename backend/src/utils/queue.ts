import Queue from 'bull';
import admin from 'firebase-admin';
import axios from 'axios';
import prisma from '../config/database';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const queueOptions = {
  redis: {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
};

const notificationQueue = new Queue('notifications', REDIS_URL, queueOptions);
const retentionQueue = new Queue('retention', REDIS_URL, queueOptions);

notificationQueue.process(async (job) => {
  const { userId, title, body, fcmToken } = job.data;

  if (!fcmToken) return;

  try {
    const isExpoToken =
      typeof fcmToken === 'string' &&
      (fcmToken.startsWith('ExponentPushToken[') || fcmToken.startsWith('ExpoPushToken['));

    if (isExpoToken) {
      await axios.post('https://exp.host/--/api/v2/push/send', {
        to: fcmToken,
        title,
        body,
      });
      console.log(`Expo push notification sent to user ${userId}`);
      return;
    }

    if (!admin.apps.length) return;

    await admin.messaging().send({
      notification: { title, body },
      token: fcmToken,
    });
    console.log(`Push notification sent to user ${userId}`);
  } catch (error) {
    console.error(`Error sending push notification to user ${userId}:`, error);
  }
});

export const addNotificationToQueue = (data: { userId: string, title: string, body: string, fcmToken: string }) => {
  notificationQueue.add(data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 100,
  });
};

// Retention Logic: Streak warnings and inactivity reminders
retentionQueue.process('streak_warning', async (job) => {
  const users = await prisma.user.findMany({
    where: {
      streak: { gt: 0 },
      lastPostAt: {
        lt: new Date(Date.now() - 20 * 60 * 60 * 1000), // 20 hours ago
      },
      notifyPush: true,
      fcmToken: { not: null },
    },
    select: { id: true, username: true, fcmToken: true, streak: true },
  });

  for (const u of users) {
    addNotificationToQueue({
      userId: u.id,
      title: '¡No pierdas tu racha!',
      body: `Llevas ${u.streak} días seguidos. Publica algo hoy para mantenerla viva 🔥`,
      fcmToken: u.fcmToken!,
    });
  }
});

retentionQueue.process('inactivity_reminder', async (job) => {
  const users = await prisma.user.findMany({
    where: {
      lastPostAt: {
        lt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
      },
      notifyPush: true,
      fcmToken: { not: null },
    },
    select: { id: true, username: true, fcmToken: true },
  });

  for (const u of users) {
    addNotificationToQueue({
      userId: u.id,
      title: 'Te extrañamos en Ember',
      body: 'Hace un par de días que no compartes nada. ¿Qué hay de nuevo?',
      fcmToken: u.fcmToken!,
    });
  }
});

// Schedule retention jobs (runs every 12 hours)
export const setupRetentionSchedules = () => {
  retentionQueue.add('streak_warning', {}, { repeat: { cron: '0 */12 * * *' } });
  retentionQueue.add('inactivity_reminder', {}, { repeat: { cron: '0 18 * * *' } }); // Every day at 6 PM
};

export default notificationQueue;
