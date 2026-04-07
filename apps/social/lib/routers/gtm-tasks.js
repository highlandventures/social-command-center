import { z } from 'zod';
import { router, protectedProcedure, internalProcedure } from '../trpc';

export const gtmTasksRouter = router({
  /**
   * gtmTasks.list
   * Returns GTM tasks, optionally filtered by project or owner.
   */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
        ownerId: z.string().optional(),
        limit: z.number().min(1).max(200).default(100),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const where = {};
      if (input.projectId) where.projectId = input.projectId;
      if (input.status) where.status = input.status;
      if (input.ownerId) where.ownerId = input.ownerId;

      return ctx.prisma.gtmTask.findMany({
        where,
        include: {
          project: { select: { id: true, name: true, category: true } },
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          contact: { select: { id: true, name: true, email: true } },
        },
        take: input.limit,
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      });
    }),

  /**
   * gtmTasks.myTasks
   * Returns tasks assigned to the current user across all projects.
   */
  myTasks: protectedProcedure
    .input(
      z.object({
        status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const where = { ownerId: ctx.user.id };
      if (input.status) where.status = input.status;

      return ctx.prisma.gtmTask.findMany({
        where,
        include: {
          project: { select: { id: true, name: true, category: true, healthStatus: true } },
        },
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      });
    }),

  /**
   * gtmTasks.create
   */
  create: internalProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1).max(500),
        priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
        ownerId: z.string().optional(),
        contactId: z.string().nullish(),
        dueDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmTask.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          priority: input.priority,
          ownerId: input.ownerId ?? ctx.user.id,
          contactId: input.contactId || null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        },
      });
    }),

  /**
   * gtmTasks.update
   */
  update: internalProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(500).optional(),
        status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
        priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
        ownerId: z.string().nullish(),
        contactId: z.string().nullish(),
        dueDate: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const data = {};

      if (fields.title !== undefined) data.title = fields.title;
      if (fields.status !== undefined) data.status = fields.status;
      if (fields.priority !== undefined) data.priority = fields.priority;
      if (fields.ownerId !== undefined) data.ownerId = fields.ownerId;
      if (fields.contactId !== undefined) data.contactId = fields.contactId;
      if (fields.dueDate !== undefined) data.dueDate = fields.dueDate ? new Date(fields.dueDate) : null;

      return ctx.prisma.gtmTask.update({ where: { id }, data });
    }),

  /**
   * gtmTasks.delete
   */
  delete: internalProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmTask.delete({ where: { id: input.id } });
    }),
});
