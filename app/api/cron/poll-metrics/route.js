/**
 * Cron: Poll Post Metrics
 * Schedule: Every 15 minutes (* /15 * * * *)
 *
 * Adaptive polling: fetches engagement metrics for published posts based on age.
 *   - Posts <2h old: always poll
 *   - Posts 2-48h old: poll (within cycle)
 *   - Posts >48h but <7d: only if last fetched >6h ago
 *   - Posts >7d: skip
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getValidToken } from '@/lib/token-refresh';
import { XPlatformAdapter } from '@/lib/x-adapter';
import { RedditAdapter } from '@/lib/reddit-adapter';

export const dynamic = 'force-dynamic';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { metricsFetched: 0, postsProcessed: 0, errors: [] };

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

    // Get all published posts within the last 7 days
    const publishedPosts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        platformPostId: { not: null },
        publishedAt: { gte: sevenDaysAgo },
      },
      include: {
        account: true,
        metrics: {
          orderBy: { fetchedAt: 'desc' },
          take: 1,
        },
      },
    });

    for (const post of publishedPosts) {
      try {
        const postAgeMs = now.getTime() - new Date(post.publishedAt).getTime();
        const lastFetch = post.metrics[0]?.fetchedAt;
        const timeSinceLastFetch = lastFetch
          ? now.getTime() - new Date(lastFetch).getTime()
          : Infinity;

        // Adaptive polling logic
        let shouldPoll = false;

        if (postAgeMs < TWO_HOURS_MS) {
          // Posts <2h old: always poll
          shouldPoll = true;
        } else if (postAgeMs < FORTY_EIGHT_HOURS_MS) {
          // Posts 2-48h old: poll within cycle
          shouldPoll = true;
        } else if (postAgeMs < SEVEN_DAYS_MS) {
          // Posts >48h but <7d: only if last fetched >6h ago
          shouldPoll = timeSinceLastFetch > SIX_HOURS_MS;
        }
        // Posts >7d: already excluded by query

        if (!shouldPoll) continue;

        const token = await getValidToken(post.account);
        let metricsData = {};

        if (post.account.platform === 'X') {
          const adapter = new XPlatformAdapter(token);
          const response = await adapter.getOwnTweetMetrics(post.platformPostId);
          const publicMetrics = response?.data?.public_metrics || {};
          const nonPublicMetrics = response?.data?.non_public_metrics || {};
          const organicMetrics = response?.data?.organic_metrics || {};

          metricsData = {
            impressions:
              nonPublicMetrics.impression_count ||
              organicMetrics.impression_count ||
              0,
            engagements:
              (publicMetrics.like_count || 0) +
              (publicMetrics.retweet_count || 0) +
              (publicMetrics.reply_count || 0) +
              (publicMetrics.quote_count || 0) +
              (publicMetrics.bookmark_count || 0),
            likes: publicMetrics.like_count || 0,
            retweets: publicMetrics.retweet_count || 0,
            replies: publicMetrics.reply_count || 0,
            bookmarks: publicMetrics.bookmark_count || 0,
            linkClicks: nonPublicMetrics.url_link_clicks || 0,
            profileClicks: nonPublicMetrics.user_profile_clicks || 0,
          };
        } else if (post.account.platform === 'REDDIT') {
          const adapter = new RedditAdapter(token);
          // Fetch post data from Reddit to get metrics
          const response = await adapter.getUserPosts(post.account.username, 'new', 100);
          const children = response?.data?.children || [];
          const redditPost = children.find(
            (c) =>
              c.data?.id === post.platformPostId ||
              c.data?.name === post.platformPostId,
          );

          if (redditPost) {
            const d = redditPost.data;
            metricsData = {
              upvotes: d.ups || 0,
              downvotes: d.downs || 0,
              commentCount: d.num_comments || 0,
              awards: d.total_awards_received || 0,
              // Map to generic engagement fields
              engagements: (d.ups || 0) + (d.num_comments || 0),
              impressions: d.view_count || 0,
            };
          }
        }

        // Compute engagement rate (handle division by zero)
        const impressions = metricsData.impressions || 0;
        const engagements = metricsData.engagements || 0;
        const engagementRate =
          impressions > 0 ? (engagements / impressions) * 100 : 0;

        // Create PostMetrics record
        await prisma.postMetrics.create({
          data: {
            postId: post.id,
            accountId: post.accountId,
            impressions,
            engagements,
            likes: metricsData.likes || 0,
            retweets: metricsData.retweets || 0,
            replies: metricsData.replies || 0,
            bookmarks: metricsData.bookmarks || 0,
            linkClicks: metricsData.linkClicks || 0,
            profileClicks: metricsData.profileClicks || 0,
            upvotes: metricsData.upvotes || 0,
            downvotes: metricsData.downvotes || 0,
            commentCount: metricsData.commentCount || 0,
            awards: metricsData.awards || 0,
            engagementRate,
          },
        });

        results.metricsFetched++;
        results.postsProcessed++;
      } catch (postError) {
        console.error(
          `Error fetching metrics for post ${post.id}:`,
          postError,
        );
        results.errors.push({ postId: post.id, error: postError.message });
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('poll-metrics cron error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
