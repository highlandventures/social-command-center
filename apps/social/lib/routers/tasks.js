import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const tasksRouter = router({
  /**
   * tasks.list
   * Returns the current user's tasks, ordered by sortOrder then createdAt.
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
        limit: z.number().min(1).max(100).default(50),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma, user } = ctx;
      const where = { userId: user.id };
      if (input.status) where.status = input.status;

      return prisma.homeTask.findMany({
        where,
        take: input.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
    }),

  /**
   * tasks.create
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(2000).nullish(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        dueDate: z.date().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma, user } = ctx;
      return prisma.homeTask.create({
        data: {
          userId: user.id,
          title: input.title,
          description: input.description || null,
          priority: input.priority,
          dueDate: input.dueDate || null,
        },
      });
    }),

  /**
   * tasks.update
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(2000).nullish(),
        status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        dueDate: z.date().nullish(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma, user } = ctx;
      const { id, ...data } = input;

      // Verify ownership
      const existing = await prisma.homeTask.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        throw new Error('Task not found');
      }

      // Set completedAt when marking done
      if (data.status === 'DONE' && existing.status !== 'DONE') {
        data.completedAt = new Date();
      } else if (data.status && data.status !== 'DONE') {
        data.completedAt = null;
      }

      return prisma.homeTask.update({ where: { id }, data });
    }),

  /**
   * tasks.delete
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { prisma, user } = ctx;

      // Verify ownership
      const existing = await prisma.homeTask.findFirst({
        where: { id: input.id, userId: user.id },
      });
      if (!existing) {
        throw new Error('Task not found');
      }

      return prisma.homeTask.delete({ where: { id: input.id } });
    }),
});
