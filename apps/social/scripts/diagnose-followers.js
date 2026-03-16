/**
 * Diagnostic: Why are follower counts stale?
 * Usage: DATABASE_URL="..." node scripts/diagnose-followers.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  // 1. Check latest metrics per account
  const accounts = await p.account.findMany({
    where: { isActive: true },
    select: { id: true, username: true },
  });

  for (const acct of accounts) {
    const last5 = await p.accountMetrics.findMany({
      where: { accountId: acct.id },
      orderBy: { date: 'desc' },
      take: 5,
      select: { id: true, date: true, followers: true, following: true },
    });

    console.log(`\n=== @${acct.username} last 5 snapshots ===`);
    for (const m of last5) {
      console.log(`  ${m.date.toISOString().slice(0, 10)} | ${m.followers} followers | ${m.following} following | id: ${m.id}`);
    }
  }

  // 2. Check API call logs for poll-metrics and daily-analytics
  console.log('\n=== Recent cron API calls (last 20) ===');
  const logs = await p.aPICallLog.findMany({
    where: {
      OR: [
        { endpoint: { contains: 'daily' } },
        { endpoint: '/user/last_tweets' },
      ],
    },
    orderBy: { timestamp: 'desc' },
    take: 20,
    select: { timestamp: true, endpoint: true, statusCode: true, accountId: true },
  });
  for (const l of logs) {
    const acct = l.accountId
      ? accounts.find((a) => a.id === l.accountId)?.username || l.accountId.slice(0, 8)
      : '-';
    console.log(
      `  ${l.timestamp.toISOString().slice(0, 16)} | ${l.endpoint.padEnd(20)} | ${l.statusCode} | @${acct}`
    );
  }

  // 3. Check if today's record exists and what's in it
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  console.log(`\n=== Today's records (${today.toISOString().slice(0, 10)}) ===`);
  const todayMetrics = await p.accountMetrics.findMany({
    where: { date: today },
    include: { account: { select: { username: true } } },
  });
  for (const m of todayMetrics) {
    console.log(`  @${m.account.username}: ${m.followers} followers, ${m.following} following, ${m.totalPosts} posts`);
  }

  // 4. Show distinct follower values per account (are they actually changing?)
  console.log('\n=== Distinct follower values per account ===');
  for (const acct of accounts) {
    const all = await p.accountMetrics.findMany({
      where: { accountId: acct.id },
      select: { followers: true },
    });
    const distinct = [...new Set(all.map((m) => m.followers))].sort((a, b) => a - b);
    console.log(`  @${acct.username}: ${distinct.join(', ')} (${distinct.length} unique values)`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
