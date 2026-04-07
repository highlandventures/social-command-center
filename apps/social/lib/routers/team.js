import { router, protectedProcedure } from '../trpc';

export const teamRouter = router({
  members: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
      orderBy: { name: 'asc' },
    });
  }),
});
