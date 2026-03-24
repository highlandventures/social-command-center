/**
 * One-time: Backfill AccountMetrics from X Analytics CSV export.
 *
 * Calculates daily follower counts by working backwards from the current
 * known count using daily new follows / unfollows. Also writes daily
 * impressions, engagements, likes, replies, reposts, and profile visits.
 *
 * This route is idempotent — it upserts by accountId + date.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

// Data from X Analytics CSV export for @Figure account
// Current follower count on Mar 24: 21,017 (from TwitterAPI.io)
const CURRENT_FOLLOWERS = 21017;
const ACCOUNT_USERNAME = 'Figure';

// CSV data: [date, impressions, likes, engagements, bookmarks, shares, newFollows, unfollows, replies, reposts, profileVisits]
const CSV_DATA = [
  ['2026-03-24', 1608, 10, 39, 0, 1, 4, 1, 0, 0, 7],
  ['2026-03-23', 5340, 47, 164, 2, 0, 13, 9, 3, 7, 16],
  ['2026-03-22', 1872, 11, 54, 0, 0, 8, 8, 4, 1, 7],
  ['2026-03-21', 2679, 20, 79, 3, 2, 8, 6, 4, 0, 8],
  ['2026-03-20', 7604, 33, 239, 9, 5, 18, 13, 2, 4, 30],
  ['2026-03-19', 6086, 50, 262, 2, 15, 19, 3, 3, 12, 38],
  ['2026-03-18', 1881, 21, 69, 1, 0, 13, 6, 3, 0, 16],
  ['2026-03-17', 2066, 25, 108, 2, 2, 18, 4, 5, 4, 7],
  ['2026-03-16', 1155, 10, 55, 0, 0, 16, 8, 2, 0, 5],
  ['2026-03-15', 1553, 8, 64, 2, 0, 6, 2, 5, 2, 11],
  ['2026-03-14', 1759, 23, 72, 0, 0, 9, 4, 3, 3, 11],
  ['2026-03-13', 2519, 30, 107, 3, 2, 8, 4, 4, 4, 7],
  ['2026-03-12', 2479, 29, 86, 3, 1, 10, 3, 0, 3, 14],
  ['2026-03-11', 2288, 22, 122, 0, 0, 21, 5, 5, 4, 11],
  ['2026-03-10', 1720, 17, 77, 0, 0, 24, 8, 1, 11, 7],
  ['2026-03-09', 1379, 7, 51, 3, 0, 11, 8, 2, 2, 7],
  ['2026-03-08', 1378, 11, 65, 2, 1, 12, 7, 1, 0, 11],
  ['2026-03-07', 2410, 18, 61, 1, 0, 8, 4, 3, 2, 14],
  ['2026-03-06', 2780, 29, 125, 0, 1, 11, 3, 4, 3, 19],
  ['2026-03-05', 2836, 6, 62, 1, 0, 16, 1, 2, 0, 8],
  ['2026-03-04', 4201, 37, 152, 4, 0, 14, 5, 16, 3, 12],
  ['2026-03-03', 4679, 49, 191, 2, 1, 20, 9, 6, 12, 19],
  ['2026-03-02', 2530, 13, 68, 0, 0, 16, 3, 5, 2, 13],
  ['2026-03-01', 2134, 6, 75, 0, 0, 22, 5, 3, 0, 21],
  ['2026-02-28', 6097, 27, 257, 3, 0, 111, 6, 3, 4, 30],
  ['2026-02-27', 8473, 85, 356, 5, 4, 51, 6, 3, 13, 54],
  ['2026-02-26', 6167, 57, 222, 3, 1, 23, 4, 7, 5, 35],
  ['2026-02-25', 7731, 77, 279, 2, 1, 25, 4, 5, 8, 33],
  ['2026-02-24', 7700, 75, 260, 4, 2, 36, 5, 9, 12, 30],
];

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { upserted: 0, errors: [] };

  try {
    // Find the Figure account
    const account = await prisma.account.findFirst({
      where: { username: ACCOUNT_USERNAME, isActive: true },
    });

    if (!account) {
      return NextResponse.json({ error: `Account @${ACCOUNT_USERNAME} not found` }, { status: 404 });
    }

    // Calculate daily follower counts working backwards from current
    // CSV is sorted newest first, so index 0 = most recent day
    const dailyData = [];
    let runningFollowers = CURRENT_FOLLOWERS;

    for (let i = 0; i < CSV_DATA.length; i++) {
      const [dateStr, impressions, likes, engagements, bookmarks, shares, newFollows, unfollows, replies, reposts, profileVisits] = CSV_DATA[i];

      // For the first row (today), followers = current count
      // For each subsequent row, subtract the net change of the PREVIOUS (more recent) day
      if (i > 0) {
        const prevRow = CSV_DATA[i - 1];
        const prevNewFollows = prevRow[6];
        const prevUnfollows = prevRow[7];
        runningFollowers -= (prevNewFollows - prevUnfollows);
      }

      dailyData.push({
        date: dateStr,
        followers: runningFollowers,
        impressions,
        likes,
        engagements,
        replies,
        reposts,
        profileVisits,
      });
    }

    // Upsert each day into AccountMetrics
    for (const day of dailyData) {
      try {
        const date = new Date(day.date + 'T00:00:00.000Z');

        await prisma.accountMetrics.upsert({
          where: {
            accountId_date: {
              accountId: account.id,
              date,
            },
          },
          update: {
            followers: day.followers,
          },
          create: {
            accountId: account.id,
            date,
            followers: day.followers,
            following: 0, // Not available in CSV
            totalPosts: 0,
          },
        });
        results.upserted++;
      } catch (dayErr) {
        results.errors.push({ date: day.date, error: dayErr.message });
      }
    }

    // Return the calculated follower progression for verification
    results.followerProgression = dailyData.map(d => ({
      date: d.date,
      followers: d.followers,
    }));

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('[backfill-followers] Fatal error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
