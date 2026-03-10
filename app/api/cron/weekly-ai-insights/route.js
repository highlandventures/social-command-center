/**
 * Cron: Weekly AI Insights
 * Schedule: Monday 6:00 AM UTC (0 6 * * 1)
 *
 * Gathers last 7 days of data and generates AI-powered insights via Claude.
 * Creates both a WEEKLY_SUMMARY and an OPTIMAL_SCHEDULE insight.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { generateInsight } from '@/lib/ai';

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

    // Prepare context for Claude
    const aiContext = {
      task: 'Generate a comprehensive weekly social media insights summary',
      period: { start: sevenDaysAgo.toISOString(), end: now.toISOString() },
      stats: {
        totalPosts,
        totalMentions,
        totalListeningHits,
        avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
        sentimentBreakdown,
        accountCount: accounts.length,
      },
      topPosts: recentPosts
        .sort((a, b) => (b.metrics[0]?.engagementRate || 0) - (a.metrics[0]?.engagementRate || 0))
        .slice(0, 5)
        .map((p) => ({
          content: p.content?.substring(0, 200),
          platform: p.platform,
          engagementRate: p.metrics[0]?.engagementRate || 0,
          impressions: p.metrics[0]?.impressions || 0,
          likes: p.metrics[0]?.likes || 0,
          retweets: p.metrics[0]?.retweets || 0,
        })),
      recentMentions: recentMentions.slice(0, 20).map((m) => ({
        content: m.content?.substring(0, 150),
        mentionType: m.mentionType,
        authorUsername: m.authorUsername,
      })),
      listeningHighlights: recentListeningHits
        .filter((h) => h.heuristicScore > 0.5)
        .slice(0, 15)
        .map((h) => ({
          content: h.content?.substring(0, 150),
          sentiment: h.sentiment,
          score: h.heuristicScore,
          platform: h.platform,
        })),
    };

    const systemPrompt = `You are a senior social media strategist generating a weekly insights summary.
Analyze the provided data and generate actionable insights.
Always respond with valid JSON matching this schema:
{
  "summary": "string - 3-4 sentence executive summary of the week",
  "performanceHighlights": [
    { "highlight": "string", "metric": "string", "trend": "UP|DOWN|STABLE" }
  ],
  "contentInsights": [
    { "insight": "string", "evidence": "string", "actionability": "HIGH|MEDIUM|LOW" }
  ],
  "audienceTrends": [
    { "trend": "string", "detail": "string" }
  ],
  "recommendations": [
    { "recommendation": "string", "priority": "HIGH|MEDIUM|LOW", "expectedImpact": "string" }
  ],
  "optimalPostingTimes": [
    { "day": "string", "time": "string", "rationale": "string" }
  ],
  "weekAhead": "string - brief outlook for the coming week"
}`;

    // Generate AI insights via Claude
    const aiContent = await generateInsight('cron/weekly-summary', aiContext, {
      systemPrompt,
      maxTokens: 3000,
    });

    // Store the AI-generated insight
    const insight = await prisma.aIInsight.create({
      data: {
        insightType: 'WEEKLY_SUMMARY',
        dataRangeStart: sevenDaysAgo,
        dataRangeEnd: now,
        content: {
          ...aiContent,
          stats: {
            totalPosts,
            totalMentions,
            totalListeningHits,
            avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
            sentimentBreakdown,
          },
        },
      },
    });

    // Also create an optimal schedule insight if posting time data exists
    if (aiContent.optimalPostingTimes?.length > 0) {
      await prisma.aIInsight.create({
        data: {
          insightType: 'OPTIMAL_SCHEDULE',
          dataRangeStart: sevenDaysAgo,
          dataRangeEnd: now,
          content: {
            schedule: aiContent.optimalPostingTimes,
            generatedFrom: insight.id,
          },
        },
      });
    }

    return NextResponse.json({
      ok: true,
      insightId: insight.id,
      aiGenerated: true,
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
