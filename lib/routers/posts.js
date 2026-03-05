import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';

export const postsRouter = router({
  /**
   * posts.list
   * Paginated post list with optional filters and latest metrics snapshot.
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['DRAFT', 'SCHEDULED', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'FAILED']).optional(),
        accountId: z.string().optional(),
        platform: z.enum(['X', 'REDDIT']).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { status, accountId, platform, limit, cursor } = input;

      const where = {};
      if (status) where.status = status;
      if (accountId) where.accountId = accountId;
      if (platform) where.platform = platform;

      const posts = await prisma.post.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          account: {
            select: { id: true, platform: true, username: true, displayName: true, avatarUrl: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          metrics: {
            orderBy: { fetchedAt: 'desc' },
            take: 1,
          },
        },
      });

      let nextCursor = undefined;
      if (posts.length > limit) {
        const next = posts.pop();
        nextCursor = next.id;
      }

      return { items: posts, nextCursor };
    }),

  /**
   * posts.create
   * Create a new post (starts as DRAFT).
   */
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        platform: z.enum(['X', 'REDDIT']),
        content: z.string().min(1),
        contentType: z.enum(['POST', 'THREAD', 'ARTICLE', 'COMMENT']).default('POST'),
        threadId: z.string().nullish(),
        threadPosition: z.number().nullish(),
        scheduledFor: z.date().nullish(),
        subreddit: z.string().nullish(),
        flairId: z.string().nullish(),
        articleTitle: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma, user } = ctx;

      return prisma.post.create({
        data: {
          ...input,
          createdById: user.id,
          status: input.scheduledFor ? 'SCHEDULED' : 'DRAFT',
        },
      });
    }),

  /**
   * posts.update
   * Update a draft or scheduled post. Cannot update published posts.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          content: z.string().min(1).optional(),
          contentType: z.enum(['POST', 'THREAD', 'ARTICLE', 'COMMENT']).optional(),
          scheduledFor: z.date().nullish(),
          subreddit: z.string().nullish(),
          flairId: z.string().nullish(),
          articleTitle: z.string().nullish(),
          accountId: z.string().optional(),
          platform: z.enum(['X', 'REDDIT']).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { id, data } = input;

      const existing = await prisma.post.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found.' });
      }
      if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft or scheduled posts can be updated.',
        });
      }

      return prisma.post.update({ where: { id }, data });
    }),

  /**
   * posts.delete
   * Delete a draft post only.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const existing = await prisma.post.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found.' });
      }
      if (existing.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft posts can be deleted.',
        });
      }

      await prisma.post.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /**
   * posts.publish
   * Mark a post as PUBLISHED. Adapter wiring comes later.
   */
  publish: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      const post = await prisma.post.findUnique({
        where: { id: input.id },
        include: { account: true },
      });
      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found.' });
      }

      // TODO: Wire up XPlatformAdapter / RedditAdapter to actually publish.
      // For now, just mark as published with a placeholder platformPostId.
      return prisma.post.update({
        where: { id: input.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          platformPostId: `stub_${Date.now()}`,
        },
      });
    }),

  /**
   * posts.schedule
   * Set a post to SCHEDULED status with a target publish time.
   */
  schedule: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledFor: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      const post = await prisma.post.findUnique({ where: { id: input.id } });
      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found.' });
      }
      if (!['DRAFT', 'SCHEDULED'].includes(post.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft or scheduled posts can be rescheduled.',
        });
      }

      return prisma.post.update({
        where: { id: input.id },
        data: {
          status: 'SCHEDULED',
          scheduledFor: input.scheduledFor,
        },
      });
    }),

  /**
   * posts.getMetrics
   * Return the PostMetrics history for a single post.
   */
  getMetrics: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.postMetrics.findMany({
        where: { postId: input.postId },
        orderBy: { fetchedAt: 'asc' },
      });
    }),
});
