import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const milestonesRouter = router({
  /**
   * milestones.list
   * Returns all milestones ordered by startDate desc.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.milestone.findMany({
      orderBy: { startDate: 'desc' },
    });
  }),

  /**
   * milestones.create
   * Create a new milestone with date range validation.
   */
  create: protectedProcedure
    .input(
      z
        .object({
          name: z.string().min(1).max(100),
          description: z.string().max(500).optional(),
          startDate: z.string(),
          endDate: z.string(),
        })
        .refine(
          (data) => new Date(data.endDate) > new Date(data.startDate),
          { message: 'endDate must be after startDate' }
        )
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.milestone.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          createdById: ctx.user.id,
        },
      });
    }),

  /**
   * milestones.update
   * Update milestone fields. Validates endDate > startDate when both provided.
   */
  update: protectedProcedure
    .input(
      z
        .object({
          id: z.string(),
          name: z.string().min(1).max(100).optional(),
          description: z.string().max(500).optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .refine(
          (data) => {
            if (data.startDate && data.endDate) {
              return new Date(data.endDate) > new Date(data.startDate);
            }
            return true;
          },
          { message: 'endDate must be after startDate' }
        )
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const data = {};

      if (fields.name !== undefined) data.name = fields.name;
      if (fields.description !== undefined) data.description = fields.description;
      if (fields.startDate !== undefined) data.startDate = new Date(fields.startDate);
      if (fields.endDate !== undefined) data.endDate = new Date(fields.endDate);

      return ctx.prisma.milestone.update({
        where: { id },
        data,
      });
    }),

  /**
   * milestones.delete
   * Delete a milestone by id.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.milestone.delete({
        where: { id: input.id },
      });
    }),
});
