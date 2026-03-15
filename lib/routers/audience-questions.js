import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

/**
 * Read cached AUDIENCE_QUESTION insight by data type.
 * Returns { data, lastUpdated } or empty state.
 */
async function readCachedInsight(prisma, dataType) {
  const insights = await prisma.aIInsight.findMany({
    where: {
      insightType: 'AUDIENCE_QUESTION',
      dismissed: false,
    },
    orderBy: { generatedAt: 'desc' },
  });

  const match = insights.find(i => i.content?.type === dataType);
  return match
    ? { data: match.content.data, lastUpdated: match.generatedAt }
    : { data: [], lastUpdated: null };
}

const daysInput = z.object({
  days: z.number().min(1).max(90).default(30),
});

export const audienceQuestionsRouter = router({
  /**
   * clusters -- Topic clusters ranked by opportunity score (cache-read only)
   * Returns: { clusters: [{ label, description, questionIndices, totalVolume,
   *            totalEngagement, opportunityScore }], lastUpdated }
   */
  clusters: protectedProcedure
    .input(daysInput)
    .query(async ({ ctx }) => {
      const cached = await readCachedInsight(ctx.prisma, 'clusters');
      return {
        clusters: cached.data || [],
        lastUpdated: cached.lastUpdated,
      };
    }),

  /**
   * questions -- Individual audience questions extracted from listening hits (cache-read only)
   * Returns: { questions: [{ text, topicName, engagementSum, count,
   *            isRecurring, isUnanswered }], lastUpdated }
   */
  questions: protectedProcedure
    .input(daysInput)
    .query(async ({ ctx }) => {
      const cached = await readCachedInsight(ctx.prisma, 'questions');
      return {
        questions: cached.data || [],
        lastUpdated: cached.lastUpdated,
      };
    }),
});
