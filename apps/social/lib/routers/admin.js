import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminProcedure, protectedProcedure } from '../trpc';

export const adminRouter = router({
  users: router({
    /**
     * admin.users.list
     * List all users with their roles.
     */
    list: adminProcedure.query(async ({ ctx }) => {
      return ctx.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          invitedBy: true,
          createdAt: true,
          lastActiveAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

    /**
     * admin.users.invite
     * Create a new user with a specified email and role.
     */
    invite: adminProcedure
      .input(
        z.object({
          email: z.string().email(),
          role: z.enum(['ADMIN', 'INTERNAL', 'AGENCY']).default('INTERNAL'),
          name: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { prisma, user } = ctx;

        const existing = await prisma.user.findUnique({ where: { email: input.email } });
        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A user with this email already exists.',
          });
        }

        return prisma.user.create({
          data: {
            email: input.email,
            name: input.name ?? null,
            role: input.role,
            invitedBy: user.id,
          },
        });
      }),

    /**
     * admin.users.updateRole
     * Update a user's role.
     */
    updateRole: adminProcedure
      .input(
        z.object({
          userId: z.string(),
          role: z.enum(['ADMIN', 'INTERNAL', 'AGENCY']),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { prisma } = ctx;

        const targetUser = await prisma.user.findUnique({ where: { id: input.userId } });
        if (!targetUser) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
        }

        return prisma.user.update({
          where: { id: input.userId },
          data: { role: input.role },
        });
      }),
  }),

  /**
   * admin.apiCosts
   * Aggregate APICallLog by provider and time period.
   */
  apiCosts: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(30),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const logs = await prisma.aPICallLog.findMany({
        where: { timestamp: { gte: since } },
        select: {
          provider: true,
          estimatedCost: true,
          timestamp: true,
        },
        orderBy: { timestamp: 'asc' },
      });

      // Aggregate by provider
      const byProvider = {};
      for (const log of logs) {
        if (!byProvider[log.provider]) {
          byProvider[log.provider] = { totalCost: 0, callCount: 0 };
        }
        byProvider[log.provider].totalCost += log.estimatedCost;
        byProvider[log.provider].callCount += 1;
      }

      // Aggregate by date + provider
      const byDateProvider = {};
      for (const log of logs) {
        const dateKey = log.timestamp.toISOString().slice(0, 10);
        if (!byDateProvider[dateKey]) byDateProvider[dateKey] = {};
        if (!byDateProvider[dateKey][log.provider]) {
          byDateProvider[dateKey][log.provider] = { cost: 0, calls: 0 };
        }
        byDateProvider[dateKey][log.provider].cost += log.estimatedCost;
        byDateProvider[dateKey][log.provider].calls += 1;
      }

      const totalCost = Object.values(byProvider).reduce((sum, p) => sum + p.totalCost, 0);
      const totalCalls = Object.values(byProvider).reduce((sum, p) => sum + p.callCount, 0);

      return {
        totalCost,
        totalCalls,
        byProvider,
        timeSeries: Object.entries(byDateProvider).map(([date, providers]) => ({
          date,
          providers,
        })),
      };
    }),

  /**
   * admin.auditLog
   * Paginated AuditLog list.
   */
  auditLog: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().nullish(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { limit, cursor } = input;

      const logs = await prisma.auditLog.findMany({
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      let nextCursor = undefined;
      if (logs.length > limit) {
        const next = logs.pop();
        nextCursor = next.id;
      }

      return { items: logs, nextCursor };
    }),
});
