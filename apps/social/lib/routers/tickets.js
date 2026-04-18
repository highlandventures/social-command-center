import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const ticketsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        type: z.enum(['BUG', 'FEATURE_REQUEST']),
        title: z.string().min(1).max(200),
        description: z.string().min(1),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
        screenshots: z
          .array(z.object({ url: z.string().url(), filename: z.string() }))
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.ticket.create({
        data: {
          type: input.type,
          title: input.title,
          description: input.description,
          priority: input.priority,
          screenshots: input.screenshots || [],
          createdById: ctx.user.id,
        },
      });
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(['BUG', 'FEATURE_REQUEST']).optional(),
          status: z.enum(['OPEN', 'IN_PROGRESS', 'AI_REVIEWING', 'RESOLVED', 'WONT_FIX', 'DEFERRED']).optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { type, status, limit = 50, cursor } = input || {};
      const where = {};
      if (type) where.type = type;
      if (status) where.status = status;

      const tickets = await ctx.prisma.ticket.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { comments: true } },
          // Derived: 1 matching comment means this ticket has an outstanding caveat /
          // follow-up note, even though it's marked RESOLVED. Used by the UI to keep
          // caveat'd tickets in the Active tab instead of Archive.
          comments: {
            where: { content: { startsWith: 'Caveat' } },
            select: { id: true },
            take: 1,
          },
          // Timestamp of the most recent comment — used by the notification badge so
          // we can tell the user when new activity has appeared since they last viewed.
        },
      });

      // Flatten: expose hasCaveat as a scalar and drop the raw comments array.
      const shaped = tickets.map((t) => ({
        ...t,
        hasCaveat: Array.isArray(t.comments) && t.comments.length > 0,
        comments: undefined,
      }));

      let nextCursor = undefined;
      if (shaped.length > limit) {
        const next = shaped.pop();
        nextCursor = next.id;
      }

      return { tickets: shaped, nextCursor };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.ticket.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          comments: { orderBy: { createdAt: 'asc' } },
        },
      });
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'AI_REVIEWING', 'RESOLVED', 'WONT_FIX', 'DEFERRED']),
        resolution: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = { status: input.status };
      if (input.resolution) data.resolution = input.resolution;
      if (input.status === 'RESOLVED') data.resolvedAt = new Date();
      return ctx.prisma.ticket.update({ where: { id: input.id }, data });
    }),

  addComment: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.ticketComment.create({
        data: {
          ticketId: input.ticketId,
          authorName: ctx.user.name || ctx.user.email,
          content: input.content,
        },
      });
    }),

  featureRequests: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.ticket.findMany({
      where: { type: 'FEATURE_REQUEST' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true } },
      },
    });
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [openBugs, openFeatures, aiReviewed, resolvedThisWeek] = await Promise.all([
      ctx.prisma.ticket.count({ where: { type: 'BUG', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      ctx.prisma.ticket.count({ where: { type: 'FEATURE_REQUEST', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      ctx.prisma.ticket.count({ where: { aiAnalysis: { not: null } } }),
      ctx.prisma.ticket.count({ where: { status: 'RESOLVED', resolvedAt: { gte: weekAgo } } }),
    ]);

    return { openBugs, openFeatures, aiReviewed, resolvedThisWeek };
  }),
});
