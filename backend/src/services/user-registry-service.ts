import { prisma } from '../lib/prisma.js';
import fs from 'node:fs';
import path from 'node:path';

export type RegisteredUserRecord = {
  email: string;
  role: 'fan' | 'artist';
  authProvider: 'google' | 'email';
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

function mapRole(role: string): 'fan' | 'artist' {
  return role === 'ARTIST' ? 'artist' : 'fan';
}

function resolveLegacyRegistryPath() {
  const candidates = [
    path.resolve(process.cwd(), 'backend/data/user-registry.json'),
    path.resolve(process.cwd(), 'data/user-registry.json'),
    path.resolve(process.cwd(), '../backend/data/user-registry.json')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

async function importLegacyUsersToDb() {
  const legacyPath = resolveLegacyRegistryPath();
  if (!legacyPath) {
    return;
  }
  try {
    const raw = fs.readFileSync(legacyPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<
      string,
      {
        email?: string;
        role?: 'fan' | 'artist';
        authProvider?: 'google' | 'email';
        onboardingCompleted?: boolean;
        createdAt?: string;
      }
    >;
    const entries = Object.values(parsed || {}).filter((item) => Boolean(item?.email));
    if (entries.length === 0) {
      return;
    }
    for (const entry of entries) {
      const email = String(entry.email).trim().toLowerCase();
      if (!email) {
        continue;
      }
      await prisma.user.upsert({
        where: { email },
        create: {
          email,
          role: entry.role === 'artist' ? 'ARTIST' : 'FAN',
          authProvider: entry.authProvider === 'google' ? 'google' : 'email',
          onboardingCompleted: Boolean(entry.onboardingCompleted)
        },
        update: {
          role: entry.role === 'artist' ? 'ARTIST' : 'FAN',
          authProvider: entry.authProvider === 'google' ? 'google' : 'email',
          onboardingCompleted: Boolean(entry.onboardingCompleted)
        }
      });
    }
  } catch {
    // ignore legacy import errors
  }
}

export async function listRegisteredUsers(): Promise<RegisteredUserRecord[]> {
  await importLegacyUsersToDb();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return users.map((user) => ({
    email: user.email,
    role: mapRole(user.role),
    authProvider: user.authProvider === 'google' ? 'google' : 'email',
    onboardingCompleted: user.onboardingCompleted,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  }));
}
