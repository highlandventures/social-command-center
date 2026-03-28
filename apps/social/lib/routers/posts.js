import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { XPlatformAdapter } from '../x-adapter';
import { getValidToken } from '../token-refresh';
import { publishRedditPost, listLateAccounts } from '../late-reddit';

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
        since: z.string().optional(), // ISO date string e.g. '2026-03-01'
        until: z.string().optional(), // ISO date string e.g. '2026-03-31'
        excludeReplies: z.boolean().optional(), // Filter out reply tweets
        limit: z.number().min(1).max(500).default(20),
        cursor: z.string().nullish(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { status, accountId, platform, since, until, excludeReplies, limit, cursor } = input;

      const where = {};
      if (status) where.status = status;
      if (accountId) where.accountId = accountId;
      if (platform) where.platform = platform;
      if (since || until) {
        // Calendar needs both published AND scheduled posts in the date range.
        // Use OR: publishedAt in range OR scheduledFor in range.
        const dateGte = since ? new Date(since + 'T00:00:00Z') : undefined;
        const dateLte = until ? new Date(until + 'T23:59:59.999Z') : undefined;
        const publishedFilter = {};
        const scheduledFilter = {};
        if (dateGte) { publishedFilter.gte = dateGte; scheduledFilter.gte = dateGte; }
        if (dateLte) { publishedFilter.lte = dateLte; scheduledFilter.lte = dateLte; }
        where.OR = [
          { publishedAt: publishedFilter },
          { scheduledFor: scheduledFilter },
        ];
      }
      if (excludeReplies) {
        where.content = { not: { startsWith: '@' } };
      }

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
          status: z.enum(['DRAFT', 'SCHEDULED']).optional(),
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
      if (!['DRAFT', 'SCHEDULED', 'PENDING_APPROVAL'].includes(existing.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft, scheduled, or pending-approval posts can be updated.',
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
   * Publish a post to X via the platform adapter.
   * Reddit is deferred (no API key yet).
   */
  publish: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { prisma, user } = ctx;

      const post = await prisma.post.findUnique({
        where: { id: input.id },
        include: {
          account: true,
          threadPosts: { orderBy: { threadPosition: 'asc' } },
        },
      });
      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found.' });
      }
      if (post.status === 'PUBLISHED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Post is already published.' });
      }

      let platformPostId;

      try {
        if (post.platform === 'REDDIT') {
          // Publish via Late API (no direct Reddit OAuth needed)
          if (!process.env.LATE_API_KEY) {
            throw new Error('LATE_API_KEY is not configured.');
          }

          // Find the Late Reddit account ID
          const lateAccounts = await listLateAccounts();
          const redditAccount = (lateAccounts?.data || lateAccounts || [])
            .find((a) => a.platform === 'reddit');
          if (!redditAccount) {
            throw new Error('No Reddit account connected in Late. Visit Admin → Connect Reddit to set up.');
          }

          const title = post.articleTitle || post.content.substring(0, 100);
          const result = await publishRedditPost({
            accountId: redditAccount._id || redditAccount.id,
            subreddit: post.subreddit || 'FigureTech',
            title,
            content: post.content,
            flairId: post.flairId || undefined,
          });

          platformPostId = result?._id || result?.id || null;
        } else {
          // X/Twitter — use direct OAuth adapter
          const accessToken = await getValidToken(post.account);
          const adapter = new XPlatformAdapter(accessToken);

          if (post.contentType === 'THREAD') {
            // Thread tweets may be stored as child Post records (threadPosts)
            // OR as a single content field joined by \n---\n (composer format)
            let tweetTexts;
            if (post.threadPosts.length > 0) {
              tweetTexts = [post.content, ...post.threadPosts.map((t) => t.content)];
            } else if (post.content.includes('\n---\n')) {
              tweetTexts = post.content.split('\n---\n').map((t) => t.trim()).filter(Boolean);
            } else {
              tweetTexts = [post.content];
            }

            if (tweetTexts.length > 1) {
              const results = await adapter.publishThread(tweetTexts);
              platformPostId = results[0]?.data?.id;

              // Update child post records if they exist
              for (let i = 0; i < post.threadPosts.length; i++) {
                const childResult = results[i + 1];
                if (childResult?.data?.id) {
                  await prisma.post.update({
                    where: { id: post.threadPosts[i].id },
                    data: {
                      platformPostId: childResult.data.id,
                      status: 'PUBLISHED',
                      publishedAt: new Date(),
                    },
                  });
                }
              }
            } else {
              // Single tweet, despite THREAD type
              const result = await adapter.publishTweet(tweetTexts[0]);
              platformPostId = result?.data?.id;
            }
          } else if (post.contentType === 'ARTICLE') {
            const result = await adapter.publishArticle(post.articleTitle || '', post.content);
            platformPostId = result?.data?.id;
          } else {
            const result = await adapter.publishTweet(post.content);
            platformPostId = result?.data?.id;
          }
        }
      } catch (err) {
        // Mark as failed and log
        await prisma.post.update({
          where: { id: input.id },
          data: { status: 'FAILED' },
        });
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'post.publish.failed',
            target: input.id,
            metadata: { error: err.message, platform: post.platform },
          },
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to publish to ${post.platform}: ${err.message}`,
        });
      }

      // Update post as published
      const updated = await prisma.post.update({
        where: { id: input.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          platformPostId: platformPostId || null,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'post.published',
          target: input.id,
          metadata: { platform: post.platform, platformPostId },
        },
      });

      return updated;
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
