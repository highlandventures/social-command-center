import { z } from 'zod';
import { router, protectedProcedure, internalProcedure } from '../trpc';
import {
  queryTasks,
  createTask,
  updateTask,
  getTaskSchema,
} from '../notion-tasks';

export const notionTasksRouter = router({
  /**
   * notionTasks.connectionStatus
   * Always connected — tasks go to Prisma, no external API needed.
   */
  connectionStatus: protectedProcedure.query(async () => {
    return { connected: true };
  }),

  /**
   * notionTasks.schema
   * Returns valid options for all select/multi-select fields.
   */
  schema: protectedProcedure.query(async () => {
    return getTaskSchema();
  }),

  /**
   * notionTasks.list
   * Pull tasks from the local NotionTaskInbox table.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          pageSize: z.number().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const { status, pageSize } = input || {};
      return queryTasks({
        status,
        pageSize: pageSize || 25,
      });
    }),

  /**
   * notionTasks.create
   * File a new task — stored in Prisma, synced to Notion on a schedule.
   */
  create: internalProcedure
    .input(
      z.object({
        title: z.string().min(1, 'Task name is required'),
        status: z.string().optional(),
        due: z.string().optional(),
        lcDueDate: z.string().optional(),
        publishDate: z.string().optional(),
        product: z.array(z.string()).optional(),
        channel: z.array(z.string()).optional(),
        audience: z.array(z.string()).optional(),
        socialChannel: z.array(z.string()).optional(),
        company: z.array(z.string()).optional(),
        geo: z.array(z.string()).optional(),
        notes: z.string().optional(),
        summary: z.string().optional(),
        reviewPriority: z.string().optional(),
        editorialReviewStage: z.string().optional(),
        needComplianceApproval: z.boolean().optional(),
        lexionUrl: z.string().optional(),
        shortcutTicketUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createTask({
        userId: ctx.user.id,
        ...input,
        filedBy: ctx.user.email || 'unknown',
      });
    }),

  /**
   * notionTasks.update
   * Update an existing task.
   */
  update: internalProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        title: z.string().optional(),
        status: z.string().optional(),
        due: z.string().optional(),
        lcDueDate: z.string().optional(),
        publishDate: z.string().optional(),
        notes: z.string().optional(),
        reviewPriority: z.string().optional(),
        editorialReviewStage: z.string().optional(),
        needComplianceApproval: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { taskId, ...updates } = input;
      return updateTask(taskId, updates);
    }),
});
