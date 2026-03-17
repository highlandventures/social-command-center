/**
 * Intelligence Router — Task Management & Weekly Briefing
 *
 * Procedures:
 * - getBriefing: Fetch this week's briefing (generate if missing)
 * - regenerateBriefing: Manually refresh the briefing
 * - getTasks: List tasks with filtering
 * - updateTask: Update task status (complete, dismiss, snooze)
 * - createTask: Create a manual task
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { generateWeeklyBriefing } from '../intelligence-engine';

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const intelligenceRouter = router({
  /**
   * Get current weekly briefing
   * Generates on-demand if no briefing exists for this week
   */
  getBriefing: protectedProcedure
    .input(
      z.object({
        role: z.enum(['CMO', 'CONTENT_STRATEGIST', 'SOCIAL_MANAGER', 'GROWTH_ANALYST', 'KOL_MANAGER', 'GENERAL']).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const role = input?.role || 'GENERAL';
      const monday = getMonday(new Date());

      let briefing = await prisma.weeklyBriefing.findUnique({
        where: { weekStart_role: { weekStart: monday, role } },
      });

      // Generate on-demand if no briefing exists for this week
      if (!briefing) {
        briefing = await generateWeeklyBriefing(prisma, role);
      }

      return briefing;
    }),

  /**
   * Regenerate briefing (manual refresh)
   */
  regenerateBriefing: protectedProcedure
    .input(
      z.object({
        role: z.enum(['CMO', 'CONTENT_STRATEGIST', 'SOCIAL_MANAGER', 'GROWTH_ANALYST', 'KOL_MANAGER', 'GENERAL']).optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      return generateWeeklyBriefing(ctx.prisma, input?.role || 'GENERAL');
    }),

  /**
   * List tasks with filtering
   */
  getTasks: protectedProcedure
    .input(
      z.object({
        status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED', 'SNOOZED']).optional(),
        priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
        sourceType: z.enum(['LISTENING', 'EMAIL', 'CALENDAR', 'CAMPAIGN', 'REPORT', 'MANUAL']).optional(),
        limit: z.number().min(1).max(100).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      return prisma.intelligenceTask.findMany({
        where: {
          ...(input?.status && { status: input.status }),
          ...(input?.priority && { priority: input.priority }),
          ...(input?.sourceType && { sourceType: input.sourceType }),
        },
        orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
        take: input?.limit || 50,
      });
    }),

  /**
   * Update task status
   */
  updateTask: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED', 'SNOOZED']).optional(),
        snoozedUntil: z.date().optional(),
        dismissReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const data = {};
      if (input.status) data.status = input.status;
      if (input.status === 'COMPLETED') data.completedAt = new Date();
      if (input.status === 'DISMISSED') {
        data.dismissedAt = new Date();
        data.dismissReason = input.dismissReason;
      }
      if (input.snoozedUntil) {
        data.status = 'SNOOZED';
        data.snoozedUntil = input.snoozedUntil;
      }
      return prisma.intelligenceTask.update({
        where: { id: input.id },
        data,
      });
    }),

  /**
   * Create manual task
   */
  createTask: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
        dueDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      return prisma.intelligenceTask.create({
        data: {
          title: input.title,
          description: input.description,
          sourceType: 'MANUAL',
          priority: input.priority || 'MEDIUM',
          priorityScore: input.priority === 'CRITICAL' ? 90 : input.priority === 'HIGH' ? 70 : input.priority === 'LOW' ? 20 : 50,
          dueDate: input.dueDate,
        },
      });
    }),
});
