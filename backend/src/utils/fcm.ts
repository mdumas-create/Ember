import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

export const initializeFirebase = () => {
  if (!admin.apps.length) {
    try {
      // 1. Try to load from JSON file (Recommended for local dev)
      const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
      if (fs.existsSync(serviceAccountPath)) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
        });
        console.log('Firebase Admin initialized (from JSON file)');
        return;
      }

      // 2. Fallback to Environment Variables (For production/CI)
      const rawServiceAccount =
        process.env.FCM_SERVICE_ACCOUNT_JSON ||
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

      if (rawServiceAccount) {
        const parsed = JSON.parse(rawServiceAccount);
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: (parsed.private_key || '').replace(/\\n/g, '\n'),
          }),
        });
        console.log('Firebase Admin initialized');
        return;
      }

      const projectId = process.env.FCM_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FCM_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FCM_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        console.warn('Firebase Admin missing credentials. Push notifications will be disabled.');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase Admin initialized');
    } catch (error) {
      console.warn('Firebase Admin failed to initialize. Push notifications will be disabled.', error);
    }
  }
};

export const sendPushNotification = async (token: string, title: string, body: string, data?: any) => {
  if (!admin.apps.length) return;
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};
