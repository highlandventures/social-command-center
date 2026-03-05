/**
 * Cron: Daily Analytics
 * Schedule: 2:00 AM UTC daily (0 2 * * *)
 *
 * For each active account, fetches current follower/karma counts
 * and upserts an AccountMetrics record for today's date.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getValidToken } from '@/lib/token-refresh';
import { XPlatformAdapter } from '@/lib/x-adapter';
import { RedditAdapter } from '@/lib/reddit-adapter';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { accountsProcessed: 0, errors: [] };

  try {
    const activeAccounts = await prisma.account.findMany({
      where: { isActive: true },
    });

    // Today's date at midnight (for the date-only field)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (const account of activeAccounts) {
      try {
        const token = await getValidToken(account);
        let metricsData = {};

        if (account.platform === 'X') {
          const adapter = new XPlatformAdapter(token);
          const response = await adapter.getOwnAccountAnalytics(account.platformUserId);
          const publicMetrics = response?.data?.public_metrics || {};

          metricsData = {
            followers: publicMetrics.followers_count || 0,
            following: publicMetrics.following_count || 0,
            totalPosts: publicMetrics.tweet_count || 0,
          };
        } else if (account.platform === 'REDDIT') {
          const adapter = new RedditAdapter(token);
          const response = await adapter.getUserProfile(account.username);
          const userData = response?.data || response || {};

          metricsData = {
            followers: userData.subreddit?.subscribers || userData.subscribers || 0,
            following: 0,
            totalPosts: 0,
            karma:
              (userData.link_karma || 0) +
              (userData.comment_karma || 0),
          };
        }

        // Upsert AccountMetrics for today
        await prisma.accountMetrics.upsert({
          where: {
            accountId_date: {
              accountId: account.id,
              date: today,
            },
          },
          update: {
            followers: metricsData.followers || 0,
            following: metricsData.following || 0,
            totalPosts: metricsData.totalPosts || 0,
            karma: metricsData.karma ?? null,
          },
          create: {
            accountId: account.id,
            date: today,
            followers: metricsData.followers || 0,
            following: metricsData.following || 0,
            totalPosts: metricsData.totalPosts || 0,
            karma: metricsData.karma ?? null,
          },
        });

        // Log API call
        await prisma.aPICallLog.create({
          data: {
            provider: account.platform === 'X' ? 'x_official' : 'reddit',
            endpoint: 'daily-analytics',
            method: 'GET',
            statusCode: 200,
            responseTime: 0,
            estimatedCost: account.platform === 'X' ? 0.003 : 0.00024,
            accountId: account.id,
          },
        });

        results.accountsProcessed++;
      } catch (accountError) {
        console.error(
          `Error fetching daily analytics for account ${account.id}:`,
          accountError,
        );
        results.errors.push({
          accountId: account.id,
          error: accountError.message,
        });
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('daily-analytics cron error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
