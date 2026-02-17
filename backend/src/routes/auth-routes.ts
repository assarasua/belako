import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['fan', 'artist'])
});
const googleBodySchema = z.object({
  idToken: z.string().min(20)
});

export const authRoutes = Router();

type AuthProvider = 'google' | 'email';
type AppRole = 'fan' | 'artist';

function normalizeRole(role: string | undefined): AppRole {
  return role === 'artist' ? 'artist' : 'fan';
}

function toPrismaRole(role: AppRole): 'FAN' | 'ARTIST' {
  return role === 'artist' ? 'ARTIST' : 'FAN';
}

function fromPrismaRole(role: string | undefined): AppRole {
  return role === 'ARTIST' ? 'artist' : 'fan';
}

function resolveRoleForGoogleEmail(email: string): AppRole {
  if (env.allowAllDashboardEmails) {
    return 'artist';
  }
  const normalized = email.trim().toLowerCase();
  return env.bandAllowedEmails.includes(normalized) ? 'artist' : 'fan';
}

async function upsertAuthUser(input: {
  email: string;
  role: AppRole;
  authProvider: AuthProvider;
  name?: string;
  picture?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const created = await prisma.user.create({
      data: {
        email,
        role: toPrismaRole(input.role),
        authProvider: input.authProvider,
        onboardingCompleted: false,
        name: input.name || undefined,
        picture: input.picture || undefined
      }
    });
    return { user: created, isNewUser: true };
  }

  const updated = await prisma.user.update({
    where: { email },
    data: {
      role: toPrismaRole(input.role),
      authProvider: input.authProvider,
      name: input.name || existing.name || undefined,
      picture: input.picture || existing.picture || undefined
    }
  });
  return { user: updated, isNewUser: false };
}

authRoutes.post('/login', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  try {
    const { user, isNewUser } = await upsertAuthUser({
      email: parsed.data.email,
      role: parsed.data.role,
      authProvider: 'email'
    });

    const token = jwt.sign(
      {
        sub: parsed.data.email,
        email: parsed.data.email,
        role: parsed.data.role
      },
      env.jwtSecret,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        email: parsed.data.email,
        role: parsed.data.role,
        authProvider: 'email',
        isNewUserHint: isNewUser,
        onboardingCompleted: user.onboardingCompleted
      }
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'No se pudo iniciar sesión.' });
  }
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
    const verifyResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(parsed.data.idToken)}`
    );
    const payload = (await verifyResponse.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string;
      sub?: string;
      name?: string;
      picture?: string;
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

    const role = resolveRoleForGoogleEmail(payload.email);
    const { user, isNewUser } = await upsertAuthUser({
      email: payload.email,
      role,
      authProvider: 'google',
      name: payload.name,
      picture: payload.picture
    });

    const token = jwt.sign(
      {
        sub: payload.sub || payload.email,
        email: payload.email,
        role,
        authProvider: 'google',
        name: payload.name,
        picture: payload.picture
      },
      env.jwtSecret,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        email: payload.email,
        role,
        authProvider: 'google',
        name: payload.name,
        picture: payload.picture,
        canAccessDashboard: role === 'artist',
        isNewUserHint: isNewUser,
        onboardingCompleted: user.onboardingCompleted
      }
    });
  } catch {
    res.status(500).json({ error: 'No se pudo verificar Google SSO en este momento.' });
  }
});

authRoutes.get('/session', requireAuth, async (req, res) => {
  const email = (req.authUser?.email || req.authUser?.sub || '').trim().toLowerCase();
  const existing = email && email.includes('@') ? await prisma.user.findUnique({ where: { email } }) : null;
  res.json({
    user: {
      email,
      role: existing ? fromPrismaRole(existing.role) : req.authUser?.role || 'fan',
      authProvider: (existing?.authProvider as AuthProvider | undefined) || req.authUser?.authProvider || 'email',
      name: existing?.name || req.authUser?.name || '',
      picture: existing?.picture || req.authUser?.picture || '',
      canAccessDashboard: (existing ? fromPrismaRole(existing.role) : req.authUser?.role) === 'artist',
      isRegistered: Boolean(existing),
      onboardingCompleted: existing?.onboardingCompleted ?? false
    }
  });
});

authRoutes.post('/onboarding/complete', requireAuth, async (req, res) => {
  const email = (req.authUser?.email || req.authUser?.sub || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'No se pudo resolver el email autenticado.' });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email,
          role: toPrismaRole(normalizeRole(req.authUser?.role)),
          authProvider: req.authUser?.authProvider || 'email',
          onboardingCompleted: true,
          name: req.authUser?.name || undefined,
          picture: req.authUser?.picture || undefined
        }
      });
      res.status(201).json({ ok: true, onboardingCompleted: true, isNewUserHint: true });
      return;
    }

    await prisma.user.update({
      where: { email },
      data: { onboardingCompleted: true }
    });
    res.json({ ok: true, onboardingCompleted: true, isNewUserHint: false });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'No se pudo completar onboarding.' });
  }
});
