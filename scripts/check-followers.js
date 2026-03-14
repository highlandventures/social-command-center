/**
 * Diagnostic: Show follower snapshot accuracy per account.
 * Usage: DATABASE_URL="..." node scripts/check-followers.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const accounts = await p.account.findMany({
    where: { isActive: true },
    select: { id: true, username: true },
  });

  for (const acct of accounts) {
    const metrics = await p.accountMetrics.findMany({
      where: { accountId: acct.id },
      orderBy: { date: 'asc' },
      select: { date: true, followers: true },
    });

    console.log(`\n=== @${acct.username} (${metrics.length} snapshots) ===`);

    // Show every record with date and value
    let lastVal = null;
    let sameCount = 0;
    for (const m of metrics) {
      const d = m.date.toISOString().slice(0, 10);
      if (m.followers !== lastVal) {
        if (sameCount > 1) {
          console.log(`    ... (${sameCount - 1} more days at ${lastVal})`);
        }
        const delta = lastVal !== null ? ` (${m.followers > lastVal ? '+' : ''}${m.followers - lastVal})` : '';
        console.log(`  ${d}: ${m.followers.toLocaleString()} followers${delta}`);
        lastVal = m.followers;
        sameCount = 1;
      } else {
        sameCount++;
      }
    }
    if (sameCount > 1) {
      console.log(`    ... (${sameCount - 1} more days at ${lastVal})`);
    }

    // Summary
    const uniqueValues = new Set(metrics.map(m => m.followers));
    console.log(`  UNIQUE VALUES: ${uniqueValues.size} distinct counts across ${metrics.length} days`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
