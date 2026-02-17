import { prisma } from '../src/lib/prisma.js';

async function run() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, appRole: true }
  });

  if (users.length === 0) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, users: 0, backfilled: 0 }, null, 2));
    return;
  }

  const existing = await prisma.tierProgress.findMany({
    where: { userId: { in: users.map((user) => user.id) } },
    select: { userId: true }
  });
  const existingIds = new Set(existing.map((row) => row.userId));

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

  const fanUsers = users.filter((user) => user.role === 'FAN' && user.appRole !== 'artist').length;
  const artistUsers = users.length - fanUsers;

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        users: users.length,
        fanUsers,
        artistUsers,
        alreadyPresent: existing.length,
        backfilled: missing.length
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Tier progress backfill error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
