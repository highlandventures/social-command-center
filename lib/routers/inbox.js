import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { XPlatformAdapter } from '../x-adapter';
import { getValidToken } from '../token-refresh';

export const inboxRouter = router({
  /**
   * inbox.list
   * Paginated inbox items with optional filters.
   */
  list: protectedProcedure
    .input(
      z.object({
        read: z.boolean().optional(),
        platform: z.enum(['X', 'REDDIT']).optional(),
        type: z.enum(['COMMENT', 'DM', 'MENTION']).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { read, platform, type, limit, cursor } = input;

      const where = { archived: false };
      if (read !== undefined) where.read = read;
      if (platform) where.platform = platform;
      if (type) where.itemType = type;

      const items = await prisma.inboxItem.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { receivedAt: 'desc' },
        include: {
          account: {
            select: { id: true, platform: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      });

      let nextCursor = undefined;
      if (items.length > limit) {
        const next = items.pop();
        nextCursor = next.id;
      }

      return { items, nextCursor };
    }),

  /**
   * inbox.markRead
   * Mark an inbox item as read.
   */
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.inboxItem.findUnique({ where: { id: input.id } });
      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Inbox item not found.' });
      }

      return ctx.prisma.inboxItem.update({
        where: { id: input.id },
        data: { read: true },
      });
    }),

  /**
   * inbox.archive
   * Archive an inbox item.
   */
  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.inboxItem.findUnique({ where: { id: input.id } });
      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Inbox item not found.' });
      }

      return ctx.prisma.inboxItem.update({
        where: { id: input.id },
        data: { archived: true },
      });
    }),

  /**
   * inbox.reply
   * Reply to an inbox item on X. Sends the reply via the platform adapter,
   * then marks the item as replied in the database.
   * Reddit replies deferred (no API key yet).
   */
  reply: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma, user } = ctx;

      const item = await prisma.inboxItem.findUnique({
        where: { id: input.id },
        include: { account: true },
      });
      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Inbox item not found.' });
      }

      // Reddit deferred
      if (item.platform === 'REDDIT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Reddit replies are not yet enabled. Reddit API integration coming soon.',
        });
      }

      // We need a platform post/tweet ID to reply to.
      // The threadContext field stores the original tweet ID or URL.
      // Parse it to extract the tweet ID for in_reply_to.
      let replyToTweetId = item.threadContext;

      // If threadContext is a URL, extract the tweet ID from it
      if (replyToTweetId && replyToTweetId.includes('/')) {
        const parts = replyToTweetId.split('/');
        replyToTweetId = parts[parts.length - 1]?.split('?')[0];
      }

      if (!replyToTweetId) {
        // Fall back: mark as replied in DB only (can't send without a tweet ID to reply to)
        return prisma.inboxItem.update({
          where: { id: input.id },
          data: { replied: true, read: true, internalNotes: 'Reply recorded (no tweet ID to reply to on platform)' },
        });
      }

      // Get valid token and send the reply via X adapter
      const accessToken = await getValidToken(item.account);
      const adapter = new XPlatformAdapter(accessToken);

      try {
        await adapter.publishTweet(input.content, replyToTweetId);
      } catch (err) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'inbox.reply.failed',
            target: input.id,
            metadata: { error: err.message, platform: item.platform },
          },
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to send reply on X: ${err.message}`,
        });
      }

      // Mark as replied + audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'inbox.replied',
          target: input.id,
          metadata: { platform: item.platform, replyToTweetId },
        },
      });

      return prisma.inboxItem.update({
        where: { id: input.id },
        data: { replied: true, read: true },
      });
    }),
});
