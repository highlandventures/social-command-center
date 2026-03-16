import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const copilotRouter = router({
  /**
   * copilot.getRecentThread
   * Returns the most recent conversation thread for the current user,
   * including all messages ordered by creation time.
   */
  getRecentThread: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.copilotThread.findFirst({
      where: { userId: ctx.user.id },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }),

  /**
   * copilot.createThread
   * Creates a new conversation thread, optionally scoped to an account.
   */
  createThread: protectedProcedure
    .input(
      z.object({
        accountId: z.string().optional(),
      }).default({})
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.copilotThread.create({
        data: {
          userId: ctx.user.id,
          accountId: input.accountId || null,
        },
      });
    }),

  /**
   * copilot.getDailyUsage
   * Returns the number of user messages sent today for soft limit tracking.
   */
  getDailyUsage: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await ctx.prisma.copilotMessage.count({
      where: {
        thread: { userId: ctx.user.id },
        role: 'user',
        createdAt: { gte: today },
      },
    });

    return { count, limit: 50, warning: count >= 50 };
  }),

  /**
   * copilot.getSuggestionChips
   * Returns 3-4 contextual suggestion prompts based on latest intel data.
   */
  getSuggestionChips: protectedProcedure.query(async ({ ctx }) => {
    const [perfInsight, compInsight, audInsight] = await Promise.all([
      ctx.prisma.aIInsight.findFirst({
        where: { insightType: 'PERFORMANCE_PATTERN', dismissed: false },
        orderBy: { generatedAt: 'desc' },
      }),
      ctx.prisma.aIInsight.findFirst({
        where: { insightType: 'COMPETITOR_STRATEGY', dismissed: false },
        orderBy: { generatedAt: 'desc' },
      }),
      ctx.prisma.aIInsight.findFirst({
        where: { insightType: 'AUDIENCE_QUESTION', dismissed: false },
        orderBy: { generatedAt: 'desc' },
      }),
    ]);

    const chips = [];

    if (perfInsight?.content) {
      const text = typeof perfInsight.content === 'string'
        ? perfInsight.content
        : JSON.stringify(perfInsight.content);
      const topic = text.slice(0, 50).replace(/["\n]/g, '').trim();
      chips.push({
        id: 'perf',
        label: 'Write about top pattern',
        prompt: `Write a thread about this performance insight: ${topic}`,
      });
    }

    if (compInsight?.content) {
      const text = typeof compInsight.content === 'string'
        ? compInsight.content
        : JSON.stringify(compInsight.content);
      const theme = text.slice(0, 50).replace(/["\n]/g, '').trim();
      chips.push({
        id: 'comp',
        label: 'Counter competitor theme',
        prompt: `Counter this competitor theme with our perspective: ${theme}`,
      });
    }

    if (audInsight?.content) {
      const text = typeof audInsight.content === 'string'
        ? audInsight.content
        : JSON.stringify(audInsight.content);
      const question = text.slice(0, 60).replace(/["\n]/g, '').trim();
      chips.push({
        id: 'aud',
        label: 'Answer audience question',
        prompt: `Answer this audience question in a post: ${question}`,
      });
    }

    // Always include a generic fallback
    chips.push({
      id: 'general',
      label: 'Draft a thread',
      prompt: 'Draft a thread about our latest update',
    });

    // If no intel data at all, add another generic
    if (chips.length <= 1) {
      chips.unshift({
        id: 'trending',
        label: 'What\'s trending?',
        prompt: 'What topics are trending that we should post about?',
      });
    }

    return chips;
  }),
});
