/**
 * One-off: Backfill postedAt on KOL activations using Twitter Snowflake ID.
 * Twitter/X tweet IDs are Snowflake IDs that encode the creation timestamp.
 * Timestamp = (id >> 22) + 1288834974657
 *
 * Run with: node prisma/backfill-posted-at-from-id.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TWITTER_EPOCH = 1288834974657n;

function dateFromSnowflake(id) {
  try {
    const snowflake = BigInt(id);
    const timestamp = Number((snowflake >> 22n) + TWITTER_EPOCH);
    const date = new Date(timestamp);
    // Sanity check: should be between 2010 and 2027
    if (date.getFullYear() >= 2010 && date.getFullYear() <= 2027) {
      return date;
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
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
  });

  console.log(`Found ${activations.length} X activations missing postedAt\n`);

  let updated = 0;
  let failed = 0;

  for (const act of activations) {
    const postedAt = dateFromSnowflake(act.platformPostId);
    if (postedAt) {
      await prisma.kOLActivation.update({
        where: { id: act.id },
        data: { postedAt },
      });
      console.log(`  + ${act.platformPostId} → ${postedAt.toISOString().slice(0, 10)} — ${(act.content || '').slice(0, 60)}`);
      updated++;
    } else {
      console.log(`  ? ${act.platformPostId} — could not derive date`);
      failed++;
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`Done. Updated: ${updated}, Failed: ${failed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
