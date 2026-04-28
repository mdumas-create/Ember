import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../../config/database';
import { trackEvent } from '../../utils/analytics';

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(6),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const register = async (req: Request, res: Response) => {
  console.log('Registration attempt:', req.body);
  try {
    const validated = RegisterSchema.parse(req.body);

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: validated.email }, { username: validated.username }] },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(validated.password, 10);

    const user = await prisma.user.create({
      data: {
        email: validated.email,
        username: validated.username,
        password: hashedPassword,
        interests: [], // Explicitly initialize empty array
      },
    });

    console.log('User created successfully:', user.id);

    const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });

    trackEvent('user_registered', user.id, { email: user.email }).catch(() => {});
    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        interests: user.interests,
        isPublic: user.isPublic,
        fcmToken: user.fcmToken,
        notifyPush: user.notifyPush,
        notifyMessages: user.notifyMessages,
        notifyLikes: user.notifyLikes,
        notifyComments: user.notifyComments,
      },
      accessToken,
      refreshToken
    });
  } catch (error: any) {
    console.error('Registration error detail:', error);
    let message = 'Registration failed';
    
    if (error instanceof z.ZodError) {
      message = error.issues[0]?.message || message;
      if (error.issues[0]?.path?.[0] === 'password') {
        message = 'La contraseña debe tener al menos 6 caracteres';
      } else if (error.issues[0]?.path?.[0] === 'username') {
        message = 'El usuario debe tener al menos 3 caracteres';
      }
    } else {
      message = error.message;
    }
    
    res.status(400).json({ error: message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const validated = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: validated.email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(validated.password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });

    console.log('Login successful:', user.username);

    trackEvent('user_login', user.id, { email: user.email }).catch(() => {});
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        interests: user.interests,
        isPublic: user.isPublic,
        fcmToken: user.fcmToken,
        notifyPush: user.notifyPush,
        notifyMessages: user.notifyMessages,
        notifyLikes: user.notifyLikes,
        notifyComments: user.notifyComments,
      },
      accessToken,
      refreshToken
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.sendStatus(401);

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { id: string };
    
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, suspended: true }
    });

    if (!user || user.suspended) {
      return res.sendStatus(403);
    }

    const accessToken = jwt.sign({ id: payload.id }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    res.json({ accessToken });
  } catch (error) {
    res.sendStatus(403);
  }
};
