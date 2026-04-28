import dotenv from 'dotenv';
dotenv.config();

import { httpServer } from './server';
import { connectRedis } from './config/redis';
import prisma from './config/database';
import { setupRetentionSchedules } from './utils/queue';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Database check
    await prisma.$connect();
    console.log('PostgreSQL database connected');

    // Redis connection
    await connectRedis();

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      setupRetentionSchedules();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
