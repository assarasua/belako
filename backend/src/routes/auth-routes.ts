import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['fan', 'artist'])
});

export const authRoutes = Router();

authRoutes.post('/login', (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const token = jwt.sign(
    {
      sub: parsed.data.email,
      role: parsed.data.role
    },
    env.jwtSecret,
    { expiresIn: '12h' }
  );

  res.json({ token, user: { email: parsed.data.email, role: parsed.data.role } });
});
