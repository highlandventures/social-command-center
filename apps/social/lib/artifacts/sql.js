/**
 * Recursive-CTE helpers for the artifact graph.
 *
 * This is the only place in the codebase using `WITH RECURSIVE` via
 * `prisma.$queryRaw`. Graph hierarchy traversal is the exact case where raw
 * SQL pays off — Prisma's nested include would require N round-trips.
 *
 * Other `$queryRaw` usages in the repo (cron batch inserts in
 * `daily-analytics` and `notion-sync`) are parameter-bound; we follow the same
 * discipline here. All inputs are cuids but we still use `Prisma.sql`
 * parameter binding to prevent injection as a blanket rule.
 *
 * See .planning/phases/17-artifact-graph-foundation/17-02-PLAN.md (Task 2)
 */

import { Prisma } from '@prisma/client';

const MIN_DEPTH = 1;
const MAX_DEPTH = 20;

function clampDepth(d) {
  if (!Number.isFinite(d)) return 10;
  return Math.max(MIN_DEPTH, Math.min(d, MAX_DEPTH));
}

/**
 * descendantsOf — walks the primary hierarchy (artifacts.parent_id) AND the
 * `PARENT_OF` relationship edges down from rootId, up to `maxDepth` levels.
 *
 * Returns `{ artifacts: Artifact[], edges: Edge[] }`. The caller reassembles
 * the tree client-side. Archived artifacts and edges are excluded by default.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ rootId: string, maxDepth?: number }} args
 */
export async function descendantsOf(prisma, { rootId, maxDepth = 10 }) {
  const depth = clampDepth(maxDepth);

  const artifacts = await prisma.$queryRaw(Prisma.sql`
    WITH RECURSIVE tree AS (
      SELECT a.*, 0 AS depth
      FROM artifacts a
      WHERE a.id = ${rootId} AND a.archived_at IS NULL

      UNION ALL

      SELECT a.*, t.depth + 1
      FROM artifacts a
      JOIN tree t
        ON a.parent_id = t.id
        OR a.id IN (
          SELECT r.target_id FROM artifact_relationships r
          WHERE r.source_id = t.id
            AND r.relationship_type = 'PARENT_OF'
            AND r.archived_at IS NULL
        )
      WHERE t.depth < ${depth} AND a.archived_at IS NULL
    )
    SELECT DISTINCT * FROM tree ORDER BY depth ASC;
  `);

  const ids = artifacts.map((a) => a.id);
  if (ids.length === 0) return { artifacts: [], edges: [] };

  const edges = await prisma.artifactRelationship.findMany({
    where: {
      sourceId: { in: ids },
      targetId: { in: ids },
      archivedAt: null,
    },
    select: {
      id: true,
      sourceId: true,
      targetId: true,
      relationshipType: true,
    },
  });

  return { artifacts, edges };
}

/**
 * lineageOf — walks `DERIVED_FROM` edges backwards from `artifactId` toward
 * its origin, up to `maxDepth` hops. Returns artifacts in lineage order
 * (most-recent descendant first, origin last).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ artifactId: string, maxDepth?: number }} args
 */
export async function lineageOf(prisma, { artifactId, maxDepth = 10 }) {
  const depth = clampDepth(maxDepth);

  const rows = await prisma.$queryRaw(Prisma.sql`
    WITH RECURSIVE lineage AS (
      SELECT a.*, 0 AS depth
      FROM artifacts a
      WHERE a.id = ${artifactId} AND a.archived_at IS NULL

      UNION ALL

      SELECT a.*, l.depth + 1
      FROM artifacts a
      JOIN artifact_relationships r
        ON r.source_id = a.id
        AND r.relationship_type = 'DERIVED_FROM'
        AND r.archived_at IS NULL
      JOIN lineage l ON r.target_id = l.id
      WHERE l.depth < ${depth} AND a.archived_at IS NULL
    )
    SELECT DISTINCT * FROM lineage ORDER BY depth ASC;
  `);

  return rows;
}
