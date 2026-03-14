/**
 * Cron: Poll Subreddit Metrics
 * Schedule: Every 6 hours (0 */6 * * *)
 *
 * Fetches subscriber counts, post volume, and engagement stats for
 * all active MonitoredSubreddit records via SociaVault.
 * Stores daily snapshots in SubredditMetrics for trending over time.
 *
 * COST: 1 SociaVault credit per subreddit per poll.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSubredditPosts } from '@/lib/sociavault';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.SOCIAVAULT_API_KEY) {
    return NextResponse.json({ error: 'SOCIAVAULT_API_KEY not configured' }, { status: 500 });
  }

  const results = { subredditsPolled: 0, metricsCreated: 0, errors: [] };

  try {
    const monitoredSubs = await prisma.monitoredSubreddit.findMany({
      where: { active: true },
    });

    if (monitoredSubs.length === 0) {
      return NextResponse.json({ ok: true, message: 'No monitored subreddits found', ...results });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (const sub of monitoredSubs) {
      try {
        // Fetch recent posts from subreddit (includes subreddit_subscribers on each post)
        const posts = await getSubredditPosts(sub.subredditName, {
          sort: 'new',
          timeframe: 'day',
        });

        results.subredditsPolled++;

        // Extract subscriber count from first post with the field
        const subscribers = posts.reduce((max, p) => {
          const s = p.subreddit_subscribers || 0;
          return s > max ? s : max;
        }, 0);

        // Compute post-level stats
        const postsCount = posts.length;
        const totalUpvotes = posts.reduce((sum, p) => sum + (p.ups || 0), 0);
        const totalComments = posts.reduce((sum, p) => sum + (p.num_comments || 0), 0);
        const avgUpvotes = postsCount > 0 ? totalUpvotes / postsCount : 0;
        const avgComments = postsCount > 0 ? totalComments / postsCount : 0;

        // Find top post
        const topPost = posts.reduce((best, p) => (!best || (p.ups || 0) > (best.ups || 0)) ? p : best, null);

        // Upsert daily snapshot
        await prisma.subredditMetrics.upsert({
          where: {
            subredditId_date: { subredditId: sub.id, date: today },
          },
          update: {
            subscribers,
            postsCount,
            commentsCount: totalComments,
            avgUpvotes: Math.round(avgUpvotes * 100) / 100,
            avgComments: Math.round(avgComments * 100) / 100,
            topPostScore: topPost?.ups || 0,
            topPostTitle: topPost?.title || null,
          },
          create: {
            subredditId: sub.id,
            date: today,
            subscribers,
            postsCount,
            commentsCount: totalComments,
            avgUpvotes: Math.round(avgUpvotes * 100) / 100,
            avgComments: Math.round(avgComments * 100) / 100,
            topPostScore: topPost?.ups || 0,
            topPostTitle: topPost?.title || null,
          },
        });

        results.metricsCreated++;

        // Also update the running averages on the MonitoredSubreddit record
        await prisma.monitoredSubreddit.update({
          where: { id: sub.id },
          data: {
            avgDailyPosts: postsCount,
            avgEngagement: Math.round(avgUpvotes * 100) / 100,
          },
        });

        // Rate-limit: small delay between subreddits
        await new Promise((r) => setTimeout(r, 300));
      } catch (subError) {
        console.error(`[poll-subreddit-metrics] Error polling r/${sub.subredditName}:`, subError.message);
        results.errors.push({ subreddit: sub.subredditName, error: subError.message });
      }
    }

    console.log(`[poll-subreddit-metrics] Done: ${results.subredditsPolled} polled, ${results.metricsCreated} snapshots`);
    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('[poll-subreddit-metrics] Cron error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
