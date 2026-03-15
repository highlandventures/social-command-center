import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { scoreKOL } from '../ai/kol-scoring';
import { generateKOLScorecard } from '../ai/reports';

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
      avatarUrl: k.avatarUrl,
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
        relationshipType: z.enum(['PAID_PARTNER', 'ORGANIC_ADVOCATE', 'ADVISOR', 'PORTFOLIO_FOUNDER', 'RETAIL_ANALYST', 'COMPANY_EXEC']),
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
        orderBy: [{ postedAt: { sort: 'desc', nulls: 'last' } }, { detectedAt: 'desc' }],
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
   * kol.update
   * Update a KOL's editable fields (relationship type, compensation, etc.).
   */
  update: protectedProcedure
    .input(
      z.object({
        kolId: z.string(),
        relationshipType: z.enum(['PAID_PARTNER', 'ORGANIC_ADVOCATE', 'ADVISOR', 'PORTFOLIO_FOUNDER', 'RETAIL_ANALYST', 'COMPANY_EXEC']).optional(),
        compensationMonthly: z.number().nullish(),
        cohortId: z.string().nullish(),
        baselineFollowers: z.number().int().nullish(),
        baselineEngRate: z.number().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { kolId, ...updates } = input;
      const kol = await ctx.prisma.kOL.findUnique({ where: { id: kolId } });
      if (!kol) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'KOL not found.' });
      }

      // Filter out undefined values
      const data = {};
      if (updates.relationshipType !== undefined) data.relationshipType = updates.relationshipType;
      if (updates.compensationMonthly !== undefined) data.compensationMonthly = updates.compensationMonthly;
      if (updates.cohortId !== undefined) data.cohortId = updates.cohortId;
      if (updates.baselineFollowers !== undefined) data.baselineFollowers = updates.baselineFollowers;
      if (updates.baselineEngRate !== undefined) data.baselineEngRate = updates.baselineEngRate;

      return ctx.prisma.kOL.update({
        where: { id: kolId },
        data,
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
   * kol.score
   * AI-score a single KOL using Claude. Updates aiScore, aiScoreRationale, aiScoreUpdatedAt.
   */
  score: protectedProcedure
    .input(z.object({ kolId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const kol = await ctx.prisma.kOL.findUnique({ where: { id: input.kolId } });
      if (!kol) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'KOL not found.' });
      }

      const activations = await ctx.prisma.kOLActivation.findMany({
        where: { kolId: kol.id },
        orderBy: { detectedAt: 'desc' },
        take: 50,
      });

      const metrics = await ctx.prisma.kOLMetrics.findFirst({
        where: { kolId: kol.id },
        orderBy: { weekStart: 'desc' },
      });

      const result = await scoreKOL(kol, activations, metrics);

      await ctx.prisma.kOL.update({
        where: { id: kol.id },
        data: {
          aiScore: result.score,
          aiScoreRationale: result.rationale,
          aiScoreUpdatedAt: new Date(),
        },
      });

      return { kolId: kol.id, name: kol.name, ...result };
    }),

  /**
   * kol.scoreAll
   * AI-score all active KOLs using Claude. Returns summary of results.
   */
  scoreAll: protectedProcedure.mutation(async ({ ctx }) => {
    const kols = await ctx.prisma.kOL.findMany({ where: { active: true } });
    const results = [];

    for (const kol of kols) {
      try {
        const activations = await ctx.prisma.kOLActivation.findMany({
          where: { kolId: kol.id },
          orderBy: { detectedAt: 'desc' },
          take: 50,
        });

        const metrics = await ctx.prisma.kOLMetrics.findFirst({
          where: { kolId: kol.id },
          orderBy: { weekStart: 'desc' },
        });

        const result = await scoreKOL(kol, activations, metrics);

        await ctx.prisma.kOL.update({
          where: { id: kol.id },
          data: {
            aiScore: result.score,
            aiScoreRationale: result.rationale,
            aiScoreUpdatedAt: new Date(),
          },
        });

        results.push({ kolId: kol.id, name: kol.name, score: result.score, ok: true });
      } catch (err) {
        console.error(`Failed to score KOL ${kol.id}:`, err.message);
        results.push({ kolId: kol.id, name: kol.name, ok: false, error: err.message });
      }
    }

    return {
      scored: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
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

    // Exclude competitor accounts and brand accounts
    const competitorAccounts = await ctx.prisma.competitorAccount.findMany({
      select: { username: true },
    });
    const brandAccounts = await ctx.prisma.account.findMany({
      select: { username: true },
    });
    const excludeUsernames = new Set([
      ...kolUsernames,
      ...competitorAccounts.map((a) => a.username.toLowerCase()),
      ...brandAccounts.map((a) => a.username.toLowerCase()),
    ]);

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
      // Skip existing KOLs, competitors, and brand accounts
      if (excludeUsernames.has(username)) continue;

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

  /**
   * kol.recentActivations
   * Return the most recent activations across all KOLs.
   */
  recentActivations: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(30) }).default({}))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.kOLActivation.findMany({
        orderBy: [{ postedAt: { sort: 'desc', nulls: 'last' } }, { detectedAt: 'desc' }],
        take: input.limit,
        include: {
          kol: { select: { id: true, name: true, username: true, platform: true, avatarUrl: true } },
        },
      });
    }),

  /**
   * kol.generateScorecard
   * Generates a detailed AI-powered scorecard for a specific KOL.
   */
  generateScorecard: protectedProcedure
    .input(z.object({ kolId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const kol = await ctx.prisma.kOL.findUnique({ where: { id: input.kolId } });
      if (!kol) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'KOL not found.' });
      }

      const activations = await ctx.prisma.kOLActivation.findMany({
        where: { kolId: kol.id },
        orderBy: { detectedAt: 'desc' },
        take: 50,
      });

      const metrics = await ctx.prisma.kOLMetrics.findMany({
        where: { kolId: kol.id },
        orderBy: { weekStart: 'desc' },
        take: 8,
      });

      return generateKOLScorecard(kol, activations, metrics);
    }),
});
