import request from 'supertest';
import { app } from '../server';
import prisma from '../config/database';
import redisClient, { connectRedis } from '../config/redis';
import jwt from 'jsonwebtoken';

describe('Posts API', () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    await connectRedis();
    // Clean up if previous test failed
    const email = 'posts-test@example.com';
    await prisma.postHashtag.deleteMany({ where: { post: { author: { email } } } });
    await prisma.postMedia.deleteMany({ where: { post: { author: { email } } } });
    await prisma.post.deleteMany({ where: { author: { email } } });
    await prisma.user.deleteMany({ where: { email } });

    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: 'posts-test@example.com',
        username: 'poststester',
        password: 'password123',
      },
    });
    userId = user.id;
    token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!);
  });

  afterAll(async () => {
    if (userId) {
      await prisma.postHashtag.deleteMany({ where: { post: { authorId: userId } } });
      await prisma.postMedia.deleteMany({ where: { post: { authorId: userId } } });
      await prisma.post.deleteMany({ where: { authorId: userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await redisClient.disconnect();
    await prisma.$disconnect();
  });

  it('should create a post', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'This is a test post #test',
      });
    
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('This is a test post #test');
  });

  it('should not allow post with banned words', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'This is a spam post',
      });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Contenido no permitido');
  });

  it('should fetch the feed', async () => {
    const res = await request(app)
      .get('/api/posts')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.posts)).toBe(true);
  });
});
