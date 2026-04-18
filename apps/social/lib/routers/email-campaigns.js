import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { generateInsight } from '../ai';
import { TRPCError } from '@trpc/server';
import { createWithArtifact, updateArtifactFromModule } from '../artifacts/create';
import { ARTIFACT_MODULE, ARTIFACT_TYPE } from '../artifacts/types';

export const emailCampaignsRouter = router({
  /**
   * emailCampaigns.list
   * Returns all campaigns ordered by createdAt desc with list, template, and send count.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.emailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        list: {
          select: { id: true, name: true, _count: { select: { subscribers: true } } },
        },
        template: {
          select: { id: true, name: true },
        },
        _count: { select: { sends: true } },
      },
    });
  }),

  /**
   * emailCampaigns.getById
   * Returns a single campaign with list and template details.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.emailCampaign.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          list: {
            select: { id: true, name: true, _count: { select: { subscribers: true } } },
          },
          template: {
            select: { id: true, name: true },
          },
          _count: { select: { sends: true } },
        },
      });
    }),

  /**
   * emailCampaigns.create
   * Create a new DRAFT campaign.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        subject: z.string().min(1).max(200),
        fromName: z.string().max(100).optional(),
        fromEmail: z.string().email().optional(),
        replyTo: z.string().email().optional(),
        listId: z.string(),
        templateId: z.string().optional(),
        htmlContent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { moduleRow } = await createWithArtifact(ctx.prisma, {
        module: ARTIFACT_MODULE.EMAIL,
        type: ARTIFACT_TYPE.EMAIL,
        prismaModel: 'emailCampaign',
        title: input.name,
        ownerId: ctx.user.id,
        status: 'DRAFT',
        moduleCreate: (tx) =>
          tx.emailCampaign.create({
            data: {
              name: input.name,
              subject: input.subject,
              fromName: input.fromName,
              fromEmail: input.fromEmail,
              replyTo: input.replyTo,
              listId: input.listId,
              templateId: input.templateId,
              htmlContent: input.htmlContent,
              status: 'DRAFT',
              createdById: ctx.user.id,
            },
          }),
      });
      return moduleRow;
    }),

  /**
   * emailCampaigns.update
   * Update a DRAFT campaign only. Uses updateMany with status guard for safety.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        subject: z.string().min(1).max(200).optional(),
        fromName: z.string().max(100).optional(),
        fromEmail: z.string().email().optional(),
        replyTo: z.string().email().optional(),
        listId: z.string().optional(),
        templateId: z.string().optional(),
        htmlContent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await ctx.prisma.emailCampaign.updateMany({
        where: { id, status: 'DRAFT' },
        data,
      });

      if (result.count === 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Campaign can only be updated while in DRAFT status',
        });
      }

      await updateArtifactFromModule(ctx.prisma, {
        prismaModel: 'emailCampaign',
        entityId: id,
        patch: data,
      });

      return result;
    }),

  /**
   * emailCampaigns.delete
   * Delete a DRAFT campaign only. Uses deleteMany with status guard.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.emailCampaign.deleteMany({
        where: { id: input.id, status: 'DRAFT' },
      });

      if (result.count === 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Campaign can only be deleted while in DRAFT status',
        });
      }

      return result;
    }),

  /**
   * emailCampaigns.preview
   * Returns the campaign HTML content for iframe rendering.
   */
  preview: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.emailCampaign.findUniqueOrThrow({
        where: { id: input.id },
      });

      return {
        htmlContent: campaign.htmlContent,
        subject: campaign.subject,
      };
    }),

  /**
   * emailCampaigns.suggestContent
   * Uses AI to generate subject line variants and body copy suggestion.
   */
  suggestContent: protectedProcedure
    .input(
      z.object({
        templateName: z.string().optional(),
        htmlContent: z.string().optional(),
        campaignName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Strip HTML tags and take first 500 chars as content snippet
      const contentSnippet = input.htmlContent
        ? input.htmlContent.replace(/<[^>]*>/g, '').slice(0, 500)
        : '';

      const context = JSON.stringify({
        campaignName: input.campaignName || '',
        templateName: input.templateName || '',
        contentSnippet,
      });

      const result = await generateInsight('email_content_suggestions', context, {
        systemPrompt:
          'You are an email marketing expert. Generate 5 compelling subject line variants and a brief body copy suggestion based on the provided context. Respond with JSON: { "subjectLines": ["..."], "bodySuggestion": "..." }',
        maxTokens: 512,
      });

      return result;
    }),

  /**
   * emailCampaigns.schedule
   * Transitions DRAFT to SCHEDULED (future date) or SENDING (immediate).
   * Uses updateMany with status: DRAFT guard for race protection.
   * For immediate sends, creates EmailSend records for all active subscribers.
   */
  schedule: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledFor: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const targetStatus = input.scheduledFor ? 'SCHEDULED' : 'SENDING';
      const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : new Date();

      const result = await ctx.prisma.emailCampaign.updateMany({
        where: { id: input.id, status: 'DRAFT' },
        data: {
          status: targetStatus,
          scheduledFor,
        },
      });

      if (result.count === 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Campaign already scheduled or sent',
        });
      }

      // For immediate sends, create EmailSend records for all active subscribers
      if (targetStatus === 'SENDING') {
        const campaign = await ctx.prisma.emailCampaign.findUniqueOrThrow({
          where: { id: input.id },
        });

        const subscribers = await ctx.prisma.emailSubscriber.findMany({
          where: { listId: campaign.listId, status: 'ACTIVE' },
          select: { id: true },
        });

        if (subscribers.length > 0) {
          await ctx.prisma.emailSend.createMany({
            data: subscribers.map((sub) => ({
              campaignId: input.id,
              subscriberId: sub.id,
              status: 'QUEUED',
            })),
            skipDuplicates: true,
          });
        }
      }

      return { status: targetStatus, scheduledFor };
    }),
});
