import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { generateWeeklyReport, generateCompetitiveAnalysis, generateListeningSummary } from '../ai/reports';

export const reportsRouter = router({
  /**
   * reports.list
   * List all reports with title, type, and date.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.report.findMany({
      select: {
        id: true,
        title: true,
        reportType: true,
        aiPct: true,
        createdAt: true,
        updatedAt: true,
        downloads: true,
        createdById: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  /**
   * reports.generate
   * Generate an AI-powered report using Claude via lib/ai/reports.js.
   * Gathers relevant data based on report type, then calls the appropriate generator.
   */
  generate: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        reportType: z.enum([
          'WEEKLY_PERFORMANCE',
          'MONTHLY_SUMMARY',
          'COMPETITIVE_ANALYSIS',
          'KOL_REPORT',
          'CUSTOM',
        ]),
        prompt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma, user } = ctx;
      const { title, reportType, prompt } = input;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      let content;

      try {
        if (reportType === 'WEEKLY_PERFORMANCE' || reportType === 'MONTHLY_SUMMARY') {
          const dateStart = reportType === 'WEEKLY_PERFORMANCE' ? sevenDaysAgo : thirtyDaysAgo;

          const [posts, mentions, listeningHits, accountMetrics] = await Promise.all([
            prisma.post.findMany({
              where: { status: 'PUBLISHED', publishedAt: { gte: dateStart } },
              include: { metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 }, account: true },
            }),
            prisma.mention.findMany({ where: { detectedAt: { gte: dateStart } } }),
            prisma.listeningHit.findMany({ where: { detectedAt: { gte: dateStart } } }),
            prisma.accountMetrics.findMany({ where: { date: { gte: dateStart } }, orderBy: { date: 'asc' } }),
          ]);

          content = await generateWeeklyReport({
            posts: posts.map((p) => ({ ...p, metrics: p.metrics[0] || null })),
            metrics: accountMetrics,
            mentions,
            listeningHits,
            period: { start: dateStart.toISOString(), end: now.toISOString() },
          });
        } else if (reportType === 'COMPETITIVE_ANALYSIS') {
          const [accounts, competitors] = await Promise.all([
            prisma.account.findMany({ where: { isActive: true }, include: { accountMetrics: { orderBy: { date: 'desc' }, take: 1 } } }),
            prisma.competitor.findMany({ include: { metrics: { orderBy: { date: 'desc' }, take: 1 } } }),
          ]);

          const ourMetrics = accounts[0]?.accountMetrics?.[0];
          content = await generateCompetitiveAnalysis(
            { followers: ourMetrics?.followers || 0, engagementRate: 0, postsCount: ourMetrics?.totalPosts || 0 },
            competitors.map((c) => ({ name: c.name, metrics: c.metrics[0] || {} }))
          );
        } else {
          // KOL_REPORT or CUSTOM — use listening summary as a general-purpose fallback
          const [hits, topics] = await Promise.all([
            prisma.listeningHit.findMany({ where: { detectedAt: { gte: sevenDaysAgo } } }),
            prisma.listeningTopic.findMany({ where: { active: true } }),
          ]);
          content = await generateListeningSummary(hits, topics);
        }
      } catch (err) {
        console.error('Report generation error:', err);
        content = {
          error: true,
          message: `AI generation failed: ${err.message}`,
          generatedAt: now.toISOString(),
        };
      }

      return prisma.report.create({
        data: {
          title,
          reportType,
          prompt: prompt ?? null,
          content,
          aiPct: content?.error ? 0 : 95,
          createdById: user.id,
        },
      });
    }),

  /**
   * reports.getBenchmarks
   * Return historical data for benchmarks — aggregated post + account metrics.
   */
  getBenchmarks: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;

    // Monthly aggregates for the last 6 months
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const postMetrics = await prisma.postMetrics.findMany({
      where: { fetchedAt: { gte: sixMonthsAgo } },
      select: {
        fetchedAt: true,
        impressions: true,
        engagements: true,
        engagementRate: true,
        likes: true,
        retweets: true,
        replies: true,
      },
      orderBy: { fetchedAt: 'asc' },
    });

    // Group by month
    const byMonth = {};
    for (const m of postMetrics) {
      const monthKey = m.fetchedAt.toISOString().slice(0, 7); // YYYY-MM
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          impressions: 0,
          engagements: 0,
          rates: [],
          likes: 0,
          retweets: 0,
          replies: 0,
          count: 0,
        };
      }
      byMonth[monthKey].impressions += m.impressions;
      byMonth[monthKey].engagements += m.engagements;
      byMonth[monthKey].rates.push(m.engagementRate);
      byMonth[monthKey].likes += m.likes;
      byMonth[monthKey].retweets += m.retweets;
      byMonth[monthKey].replies += m.replies;
      byMonth[monthKey].count += 1;
    }

    // Also get follower counts per month from AccountMetrics
    const accountMetrics = await prisma.accountMetrics.findMany({
      where: { date: { gte: sixMonthsAgo } },
      select: { date: true, followers: true },
      orderBy: { date: 'asc' },
    });
    // Take the max follower count per month (last snapshot of month)
    const followersByMonth = {};
    for (const am of accountMetrics) {
      const mk = am.date.toISOString().slice(0, 7);
      followersByMonth[mk] = Math.max(followersByMonth[mk] || 0, am.followers || 0);
    }

    // Sentiment per month from listening hits
    const sentHits = await prisma.listeningHit.findMany({
      where: { detectedAt: { gte: sixMonthsAgo } },
      select: { detectedAt: true, sentiment: true },
    });
    const sentByMonth = {};
    for (const h of sentHits) {
      const mk = h.detectedAt.toISOString().slice(0, 7);
      if (!sentByMonth[mk]) sentByMonth[mk] = { pos: 0, total: 0 };
      sentByMonth[mk].total++;
      if (h.sentiment === 'POSITIVE') sentByMonth[mk].pos++;
    }

    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const engRate = data.rates.length > 0
          ? parseFloat((data.rates.reduce((a, b) => a + b, 0) / data.rates.length).toFixed(2))
          : 0;
        const sent = sentByMonth[month];
        const sentiment = sent && sent.total > 0
          ? Math.round((sent.pos / sent.total) * 100)
          : null;
        return {
          month,
          engRate,
          impressions: data.impressions,
          engagements: data.engagements,
          followers: followersByMonth[month] || null,
          sentiment,
          sovPct: null, // Computed from competitor metrics when available
          likes: data.likes,
          retweets: data.retweets,
          replies: data.replies,
          postCount: data.count,
        };
      });
  }),
});
