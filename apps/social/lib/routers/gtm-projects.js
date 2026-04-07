import { z } from 'zod';
import { router, protectedProcedure, internalProcedure } from '../trpc';

export const gtmProjectsRouter = router({
  /**
   * gtmProjects.list
   * Returns all GTM projects with owner and task/moment counts.
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'ON_HOLD']).optional(),
        category: z.enum(['GTM', 'EVERGREEN', 'OPERATIONS']).optional(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const where = {};
      if (input.status) where.status = input.status;
      if (input.category) where.category = input.category;

      return ctx.prisma.gtmProject.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { tasks: true, moments: true } },
        },
        orderBy: [{ status: 'asc' }, { startDate: 'asc' }],
      });
    }),

  /**
   * gtmProjects.byId
   * Returns a single project with tasks, moments, and owner.
   */
  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.gtmProject.findUnique({
        where: { id: input.id },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          tasks: {
            include: {
              owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
              contact: { select: { id: true, name: true, email: true } },
            },
            orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
          },
          moments: {
            orderBy: { date: 'asc' },
            include: {
              childMoments: { orderBy: { date: 'asc' } },
            },
          },
        },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      return project;
    }),

  /**
   * gtmProjects.create
   */
  create: internalProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        category: z.enum(['GTM', 'EVERGREEN', 'OPERATIONS']).default('GTM'),
        aiCategory: z.enum(['GTM', 'EVERGREEN', 'OPERATIONS']).optional(),
        status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'ON_HOLD']).default('ACTIVE'),
        startDate: z.string(),
        endDate: z.string(),
        googleDocUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmProject.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          category: input.category,
          aiCategory: input.aiCategory ?? null,
          status: input.status,
          ownerId: ctx.user.id,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          googleDocUrl: input.googleDocUrl ?? null,
        },
      });
    }),

  /**
   * gtmProjects.update
   */
  update: internalProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        category: z.enum(['GTM', 'EVERGREEN', 'OPERATIONS']).optional(),
        status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'ON_HOLD']).optional(),
        healthStatus: z.enum(['ON_TRACK', 'AT_RISK', 'BEHIND']).optional(),
        ownerId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        googleDocUrl: z.string().url().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const data = {};

      if (fields.name !== undefined) data.name = fields.name;
      if (fields.description !== undefined) data.description = fields.description;
      if (fields.category !== undefined) data.category = fields.category;
      if (fields.status !== undefined) data.status = fields.status;
      if (fields.healthStatus !== undefined) data.healthStatus = fields.healthStatus;
      if (fields.ownerId !== undefined) data.ownerId = fields.ownerId;
      if (fields.startDate !== undefined) data.startDate = new Date(fields.startDate);
      if (fields.endDate !== undefined) data.endDate = new Date(fields.endDate);
      if (fields.googleDocUrl !== undefined) data.googleDocUrl = fields.googleDocUrl;

      // Log category correction if AI suggested a different category
      if (fields.category) {
        const existing = await ctx.prisma.gtmProject.findUnique({
          where: { id },
          select: { aiCategory: true, name: true, category: true },
        });
        if (existing?.aiCategory && existing.aiCategory !== fields.category) {
          await ctx.prisma.gtmCategoryCorrection.create({
            data: {
              projectId: id,
              projectName: existing.name,
              aiCategory: existing.aiCategory,
              userCategory: fields.category,
            },
          });
        }
      }

      return ctx.prisma.gtmProject.update({ where: { id }, data });
    }),

  /**
   * gtmProjects.delete
   */
  delete: internalProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmProject.delete({ where: { id: input.id } });
    }),

  /**
   * gtmProjects.stats
   * Returns aggregate counts for the projects overview.
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const [total, active, atRisk, behind] = await Promise.all([
      ctx.prisma.gtmProject.count(),
      ctx.prisma.gtmProject.count({ where: { status: 'ACTIVE' } }),
      ctx.prisma.gtmProject.count({ where: { healthStatus: 'AT_RISK' } }),
      ctx.prisma.gtmProject.count({ where: { healthStatus: 'BEHIND' } }),
    ]);
    return { total, active, atRisk, behind };
  }),
});
