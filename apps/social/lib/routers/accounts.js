import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const accountsRouter = router({
  /**
   * accounts.list
   * Returns all connected social accounts.
   * AGENCY users only see accounts they have explicit access to.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { prisma, user } = ctx;

    if (user.role === 'AGENCY') {
      const accessRecords = await prisma.userAccountAccess.findMany({
        where: { userId: user.id },
        include: {
          account: {
            select: {
              id: true,
              platform: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              connectedAt: true,
              isActive: true,
              isTest: true,
              subscriptionTier: true,
              followerCount: true,
              isVerified: true,
            },
          },
        },
      });
      return accessRecords.map((r) => r.account);
    }

    return prisma.account.findMany({
      select: {
        id: true,
        platform: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        connectedAt: true,
        isActive: true,
        isTest: true,
        subscriptionTier: true,
        followerCount: true,
        isVerified: true,
      },
      orderBy: { connectedAt: 'desc' },
    });
  }),

  /**
   * accounts.updateTier
   * Update an account's X subscription tier and verification status.
   */
  updateTier: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        subscriptionTier: z.enum(['free', 'basic', 'premium', 'premium_plus']),
        isVerified: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.account.update({
        where: { id: input.accountId },
        data: {
          subscriptionTier: input.subscriptionTier,
          ...(input.isVerified !== undefined ? { isVerified: input.isVerified } : {}),
        },
      });
    }),

  /**
   * accounts.getMetrics
   * Returns AccountMetrics for a given account within a date range.
   */
  getMetrics: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { accountId, startDate, endDate } = input;

      return prisma.accountMetrics.findMany({
        where: {
          accountId,
          date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: 'asc' },
      });
    }),
});
