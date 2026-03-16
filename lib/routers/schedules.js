import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { computeNextRun } from '../scheduling/schedule-helpers';

const cadenceEnum = z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']);

const emailSchema = z.string().email();

export const schedulesRouter = router({
  /**
   * schedules.list
   * Returns all schedules ordered by createdAt desc.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.reportSchedule.findMany({
      select: {
        id: true,
        name: true,
        cadence: true,
        reportType: true,
        enabled: true,
        recipients: true,
        nextRunAt: true,
        lastRunAt: true,
        lastReportId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  /**
   * schedules.create
   * Create a new report schedule with computed initial nextRunAt.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        cadence: cadenceEnum,
        reportType: z
          .enum([
            'WEEKLY_PERFORMANCE',
            'MONTHLY_SUMMARY',
            'COMPETITIVE_ANALYSIS',
            'KOL_REPORT',
            'CUSTOM',
          ])
          .default('WEEKLY_PERFORMANCE'),
        recipients: z.array(emailSchema).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const nextRunAt = computeNextRun(input.cadence, now);

      return ctx.prisma.reportSchedule.create({
        data: {
          name: input.name,
          cadence: input.cadence,
          reportType: input.reportType,
          recipients: input.recipients,
          createdById: ctx.user.id,
          nextRunAt,
        },
      });
    }),

  /**
   * schedules.update
   * Update schedule fields. Recomputes nextRunAt if cadence changes.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        cadence: cadenceEnum.optional(),
        reportType: z
          .enum([
            'WEEKLY_PERFORMANCE',
            'MONTHLY_SUMMARY',
            'COMPETITIVE_ANALYSIS',
            'KOL_REPORT',
            'CUSTOM',
          ])
          .optional(),
        recipients: z.array(emailSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;

      // Recompute nextRunAt if cadence is being changed
      if (fields.cadence) {
        fields.nextRunAt = computeNextRun(fields.cadence, new Date());
      }

      return ctx.prisma.reportSchedule.update({
        where: { id },
        data: fields,
      });
    }),

  /**
   * schedules.toggle
   * Flip the enabled boolean for a schedule.
   */
  toggle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const schedule = await ctx.prisma.reportSchedule.findUniqueOrThrow({
        where: { id: input.id },
        select: { enabled: true },
      });

      return ctx.prisma.reportSchedule.update({
        where: { id: input.id },
        data: { enabled: !schedule.enabled },
      });
    }),

  /**
   * schedules.delete
   * Delete a schedule by id.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.reportSchedule.delete({
        where: { id: input.id },
      });
    }),
});
