/**
 * One-off script: Enrich KOL profiles with avatars and follower counts
 * from TwitterAPI.io using the search endpoint (more reliable than profile endpoint).
 *
 * Run with: node prisma/enrich-kol-profiles.js
 *
 * Requires POSTGRES_PRISMA_URL and TWITTERAPI_IO_API_KEY env vars.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_KEY = process.env.TWITTERAPI_IO_API_KEY;
const BASE_URL = 'https://api.twitterapi.io/twitter';

async function fetchAuthorViaSearch(username) {
  const url = new URL(`${BASE_URL}/tweet/advanced_search`);
  url.searchParams.append('query', `from:${username}`);
  url.searchParams.append('queryType', 'Latest');
  url.searchParams.append('cursor', '');

  const res = await fetch(url, {
    headers: { 'X-API-Key': API_KEY },
  });

  if (!res.ok) throw new Error(`TwitterAPI.io ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const tweets = data?.data?.tweets || data?.tweets || [];
  if (tweets.length === 0) return null;
  return tweets[0].author || null;
}

async function main() {
  if (!API_KEY) {
    console.error('TWITTERAPI_IO_API_KEY not set.');
    process.exit(1);
  }

  const kols = await prisma.kOL.findMany({
    where: { active: true, platform: 'X' },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${kols.length} active X KOLs to enrich\n`);

  let enriched = 0;
  let failed = 0;
  let skipped = 0;

  for (const kol of kols) {
    try {
      const author = await fetchAuthorViaSearch(kol.username);

      if (!author) {
        console.log(`  - @${kol.username} — no tweets found`);
        skipped++;
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      const avatarUrl = author.profilePicture || author.profile_image_url || author.avatar || null;
      const followers = author.followers || author.followersCount || author.follower_count || 0;

      const updates = {};
      if (avatarUrl) updates.avatarUrl = avatarUrl;
      if (followers > 0) updates.baselineFollowers = followers;

      if (Object.keys(updates).length > 0) {
        await prisma.kOL.update({ where: { id: kol.id }, data: updates });
        console.log(`  ✓ @${kol.username} — avatar: ${avatarUrl ? 'yes' : 'no'}, followers: ${followers.toLocaleString()}`);
        enriched++;
      } else {
        console.log(`  - @${kol.username} — no profile data in author object`);
        skipped++;
      }

      // Rate limit: 300ms between requests
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`  ✗ @${kol.username} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Enriched: ${enriched}, Skipped: ${skipped}, Failed: ${failed}, Total: ${kols.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
