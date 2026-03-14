/**
 * One-time script: Backfill zero-follower AccountMetrics records
 * with the earliest known real follower count for each account.
 *
 * Usage: DATABASE_URL="..." node scripts/backfill-followers.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const accounts = await p.account.findMany({
    where: { isActive: true },
    select: { id: true, username: true },
  });

  for (const acct of accounts) {
    const firstReal = await p.accountMetrics.findFirst({
      where: { accountId: acct.id, followers: { gt: 0 } },
      orderBy: { date: 'asc' },
    });

    if (!firstReal) {
      console.log(`${acct.username}: no non-zero follower data, skipping`);
      continue;
    }

    console.log(
      `${acct.username}: first real data = ${firstReal.date.toISOString().slice(0, 10)} (${firstReal.followers} followers)`
    );

    const updated = await p.accountMetrics.updateMany({
      where: { accountId: acct.id, followers: 0 },
      data: { followers: firstReal.followers, following: firstReal.following },
    });

    console.log(`  -> Backfilled ${updated.count} records`);
  }

  const remaining = await p.accountMetrics.count({ where: { followers: 0 } });
  console.log(`\nRemaining zero-follower records: ${remaining}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
