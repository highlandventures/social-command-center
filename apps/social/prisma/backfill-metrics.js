/**
 * One-off: Backfill metricsAtDetection on KOL activations.
 * Re-searches each KOL's tweets and updates engagement metrics
 * (likes, retweets, replies, impressions, etc.) on existing activations.
 *
 * Run with: node prisma/backfill-metrics.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_KEY = process.env.TWITTERAPI_IO_API_KEY;
const BASE_URL = 'https://api.twitterapi.io/twitter';

const BRAND_TERMS = [
  '$FIGR', 'Figure Markets', 'Figure Lending', 'Figure Connect',
  'Figure Pay', 'Figure Technology', '@Figure',
  'Provenance Blockchain', '@provenancefdn',
  '$HASH', '$YLDS',
];

async function searchTweets(query, cursor = '') {
  const url = new URL(`${BASE_URL}/tweet/advanced_search`);
  url.searchParams.append('query', query);
  url.searchParams.append('queryType', 'Latest');
  if (cursor) url.searchParams.append('cursor', cursor);

  const res = await fetch(url, {
    headers: { 'X-API-Key': API_KEY },
  });

  if (!res.ok) throw new Error(`TwitterAPI.io ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  if (!API_KEY) {
    console.error('TWITTERAPI_IO_API_KEY not set.');
    process.exit(1);
  }

  const kols = await prisma.kOL.findMany({
    where: { active: true, platform: 'X' },
    orderBy: { username: 'asc' },
  });

  console.log(`Found ${kols.length} active X KOLs\n`);

  const brandQuery = `(${BRAND_TERMS.join(' OR ')})`;
  let totalUpdated = 0;

  for (const kol of kols) {
    const searchQuery = `from:${kol.username} ${brandQuery}`;
    console.log(`\n── @${kol.username} ──`);

    let cursor = '';
    let kolUpdated = 0;
    let pages = 0;
    const MAX_PAGES = 5;

    try {
      do {
        const data = await searchTweets(searchQuery, cursor);
        const tweets = data?.data?.tweets || data?.tweets || [];

        if (tweets.length === 0) break;

        for (const tweet of tweets) {
          const platformPostId = tweet.id || tweet.id_str;
          if (!platformPostId) continue;

          // Find existing activation
          const existing = await prisma.kOLActivation.findFirst({
            where: { kolId: kol.id, platformPostId: String(platformPostId) },
          });

          if (!existing) continue;

          // Check if metrics are all zeros
          const em = existing.metricsAtDetection || {};
          const hasMetrics = (em.likes || 0) + (em.retweets || 0) + (em.replies || 0) + (em.impressions || 0) > 0;
          if (hasMetrics) continue;

          // Extract engagement from tweet
          const pm = tweet.public_metrics || {};
          const metrics = {
            likes: tweet.likeCount || pm.like_count || 0,
            retweets: tweet.retweetCount || pm.retweet_count || 0,
            replies: tweet.replyCount || pm.reply_count || 0,
            quotes: tweet.quoteCount || pm.quote_count || 0,
            impressions: tweet.viewCount || pm.impression_count || 0,
            bookmarks: tweet.bookmarkCount || pm.bookmark_count || 0,
          };

          const totalEng = metrics.likes + metrics.retweets + metrics.replies;
          if (totalEng === 0 && metrics.impressions === 0) continue;

          await prisma.kOLActivation.update({
            where: { id: existing.id },
            data: { metricsAtDetection: metrics },
          });

          console.log(`  + ${platformPostId}: ${metrics.likes}L ${metrics.retweets}RT ${metrics.impressions}imp`);
          kolUpdated++;
        }

        cursor = data?.next_cursor || data?.data?.next_cursor || '';
        pages++;
        await new Promise(r => setTimeout(r, 300));
      } while (cursor && pages < MAX_PAGES);

      console.log(`  Updated: ${kolUpdated}`);
      totalUpdated += kolUpdated;
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`Done. Updated ${totalUpdated} activations with real metrics.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
