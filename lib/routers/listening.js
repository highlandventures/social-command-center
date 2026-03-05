import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';

export const listeningRouter = router({
  topics: router({
    /**
     * listening.topics.list
     * List all ListeningTopics with query counts and hit counts.
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const topics = await ctx.prisma.listeningTopic.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              queries: true,
              hits: true,
            },
          },
        },
      });

      return topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        active: topic.active,
        pollingTier: topic.pollingTier,
        pollingTierOverride: topic.pollingTierOverride,
        createdAt: topic.createdAt,
        queryCount: topic._count.queries,
        hitCount: topic._count.hits,
      }));
    }),

    /**
     * listening.topics.create
     * Create a new listening topic with initial queries.
     */
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          queries: z.array(
            z.object({
              platform: z.enum(['X', 'REDDIT']),
              queryString: z.string().min(1),
              negativeKeywords: z.array(z.string()).default([]),
              subreddits: z.array(z.string()).default([]),
            })
          ).default([]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { prisma, user } = ctx;
        const { name, description, queries } = input;

        return prisma.listeningTopic.create({
          data: {
            name,
            description,
            createdById: user.id,
            queries: {
              create: queries,
            },
          },
          include: { queries: true },
        });
      }),

    /**
     * listening.topics.update
     * Update a listening topic's name, description, or active status.
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          data: z.object({
            name: z.string().min(1).optional(),
            description: z.string().nullish(),
            active: z.boolean().optional(),
            pollingTier: z.enum(['HOT', 'WARM', 'COOL', 'SCHEDULED']).optional(),
            pollingTierOverride: z.enum(['HOT', 'WARM', 'COOL', 'SCHEDULED']).nullish(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, data } = input;
        const existing = await ctx.prisma.listeningTopic.findUnique({ where: { id } });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Topic not found.' });
        }

        return ctx.prisma.listeningTopic.update({ where: { id }, data });
      }),
  }),

  hits: router({
    /**
     * listening.hits.list
     * Paginated list of ListeningHits for a given topic with optional filters.
     */
    list: protectedProcedure
      .input(
        z.object({
          topicId: z.string(),
          sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
          relevance: z.enum(['HIGH', 'MEDIUM', 'LOW', 'SPAM']).optional(),
          limit: z.number().min(1).max(100).default(20),
          cursor: z.string().nullish(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { prisma } = ctx;
        const { topicId, sentiment, relevance, limit, cursor } = input;

        const where = { topicId, dismissed: false };
        if (sentiment) where.sentiment = sentiment;
        if (relevance) where.aiRelevance = relevance;

        const hits = await prisma.listeningHit.findMany({
          where,
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          orderBy: { detectedAt: 'desc' },
          include: {
            query: {
              select: { id: true, queryString: true, platform: true },
            },
          },
        });

        let nextCursor = undefined;
        if (hits.length > limit) {
          const next = hits.pop();
          nextCursor = next.id;
        }

        return { items: hits, nextCursor };
      }),

    /**
     * listening.hits.dismiss
     * Dismiss a listening hit.
     */
    dismiss: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const hit = await ctx.prisma.listeningHit.findUnique({ where: { id: input.id } });
        if (!hit) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Hit not found.' });
        }

        return ctx.prisma.listeningHit.update({
          where: { id: input.id },
          data: { dismissed: true, dismissedBy: ctx.user.id },
        });
      }),
  }),
});
