import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

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
   * Stub AI generation — stores a placeholder report for now.
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

      // TODO: Wire up Claude AI to generate real report content.
      const placeholderContent = {
        sections: [
          {
            title: 'Executive Summary',
            body: 'This is a placeholder report. AI generation will be wired in a future phase.',
          },
          {
            title: 'Key Metrics',
            body: 'Metrics data will be populated once the AI pipeline is connected.',
          },
          {
            title: 'Recommendations',
            body: 'AI-generated recommendations will appear here.',
          },
        ],
        generatedAt: new Date().toISOString(),
        prompt: prompt ?? null,
      };

      return prisma.report.create({
        data: {
          title,
          reportType,
          prompt: prompt ?? null,
          content: placeholderContent,
          aiPct: 0,
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

    return Object.entries(byMonth).map(([month, data]) => ({
      month,
      impressions: data.impressions,
      engagements: data.engagements,
      avgEngagementRate:
        data.rates.length > 0
          ? data.rates.reduce((a, b) => a + b, 0) / data.rates.length
          : 0,
      likes: data.likes,
      retweets: data.retweets,
      replies: data.replies,
      postCount: data.count,
    }));
  }),
});
