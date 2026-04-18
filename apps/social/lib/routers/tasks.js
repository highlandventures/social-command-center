import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { createWithArtifact, updateArtifactFromModule } from '../artifacts/create';
import { ARTIFACT_MODULE, ARTIFACT_TYPE } from '../artifacts/types';

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
      const homeWhere = { userId: user.id };
      if (input.status) homeWhere.status = input.status;

      const [homeTasks, gtmTasks] = await Promise.all([
        prisma.homeTask.findMany({
          where: homeWhere,
          include: { contact: { select: { id: true, name: true, email: true } } },
          take: input.limit,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        }),
        prisma.gtmTask.findMany({
          where: {
            ownerId: user.id,
            ...(input.status ? { status: input.status } : {}),
          },
          include: {
            project: { select: { id: true, name: true } },
            contact: { select: { id: true, name: true, email: true } },
          },
          take: input.limit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Normalize GTM tasks to match HomeTask shape
      const normalizedGtm = gtmTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        completedAt: null,
        sortOrder: 0,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        source: 'gtm',
        projectId: t.project?.id || null,
        projectName: t.project?.name || null,
        contact: t.contact || null,
      }));

      const normalizedHome = homeTasks.map((t) => ({
        ...t,
        source: 'hub',
        projectId: null,
        projectName: null,
      }));

      return [...normalizedHome, ...normalizedGtm];
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
        contactId: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma, user } = ctx;
      const { moduleRow } = await createWithArtifact(prisma, {
        module: ARTIFACT_MODULE.HUB,
        type: ARTIFACT_TYPE.TASK,
        prismaModel: 'homeTask',
        title: input.title,
        ownerId: user.id,
        status: 'TODO',
        moduleCreate: (tx) =>
          tx.homeTask.create({
            data: {
              userId: user.id,
              title: input.title,
              description: input.description || null,
              priority: input.priority,
              dueDate: input.dueDate || null,
              contactId: input.contactId || null,
            },
          }),
      });
      return moduleRow;
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
        contactId: z.string().nullish(),
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

      const updated = await prisma.homeTask.update({ where: { id }, data });
      await updateArtifactFromModule(prisma, {
        prismaModel: 'homeTask',
        entityId: id,
        patch: data,
      });
      return updated;
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
