import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

const subscriberStatusEnum = z.enum(['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED']);

export const emailSubscribersRouter = router({
  /**
   * emailSubscribers.list
   * Paginated subscriber list with optional status filter and search.
   * Uses cursor-based pagination (same pattern as posts.list).
   */
  list: protectedProcedure
    .input(
      z.object({
        listId: z.string(),
        status: subscriberStatusEnum.optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { listId, status, search, limit, cursor } = input;

      const where = { listId };
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const subscribers = await ctx.prisma.emailSubscriber.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor;
      if (subscribers.length > limit) {
        const next = subscribers.pop();
        nextCursor = next.id;
      }

      return { items: subscribers, nextCursor };
    }),

  /**
   * emailSubscribers.create
   * Add a single subscriber to a list. Email is normalized to lowercase.
   */
  create: protectedProcedure
    .input(
      z.object({
        listId: z.string(),
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailSubscriber.create({
        data: {
          listId: input.listId,
          email: input.email.toLowerCase(),
          firstName: input.firstName,
          lastName: input.lastName,
          status: 'ACTIVE',
        },
      });
    }),

  /**
   * emailSubscribers.importCSV
   * Batch import subscribers from a parsed CSV array.
   * Uses createMany with skipDuplicates for idempotent imports.
   */
  importCSV: protectedProcedure
    .input(
      z.object({
        listId: z.string(),
        subscribers: z
          .array(
            z.object({
              email: z.string().email(),
              firstName: z.string().nullish(),
              lastName: z.string().nullish(),
            })
          )
          .max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = input.subscribers.map((s) => ({
        listId: input.listId,
        email: s.email.toLowerCase(),
        firstName: s.firstName ?? undefined,
        lastName: s.lastName ?? undefined,
        status: 'ACTIVE',
      }));

      const result = await ctx.prisma.emailSubscriber.createMany({
        data,
        skipDuplicates: true,
      });

      return { imported: result.count, total: input.subscribers.length };
    }),

  /**
   * emailSubscribers.updateStatus
   * Update a subscriber's status (ACTIVE/UNSUBSCRIBED/BOUNCED/COMPLAINED).
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: subscriberStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailSubscriber.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  /**
   * emailSubscribers.delete
   * Delete a subscriber by id.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailSubscriber.delete({
        where: { id: input.id },
      });
    }),
});
