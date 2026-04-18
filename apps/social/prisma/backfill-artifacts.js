#!/usr/bin/env node
/**
 * Backfill script for Phase 17 (MCP + Unified Artifact Graph).
 *
 * Creates `Artifact` rows for every existing row in the 10 module tables that
 * participate in the graph, and writes the primary `PARENT_OF` relationships
 * based on existing FK columns.
 *
 * Safe to run repeatedly: idempotent via `@@unique([module, entityId])` on
 * artifacts and `@@unique([sourceId, targetId, relationshipType])` on
 * relationships. Historical rows with `artifactId != null` are skipped.
 *
 * Usage:
 *   node prisma/backfill-artifacts.js --dry-run
 *   node prisma/backfill-artifacts.js
 *   node prisma/backfill-artifacts.js --batch-size=1000
 *
 * See .planning/phases/17-artifact-graph-foundation/17-01-PLAN.md (Task 4)
 */

const { PrismaClient } = require('@prisma/client');

const ARTIFACT_TYPE = {
  CAMPAIGN: 'CAMPAIGN',
  PROJECT: 'PROJECT',
  TASK: 'TASK',
  MILESTONE: 'MILESTONE',
  POST: 'POST',
  EMAIL: 'EMAIL',
  LC_TICKET: 'LC_TICKET',
  REPORT: 'REPORT',
};

const GTM_MOMENT_CAMPAIGN_TYPES = new Set(['LAUNCH', 'TENTPOLE', 'CAMPAIGN']);

/**
 * Module configuration — one entry per module table that gets an artifact row.
 *
 * - prismaModel: Prisma delegate name (on PrismaClient)
 * - module: ArtifactModule enum value
 * - typeFor(entity): returns ArtifactType enum value for this row
 * - select: Prisma select used to load minimal columns for title/owner/status
 * - toArtifact(entity): builds the artifact-row data
 */
const MODULE_CONFIGS = [
  {
    prismaModel: 'post',
    module: 'SOCIAL',
    typeFor: () => ARTIFACT_TYPE.POST,
    select: { id: true, content: true, createdById: true, status: true },
    toArtifact: (row) => ({
      type: ARTIFACT_TYPE.POST,
      title: String(row.content ?? '').slice(0, 120) || '(untitled post)',
      ownerId: row.createdById || null,
      status: row.status || null,
      module: 'SOCIAL',
      entityId: row.id,
    }),
  },
  {
    prismaModel: 'gtmProject',
    module: 'GTM',
    typeFor: () => ARTIFACT_TYPE.PROJECT,
    select: { id: true, name: true, ownerId: true, status: true },
    toArtifact: (row) => ({
      type: ARTIFACT_TYPE.PROJECT,
      title: row.name || '(untitled project)',
      ownerId: row.ownerId || null,
      status: row.status || null,
      module: 'GTM',
      entityId: row.id,
    }),
  },
  {
    prismaModel: 'gtmTask',
    module: 'GTM',
    typeFor: () => ARTIFACT_TYPE.TASK,
    select: { id: true, title: true, ownerId: true, status: true },
    toArtifact: (row) => ({
      type: ARTIFACT_TYPE.TASK,
      title: row.title || '(untitled task)',
      ownerId: row.ownerId || null,
      status: row.status || null,
      module: 'GTM',
      entityId: row.id,
    }),
  },
  {
    prismaModel: 'gtmMoment',
    module: 'GTM',
    typeFor: (row) =>
      GTM_MOMENT_CAMPAIGN_TYPES.has(row.type)
        ? ARTIFACT_TYPE.CAMPAIGN
        : ARTIFACT_TYPE.MILESTONE,
    select: { id: true, label: true, type: true },
    toArtifact: (row) => ({
      type: GTM_MOMENT_CAMPAIGN_TYPES.has(row.type)
        ? ARTIFACT_TYPE.CAMPAIGN
        : ARTIFACT_TYPE.MILESTONE,
      title: row.label || '(untitled moment)',
      ownerId: null,
      status: null,
      module: 'GTM',
      entityId: row.id,
    }),
  },
  {
    prismaModel: 'emailCampaign',
    module: 'EMAIL',
    typeFor: () => ARTIFACT_TYPE.EMAIL,
    select: { id: true, name: true, createdById: true, status: true },
    toArtifact: (row) => ({
      type: ARTIFACT_TYPE.EMAIL,
      title: row.name || '(untitled campaign)',
      ownerId: row.createdById || null,
      status: row.status || null,
      module: 'EMAIL',
      entityId: row.id,
    }),
  },
  {
    prismaModel: 'notionTaskInbox',
    module: 'LC_REVIEW',
    typeFor: () => ARTIFACT_TYPE.LC_TICKET,
    select: { id: true, title: true, userId: true, status: true },
    toArtifact: (row) => ({
      type: ARTIFACT_TYPE.LC_TICKET,
      title: row.title || '(untitled ticket)',
      ownerId: row.userId || null,
      status: row.status || null,
      module: 'LC_REVIEW',
      entityId: row.id,
    }),
  },
  {
    prismaModel: 'report',
    module: 'SOCIAL',
    typeFor: () => ARTIFACT_TYPE.REPORT,
    select: { id: true, title: true, createdById: true, status: true },
    toArtifact: (row) => ({
      type: ARTIFACT_TYPE.REPORT,
      title: row.title || '(untitled report)',
      ownerId: row.createdById || null,
      status: row.status || null,
      module: 'SOCIAL',
      entityId: row.id,
    }),
  },
  {
    prismaModel: 'homeTask',
    module: 'HUB',
    typeFor: () => ARTIFACT_TYPE.TASK,
    select: { id: true, title: true, userId: true, status: true },
    toArtifact: (row) => ({
      type: ARTIFACT_TYPE.TASK,
      title: row.title || '(untitled task)',
      ownerId: row.userId || null,
      status: row.status || null,
      module: 'HUB',
      entityId: row.id,
    }),
  },
  {
    prismaModel: 'intelligenceTask',
    module: 'HUB',
    typeFor: () => ARTIFACT_TYPE.TASK,
    select: { id: true, title: true, status: true },
    toArtifact: (row) => ({
      type: ARTIFACT_TYPE.TASK,
      title: row.title || '(untitled task)',
      ownerId: null,
      status: row.status || null,
      module: 'HUB',
      entityId: row.id,
    }),
  },
  {
    prismaModel: 'weeklyBriefing',
    module: 'HUB',
    typeFor: () => ARTIFACT_TYPE.REPORT,
    select: { id: true, role: true, weekStart: true },
    toArtifact: (row) => ({
      type: ARTIFACT_TYPE.REPORT,
      title: `${row.role || 'GENERAL'} Briefing ${new Date(row.weekStart).toISOString().slice(0, 10)}`,
      ownerId: null,
      status: null,
      module: 'HUB',
      entityId: row.id,
    }),
  },
];

function parseArgs(argv) {
  const args = { dryRun: false, batchSize: 500 };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--batch-size=')) {
      const n = parseInt(arg.split('=')[1], 10);
      if (Number.isFinite(n) && n > 0) args.batchSize = n;
    }
  }
  return args;
}

async function backfillArtifacts(prisma, { dryRun, batchSize, log = console.log }) {
  const summary = { artifactsCreated: 0, artifactsAlreadyPresent: 0, perModule: {} };

  for (const config of MODULE_CONFIGS) {
    const delegate = prisma[config.prismaModel];
    if (!delegate) {
      log(`[backfill] skip ${config.prismaModel} — delegate not present on client`);
      continue;
    }

    // Count rows that still need an artifact (artifactId IS NULL).
    const pending = await delegate.findMany({
      where: { artifactId: null },
      select: config.select,
    });

    summary.perModule[config.prismaModel] = { pending: pending.length, created: 0 };
    log(`[backfill] ${config.prismaModel}: ${pending.length} rows need artifact`);

    if (dryRun || pending.length === 0) continue;

    // Batch inserts
    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      const data = batch.map((row) => config.toArtifact(row));

      const createRes = await prisma.artifact.createMany({
        data,
        skipDuplicates: true,
      });
      summary.artifactsCreated += createRes.count;
      summary.perModule[config.prismaModel].created += createRes.count;

      // Re-query artifact ids for this batch and update the module rows.
      const entityIds = batch.map((r) => r.id);
      const artifacts = await prisma.artifact.findMany({
        where: { module: config.module, entityId: { in: entityIds } },
        select: { id: true, entityId: true },
      });

      await prisma.$transaction(
        artifacts.map((a) =>
          delegate.update({
            where: { id: a.entityId },
            data: { artifactId: a.id },
          }),
        ),
      );
    }
  }

  // Rows whose artifact already existed (skipDuplicates swallowed the insert).
  // For a clean summary we compute: attempted - created.
  const totalAttempted = Object.values(summary.perModule).reduce(
    (sum, v) => sum + v.pending,
    0,
  );
  summary.artifactsAlreadyPresent = totalAttempted - summary.artifactsCreated;

  return summary;
}

async function backfillRelationships(prisma, { dryRun, log = console.log }) {
  const summary = { relationshipsCreated: 0, perEdge: {} };

  const edgeSpecs = [
    {
      name: 'gtmTask → gtmProject',
      fetch: async () =>
        prisma.gtmTask.findMany({
          where: { artifactId: { not: null } },
          select: { artifactId: true, project: { select: { artifactId: true } } },
        }),
      edge: (row) =>
        row.project?.artifactId && row.artifactId
          ? { sourceId: row.project.artifactId, targetId: row.artifactId }
          : null,
    },
    {
      name: 'gtmMoment → gtmProject',
      fetch: async () =>
        prisma.gtmMoment.findMany({
          where: { artifactId: { not: null }, projectId: { not: null } },
          select: { artifactId: true, project: { select: { artifactId: true } } },
        }),
      edge: (row) =>
        row.project?.artifactId && row.artifactId
          ? { sourceId: row.project.artifactId, targetId: row.artifactId }
          : null,
    },
    {
      name: 'gtmMoment → parent gtmMoment',
      // projects win when both are set, so only include moments with parentMomentId AND NO projectId
      fetch: async () =>
        prisma.gtmMoment.findMany({
          where: {
            artifactId: { not: null },
            projectId: null,
            parentMomentId: { not: null },
          },
          select: { artifactId: true, parentMoment: { select: { artifactId: true } } },
        }),
      edge: (row) =>
        row.parentMoment?.artifactId && row.artifactId
          ? { sourceId: row.parentMoment.artifactId, targetId: row.artifactId }
          : null,
    },
    {
      name: 'post → thread-parent post',
      fetch: async () =>
        prisma.post.findMany({
          where: { artifactId: { not: null }, threadId: { not: null } },
          select: { artifactId: true, threadParent: { select: { artifactId: true } } },
        }),
      edge: (row) =>
        row.threadParent?.artifactId && row.artifactId
          ? { sourceId: row.threadParent.artifactId, targetId: row.artifactId }
          : null,
    },
    {
      name: 'intelligenceTask → weeklyBriefing',
      fetch: async () =>
        prisma.intelligenceTask.findMany({
          where: { artifactId: { not: null }, briefingId: { not: null } },
          select: { artifactId: true, briefing: { select: { artifactId: true } } },
        }),
      edge: (row) =>
        row.briefing?.artifactId && row.artifactId
          ? { sourceId: row.briefing.artifactId, targetId: row.artifactId }
          : null,
    },
  ];

  for (const spec of edgeSpecs) {
    const rows = await spec.fetch();
    const edges = rows.map(spec.edge).filter(Boolean);
    summary.perEdge[spec.name] = { candidates: edges.length, created: 0 };
    log(`[backfill] edges ${spec.name}: ${edges.length} candidate PARENT_OF edges`);

    if (dryRun || edges.length === 0) continue;

    const res = await prisma.artifactRelationship.createMany({
      data: edges.map((e) => ({
        sourceId: e.sourceId,
        targetId: e.targetId,
        relationshipType: 'PARENT_OF',
      })),
      skipDuplicates: true,
    });
    summary.relationshipsCreated += res.count;
    summary.perEdge[spec.name].created = res.count;
  }

  return summary;
}

async function main() {
  const { dryRun, batchSize } = parseArgs(process.argv);
  const prisma = new PrismaClient();

  console.log(`[backfill] starting (dryRun=${dryRun}, batchSize=${batchSize})`);

  try {
    const artifactSummary = await backfillArtifacts(prisma, { dryRun, batchSize });
    const relSummary = await backfillRelationships(prisma, { dryRun });

    console.log('\n[backfill] summary:');
    console.log(JSON.stringify({ ...artifactSummary, ...relSummary, dryRun }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

// Only run main() when invoked directly, not when imported by tests.
if (require.main === module) {
  main().catch((err) => {
    console.error('[backfill] failed:', err);
    process.exit(1);
  });
}

module.exports = {
  backfillArtifacts,
  backfillRelationships,
  MODULE_CONFIGS,
  parseArgs,
};
