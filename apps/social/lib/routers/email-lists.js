import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const emailListsRouter = router({
  /**
   * emailLists.list
   * Returns all email lists ordered by createdAt desc with subscriber count.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.emailList.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { subscribers: true } } },
    });
  }),

  /**
   * emailLists.create
   * Create a new email list.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailList.create({
        data: {
          name: input.name,
          description: input.description,
          createdById: ctx.user.id,
        },
      });
    }),

  /**
   * emailLists.update
   * Update an email list by id.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.emailList.update({
        where: { id },
        data,
      });
    }),

  /**
   * emailLists.delete
   * Delete an email list by id (cascades to subscribers).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailList.delete({
        where: { id: input.id },
      });
    }),
});
