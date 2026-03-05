/**
 * Cron: Weekly AI Insights
 * Schedule: Monday 6:00 AM UTC (0 6 * * 1)
 *
 * STUB: Gathers last 7 days of data and creates a placeholder AIInsight record.
 * Actual Claude integration will be wired in Phase 3.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Gather last 7 days of data for the summary
    const [recentPosts, recentListeningHits, recentMentions, accounts] =
      await Promise.all([
        prisma.post.findMany({
          where: {
            status: 'PUBLISHED',
            publishedAt: { gte: sevenDaysAgo },
          },
          include: {
            metrics: {
              orderBy: { fetchedAt: 'desc' },
              take: 1,
            },
            account: true,
          },
        }),
        prisma.listeningHit.findMany({
          where: {
            detectedAt: { gte: sevenDaysAgo },
          },
        }),
        prisma.mention.findMany({
          where: {
            detectedAt: { gte: sevenDaysAgo },
          },
        }),
        prisma.account.findMany({
          where: { isActive: true },
        }),
      ]);

    // Compute summary statistics
    const totalPosts = recentPosts.length;
    const totalMentions = recentMentions.length;
    const totalListeningHits = recentListeningHits.length;

    const avgEngagementRate =
      totalPosts > 0
        ? recentPosts.reduce((sum, p) => {
            const latestMetric = p.metrics[0];
            return sum + (latestMetric?.engagementRate || 0);
          }, 0) / totalPosts
        : 0;

    const sentimentBreakdown = {
      positive: recentListeningHits.filter((h) => h.sentiment === 'POSITIVE').length,
      neutral: recentListeningHits.filter((h) => h.sentiment === 'NEUTRAL').length,
      negative: recentListeningHits.filter((h) => h.sentiment === 'NEGATIVE').length,
    };

    // STUB: Create placeholder AIInsight record
    // Phase 3 will replace this with actual Claude-generated insights
    const insight = await prisma.aIInsight.create({
      data: {
        insightType: 'WEEKLY_SUMMARY',
        dataRangeStart: sevenDaysAgo,
        dataRangeEnd: now,
        content: {
          _stub: true,
          _note: 'Placeholder insight. Claude integration coming in Phase 3.',
          summary: `Weekly summary: ${totalPosts} posts published, ${totalMentions} mentions received, ${totalListeningHits} listening hits detected.`,
          stats: {
            totalPosts,
            totalMentions,
            totalListeningHits,
            avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
            sentimentBreakdown,
          },
          recommendations: [
            'Analyze top-performing posts for content patterns.',
            'Review actionable listening hits for engagement opportunities.',
            'Monitor sentiment trends for brand perception shifts.',
          ],
        },
      },
    });

    return NextResponse.json({
      ok: true,
      insightId: insight.id,
      dataRange: {
        start: sevenDaysAgo.toISOString(),
        end: now.toISOString(),
      },
      stats: {
        totalPosts,
        totalMentions,
        totalListeningHits,
        avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
      },
    });
  } catch (error) {
    console.error('weekly-ai-insights cron error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
