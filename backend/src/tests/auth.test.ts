import request from 'supertest';
import { app } from '../server';
import prisma from '../config/database';
import redisClient, { connectRedis } from '../config/redis';

describe('Auth API', () => {
  const testUser = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
  };

  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await redisClient.disconnect();
    await prisma.$disconnect();
  });

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    expect(res.status).toBe(201);
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('should login an existing user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });
});
