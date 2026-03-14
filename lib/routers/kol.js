import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';

export const kolRouter = router({
  /**
   * kol.list
   * List all KOLs with latest metrics and AI scores.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const kols = await ctx.prisma.kOL.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      include: {
        cohort: { select: { id: true, name: true } },
        metrics: {
          orderBy: { weekStart: 'desc' },
          take: 1,
        },
      },
    });

    return kols.map((k) => ({
      id: k.id,
      name: k.name,
      platform: k.platform,
      username: k.username,
      relationshipType: k.relationshipType,
      cohort: k.cohort,
      compensationMonthly: k.compensationMonthly,
      baselineFollowers: k.baselineFollowers,
      baselineEngRate: k.baselineEngRate,
      aiScore: k.aiScore,
      aiScoreRationale: k.aiScoreRationale,
      aiScoreUpdatedAt: k.aiScoreUpdatedAt,
      createdAt: k.createdAt,
      latestMetrics: k.metrics[0] ?? null,
    }));
  }),

  /**
   * kol.create
   * Create a new KOL record.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        platform: z.enum(['X', 'REDDIT']),
        username: z.string().min(1),
        platformUserId: z.string().optional(),
        relationshipType: z.enum(['PAID_PARTNER', 'ORGANIC_ADVOCATE', 'ADVISOR', 'PORTFOLIO_FOUNDER']),
        cohortId: z.string().nullish(),
        compensationMonthly: z.number().nullish(),
        campaignDeliverables: z.any().nullish(),
        baselineFollowers: z.number().int().nullish(),
        baselineEngRate: z.number().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.kOL.create({
        data: {
          ...input,
          addedBy: ctx.user.id,
        },
      });
    }),

  /**
   * kol.getActivations
   * Return all activations for a given KOL.
   */
  getActivations: protectedProcedure
    .input(z.object({ kolId: z.string() }))
    .query(async ({ ctx, input }) => {
      const kol = await ctx.prisma.kOL.findUnique({ where: { id: input.kolId } });
      if (!kol) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'KOL not found.' });
      }

      return ctx.prisma.kOLActivation.findMany({
        where: { kolId: input.kolId },
        orderBy: { detectedAt: 'desc' },
      });
    }),

  /**
   * kol.getCohorts
   * List KOL cohorts with aggregate stats.
   */
  getCohorts: protectedProcedure.query(async ({ ctx }) => {
    const cohorts = await ctx.prisma.kOLCohort.findMany({
      include: {
        kols: {
          where: { active: true },
          include: {
            metrics: {
              orderBy: { weekStart: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return cohorts.map((cohort) => {
      const activeKols = cohort.kols;
      const totalCompensation = activeKols.reduce(
        (sum, k) => sum + (k.compensationMonthly ?? 0),
        0
      );
      const avgEngRate =
        activeKols.length > 0
          ? activeKols.reduce(
              (sum, k) => sum + (k.metrics[0]?.engagementRateBrand ?? 0),
              0
            ) / activeKols.length
          : 0;

      return {
        id: cohort.id,
        name: cohort.name,
        description: cohort.description,
        kolCount: activeKols.length,
        totalCompensation,
        avgEngagementRate: avgEngRate,
      };
    });
  }),

  /**
   * kol.deactivate
   * Soft-delete a KOL by setting active=false.
   */
  deactivate: protectedProcedure
    .input(z.object({ kolId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const kol = await ctx.prisma.kOL.findUnique({ where: { id: input.kolId } });
      if (!kol) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'KOL not found.' });
      }

      return ctx.prisma.kOL.update({
        where: { id: input.kolId },
        data: { active: false },
      });
    }),

  /**
   * kol.reactivate
   * Re-enable a previously deactivated KOL.
   */
  reactivate: protectedProcedure
    .input(z.object({ kolId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const kol = await ctx.prisma.kOL.findUnique({ where: { id: input.kolId } });
      if (!kol) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'KOL not found.' });
      }

      return ctx.prisma.kOL.update({
        where: { id: input.kolId },
        data: { active: true },
      });
    }),

  /**
   * kol.listAll
   * List all KOLs including inactive (for admin management).
   */
  listAll: protectedProcedure.query(async ({ ctx }) => {
    const kols = await ctx.prisma.kOL.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        cohort: { select: { id: true, name: true } },
        metrics: {
          orderBy: { weekStart: 'desc' },
          take: 1,
        },
      },
    });

    return kols.map((k) => ({
      id: k.id,
      name: k.name,
      platform: k.platform,
      username: k.username,
      relationshipType: k.relationshipType,
      cohort: k.cohort,
      active: k.active,
      aiScore: k.aiScore,
      createdAt: k.createdAt,
      latestMetrics: k.metrics[0] ?? null,
    }));
  }),

  /**
   * kol.getMetricsHistory
   * Weekly KOLMetrics time series for a single KOL.
   */
  getMetricsHistory: protectedProcedure
    .input(z.object({ kolId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.kOLMetrics.findMany({
        where: { kolId: input.kolId },
        orderBy: { weekStart: 'asc' },
      });
    }),

  /**
   * kol.discoverCandidates
   * AI-powered KOL discovery from listening data.
   * Identifies frequently-appearing authors in listening hits
   * who aren't already in the KOL roster.
   */
  discoverCandidates: protectedProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get all existing KOL usernames to exclude
    const existingKOLs = await ctx.prisma.kOL.findMany({
      select: { username: true },
    });
    const kolUsernames = new Set(existingKOLs.map((k) => k.username.toLowerCase()));

    // Get listening hits from last 30 days
    const hits = await ctx.prisma.listeningHit.findMany({
      where: {
        detectedAt: { gte: thirtyDaysAgo },
        dismissed: false,
        authorUsername: { not: 'unknown' },
      },
      select: {
        authorUsername: true,
        authorFollowersOrKarma: true,
        content: true,
        engagementCount: true,
        heuristicScore: true,
        sentiment: true,
        platform: true,
        sourceUrl: true,
        topic: { select: { name: true } },
      },
      orderBy: { heuristicScore: 'desc' },
    });

    // Group by author
    const authorMap = {};
    for (const hit of hits) {
      const username = hit.authorUsername.toLowerCase().replace(/^@/, '');
      // Skip existing KOLs
      if (kolUsernames.has(username)) continue;

      if (!authorMap[username]) {
        authorMap[username] = {
          username: hit.authorUsername,
          platform: hit.platform,
          followers: hit.authorFollowersOrKarma,
          hits: [],
          topics: new Set(),
        };
      }
      authorMap[username].hits.push(hit);
      if (hit.topic?.name) authorMap[username].topics.add(hit.topic.name);
      // Keep highest follower count seen
      if (hit.authorFollowersOrKarma > authorMap[username].followers) {
        authorMap[username].followers = hit.authorFollowersOrKarma;
      }
    }

    // Filter to authors with 2+ appearances and compute metrics
    const candidates = Object.values(authorMap)
      .filter((a) => a.hits.length >= 2)
      .map((a) => {
        const avgEng = a.hits.reduce((s, h) => s + h.engagementCount, 0) / a.hits.length;
        const avgScore = a.hits.reduce((s, h) => s + h.heuristicScore, 0) / a.hits.length;
        const posCount = a.hits.filter((h) => h.sentiment === 'POSITIVE').length;
        const sentimentPct = Math.round((posCount / a.hits.length) * 100);
        const compositeScore = a.hits.length * avgScore;

        return {
          username: a.username,
          platform: a.platform,
          followers: a.followers,
          appearances: a.hits.length,
          avgEngagement: Math.round(avgEng),
          avgScore: parseFloat(avgScore.toFixed(2)),
          sentimentPct,
          compositeScore: parseFloat(compositeScore.toFixed(2)),
          topics: [...a.topics].slice(0, 3),
          sampleContent: a.hits[0]?.content?.slice(0, 200) || '',
          sampleUrl: a.hits[0]?.sourceUrl || null,
        };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 10);

    return candidates;
  }),
});
