import { z } from 'zod';
import { router, protectedProcedure, internalProcedure } from '../trpc';

export const gtmProductsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.gtmProduct.findMany({
      orderBy: { name: 'asc' },
    });
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.prisma.gtmProduct.findUnique({
        where: { id: input.id },
      });
      if (!product) throw new Error('Product not found');
      return product;
    }),

  create: internalProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        positioning: z.string().max(5000).optional(),
        messaging: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmProduct.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          positioning: input.positioning ?? null,
          messaging: input.messaging ?? null,
        },
      });
    }),

  update: internalProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        positioning: z.string().max(5000).nullish(),
        messaging: z.string().max(5000).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.gtmProduct.update({ where: { id }, data });
    }),

  delete: internalProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmProduct.delete({ where: { id: input.id } });
    }),
});
