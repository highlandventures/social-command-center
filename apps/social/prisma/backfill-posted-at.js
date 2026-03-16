/**
 * One-off: Backfill postedAt on KOL activations that are missing it.
 * Fetches tweet details by ID from TwitterAPI.io to get the actual post date.
 *
 * Run with: node prisma/backfill-posted-at.js
 *
 * Requires POSTGRES_PRISMA_URL and TWITTERAPI_IO_API_KEY env vars.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_KEY = process.env.TWITTERAPI_IO_API_KEY;
const BASE_URL = 'https://api.twitterapi.io/twitter';

async function getTweetDetail(tweetId) {
  const url = new URL(`${BASE_URL}/tweet/detail`);
  url.searchParams.append('tweet_id', tweetId);

  const res = await fetch(url, {
    headers: { 'X-API-Key': API_KEY },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TwitterAPI.io ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  if (!API_KEY) {
    console.error('TWITTERAPI_IO_API_KEY not set.');
    process.exit(1);
  }

  // Get all activations missing postedAt (X platform only — Reddit would need different API)
  const activations = await prisma.kOLActivation.findMany({
    where: {
      postedAt: null,
      platform: 'X',
    },
    select: {
      id: true,
      platformPostId: true,
      content: true,
    },
    orderBy: { detectedAt: 'desc' },
  });

  console.log(`Found ${activations.length} X activations missing postedAt\n`);

  let updated = 0;
  let failed = 0;
  let notFound = 0;

  for (const act of activations) {
    try {
      const data = await getTweetDetail(act.platformPostId);
      const tweet = data?.data || data?.tweet || data;

      let postedAt = null;
      if (tweet?.createdAt) {
        postedAt = new Date(tweet.createdAt);
      } else if (tweet?.created_at) {
        postedAt = new Date(tweet.created_at);
      }

      if (postedAt && !isNaN(postedAt.getTime())) {
        await prisma.kOLActivation.update({
          where: { id: act.id },
          data: { postedAt },
        });
        console.log(`  + ${act.platformPostId} → ${postedAt.toISOString().slice(0, 10)} — ${(act.content || '').slice(0, 60)}`);
        updated++;
      } else {
        console.log(`  ? ${act.platformPostId} — no date found in response`);
        notFound++;
      }
    } catch (err) {
      console.error(`  x ${act.platformPostId} — ${err.message.slice(0, 100)}`);
      failed++;
    }

    // Rate limit: 200ms between requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`Done. Updated: ${updated}, Not found: ${notFound}, Failed: ${failed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
