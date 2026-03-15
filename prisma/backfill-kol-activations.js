/**
 * One-off script: Historical backfill of KOL activations.
 *
 * Searches for all KOL mentions of Figure-affiliated brands/products
 * and creates activation records with actual post dates.
 *
 * Run with: node prisma/backfill-kol-activations.js
 *
 * Requires POSTGRES_PRISMA_URL and TWITTERAPI_IO_API_KEY env vars.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_KEY = process.env.TWITTERAPI_IO_API_KEY;
const BASE_URL = 'https://api.twitterapi.io/twitter';

// Brand terms that indicate a KOL is talking about Figure
const BRAND_TERMS = [
  '$FIGR', 'Figure Markets', 'Figure Lending', 'Figure Connect',
  'Figure Pay', 'Figure Technology', '@Figure',
  'Provenance Blockchain', '@provenancefdn',
  '$HASH', '$YLDS',
];

function classifyActivation(hit) {
  if (hit.inReplyToId || hit.in_reply_to_id) return 'REPLY';
  if (hit.quoted_tweet) return 'QUOTE_TWEET';
  if (hit.retweeted_tweet) return 'RETWEET';
  return 'DIRECT_MENTION';
}

async function searchTweets(query, cursor = '') {
  const url = new URL(`${BASE_URL}/tweet/advanced_search`);
  url.searchParams.append('query', query);
  url.searchParams.append('queryType', 'Latest');
  url.searchParams.append('cursor', cursor);

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

  console.log(`Found ${kols.length} active X KOLs to backfill\n`);

  const brandQuery = `(${BRAND_TERMS.join(' OR ')})`;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const kol of kols) {
    const searchQuery = `from:${kol.username} ${brandQuery}`;
    console.log(`\n── @${kol.username} ──`);
    console.log(`  Query: ${searchQuery.slice(0, 100)}...`);

    let cursor = '';
    let kolCreated = 0;
    let kolSkipped = 0;
    let pages = 0;
    const MAX_PAGES = 5; // Up to ~100 tweets per KOL

    try {
      do {
        const data = await searchTweets(searchQuery, cursor);
        const tweets = data?.data?.tweets || data?.tweets || [];

        if (tweets.length === 0) break;

        for (const tweet of tweets) {
          const platformPostId = tweet.id || tweet.id_str;
          if (!platformPostId) continue;

          // Check for existing activation
          const existing = await prisma.kOLActivation.findFirst({
            where: { kolId: kol.id, platformPostId: String(platformPostId) },
          });

          if (existing) {
            // Update postedAt if missing on existing record
            if (!existing.postedAt && tweet.createdAt) {
              const postedAt = new Date(tweet.createdAt);
              if (!isNaN(postedAt.getTime())) {
                await prisma.kOLActivation.update({
                  where: { id: existing.id },
                  data: { postedAt },
                });
              }
            }
            kolSkipped++;
            continue;
          }

          const content = tweet.text || '';
          const sourceUrl = tweet.url || tweet.twitterUrl || null;

          // Parse actual post date
          let postedAt = null;
          if (tweet.createdAt) {
            postedAt = new Date(tweet.createdAt);
            if (isNaN(postedAt.getTime())) postedAt = null;
          }

          // Extract engagement metrics
          const pm = tweet.public_metrics || {};
          const metricsAtDetection = {
            likes: tweet.likeCount || pm.like_count || 0,
            retweets: tweet.retweetCount || pm.retweet_count || 0,
            replies: tweet.replyCount || pm.reply_count || 0,
            quotes: tweet.quoteCount || pm.quote_count || 0,
            impressions: tweet.viewCount || pm.impression_count || 0,
            bookmarks: tweet.bookmarkCount || pm.bookmark_count || 0,
          };

          const activationType = classifyActivation(tweet);

          await prisma.kOLActivation.create({
            data: {
              kolId: kol.id,
              platform: 'X',
              activationType,
              platformPostId: String(platformPostId),
              content: String(content),
              sourceUrl,
              postedAt,
              detectionMethod: 'historical_backfill',
              metricsAtDetection,
            },
          });

          const dateStr = postedAt ? postedAt.toISOString().slice(0, 10) : 'unknown date';
          console.log(`  + ${dateStr} — ${content.slice(0, 80)}...`);
          kolCreated++;
        }

        cursor = data?.next_cursor || data?.data?.next_cursor || '';
        pages++;

        // Rate limit: 300ms between pages
        await new Promise(r => setTimeout(r, 300));
      } while (cursor && pages < MAX_PAGES);

      console.log(`  Result: ${kolCreated} new, ${kolSkipped} existing`);
      totalCreated += kolCreated;
      totalSkipped += kolSkipped;
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      totalErrors++;
    }

    // Rate limit between KOLs
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`Done. Created: ${totalCreated}, Skipped: ${totalSkipped}, Errors: ${totalErrors}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
