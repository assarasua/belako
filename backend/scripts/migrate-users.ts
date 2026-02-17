import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';

type LegacyUser = {
  email?: string;
  role?: 'fan' | 'artist';
  authProvider?: 'google' | 'email';
  onboardingCompleted?: boolean;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function resolveLegacyRegistryPath() {
  const candidates = [
    path.resolve(process.cwd(), 'backend/data/user-registry.json'),
    path.resolve(process.cwd(), 'data/user-registry.json'),
    path.resolve(process.cwd(), '../backend/data/user-registry.json')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function inferArtistByEmail(email: string): boolean {
  if (env.allowAllDashboardEmails) {
    return true;
  }
  return env.bandAllowedEmails.includes(email);
}

function inferRoles(email: string, legacyRole?: 'fan' | 'artist') {
  const isArtist = legacyRole === 'artist' || inferArtistByEmail(email);
  return {
    role: isArtist ? 'ARTIST' : 'FAN',
    appRole: isArtist ? 'artist' : 'user'
  } as const;
}

async function migrateFromLegacyFile() {
  const legacyPath = resolveLegacyRegistryPath();
  if (!legacyPath) {
    return { processed: 0, createdOrUpdated: 0 };
  }

  const raw = fs.readFileSync(legacyPath, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, LegacyUser>;
  const entries = Object.values(parsed || {}).filter((entry) => Boolean(entry?.email));

  let createdOrUpdated = 0;
  for (const entry of entries) {
    const email = normalizeEmail(String(entry.email));
    if (!email || !email.includes('@')) {
      continue;
    }
    const roles = inferRoles(email, entry.role);
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        role: roles.role,
        appRole: roles.appRole,
        authProvider: entry.authProvider === 'google' ? 'google' : 'email',
        onboardingCompleted: Boolean(entry.onboardingCompleted)
      },
      update: {
        role: roles.role,
        appRole: roles.appRole,
        authProvider: entry.authProvider === 'google' ? 'google' : 'email',
        onboardingCompleted: Boolean(entry.onboardingCompleted)
      }
    });
    createdOrUpdated += 1;
  }

  return { processed: entries.length, createdOrUpdated };
}

async function migrateFromBandSales() {
  const sales = await prisma.bandSale.findMany({
    select: {
      userEmail: true,
      customerEmail: true,
      customerName: true
    }
  });

  const emails = new Set<string>();
  for (const sale of sales) {
    if (sale.userEmail) {
      emails.add(normalizeEmail(sale.userEmail));
    }
    if (sale.customerEmail) {
      emails.add(normalizeEmail(sale.customerEmail));
    }
  }

  let createdOrUpdated = 0;
  for (const email of emails) {
    if (!email || !email.includes('@')) {
      continue;
    }
    const roles = inferRoles(email);
    const anySale = sales.find(
      (sale) => normalizeEmail(sale.userEmail || sale.customerEmail || '') === email
    );
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        role: roles.role,
        appRole: roles.appRole,
        authProvider: 'email',
        onboardingCompleted: false,
        name: anySale?.customerName || undefined
      },
      update: {
        role: roles.role,
        appRole: roles.appRole,
        name: anySale?.customerName || undefined
      }
    });
    createdOrUpdated += 1;
  }

  return { processed: emails.size, createdOrUpdated };
}

async function run() {
  const legacy = await migrateFromLegacyFile();
  const sales = await migrateFromBandSales();
  const totalUsers = await prisma.user.count();

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        legacy,
        sales,
        totalUsers
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Users migration error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
