import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  backfillArtifacts,
  backfillRelationships,
  parseArgs,
} = require('../../prisma/backfill-artifacts.js');

// -------------------------------------------------------
// In-memory mock Prisma that mimics the subset of the API used by the backfill.
// -------------------------------------------------------

function makeMockPrisma(seed = {}) {
  const tables = {
    post: seed.post || [],
    gtmProject: seed.gtmProject || [],
    gtmTask: seed.gtmTask || [],
    gtmMoment: seed.gtmMoment || [],
    emailCampaign: seed.emailCampaign || [],
    notionTaskInbox: seed.notionTaskInbox || [],
    report: seed.report || [],
    homeTask: seed.homeTask || [],
    intelligenceTask: seed.intelligenceTask || [],
    weeklyBriefing: seed.weeklyBriefing || [],
    artifact: seed.artifact || [],
    artifactRelationship: seed.artifactRelationship || [],
  };

  function matchesWhere(row, where) {
    if (!where) return true;
    for (const [k, v] of Object.entries(where)) {
      if (v && typeof v === 'object' && 'not' in v) {
        if (row[k] === v.not) return false;
      } else if (v && typeof v === 'object' && 'in' in v) {
        if (!v.in.includes(row[k])) return false;
      } else {
        if (row[k] !== v) return false;
      }
    }
    return true;
  }

  function pickSelect(row, select) {
    if (!select) return { ...row };
    const out = {};
    for (const [k, v] of Object.entries(select)) {
      if (v === true) out[k] = row[k];
      else if (typeof v === 'object' && v.select) {
        // Nested relation — our seed stores resolved relations alongside scalar fields
        out[k] = row[k] ? pickSelect(row[k], v.select) : null;
      }
    }
    return out;
  }

  function makeDelegate(name) {
    return {
      findMany: vi.fn(async ({ where, select } = {}) =>
        tables[name].filter((r) => matchesWhere(r, where)).map((r) => pickSelect(r, select)),
      ),
      update: vi.fn(async ({ where, data }) => {
        const row = tables[name].find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }),
    };
  }

  const prisma = {};
  for (const name of Object.keys(tables)) {
    prisma[name] = makeDelegate(name);
  }

  // artifact.createMany is called with skipDuplicates — honor @@unique([module, entityId]).
  prisma.artifact.createMany = vi.fn(async ({ data, skipDuplicates }) => {
    let count = 0;
    for (const row of data) {
      const exists = tables.artifact.find(
        (a) => a.module === row.module && a.entityId === row.entityId,
      );
      if (exists && skipDuplicates) continue;
      if (exists && !skipDuplicates) {
        throw new Error('Unique constraint on (module, entityId)');
      }
      tables.artifact.push({ ...row, id: row.id || `art_${tables.artifact.length + 1}` });
      count++;
    }
    return { count };
  });

  // artifactRelationship.createMany honors @@unique([sourceId, targetId, relationshipType]).
  prisma.artifactRelationship.createMany = vi.fn(async ({ data, skipDuplicates }) => {
    let count = 0;
    for (const row of data) {
      const exists = tables.artifactRelationship.find(
        (r) =>
          r.sourceId === row.sourceId &&
          r.targetId === row.targetId &&
          r.relationshipType === row.relationshipType,
      );
      if (exists && skipDuplicates) continue;
      tables.artifactRelationship.push({
        ...row,
        id: `rel_${tables.artifactRelationship.length + 1}`,
      });
      count++;
    }
    return { count };
  });

  prisma.$transaction = vi.fn(async (ops) => Promise.all(ops));
  prisma.$disconnect = vi.fn();

  prisma.__tables = tables; // test helper

  return prisma;
}

// -------------------------------------------------------
// Tests
// -------------------------------------------------------

describe('parseArgs', () => {
  it('defaults to non-dry-run with batch size 500', () => {
    expect(parseArgs(['node', 'script.js'])).toEqual({ dryRun: false, batchSize: 500 });
  });

  it('parses --dry-run flag', () => {
    expect(parseArgs(['node', 'script.js', '--dry-run'])).toEqual({ dryRun: true, batchSize: 500 });
  });

  it('parses --batch-size=NNN', () => {
    expect(parseArgs(['node', 'script.js', '--batch-size=1000'])).toEqual({
      dryRun: false,
      batchSize: 1000,
    });
  });

  it('ignores malformed --batch-size values', () => {
    expect(parseArgs(['node', 'script.js', '--batch-size=abc'])).toEqual({
      dryRun: false,
      batchSize: 500,
    });
  });
});

describe('backfillArtifacts', () => {
  it('reports pending counts in dry-run without writing', async () => {
    const prisma = makeMockPrisma({
      post: [{ id: 'p1', content: 'hello', createdById: 'u1', status: 'DRAFT', artifactId: null }],
      gtmProject: [{ id: 'pr1', name: 'Q2', ownerId: 'u1', status: 'ACTIVE', artifactId: null }],
    });
    const log = vi.fn();
    const summary = await backfillArtifacts(prisma, { dryRun: true, batchSize: 500, log });

    expect(summary.perModule.post.pending).toBe(1);
    expect(summary.perModule.gtmProject.pending).toBe(1);
    expect(summary.artifactsCreated).toBe(0);
    expect(prisma.artifact.createMany).not.toHaveBeenCalled();
  });

  it('creates one artifact per pending row across all 10 modules', async () => {
    const seed = {
      post: [{ id: 'p1', content: 'post 1', createdById: 'u1', status: 'PUBLISHED', artifactId: null }],
      gtmProject: [{ id: 'pr1', name: 'Q2', ownerId: 'u1', status: 'ACTIVE', artifactId: null }],
      gtmTask: [{ id: 't1', title: 'do it', ownerId: 'u1', status: 'TODO', artifactId: null }],
      gtmMoment: [{ id: 'm1', label: 'Launch', type: 'LAUNCH', artifactId: null }],
      emailCampaign: [{ id: 'e1', name: 'blast', createdById: 'u1', status: 'DRAFT', artifactId: null }],
      notionTaskInbox: [{ id: 'n1', title: 'review', userId: 'u1', status: 'Not Started', artifactId: null }],
      report: [{ id: 'r1', title: 'weekly', createdById: 'u1', status: 'READY', artifactId: null }],
      homeTask: [{ id: 'h1', title: 'personal', userId: 'u1', status: 'TODO', artifactId: null }],
      intelligenceTask: [{ id: 'i1', title: 'reply', status: 'PENDING', artifactId: null }],
      weeklyBriefing: [{ id: 'w1', role: 'CMO', weekStart: new Date('2026-04-14'), artifactId: null }],
    };
    const prisma = makeMockPrisma(seed);
    const log = vi.fn();

    const summary = await backfillArtifacts(prisma, { dryRun: false, batchSize: 500, log });

    expect(summary.artifactsCreated).toBe(10);
    expect(prisma.__tables.artifact).toHaveLength(10);

    // Every module row now has an artifactId
    for (const tableName of Object.keys(seed)) {
      const row = prisma.__tables[tableName][0];
      expect(row.artifactId).toBeTruthy();
    }

    // A GtmMoment with type LAUNCH → CAMPAIGN artifact type
    const momentArt = prisma.__tables.artifact.find((a) => a.entityId === 'm1');
    expect(momentArt.type).toBe('CAMPAIGN');

    // WeeklyBriefing title derived from role + weekStart
    const briefingArt = prisma.__tables.artifact.find((a) => a.entityId === 'w1');
    expect(briefingArt.title).toMatch(/^CMO Briefing 2026-04-14$/);
  });

  it('is idempotent — running twice creates zero new artifacts on the second run', async () => {
    const prisma = makeMockPrisma({
      post: [{ id: 'p1', content: 'x', createdById: 'u1', status: 'DRAFT', artifactId: null }],
    });
    const log = vi.fn();

    const first = await backfillArtifacts(prisma, { dryRun: false, batchSize: 500, log });
    expect(first.artifactsCreated).toBe(1);

    // Second run: the post now has artifactId, so findMany({ artifactId: null }) returns []
    const second = await backfillArtifacts(prisma, { dryRun: false, batchSize: 500, log });
    expect(second.artifactsCreated).toBe(0);
    expect(second.perModule.post.pending).toBe(0);
  });

  it('skips rows that already have artifactId set', async () => {
    const prisma = makeMockPrisma({
      post: [
        { id: 'p1', content: 'needs art', createdById: 'u1', status: 'DRAFT', artifactId: null },
        { id: 'p2', content: 'already has art', createdById: 'u1', status: 'DRAFT', artifactId: 'art_preexisting' },
      ],
    });
    const log = vi.fn();

    const summary = await backfillArtifacts(prisma, { dryRun: false, batchSize: 500, log });
    expect(summary.perModule.post.pending).toBe(1);
    expect(summary.artifactsCreated).toBe(1);
  });
});

describe('backfillRelationships', () => {
  it('creates PARENT_OF edges for GtmTask → GtmProject', async () => {
    const prisma = makeMockPrisma({
      gtmTask: [
        {
          id: 't1',
          artifactId: 'art_task',
          project: { artifactId: 'art_proj' },
        },
      ],
    });
    const log = vi.fn();
    const summary = await backfillRelationships(prisma, { dryRun: false, log });

    expect(summary.relationshipsCreated).toBe(1);
    expect(prisma.__tables.artifactRelationship).toHaveLength(1);
    expect(prisma.__tables.artifactRelationship[0]).toMatchObject({
      sourceId: 'art_proj',
      targetId: 'art_task',
      relationshipType: 'PARENT_OF',
    });
  });

  it('creates edges for all 5 hierarchy types', async () => {
    const prisma = makeMockPrisma({
      gtmTask: [{ id: 't1', artifactId: 'art_t1', project: { artifactId: 'art_p1' } }],
      gtmMoment: [
        // one with projectId set → project-parent edge
        { id: 'm1', artifactId: 'art_m1', projectId: 'pr1', parentMomentId: null, project: { artifactId: 'art_p1' }, parentMoment: null },
        // one with only parentMomentId → moment-parent edge
        { id: 'm2', artifactId: 'art_m2', projectId: null, parentMomentId: 'm1', project: null, parentMoment: { artifactId: 'art_m1' } },
      ],
      post: [
        { id: 'post1', artifactId: 'art_post1', threadId: 'post0', threadParent: { artifactId: 'art_post0' } },
      ],
      intelligenceTask: [
        { id: 'i1', artifactId: 'art_i1', briefingId: 'w1', briefing: { artifactId: 'art_w1' } },
      ],
    });
    const log = vi.fn();
    const summary = await backfillRelationships(prisma, { dryRun: false, log });

    // Expect: 1 (task→project) + 1 (moment→project) + 1 (moment→parent moment) + 1 (post→thread parent) + 1 (task→briefing) = 5
    expect(summary.relationshipsCreated).toBe(5);

    const edges = prisma.__tables.artifactRelationship;
    expect(edges.map((e) => `${e.sourceId}→${e.targetId}`).sort()).toEqual(
      [
        'art_p1→art_t1',     // task → project
        'art_p1→art_m1',     // moment with projectId → project
        'art_m1→art_m2',     // moment with parentMomentId → parent moment
        'art_post0→art_post1', // post → thread parent
        'art_w1→art_i1',     // intel task → briefing
      ].sort(),
    );
  });

  it('is idempotent — running twice does not duplicate edges', async () => {
    const prisma = makeMockPrisma({
      gtmTask: [{ id: 't1', artifactId: 'art_t1', project: { artifactId: 'art_p1' } }],
    });
    const log = vi.fn();

    const first = await backfillRelationships(prisma, { dryRun: false, log });
    expect(first.relationshipsCreated).toBe(1);

    const second = await backfillRelationships(prisma, { dryRun: false, log });
    expect(second.relationshipsCreated).toBe(0);
    expect(prisma.__tables.artifactRelationship).toHaveLength(1);
  });

  it('dry-run does not write edges', async () => {
    const prisma = makeMockPrisma({
      gtmTask: [{ id: 't1', artifactId: 'art_t1', project: { artifactId: 'art_p1' } }],
    });
    const log = vi.fn();
    const summary = await backfillRelationships(prisma, { dryRun: true, log });

    expect(summary.perEdge['gtmTask → gtmProject'].candidates).toBe(1);
    expect(summary.relationshipsCreated).toBe(0);
    expect(prisma.__tables.artifactRelationship).toHaveLength(0);
  });
});
