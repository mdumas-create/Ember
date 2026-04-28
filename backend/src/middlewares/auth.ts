import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

export interface AuthRequest extends Request {
  user?: { id: string; role?: string; username?: string };
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, suspended: true, username: true },
    });
    if (!dbUser) {
      console.warn('Auth Failure: User not found in DB', decoded.id);
      return res.sendStatus(401);
    }
    if (dbUser.suspended) {
      console.warn('Auth Failure: User suspended', dbUser.id);
      return res.status(403).json({ error: 'Cuenta suspendida' });
    }
    (req as AuthRequest).user = { id: dbUser.id, role: dbUser.role, username: dbUser.username };
    next();
  } catch (err: any) {
    console.error('JWT Verification Error:', err.message);
    return res.sendStatus(401);
  }
};

export const requireRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const role = authReq.user?.role;
    if (!role || !roles.includes(role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
};
