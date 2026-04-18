/**
 * Ontology → ListeningQuery reconciler.
 *
 * Given a topic id, reads every BrandEntity under it, runs the pure planner, and
 * diff-updates the `listening_queries` table:
 *   - Insert new planner queries that don't exist yet.
 *   - Disable ( active:false ) planner queries that are no longer emitted.
 *   - Leave hand-written queries (sourceEntityId = null) untouched.
 *
 * Matching is done by (sourceEntityId, sourceTemplate) — so editing an entity's
 * handles/aliases rewrites the *same* query row rather than piling up new ones.
 */

import { prisma } from '@/lib/db';
import { planQueriesForTopic } from './query-planner';

export async function syncQueriesFromOntology(topicId) {
  const entities = await prisma.brandEntity.findMany({
    where: { topicId, enabled: true },
    orderBy: { createdAt: 'asc' },
  });

  const planned = planQueriesForTopic(topicId, entities);

  // Existing planner-generated queries for this topic (not hand-written ones).
  const existing = await prisma.listeningQuery.findMany({
    where: { topicId, sourceEntityId: { not: null } },
  });

  const key = (row) => `${row.sourceEntityId}::${row.sourceTemplate}`;
  const existingByKey = new Map(existing.map((r) => [key(r), r]));
  const plannedByKey = new Map(planned.map((r) => [key(r), r]));

  let inserted = 0;
  let updated = 0;
  let disabled = 0;

  // Insert new or update changed queries.
  for (const [k, p] of plannedByKey) {
    const existingRow = existingByKey.get(k);
    if (!existingRow) {
      await prisma.listeningQuery.create({
        data: {
          topicId: p.topicId,
          platform: p.platform,
          queryString: p.queryString,
          negativeKeywords: p.negativeKeywords,
          generatedBy: p.generatedBy,
          active: true,
          sourceEntityId: p.sourceEntityId,
          sourceTemplate: p.sourceTemplate,
        },
      });
      inserted++;
    } else if (
      existingRow.queryString !== p.queryString ||
      existingRow.active === false
    ) {
      await prisma.listeningQuery.update({
        where: { id: existingRow.id },
        data: {
          queryString: p.queryString,
          negativeKeywords: p.negativeKeywords,
          active: true,
          // Reset the high-water mark on query content change — the old cursor
          // refers to tweets that may not match the new query, so we must
          // re-backfill the recent window under the new string.
          lastHitPlatformId: null,
          lastHitSyncAt: null,
        },
      });
      updated++;
    }
  }

  // Soft-delete planner queries that are no longer emitted (entity disabled/deleted
  // or template no longer applies).
  for (const [k, existingRow] of existingByKey) {
    if (!plannedByKey.has(k) && existingRow.active) {
      await prisma.listeningQuery.update({
        where: { id: existingRow.id },
        data: { active: false },
      });
      disabled++;
    }
  }

  return {
    topicId,
    entityCount: entities.length,
    plannedCount: planned.length,
    inserted,
    updated,
    disabled,
    unchanged: planned.length - inserted - updated,
  };
}

/** Reconcile every topic that has at least one BrandEntity. */
export async function syncAllOntologies() {
  const topics = await prisma.listeningTopic.findMany({
    where: { active: true, entities: { some: {} } },
    select: { id: true, name: true },
  });
  const results = [];
  for (const topic of topics) {
    const r = await syncQueriesFromOntology(topic.id);
    results.push({ ...r, topicName: topic.name });
  }
  return results;
}
