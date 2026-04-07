import { z } from 'zod';
import { router, protectedProcedure, internalProcedure } from '../trpc';

export const gtmMomentsRouter = router({
  /**
   * gtmMoments.list
   * Returns moments for the calendar view, with child moments for multiday events.
   * Optionally filtered by date range.
   */
  list: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        type: z.enum(['LAUNCH', 'TENTPOLE', 'EVENT', 'CAMPAIGN', 'MILESTONE', 'ACTIVATION']).optional(),
        projectId: z.string().optional(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const where = {
        parentMomentId: null, // Only top-level moments
      };

      if (input.type) where.type = input.type;
      if (input.projectId) where.projectId = input.projectId;

      // Date range filter — matches moments that overlap the window
      if (input.startDate || input.endDate) {
        where.OR = [];
        const rangeStart = input.startDate ? new Date(input.startDate) : undefined;
        const rangeEnd = input.endDate ? new Date(input.endDate) : undefined;

        // Single-day moments (use date field)
        const singleDayWhere = {};
        if (rangeStart) singleDayWhere.date = { ...(singleDayWhere.date || {}), gte: rangeStart };
        if (rangeEnd) singleDayWhere.date = { ...(singleDayWhere.date || {}), lte: rangeEnd };
        where.OR.push({ date: { not: null }, ...singleDayWhere });

        // Multiday moments (use startDate/endDate fields)
        const multiDayWhere = { startDate: { not: null } };
        if (rangeEnd) multiDayWhere.startDate = { ...multiDayWhere.startDate, lte: rangeEnd };
        if (rangeStart) multiDayWhere.endDate = { gte: rangeStart };
        where.OR.push(multiDayWhere);
      }

      return ctx.prisma.gtmMoment.findMany({
        where,
        include: {
          project: { select: { id: true, name: true, category: true, healthStatus: true } },
          childMoments: {
            orderBy: { date: 'asc' },
            include: {
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [
          { date: 'asc' },
          { startDate: 'asc' },
        ],
      });
    }),

  /**
   * gtmMoments.create
   * Creates a moment — either single-day (date) or multiday (startDate + endDate).
   */
  create: internalProcedure
    .input(
      z.object({
        label: z.string().min(1).max(300),
        type: z.enum(['LAUNCH', 'TENTPOLE', 'EVENT', 'CAMPAIGN', 'MILESTONE', 'ACTIVATION']).default('MILESTONE'),
        category: z.string().max(100).optional(),
        projectId: z.string().optional(),
        parentMomentId: z.string().optional(),
        date: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmMoment.create({
        data: {
          label: input.label,
          type: input.type,
          category: input.category ?? null,
          projectId: input.projectId ?? null,
          parentMomentId: input.parentMomentId ?? null,
          date: input.date ? new Date(input.date) : null,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
        },
      });
    }),

  /**
   * gtmMoments.update
   */
  update: internalProcedure
    .input(
      z.object({
        id: z.string(),
        label: z.string().min(1).max(300).optional(),
        type: z.enum(['LAUNCH', 'TENTPOLE', 'EVENT', 'CAMPAIGN', 'MILESTONE', 'ACTIVATION']).optional(),
        category: z.string().max(100).nullish(),
        projectId: z.string().nullish(),
        parentMomentId: z.string().nullish(),
        date: z.string().nullish(),
        startDate: z.string().nullish(),
        endDate: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const data = {};

      if (fields.label !== undefined) data.label = fields.label;
      if (fields.type !== undefined) data.type = fields.type;
      if (fields.category !== undefined) data.category = fields.category;
      if (fields.projectId !== undefined) data.projectId = fields.projectId;
      if (fields.parentMomentId !== undefined) data.parentMomentId = fields.parentMomentId;
      if (fields.date !== undefined) data.date = fields.date ? new Date(fields.date) : null;
      if (fields.startDate !== undefined) data.startDate = fields.startDate ? new Date(fields.startDate) : null;
      if (fields.endDate !== undefined) data.endDate = fields.endDate ? new Date(fields.endDate) : null;

      return ctx.prisma.gtmMoment.update({ where: { id }, data });
    }),

  /**
   * gtmMoments.delete
   */
  delete: internalProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmMoment.delete({ where: { id: input.id } });
    }),
});
