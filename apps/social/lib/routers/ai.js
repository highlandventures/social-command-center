import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { optimizeThread, predictPerformance, generateContentIdeas, analyzePostPerformance } from '../ai/content-suggestions';

export const aiRouter = router({
  /**
   * ai.optimizeThread
   * Takes an array of tweet strings and returns AI-optimized versions
   * with per-tweet suggestions and estimated engagement improvement.
   */
  optimizeThread: protectedProcedure
    .input(
      z.object({
        tweets: z.array(z.string()).min(1).max(25),
        charLimit: z.number().optional().default(280),
        accountTier: z.string().optional().default('free'),
      })
    )
    .mutation(async ({ input }) => {
      return optimizeThread(input.tweets, {
        charLimit: input.charLimit,
        accountTier: input.accountTier,
      });
    }),

  /**
   * ai.predictPerformance
   * Predicts engagement metrics for a piece of content before publishing.
   */
  predictPerformance: protectedProcedure
    .input(
      z.object({
        content: z.string().min(1),
        platform: z.enum(['X', 'REDDIT']),
        accountContext: z
          .object({
            username: z.string().optional(),
            followers: z.number().optional(),
            avgEngagementRate: z.number().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      return predictPerformance(input.content, input.platform, input.accountContext ?? {});
    }),

  /**
   * ai.suggestContent
   * Generates content ideas from recent listening data and post history.
   */
  suggestContent: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(5),
      }).default({})
    )
    .query(async ({ ctx }) => {
      const { prisma } = ctx;

      // Fetch recent listening hits for trend context
      const listeningHits = await prisma.listeningHit.findMany({
        orderBy: { detectedAt: 'desc' },
        take: 20,
      });

      // Fetch recent posts for performance context
      const postHistory = await prisma.post.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 15,
        include: {
          metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
        },
      });

      return generateContentIdeas(listeningHits, postHistory);
    }),

  /**
   * ai.analyzePerformance
   * Analyzes published post performance to find patterns in what works.
   */
  analyzePerformance: protectedProcedure
    .input(
      z.object({
        range: z.enum(['7d', '30d', '90d']).default('30d'),
      }).default({})
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const since = new Date(Date.now() - daysMap[input.range] * 24 * 60 * 60 * 1000);

      const posts = await prisma.post.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: since },
        },
        include: {
          metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
        },
        orderBy: { publishedAt: 'desc' },
        take: 30,
      });

      const postsWithMetrics = posts.map((p) => ({
        ...p,
        metrics: p.metrics[0] || null,
      }));

      return analyzePostPerformance(postsWithMetrics);
    }),
});
