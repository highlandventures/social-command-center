import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

/**
 * Read cached COMPETITOR_STRATEGY insight by data type.
 * Returns { data, lastUpdated } or empty state.
 */
async function readCachedInsight(prisma, dataType) {
  const insights = await prisma.aIInsight.findMany({
    where: {
      insightType: 'COMPETITOR_STRATEGY',
      dismissed: false,
    },
    orderBy: { generatedAt: 'desc' },
  });

  const match = insights.find(i => i.content?.type === dataType);
  if (match && !Array.isArray(match.content?.data)) {
    console.warn(`[competitorIntel] Unexpected cache shape for ${dataType}:`, typeof match.content?.data);
    return { data: [], lastUpdated: match.generatedAt };
  }
  return match
    ? { data: match.content.data, lastUpdated: match.generatedAt }
    : { data: [], lastUpdated: null };
}

const daysInput = z.object({
  days: z.number().min(1).max(90).default(30),
});

export const competitorIntelRouter = router({
  /**
   * themes — Top themes across all competitors (cache-read only)
   * Returns: { themes: [{ phrase, occurrences, avgEngRate, competitors }], lastUpdated }
   */
  themes: protectedProcedure
    .input(daysInput)
    .query(async ({ ctx }) => {
      const cached = await readCachedInsight(ctx.prisma, 'themes');
      return {
        themes: cached.data || [],
        lastUpdated: cached.lastUpdated,
      };
    }),

  /**
   * formatAnalysis — Format breakdown across competitors (cache-read only)
   * Returns: { formats: [{ format, postCount, avgEngRate, topCompetitor }], lastUpdated }
   */
  formatAnalysis: protectedProcedure
    .input(daysInput)
    .query(async ({ ctx }) => {
      const cached = await readCachedInsight(ctx.prisma, 'formats');
      return {
        formats: cached.data || [],
        lastUpdated: cached.lastUpdated,
      };
    }),

  /**
   * strategyCards — Per-competitor strategy summaries (cache-read only)
   * Returns: { cards: [{ competitorName, postingCadence, topThemes, formatMix,
   *            engagementRate, followerCount, engagementBenchmark, followerBenchmark, keyInsight }],
   *            lastUpdated }
   */
  strategyCards: protectedProcedure
    .input(daysInput)
    .query(async ({ ctx }) => {
      const cached = await readCachedInsight(ctx.prisma, 'strategyCards');
      return {
        cards: cached.data || [],
        lastUpdated: cached.lastUpdated,
      };
    }),

  /**
   * contentGaps — Themes competitors cover that Figure doesn't, and vice versa (cache-read only)
   * Returns: { gaps: [{ theme, competitors, avgEngRate, recommendation }],
   *            strengths: [{ theme, figurePostCount, avgEngRate }],
   *            lastUpdated }
   */
  contentGaps: protectedProcedure
    .input(daysInput)
    .query(async ({ ctx }) => {
      const cached = await readCachedInsight(ctx.prisma, 'contentGaps');
      const data = cached.data || {};
      return {
        gaps: data.gaps || [],
        strengths: data.strengths || [],
        lastUpdated: cached.lastUpdated,
      };
    }),
});
