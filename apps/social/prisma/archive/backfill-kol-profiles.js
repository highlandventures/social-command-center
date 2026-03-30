/**
 * One-off: Backfill KOL profile metadata from TwitterAPI.io.
 * Uses the advanced_search endpoint (which works with this API key)
 * to extract author profile data from each KOL's most recent tweets.
 *
 * Run with: TWITTERAPI_IO_API_KEY="..." node prisma/backfill-kol-profiles.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_KEY = process.env.TWITTERAPI_IO_API_KEY;
const BASE_URL = 'https://api.twitterapi.io/twitter';

async function searchTweets(query) {
  const url = new URL(`${BASE_URL}/tweet/advanced_search`);
  url.searchParams.append('query', query);
  url.searchParams.append('queryType', 'Latest');

  const res = await fetch(url, {
    headers: { 'X-API-Key': API_KEY },
  });

  if (!res.ok) throw new Error(`TwitterAPI.io ${res.status}: ${await res.text()}`);
  return res.json();
}

function extractProfileMetadata(data) {
  if (!data) return {};

  const createdAtRaw = data.createdAt || data.created_at;
  let accountCreatedAt = null;
  if (createdAtRaw) {
    const d = new Date(createdAtRaw);
    if (!isNaN(d.getTime())) accountCreatedAt = d;
  }

  // Bio is in profile_bio.description (not top-level description which is always empty)
  const bio = data.profile_bio?.description || data.description || data.bio || null;

  // Website URL from profile_bio entities
  const entityUrl = data.profile_bio?.entities?.url?.urls?.[0]?.expanded_url;
  const websiteUrl = entityUrl || data.website || null;

  return {
    avatarUrl: data.profilePicture || data.profile_image_url || data.profileImageUrl || data.avatar || null,
    baselineFollowers: data.followers || data.followersCount || data.public_metrics?.followers_count || data.follower_count || 0,
    bio: bio || null,
    location: data.location || null,
    verified: data.isBlueVerified || data.verified || data.isVerified || false,
    followingCount: data.following || data.followingCount || data.friends_count || data.public_metrics?.following_count || null,
    accountCreatedAt,
    websiteUrl: websiteUrl || null,
    name: data.name || data.displayName || null,
  };
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

  console.log(`Found ${kols.length} active X KOLs to enrich\n`);

  let enriched = 0;
  let failed = 0;

  for (const kol of kols) {
    try {
      console.log(`── @${kol.username} ──`);

      // Use search to find a recent tweet by this user — author data is embedded
      const data = await searchTweets(`from:${kol.username}`);
      const tweets = data?.tweets || data?.data?.tweets || [];

      if (tweets.length === 0 || !tweets[0].author) {
        console.log('  No tweets/author data found, skipping');
        continue;
      }

      const authorData = tweets[0].author;
      const metadata = extractProfileMetadata(authorData);

      // Build updates
      const updates = { profileEnrichedAt: new Date() };

      if (metadata.avatarUrl) updates.avatarUrl = metadata.avatarUrl;
      if (metadata.baselineFollowers > 0) updates.baselineFollowers = metadata.baselineFollowers;
      if (metadata.bio) updates.bio = metadata.bio;
      // Allow empty string bio (user cleared their bio)
      if (metadata.bio !== null && metadata.bio !== undefined) updates.bio = metadata.bio || null;
      if (metadata.location) updates.location = metadata.location;
      if (metadata.verified !== undefined) updates.verified = metadata.verified;
      if (metadata.followingCount) updates.followingCount = metadata.followingCount;
      if (metadata.accountCreatedAt) updates.accountCreatedAt = metadata.accountCreatedAt;
      if (metadata.websiteUrl) updates.websiteUrl = metadata.websiteUrl;

      await prisma.kOL.update({ where: { id: kol.id }, data: updates });

      console.log(`  Bio: ${(metadata.bio || '(empty)').substring(0, 80)}${(metadata.bio || '').length > 80 ? '...' : ''}`);
      console.log(`  Followers: ${metadata.baselineFollowers.toLocaleString()} | Following: ${metadata.followingCount || 'N/A'}`);
      console.log(`  Location: ${metadata.location || 'N/A'} | Verified: ${metadata.verified}`);
      console.log(`  Joined: ${metadata.accountCreatedAt ? metadata.accountCreatedAt.toISOString().split('T')[0] : 'N/A'}`);
      enriched++;
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      failed++;
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`Done. Enriched: ${enriched}, Failed: ${failed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
