import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../trpc';

export const competitorsRouter = router({
  /**
   * competitors.list
   * List all competitors with their latest CompetitorMetrics snapshot.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const competitors = await ctx.prisma.competitor.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        accounts: true,
        keywords: true,
        metrics: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    return competitors.map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      accounts: c.accounts,
      keywords: c.keywords.map((k) => k.keyword),
      latestMetrics: c.metrics[0] ?? null,
    }));
  }),

  /**
   * competitors.create
   * Admin-only: create a new competitor with accounts and keywords.
   */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        accounts: z.array(
          z.object({
            platform: z.enum(['X', 'REDDIT']),
            username: z.string().min(1),
            platformUserId: z.string().optional(),
          })
        ).default([]),
        keywords: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma, user } = ctx;
      const { name, accounts, keywords } = input;

      return prisma.competitor.create({
        data: {
          name,
          createdById: user.id,
          accounts: {
            create: accounts,
          },
          keywords: {
            create: keywords.map((keyword) => ({ keyword })),
          },
        },
        include: { accounts: true, keywords: true },
      });
    }),

  /**
   * competitors.getSOV
   * Share of voice over time for a competitor (or all competitors).
   */
  getSOV: protectedProcedure
    .input(
      z.object({
        competitorId: z.string().optional(),
        weeks: z.number().min(1).max(52).default(12),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { competitorId, weeks } = input;
      const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

      const where = { date: { gte: since } };
      if (competitorId) where.competitorId = competitorId;

      const metrics = await prisma.competitorMetrics.findMany({
        where,
        orderBy: { date: 'asc' },
        include: {
          competitor: { select: { id: true, name: true } },
        },
      });

      // Group by date, then by competitor
      const byDate = {};
      for (const m of metrics) {
        const dateKey = m.date.toISOString().slice(0, 10);
        if (!byDate[dateKey]) byDate[dateKey] = {};
        byDate[dateKey][m.competitor.name] = {
          competitorId: m.competitor.id,
          shareOfVoicePct: m.shareOfVoicePct,
          mentionCount: m.mentionCount,
        };
      }

      return Object.entries(byDate).map(([date, competitors]) => ({
        date,
        competitors,
      }));
    }),

  /**
   * competitors.compare
   * Side-by-side metrics comparison for all competitors.
   */
  compare: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;

    const competitors = await prisma.competitor.findMany({
      include: {
        accounts: true,
        metrics: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    return competitors.map((c) => {
      const m = c.metrics[0];
      return {
        id: c.id,
        name: c.name,
        accounts: c.accounts,
        followersX: m?.followersX ?? 0,
        followersReddit: m?.followersReddit ?? 0,
        karmaReddit: m?.karmaReddit ?? 0,
        postsCount: m?.postsCount ?? 0,
        avgEngagementRate: m?.avgEngagementRate ?? 0,
        mentionCount: m?.mentionCount ?? 0,
        sentimentPositivePct: m?.sentimentPositivePct ?? 0,
        shareOfVoicePct: m?.shareOfVoicePct ?? 0,
      };
    });
  }),
});
