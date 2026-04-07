import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const contactsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.contact.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.contact.create({
        data: { name: input.name, email: input.email || null },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.contact.delete({ where: { id: input.id } });
    }),
});
