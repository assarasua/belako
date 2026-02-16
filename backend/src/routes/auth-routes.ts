import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['fan', 'artist'])
});
const googleBodySchema = z.object({
  idToken: z.string().min(20)
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

authRoutes.post('/google', async (req, res) => {
  const parsed = googleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  if (!env.googleClientId) {
    res.status(500).json({ error: 'Google SSO no está configurado en el backend (GOOGLE_CLIENT_ID).' });
    return;
  }

  try {
    const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(parsed.data.idToken)}`);
    const payload = (await verifyResponse.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string;
      sub?: string;
      exp?: string;
    };

    if (!verifyResponse.ok) {
      res.status(401).json({ error: 'Google id_token inválido.' });
      return;
    }

    if (payload.aud !== env.googleClientId) {
      res.status(401).json({ error: 'Google id_token no corresponde al cliente configurado.' });
      return;
    }

    if (!payload.email || payload.email_verified !== 'true') {
      res.status(401).json({ error: 'La cuenta Google no tiene email verificado.' });
      return;
    }

    const token = jwt.sign(
      {
        sub: payload.sub || payload.email,
        email: payload.email,
        role: 'fan',
        authProvider: 'google'
      },
      env.jwtSecret,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        email: payload.email,
        role: 'fan',
        authProvider: 'google'
      }
    });
  } catch {
    res.status(500).json({ error: 'No se pudo verificar Google SSO en este momento.' });
  }
});
