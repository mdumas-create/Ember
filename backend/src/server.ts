import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import { setupSocket } from './config/socket';
import authRoutes from './modules/auth/auth.routes';
import postRoutes from './modules/posts/posts.routes';
import chatRoutes from './modules/chat/chat.routes';
import userRoutes from './modules/users/users.routes';
import uploadRoutes from './modules/upload/upload.routes';
import storiesRoutes from './modules/stories/stories.routes';
import moderationRoutes from './modules/moderation/moderation.routes';
import hashtagsRoutes from './modules/hashtags/hashtags.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import configRoutes from './modules/config/config.routes';
import { initializeFirebase } from './utils/fcm';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger';
import prisma from './config/database';
import redisClient from './config/redis';
import { v2 as cloudinary } from 'cloudinary';
import * as Sentry from '@sentry/node';
import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from './openapi';
import multer from 'multer';

const app = express();
const httpServer = createServer(app);

// 1. PRIORITIZE CORS - MUST BE FIRST
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:19006', // Expo Web
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(url => url.trim().replace(/\/$/, '')) : []),
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // If origin matches one of allowedOrigins, is null (for mobile), or ends with .vercel.app
    if (!origin || 
        allowedOrigins.includes(origin.replace(/\/$/, '')) || 
        origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// 2. OTHER MIDDLEWARES
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
}

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs for auth
  message: { error: 'Demasiados intentos, por favor intenta más tarde.' },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  message: { error: 'Ritmo de peticiones demasiado alto.' },
});

app.use(helmet({
  crossOriginResourcePolicy: false, // For web images
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(compression());

// Apply limiters
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/', apiLimiter);

// Logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Health Check
app.get('/health', async (req, res) => {
  const timestamp = new Date().toISOString();
  const checks: Record<string, any> = {};
  let ok = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { ok: true };
  } catch (e: any) {
    ok = false;
    checks.db = { ok: false, error: e?.message || 'db_error' };
  }

  try {
    if (!redisClient.isOpen) await redisClient.connect();
    const pong = await redisClient.ping();
    checks.redis = { ok: pong === 'PONG' };
    if (pong !== 'PONG') ok = false;
  } catch (e: any) {
    ok = false;
    checks.redis = { ok: false, error: e?.message || 'redis_error' };
  }

  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    await cloudinary.api.ping();
    checks.cloudinary = { ok: true };
  } catch (e: any) {
    ok = false;
    checks.cloudinary = { ok: false, error: e?.message || 'cloudinary_error' };
  }

  res.status(ok ? 200 : 503).json({ ok, timestamp, checks });
});

app.get('/api/openapi.json', (req, res) => {
  res.json(openapiSpec);
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api', moderationRoutes);
app.use('/api/hashtags', hashtagsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/config', configRoutes);

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`${err.name}: ${err.message} - ${req.method} ${req.originalUrl}`);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande (máximo 10MB)' });
    }
    return res.status(400).json({ error: `Error en la subida: ${err.message}` });
  }

  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Ocurrió un error interno en el servidor' 
    : err.message;

  res.status(status).json({ error: message });
});

// Initialize FCM
initializeFirebase();

const io = setupSocket(httpServer);

// Exporting app, httpServer and io
export { app, httpServer, io };
