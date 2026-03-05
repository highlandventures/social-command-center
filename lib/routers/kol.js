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
});
