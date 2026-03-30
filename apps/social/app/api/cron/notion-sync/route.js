import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/cron/notion-sync
 *
 * Returns two lists:
 *   - pending:  new tasks not yet synced to Notion
 *   - updates:  tasks already synced but whose status changed since last sync
 *
 * POST /api/cron/notion-sync
 *
 * Marks tasks as synced / re-synced.
 * Body: { synced: [{ taskId, notionPageId }] }
 *
 * PATCH /api/cron/notion-sync
 *
 * Inbound sync — accepts status changes from Notion (e.g. L&C marked a task Done)
 * and writes them back into Prisma so the hub reflects the update.
 * Body: { inbound: [{ notionPageId, status, flllcComplianceStatus, fmComplianceStatus, legalStatus }] }
 *
 * Protected by CRON_SECRET env var.
 */

function authorize(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') === secret) return true;

  return false;
}

function serialise(t) {
  return {
    taskId: t.id,
    title: t.title,
    status: t.status,
    flllcComplianceStatus: t.flllcComplianceStatus || 'Not Needed',
    fmComplianceStatus: t.fmComplianceStatus || 'Not Needed',
    legalStatus: t.legalStatus || null,
    reviewPriority: t.reviewPriority,
    due: t.due?.toISOString()?.split('T')[0] || null,
    lcDueDate: t.lcDueDate?.toISOString()?.split('T')[0] || null,
    publishDate: t.publishDate?.toISOString()?.split('T')[0] || null,
    product: t.product,
    channel: t.channel,
    audience: t.audience,
    socialChannel: t.socialChannel,
    company: t.company,
    geo: t.geo,
    editorialReviewStage: t.editorialReviewStage || null,
    needComplianceApproval: t.needComplianceApproval || false,
    archivedForCompliance: t.archivedForCompliance || false,
    notes: t.notes,
    summary: t.summary,
    lexionUrl: t.lexionUrl || null,
    shortcutTicketUrl: t.shortcutTicketUrl || null,
    filedBy: t.filedBy,
    notionPageId: t.notionPageId || null,
    createdAt: t.createdAt.toISOString(),
  };
}

export async function GET(request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // New tasks — never synced
    const pending = await prisma.notionTaskInbox.findMany({
      where: { syncedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    // Updated tasks — synced before, but modified since
    // (updatedAt > syncedAt means something changed after last sync)
    const updated = await prisma.$queryRaw`
      SELECT * FROM "notion_task_inbox"
      WHERE "synced_at" IS NOT NULL
        AND "updated_at" > "synced_at"
        AND "notion_page_id" IS NOT NULL
      ORDER BY "updated_at" ASC
      LIMIT 50
    `;

    return NextResponse.json({
      pending: pending.map(serialise),
      pendingCount: pending.length,
      updates: (updated || []).map((t) => ({
        taskId: t.id,
        notionPageId: t.notion_page_id,
        status: t.status,
        reviewPriority: t.review_priority,
        title: t.title,
        notes: t.notes,
      })),
      updatesCount: (updated || []).length,
    });
  } catch (err) {
    console.error('[notion-sync] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const synced = body.synced || [];

    for (const { taskId, notionPageId } of synced) {
      await prisma.notionTaskInbox.update({
        where: { id: taskId },
        data: {
          notionPageId: notionPageId || undefined,
          syncedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ updated: synced.length });
  } catch (err) {
    console.error('[notion-sync] POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PATCH — inbound sync from Notion → Prisma.
 * The scheduled task reads the Notion Task Inbox for status changes
 * made by L&C (or anyone outside the hub) and pushes them here.
 *
 * Body: { inbound: [{ notionPageId, status, flllcComplianceStatus, fmComplianceStatus, legalStatus }] }
 */
export async function PATCH(request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const inbound = body.inbound || [];
    let updated = 0;

    for (const { notionPageId, status, flllcComplianceStatus, fmComplianceStatus, legalStatus } of inbound) {
      if (!notionPageId) continue;

      // Find the task by its Notion page ID
      const existing = await prisma.notionTaskInbox.findFirst({
        where: { notionPageId },
      });

      if (!existing) continue;

      // Build update payload — only include fields that actually changed
      const data = {};
      if (status && existing.status !== status) data.status = status;
      if (flllcComplianceStatus && existing.flllcComplianceStatus !== flllcComplianceStatus) data.flllcComplianceStatus = flllcComplianceStatus;
      if (fmComplianceStatus && existing.fmComplianceStatus !== fmComplianceStatus) data.fmComplianceStatus = fmComplianceStatus;
      if (legalStatus !== undefined && existing.legalStatus !== legalStatus) data.legalStatus = legalStatus;

      if (Object.keys(data).length > 0) {
        // Reset syncedAt so this doesn't get re-pushed outbound
        data.syncedAt = new Date();
        await prisma.notionTaskInbox.update({
          where: { id: existing.id },
          data,
        });
        updated++;
      }
    }

    return NextResponse.json({ updated });
  } catch (err) {
    console.error('[notion-sync] PATCH error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
