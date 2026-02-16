import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AuthUser = {
  sub: string;
  role: 'fan' | 'artist' | 'admin';
};

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthUser;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, env.jwtSecret) as AuthUser;
    req.authUser = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(role: AuthUser['role']) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser || req.authUser.role !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
