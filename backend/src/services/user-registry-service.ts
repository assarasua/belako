import { prisma } from '../lib/prisma.js';
import fs from 'node:fs';
import path from 'node:path';

export type RegisteredUserRecord = {
  email: string;
  role: 'user' | 'artist';
  fanTier: 'Fan Belako' | 'Super Fan Belako' | 'Ultra Fan Belako' | 'God Fan Belako' | 'Artist';
  xp: number;
  authProvider: 'google' | 'email';
  onboardingCompleted: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRole(role: string, appRole: string): 'user' | 'artist' {
  if (appRole === 'artist' || role === 'ARTIST') {
    return 'artist';
  }
  return 'user';
}

function mapFanTierFromTierNumber(tierNumber: number): RegisteredUserRecord['fanTier'] {
  if (tierNumber >= 3) {
    return 'God Fan Belako';
  }
  if (tierNumber === 2) {
    return 'Ultra Fan Belako';
  }
  if (tierNumber === 1) {
    return 'Super Fan Belako';
  }
  return 'Fan Belako';
}

function estimateXpFromProgress(progress: { tier: number; attendance: number; spendUsd: { toNumber: () => number } } | undefined): number {
  if (!progress) {
    return 0;
  }
  const baseByTier = [0, 180, 420, 760];
  const baseXp = progress.tier >= 0 && progress.tier < baseByTier.length
    ? baseByTier[progress.tier]
    : 760 + Math.max(0, progress.tier - 3) * 200;
  const attendanceBonus = Math.max(0, progress.attendance) * 10;
  const spendBonus = Math.floor(Math.max(0, progress.spendUsd.toNumber()));
  return Math.max(0, Math.round(baseXp + attendanceBonus + spendBonus));
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
  if (users.length > 0) {
    const existingProgress = await prisma.tierProgress.findMany({
      where: { userId: { in: users.map((user) => user.id) } },
      select: { userId: true }
    });
    const existingIds = new Set(existingProgress.map((row) => row.userId));
    const missing = users.filter((user) => !existingIds.has(user.id));
    if (missing.length > 0) {
      await prisma.tierProgress.createMany({
        data: missing.map((user) => ({
          userId: user.id,
          attendance: 0,
          spendUsd: 0,
          tier: 0
        })),
        skipDuplicates: true
      });
    }
  }
  const tierProgressRows = await prisma.tierProgress.findMany({
    where: { userId: { in: users.map((user) => user.id) } }
  });
  const progressByUserId = new Map(tierProgressRows.map((row) => [row.userId, row]));

  return users.map((user) => ({
    email: user.email,
    role: mapRole(user.role, user.appRole),
    fanTier: mapRole(user.role, user.appRole) === 'artist'
      ? 'Artist'
      : mapFanTierFromTierNumber(progressByUserId.get(user.id)?.tier ?? 0),
    xp: mapRole(user.role, user.appRole) === 'artist'
      ? 0
      : estimateXpFromProgress(progressByUserId.get(user.id)),
    authProvider: user.authProvider === 'google' ? 'google' : 'email',
    onboardingCompleted: user.onboardingCompleted,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  }));
}
