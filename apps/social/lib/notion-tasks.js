/**
 * Notion Task Inbox adapter — Prisma-backed
 *
 * Tasks are stored in the app's own database (NotionTaskInbox table).
 * A scheduled sync job pushes un-synced tasks to the Notion Task Inbox
 * database, and a Notion automation copies them into Marketing Tasks.
 *
 * No Notion API key required in the app — zero external dependencies.
 */

import { prisma } from './db';

// ─── Schema (matches the Notion Task Inbox / Marketing Tasks databases) ─────

export function getTaskSchema() {
  return {
    status: {
      options: [
        { name: 'Not Started', color: 'gray' },
        { name: 'In Progress', color: 'blue' },
        { name: 'Done', color: 'green' },
        { name: 'Ready for Compliance', color: 'yellow' },
        { name: 'On Hold', color: 'red' },
      ],
    },
    flllcComplianceStatus: {
      options: [
        { name: 'Not Needed', color: 'gray' },
        { name: 'Legal Review', color: 'purple' },
        { name: 'Not Started', color: 'red' },
        { name: 'Comments Added', color: 'yellow' },
        { name: 'Comments Addressed', color: 'orange' },
        { name: 'In Progress', color: 'blue' },
        { name: 'Approved', color: 'green' },
      ],
    },
    fmComplianceStatus: {
      options: [
        { name: 'Not Needed', color: 'gray' },
        { name: 'Legal Review', color: 'purple' },
        { name: 'Not Started', color: 'red' },
        { name: 'Comments Added', color: 'yellow' },
        { name: 'Comments Addressed', color: 'orange' },
        { name: 'In Progress', color: 'blue' },
        { name: 'Approved', color: 'green' },
      ],
    },
    legalStatus: {
      options: [
        { name: 'Not Needed', color: 'gray' },
        { name: 'Not Started', color: 'red' },
        { name: 'In Progress', color: 'blue' },
        { name: 'Comments Added', color: 'yellow' },
        { name: 'Comments Addressed', color: 'orange' },
        { name: 'Approved', color: 'green' },
      ],
    },
    editorialReviewStage: {
      options: [
        { name: 'Bill (create)', color: 'gray' },
        { name: 'Figure Editorial Review', color: 'blue' },
        { name: 'Bill (Edit)', color: 'yellow' },
        { name: 'Ready to Publish', color: 'green' },
      ],
    },
    product: [
      { name: 'API', color: 'gray' },
      { name: 'CBL (Domestic)', color: 'blue' },
      { name: 'CBL (International)', color: 'blue' },
      { name: 'DART', color: 'purple' },
      { name: 'Demo Prime', color: 'pink' },
      { name: 'DSCR', color: 'orange' },
      { name: 'Figure Connect', color: 'green' },
      { name: 'Exchange', color: 'red' },
      { name: 'FGRD', color: 'brown' },
      { name: 'Figure HELOC', color: 'blue' },
      { name: 'Flex Rate', color: 'purple' },
      { name: 'Lead Portal', color: 'yellow' },
      { name: 'OPEN', color: 'orange' },
      { name: 'MPC Wallet/Self Custody', color: 'green' },
      { name: 'No Liquidation', color: 'red' },
      { name: 'Partner HELOC', color: 'blue' },
      { name: 'Piggyback', color: 'pink' },
      { name: 'Senior IO', color: 'purple' },
      { name: 'YLDS', color: 'green' },
      { name: 'None/Corporate', color: 'gray' },
      { name: 'Other', color: 'gray' },
    ],
    channel: [
      { name: 'AEO', color: 'gray' },
      { name: 'Affiliates', color: 'blue' },
      { name: 'Blog', color: 'orange' },
      { name: 'B2B2C', color: 'purple' },
      { name: 'B2B Partnership', color: 'purple' },
      { name: 'Conference', color: 'yellow' },
      { name: 'Digital', color: 'brown' },
      { name: 'Direct Mail', color: 'pink' },
      { name: 'Doc Hub Resources', color: 'gray' },
      { name: 'Email', color: 'purple' },
      { name: 'In-App Message', color: 'green' },
      { name: 'OOH/Billboards', color: 'orange' },
      { name: 'Organic/SEO', color: 'green' },
      { name: 'Paid Search', color: 'blue' },
      { name: 'PR', color: 'pink' },
      { name: 'Press Release', color: 'pink' },
      { name: 'Print', color: 'gray' },
      { name: 'Radio', color: 'brown' },
      { name: 'Social Media', color: 'blue' },
      { name: 'SMS', color: 'green' },
      { name: 'Swag', color: 'yellow' },
      { name: 'TV', color: 'red' },
      { name: 'Video', color: 'red' },
      { name: 'Voice Call', color: 'orange' },
      { name: 'Website', color: 'red' },
      { name: 'Other', color: 'gray' },
    ],
    audience: [
      { name: 'Consumers (DTC)', color: 'purple' },
      { name: 'Existing Figure Customers', color: 'purple' },
      { name: 'Loan Officers', color: 'red' },
      { name: 'Executives (Partners)', color: 'red' },
      { name: 'Investors', color: 'blue' },
      { name: 'Partner Borrowers', color: 'orange' },
      { name: 'HI Contractors', color: 'yellow' },
      { name: 'Employees/Job Seekers', color: 'green' },
      { name: 'Internal', color: 'gray' },
      { name: 'Prospects (Not in Braze)', color: 'pink' },
    ],
    socialChannel: [
      { name: 'YT', color: 'red' },
      { name: 'LI', color: 'blue' },
      { name: 'Twitter', color: 'gray' },
      { name: 'FB', color: 'blue' },
      { name: 'IG', color: 'pink' },
      { name: 'Reddit', color: 'orange' },
    ],
    company: [
      { name: 'Figure', color: 'blue' },
      { name: 'Figure Lending LLC (NY)', color: 'blue' },
      { name: 'Partner', color: 'purple' },
      { name: 'Figure Markets', color: 'orange' },
      { name: 'Figure Technology Solutions', color: 'green' },
      { name: 'Figure Equity Solutions', color: 'red' },
      { name: 'Figure Investment Advisors (REIT + other funds)', color: 'yellow' },
      { name: 'Figure Certificate Company (YLDS)', color: 'green' },
      { name: 'Figure Payments (US Exchange)', color: 'pink' },
    ],
    geo: [
      { name: 'International (All Countries)', color: 'blue' },
      { name: 'US (National)', color: 'red' },
      { name: 'US (Specific States in Comments)', color: 'orange' },
      { name: 'EU (All Countries)', color: 'purple' },
      { name: 'UK', color: 'green' },
      { name: 'Specific Countries (Specify in Comments)', color: 'gray' },
    ],
    reviewPriority: [
      { name: 'High', color: 'red' },
      { name: 'Medium', color: 'yellow' },
      { name: 'Low', color: 'green' },
      { name: 'Nice to have someday', color: 'gray' },
    ],
  };
}

// ─── Normalise a Prisma record into the shape the UI expects ────────────────

function normaliseTask(record) {
  return {
    id: record.id,
    url: record.notionPageId
      ? `https://www.notion.so/${record.notionPageId.replace(/-/g, '')}`
      : null,
    createdTime: record.createdAt?.toISOString() || null,
    lastEditedTime: record.updatedAt?.toISOString() || null,
    title: record.title,
    status: record.status,
    flllcComplianceStatus: record.flllcComplianceStatus || 'Not Needed',
    fmComplianceStatus: record.fmComplianceStatus || 'Not Needed',
    legalStatus: record.legalStatus || null,
    reviewPriority: record.reviewPriority || null,
    due: record.due?.toISOString()?.split('T')[0] || null,
    lcDueDate: record.lcDueDate?.toISOString()?.split('T')[0] || null,
    publishDate: record.publishDate?.toISOString()?.split('T')[0] || null,
    product: record.product || [],
    channel: record.channel || [],
    audience: record.audience || [],
    socialChannel: record.socialChannel || [],
    company: record.company || [],
    geo: record.geo || [],
    editorialReviewStage: record.editorialReviewStage || null,
    needComplianceApproval: record.needComplianceApproval || false,
    archivedForCompliance: record.archivedForCompliance || false,
    notes: record.notes || '',
    summary: record.summary || '',
    lexionUrl: record.lexionUrl || null,
    shortcutTicketUrl: record.shortcutTicketUrl || null,
    filedBy: record.filedBy || '',
    synced: !!record.syncedAt,
  };
}

// ─── Query tasks ────────────────────────────────────────────────────────────

export async function queryTasks({ status, pageSize = 25, skip = 0 } = {}) {
  const where = {};
  if (status) where.status = status;

  const [tasks, total] = await Promise.all([
    prisma.notionTaskInbox.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip,
    }),
    prisma.notionTaskInbox.count({ where }),
  ]);

  return {
    tasks: tasks.map(normaliseTask),
    hasMore: skip + tasks.length < total,
    total,
  };
}

// ─── Create task ────────────────────────────────────────────────────────────

export async function createTask({
  userId,
  title,
  status,
  due,
  lcDueDate,
  publishDate,
  product,
  channel,
  audience,
  socialChannel,
  company,
  geo,
  reviewPriority,
  editorialReviewStage,
  needComplianceApproval,
  notes,
  summary,
  lexionUrl,
  shortcutTicketUrl,
  filedBy,
}) {
  const record = await prisma.notionTaskInbox.create({
    data: {
      userId,
      title,
      status: status || 'Not Started',
      reviewPriority: reviewPriority || null,
      due: due ? new Date(due) : null,
      lcDueDate: lcDueDate ? new Date(lcDueDate) : null,
      publishDate: publishDate ? new Date(publishDate) : null,
      product: product || [],
      channel: channel || [],
      audience: audience || [],
      socialChannel: socialChannel || [],
      company: company || [],
      geo: geo || [],
      editorialReviewStage: editorialReviewStage || null,
      needComplianceApproval: needComplianceApproval || false,
      notes: notes || null,
      summary: summary || null,
      lexionUrl: lexionUrl || null,
      shortcutTicketUrl: shortcutTicketUrl || null,
      filedBy: filedBy || 'unknown',
    },
  });

  return normaliseTask(record);
}

// ─── Update task ────────────────────────────────────────────────────────────

export async function updateTask(taskId, updates) {
  const data = {};
  if (updates.title !== undefined) data.title = updates.title;
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.reviewPriority !== undefined) data.reviewPriority = updates.reviewPriority;
  if (updates.due !== undefined) data.due = updates.due ? new Date(updates.due) : null;
  if (updates.lcDueDate !== undefined) data.lcDueDate = updates.lcDueDate ? new Date(updates.lcDueDate) : null;
  if (updates.publishDate !== undefined) data.publishDate = updates.publishDate ? new Date(updates.publishDate) : null;
  if (updates.editorialReviewStage !== undefined) data.editorialReviewStage = updates.editorialReviewStage;
  if (updates.needComplianceApproval !== undefined) data.needComplianceApproval = updates.needComplianceApproval;
  if (updates.notes !== undefined) data.notes = updates.notes;

  const record = await prisma.notionTaskInbox.update({
    where: { id: taskId },
    data,
  });

  return normaliseTask(record);
}

// ─── Get un-synced tasks (used by the sync job) ────────────────────────────

export async function getUnsyncedTasks() {
  const tasks = await prisma.notionTaskInbox.findMany({
    where: { syncedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  return tasks;
}

// ─── Mark task as synced (used by the sync job) ─────────────────────────────

export async function markTaskSynced(taskId, notionPageId) {
  await prisma.notionTaskInbox.update({
    where: { id: taskId },
    data: {
      notionPageId,
      syncedAt: new Date(),
    },
  });
}
