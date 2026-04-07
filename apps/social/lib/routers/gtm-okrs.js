import { z } from 'zod';
import { router, protectedProcedure, internalProcedure } from '../trpc';

function computeOkrProgress(keyResults) {
  if (!keyResults || keyResults.length === 0) return 0;
  const sum = keyResults.reduce((acc, kr) => {
    if (kr.target === 0) return acc;
    return acc + Math.min(kr.current / kr.target, 1);
  }, 0);
  return Math.round((sum / keyResults.length) * 100);
}

function currentQuarter() {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${q} ${now.getFullYear()}`;
}

export const gtmOkrsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        quarter: z.string().optional(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const quarter = input.quarter || currentQuarter();
      const okrs = await ctx.prisma.gtmOkr.findMany({
        where: { quarter },
        include: { keyResults: true },
        orderBy: { createdAt: 'asc' },
      });
      return okrs.map((okr) => ({
        ...okr,
        progress: computeOkrProgress(okr.keyResults),
      }));
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const okr = await ctx.prisma.gtmOkr.findUnique({
        where: { id: input.id },
        include: { keyResults: true },
      });
      if (!okr) throw new Error('OKR not found');
      return { ...okr, progress: computeOkrProgress(okr.keyResults) };
    }),

  create: internalProcedure
    .input(
      z.object({
        title: z.string().min(1).max(300),
        description: z.string().max(2000).optional(),
        quarter: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmOkr.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          quarter: input.quarter,
        },
      });
    }),

  update: internalProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(300).optional(),
        description: z.string().max(2000).optional(),
        quarter: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.gtmOkr.update({ where: { id }, data });
    }),

  delete: internalProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmOkr.delete({ where: { id: input.id } });
    }),

  createKeyResult: internalProcedure
    .input(
      z.object({
        okrId: z.string(),
        title: z.string().min(1).max(300),
        target: z.number().min(0),
        unit: z.string().default('percent'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmKeyResult.create({
        data: {
          okrId: input.okrId,
          title: input.title,
          target: input.target,
          unit: input.unit,
        },
      });
    }),

  updateKeyResult: internalProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(300).optional(),
        target: z.number().min(0).optional(),
        current: z.number().min(0).optional(),
        unit: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.gtmKeyResult.update({ where: { id }, data });
    }),

  deleteKeyResult: internalProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gtmKeyResult.delete({ where: { id: input.id } });
    }),
});
