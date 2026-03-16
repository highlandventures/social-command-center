/**
 * Backfill historical follower counts from X Analytics CSV export.
 *
 * Uses "New follows" and "Unfollows" columns to reconstruct daily follower counts
 * by working backwards from the known current count.
 *
 * Usage: POSTGRES_PRISMA_URL=... node scripts/backfill-from-csv.js <csv_path> <handle> <current_followers>
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_PRISMA_URL } },
});

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',');

  const newFollowsIdx = headers.indexOf('New follows');
  const unfollowsIdx = headers.indexOf('Unfollows');
  const dateIdx = headers.indexOf('Date');

  if (newFollowsIdx === -1 || unfollowsIdx === -1 || dateIdx === -1) {
    throw new Error('CSV must have Date, New follows, and Unfollows columns');
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted date fields
    const match = lines[i].match(/^"([^"]+)",(.+)$/);
    if (!match) continue;

    const dateStr = match[1];
    const rest = match[2].split(',');

    // rest indices are offset by 1 since we already consumed the date
    const newFollows = parseInt(rest[newFollowsIdx - 1], 10) || 0;
    const unfollows = parseInt(rest[unfollowsIdx - 1], 10) || 0;

    // Parse date like "Sat, Mar 14, 2026"
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.warn(`Skipping unparseable date: ${dateStr}`);
      continue;
    }

    rows.push({
      date: date.toISOString().split('T')[0], // YYYY-MM-DD
      newFollows,
      unfollows,
    });
  }

  // Sort newest first (should already be, but just in case)
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

async function main() {
  const csvPath = process.argv[2];
  const handle = process.argv[3];
  const currentFollowers = parseInt(process.argv[4], 10);

  if (!csvPath || !handle || isNaN(currentFollowers)) {
    console.error('Usage: node backfill-from-csv.js <csv_path> <handle> <current_followers>');
    process.exit(1);
  }

  // Find the account
  const account = await prisma.account.findFirst({
    where: { username: { contains: handle, mode: 'insensitive' } },
  });

  if (!account) {
    console.error(`Account not found for handle: ${handle}`);
    process.exit(1);
  }

  console.log(`Account: ${account.handle} (${account.id})`);
  console.log(`Current followers: ${currentFollowers}`);

  // Parse CSV
  const rows = parseCSV(csvPath);
  console.log(`Parsed ${rows.length} days from CSV`);

  // Reconstruct follower counts working backwards from current
  // rows[0] is the most recent day
  const dailyCounts = [];
  let followers = currentFollowers;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (i === 0) {
      // Most recent day: this is the current count
      dailyCounts.push({ date: row.date, followers });
    } else {
      // Previous day's end-of-day count = current - today's net change
      // The net change for the CURRENT row was already applied to get to `followers`
      // So we subtract the PREVIOUS row's net to go back
      const prevRow = rows[i - 1];
      followers = followers - prevRow.newFollows + prevRow.unfollows;
      dailyCounts.push({ date: row.date, followers });
    }
  }

  // Show summary
  const oldest = dailyCounts[dailyCounts.length - 1];
  const newest = dailyCounts[0];
  console.log(`\nReconstructed range: ${oldest.date} (${oldest.followers}) → ${newest.date} (${newest.followers})`);
  console.log(`Net change: +${newest.followers - oldest.followers} followers over ${dailyCounts.length} days\n`);

  // Update DB records
  let updated = 0;
  let created = 0;
  let skipped = 0;

  for (const { date, followers } of dailyCounts) {
    const dateObj = new Date(date + 'T00:00:00Z');

    try {
      const existing = await prisma.accountMetrics.findFirst({
        where: {
          accountId: account.id,
          date: dateObj,
        },
      });

      if (existing) {
        if (existing.followers !== followers) {
          await prisma.accountMetrics.update({
            where: { id: existing.id },
            data: { followers },
          });
          updated++;
          if (updated <= 5) {
            console.log(`  Updated ${date}: ${existing.followers} → ${followers}`);
          }
        } else {
          skipped++;
        }
      } else {
        // Only create records within our DB range (Jan 23 onwards)
        await prisma.accountMetrics.create({
          data: {
            accountId: account.id,
            date: dateObj,
            followers,
            following: 0,
            totalPosts: 0,
          },
        });
        created++;
        if (created <= 5) {
          console.log(`  Created ${date}: ${followers}`);
        }
      }
    } catch (err) {
      console.warn(`  Error on ${date}: ${err.message}`);
    }
  }

  console.log(`\nDone! Updated: ${updated}, Created: ${created}, Skipped (unchanged): ${skipped}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
