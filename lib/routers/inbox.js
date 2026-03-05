import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';

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
   * Stub reply — marks item as replied, actual API reply wiring comes later.
   */
  reply: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.inboxItem.findUnique({ where: { id: input.id } });
      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Inbox item not found.' });
      }

      // TODO: Use XPlatformAdapter / RedditAdapter to send the actual reply.
      return ctx.prisma.inboxItem.update({
        where: { id: input.id },
        data: { replied: true, read: true },
      });
    }),
});
