import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import * as notionAdapter from '../notion-adapter';

export const approvalsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create the approval request and set post to PENDING_APPROVAL
      const [approval] = await ctx.prisma.$transaction([
        ctx.prisma.approvalRequest.create({
          data: {
            postId: input.postId,
            requestedById: ctx.user.id,
          },
        }),
        ctx.prisma.post.update({
          where: { id: input.postId },
          data: { status: 'PENDING_APPROVAL' },
        }),
      ]);

      // Sync review status to Notion via Zapier (non-blocking)
      const post = await ctx.prisma.post.findUnique({
        where: { id: input.postId },
        select: { notionPageId: true },
      });
      if (post?.notionPageId && notionAdapter.isConfigured()) {
        const appUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reviews?id=${approval.id}`;
        notionAdapter
          .sendReviewStatus(input.postId, post.notionPageId, 'Pending Review', appUrl)
          .catch(() => {}); // Non-fatal
      }

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'APPROVAL_REQUESTED',
          target: input.postId,
          metadata: { approvalId: approval.id },
        },
      });

      return approval;
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum(['PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'])
            .optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { status, limit = 50, cursor } = input || {};
      const where = {};
      if (status) where.status = status;

      const approvals = await ctx.prisma.approvalRequest.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { requestedAt: 'desc' },
        include: {
          post: {
            select: {
              id: true,
              content: true,
              contentType: true,
              platform: true,
              scheduledFor: true,
              notionPageId: true,
              account: { select: { username: true, platform: true } },
            },
          },
          requestedBy: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          reviewer: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          _count: { select: { comments: true } },
        },
      });

      let nextCursor;
      if (approvals.length > limit) {
        const next = approvals.pop();
        nextCursor = next.id;
      }

      return { approvals, nextCursor };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.approvalRequest.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          post: {
            include: {
              account: { select: { username: true, platform: true, avatarUrl: true } },
            },
          },
          requestedBy: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          reviewer: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          comments: { orderBy: { createdAt: 'asc' } },
        },
      });
    }),

  review: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'REJECTED']),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const approval = await ctx.prisma.approvalRequest.findUniqueOrThrow({
        where: { id: input.id },
        include: { post: { select: { id: true, notionPageId: true, scheduledFor: true } } },
      });

      // Determine new post status based on review decision
      let postStatus;
      if (input.status === 'APPROVED') {
        postStatus = 'APPROVED';
      } else {
        postStatus = 'DRAFT';
      }

      // Update approval + post status in a transaction
      const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.approvalRequest.update({
          where: { id: input.id },
          data: {
            status: input.status,
            reviewedById: ctx.user.id,
            reviewedAt: new Date(),
            reviewerComment: input.comment || null,
          },
        }),
        ctx.prisma.post.update({
          where: { id: approval.post.id },
          data: { status: postStatus },
        }),
      ]);

      // Add reviewer comment if provided
      if (input.comment) {
        await ctx.prisma.approvalComment.create({
          data: {
            approvalRequestId: input.id,
            authorName: ctx.user.name || ctx.user.email,
            content: input.comment,
            source: 'app',
          },
        });
      }

      // Sync decision to Notion via Zapier
      if (approval.post.notionPageId && notionAdapter.isConfigured()) {
        const notionStatus =
          input.status === 'APPROVED'
            ? 'Approved'
            : input.status === 'CHANGES_REQUESTED'
            ? 'Changes Requested'
            : 'Rejected';
        notionAdapter
          .sendReviewStatus(approval.post.id, approval.post.notionPageId, notionStatus)
          .catch(() => {});
        if (input.comment) {
          notionAdapter
            .sendComment(
              approval.post.id,
              approval.post.notionPageId,
              ctx.user.name || ctx.user.email,
              input.comment
            )
            .catch(() => {});
        }
      }

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: `APPROVAL_${input.status}`,
          target: approval.post.id,
          metadata: { approvalId: input.id, comment: input.comment },
        },
      });

      return updated;
    }),

  addComment: protectedProcedure
    .input(
      z.object({
        approvalRequestId: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const authorName = ctx.user.name || ctx.user.email;

      const comment = await ctx.prisma.approvalComment.create({
        data: {
          approvalRequestId: input.approvalRequestId,
          authorName,
          content: input.content,
          source: 'app',
        },
      });

      // Sync to Notion via Zapier
      const approval = await ctx.prisma.approvalRequest.findUnique({
        where: { id: input.approvalRequestId },
        include: { post: { select: { id: true, notionPageId: true } } },
      });
      if (approval?.post?.notionPageId && notionAdapter.isConfigured()) {
        notionAdapter
          .sendComment(approval.post.id, approval.post.notionPageId, authorName, input.content)
          .catch(() => {});
      }

      return comment;
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pending, approvedToday, changesRequested, rejected] =
      await Promise.all([
        ctx.prisma.approvalRequest.count({
          where: { status: 'PENDING' },
        }),
        ctx.prisma.approvalRequest.count({
          where: { status: 'APPROVED', reviewedAt: { gte: today } },
        }),
        ctx.prisma.approvalRequest.count({
          where: { status: 'CHANGES_REQUESTED' },
        }),
        ctx.prisma.approvalRequest.count({
          where: { status: 'REJECTED' },
        }),
      ]);

    return { pending, approvedToday, changesRequested, rejected };
  }),
});
