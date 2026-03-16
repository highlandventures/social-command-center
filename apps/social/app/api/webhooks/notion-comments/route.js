/**
 * Webhook: Receive Notion comments via Zapier
 *
 * Zapier watches for new comments on Notion pages and POSTs them here.
 * This replaces the old sync-notion-comments polling cron with near-real-time delivery.
 *
 * POST /api/webhooks/notion-comments
 * Authorization: Bearer <ZAPIER_WEBHOOK_SECRET>
 * Body: { postId, notionPageId, authorName, content, notionCommentId }
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  // Verify webhook secret
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.ZAPIER_WEBHOOK_SECRET}`;
  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { postId, authorName, content, notionCommentId } = body;

    if (!postId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: postId, content' },
        { status: 400 }
      );
    }

    // Find the active approval request for this post
    const approval = await prisma.approvalRequest.findFirst({
      where: { postId, status: 'PENDING' },
      select: { id: true },
    });

    if (!approval) {
      return NextResponse.json(
        { error: 'No pending approval found for this post' },
        { status: 404 }
      );
    }

    // Dedup: skip if we already have this Notion comment
    if (notionCommentId) {
      const existing = await prisma.approvalComment.findFirst({
        where: { notionCommentId },
      });
      if (existing) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'duplicate' });
      }
    }

    // Create the comment
    await prisma.approvalComment.create({
      data: {
        approvalRequestId: approval.id,
        authorName: authorName || 'Notion User',
        content,
        source: 'notion',
        notionCommentId: notionCommentId || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('notion-comments webhook error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
