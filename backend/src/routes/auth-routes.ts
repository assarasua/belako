import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['fan', 'artist'])
});
const googleBodySchema = z.object({
  idToken: z.string().min(20)
});

export const authRoutes = Router();

type RegisteredUser = {
  email: string;
  role: 'fan' | 'artist';
  authProvider: 'google' | 'email';
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

function resolveRegistryPath() {
  const candidates = [
    path.resolve(process.cwd(), 'backend/data/user-registry.json'),
    path.resolve(process.cwd(), 'data/user-registry.json'),
    path.resolve(process.cwd(), '../backend/data/user-registry.json')
  ];
  const existing = candidates.find((candidate) => fs.existsSync(path.dirname(candidate)));
  return existing || candidates[0];
}

function safeReadRegistry(): Record<string, RegisteredUser> {
  const registryPath = resolveRegistryPath();
  try {
    if (!fs.existsSync(registryPath)) {
      return {};
    }
    const raw = fs.readFileSync(registryPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, RegisteredUser>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function safeWriteRegistry(registry: Record<string, RegisteredUser>) {
  const registryPath = resolveRegistryPath();
  try {
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  } catch {
    // ignore write errors in MVP mode
  }
}

function getOrCreateRegisteredUser(input: {
  email: string;
  role: 'fan' | 'artist';
  authProvider: 'google' | 'email';
}) {
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const registry = safeReadRegistry();
  const existing = registry[email];
  if (existing) {
    const updated: RegisteredUser = {
      ...existing,
      role: input.role,
      authProvider: input.authProvider,
      updatedAt: now
    };
    registry[email] = updated;
    safeWriteRegistry(registry);
    return { user: updated, isNewUser: false };
  }

  const created: RegisteredUser = {
    email,
    role: input.role,
    authProvider: input.authProvider,
    onboardingCompleted: false,
    createdAt: now,
    updatedAt: now
  };
  registry[email] = created;
  safeWriteRegistry(registry);
  return { user: created, isNewUser: true };
}

function findRegisteredUser(email: string) {
  const normalized = email.trim().toLowerCase();
  const registry = safeReadRegistry();
  return registry[normalized] || null;
}

function markOnboardingCompleted(email: string) {
  const normalized = email.trim().toLowerCase();
  const registry = safeReadRegistry();
  const existing = registry[normalized];
  if (!existing) {
    return null;
  }
  const updated: RegisteredUser = {
    ...existing,
    onboardingCompleted: true,
    updatedAt: new Date().toISOString()
  };
  registry[normalized] = updated;
  safeWriteRegistry(registry);
  return updated;
}

function normalizeRole(role: string | undefined): 'fan' | 'artist' {
  return role === 'artist' ? 'artist' : 'fan';
}

function resolveRoleForGoogleEmail(email: string): 'fan' | 'artist' {
  if (env.allowAllDashboardEmails) {
    return 'artist';
  }
  const normalized = email.trim().toLowerCase();
  return env.bandAllowedEmails.includes(normalized) ? 'artist' : 'fan';
}

authRoutes.post('/login', (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { user, isNewUser } = getOrCreateRegisteredUser({
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
    const { user, isNewUser } = getOrCreateRegisteredUser({
      email: payload.email,
      role,
      authProvider: 'google'
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

authRoutes.get('/session', requireAuth, (req, res) => {
  const email = (req.authUser?.email || req.authUser?.sub || '').trim().toLowerCase();
  const existing = email && email.includes('@') ? findRegisteredUser(email) : null;
  res.json({
    user: {
      email,
      role: req.authUser?.role || 'fan',
      authProvider: req.authUser?.authProvider || 'email',
      name: req.authUser?.name || '',
      picture: req.authUser?.picture || '',
      canAccessDashboard: req.authUser?.role === 'artist',
      isRegistered: Boolean(existing),
      onboardingCompleted: existing?.onboardingCompleted ?? false
    }
  });
});

authRoutes.post('/onboarding/complete', requireAuth, (req, res) => {
  const email = (req.authUser?.email || req.authUser?.sub || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'No se pudo resolver el email autenticado.' });
    return;
  }
  const updated = markOnboardingCompleted(email);
  if (!updated) {
    const created = getOrCreateRegisteredUser({
      email,
      role: normalizeRole(req.authUser?.role),
      authProvider: req.authUser?.authProvider || 'email'
    });
    markOnboardingCompleted(email);
    res.status(201).json({ ok: true, onboardingCompleted: true, isNewUserHint: created.isNewUser });
    return;
  }
  res.json({ ok: true, onboardingCompleted: true });
});
