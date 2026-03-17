import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const emailTemplatesRouter = router({
  /**
   * emailTemplates.list
   * Returns all templates ordered by createdAt desc with campaign count.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { campaigns: true } } },
    });
  }),

  /**
   * emailTemplates.getById
   * Returns a single template by id.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.emailTemplate.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  /**
   * emailTemplates.create
   * Create a new email template.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        subject: z.string().max(200).optional(),
        htmlBody: z.string().min(1),
        category: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailTemplate.create({
        data: {
          name: input.name,
          subject: input.subject,
          htmlBody: input.htmlBody,
          category: input.category,
          createdById: ctx.user.id,
        },
      });
    }),

  /**
   * emailTemplates.update
   * Update an email template by id.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        subject: z.string().max(200).optional(),
        htmlBody: z.string().min(1).optional(),
        category: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.emailTemplate.update({
        where: { id },
        data,
      });
    }),

  /**
   * emailTemplates.delete
   * Delete an email template by id.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailTemplate.delete({
        where: { id: input.id },
      });
    }),

  /**
   * emailTemplates.duplicate
   * Create a copy of an existing template with "(Copy)" suffix.
   */
  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const original = await ctx.prisma.emailTemplate.findUniqueOrThrow({
        where: { id: input.id },
      });

      return ctx.prisma.emailTemplate.create({
        data: {
          name: `${original.name} (Copy)`,
          subject: original.subject,
          htmlBody: original.htmlBody,
          category: original.category,
          isStarter: false,
          createdById: ctx.user.id,
        },
      });
    }),
});
