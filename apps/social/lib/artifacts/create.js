/**
 * Transactional helpers for the unified artifact graph.
 *
 * `createWithArtifact` wraps a module-row create in the same $transaction as
 * the matching Artifact row, so a module row without an artifact row is
 * impossible for any future write (PRD §5.5 invariant).
 *
 * `updateArtifactFromModule` mirrors module-row title/status/owner edits back
 * onto the artifact row so `hub.*` reads never see stale titles.
 *
 * `archiveArtifact` soft-deletes an artifact by setting archivedAt.
 *
 * See .planning/phases/17-artifact-graph-foundation/17-01-PLAN.md
 */

import { moduleForPrismaModel, RELATIONSHIP_TYPE } from './types';

const VALID_PRISMA_MODELS = new Set([
  'post',
  'report',
  'gtmProject',
  'gtmTask',
  'gtmMoment',
  'emailCampaign',
  'notionTaskInbox',
  'homeTask',
  'intelligenceTask',
  'weeklyBriefing',
]);

function assertValidModel(prismaModel) {
  if (!VALID_PRISMA_MODELS.has(prismaModel)) {
    throw new Error(`Unknown prismaModel: ${prismaModel}`);
  }
}

// Mapping from (prismaModel) → which fields on a module-row patch should
// mirror back to the artifact row. Fields absent from this map are ignored.
const MIRROR_FIELDS = Object.freeze({
  post: { title: (p) => (p.content != null ? String(p.content).slice(0, 120) : undefined), status: (p) => p.status },
  report: { title: (p) => p.title, status: (p) => p.status },
  gtmProject: { title: (p) => p.name, status: (p) => p.status, ownerId: (p) => p.ownerId },
  gtmTask: { title: (p) => p.title, status: (p) => p.status, ownerId: (p) => p.ownerId },
  gtmMoment: { title: (p) => p.label }, // no status column
  emailCampaign: { title: (p) => p.name, status: (p) => p.status },
  notionTaskInbox: { title: (p) => p.title, status: (p) => p.status },
  homeTask: { title: (p) => p.title, status: (p) => p.status, ownerId: (p) => p.userId },
  intelligenceTask: { title: (p) => p.title, status: (p) => p.status },
  weeklyBriefing: {}, // title is derived at create time; no edit path mirrors back
});

function isTransactionClient(client) {
  // Prisma's interactive transaction client lacks $transaction (it's only on
  // the base PrismaClient). This is a cheap heuristic — callers can be wrong
  // but the consequences are caught downstream.
  return client && typeof client.$transaction !== 'function';
}

/**
 * createWithArtifact — create a module row + matching Artifact row in one transaction.
 *
 * @param {import('@prisma/client').PrismaClient | object} prismaClient
 *   Either the base Prisma client or a transaction client. If base, this helper opens its own tx.
 * @param {object} args
 * @param {string} args.module             ArtifactModule enum value (e.g. 'GTM')
 * @param {string} args.type               ArtifactType enum value (e.g. 'TASK')
 * @param {string} args.prismaModel        Delegate name ('gtmTask', 'post', ...)
 * @param {string} args.title              Artifact title
 * @param {string|null} [args.ownerId]     Artifact owner (User.id)
 * @param {string|null} [args.parentArtifactId]  Artifact.parentId for primary hierarchy + PARENT_OF edge
 * @param {string|null} [args.status]      Module-specific status string
 * @param {object|null} [args.metadata]    Freeform JSON
 * @param {(tx: object) => Promise<object>} args.moduleCreate
 *   Caller-provided function that creates the module row inside `tx` and returns it.
 * @returns {Promise<{ moduleRow: object, artifact: object }>}
 */
export async function createWithArtifact(prismaClient, args) {
  const {
    module,
    type,
    prismaModel,
    title,
    ownerId = null,
    parentArtifactId = null,
    status = null,
    metadata = null,
    moduleCreate,
  } = args;

  assertValidModel(prismaModel);
  if (typeof moduleCreate !== 'function') {
    throw new Error('createWithArtifact: moduleCreate must be a function');
  }

  const run = async (tx) => {
    if (typeof tx[prismaModel]?.update !== 'function') {
      throw new Error(`createWithArtifact: tx.${prismaModel} is not a valid Prisma delegate`);
    }

    const moduleRow = await moduleCreate(tx);
    if (!moduleRow || !moduleRow.id) {
      throw new Error(`createWithArtifact: moduleCreate must return a row with { id }`);
    }

    const artifact = await tx.artifact.create({
      data: {
        type,
        title,
        parentId: parentArtifactId,
        ownerId,
        status,
        module,
        entityId: moduleRow.id,
        metadata,
      },
    });

    await tx[prismaModel].update({
      where: { id: moduleRow.id },
      data: { artifactId: artifact.id },
    });

    if (parentArtifactId) {
      await tx.artifactRelationship.create({
        data: {
          sourceId: parentArtifactId,
          targetId: artifact.id,
          relationshipType: RELATIONSHIP_TYPE.PARENT_OF,
          createdById: ownerId ?? null,
        },
      });
    }

    return {
      moduleRow: { ...moduleRow, artifactId: artifact.id },
      artifact,
    };
  };

  if (isTransactionClient(prismaClient)) {
    return run(prismaClient);
  }
  return prismaClient.$transaction(run);
}

/**
 * updateArtifactFromModule — mirror module-row changes back to the artifact row.
 * Silent no-op when the module row has no artifactId yet (historical rows pre-backfill).
 *
 * @param {object} prismaClient            Base client or tx client
 * @param {object} args
 * @param {string} args.prismaModel        Delegate name — used to pick mirror-fields mapping
 * @param {string} args.entityId           Module row id (matches Artifact.entityId)
 * @param {object} args.patch              Module-level patch object (e.g. { name: 'x', status: 'ACTIVE' })
 */
export async function updateArtifactFromModule(prismaClient, args) {
  const { prismaModel, entityId, patch } = args;
  assertValidModel(prismaModel);
  if (!entityId) throw new Error('updateArtifactFromModule: entityId required');
  if (!patch || typeof patch !== 'object') return; // nothing to mirror

  const mirror = MIRROR_FIELDS[prismaModel];
  const module = moduleForPrismaModel(prismaModel);

  const data = {};
  for (const [artifactField, extract] of Object.entries(mirror)) {
    const value = extract(patch);
    if (value !== undefined) data[artifactField] = value;
  }
  if (Object.keys(data).length === 0) return; // no mirrored fields changed

  const run = async (tx) => {
    const existing = await tx.artifact.findUnique({
      where: { module_entityId: { module, entityId } },
      select: { id: true },
    });
    if (!existing) return; // pre-backfill row; silent no-op
    await tx.artifact.update({ where: { id: existing.id }, data });
  };

  if (isTransactionClient(prismaClient)) {
    return run(prismaClient);
  }
  return prismaClient.$transaction(run);
}

/**
 * archiveArtifact — set archivedAt on the artifact row.
 * Does NOT cascade to the module row (archive semantics vary per module).
 */
export async function archiveArtifact(prismaClient, args) {
  const { prismaModel, entityId } = args;
  assertValidModel(prismaModel);
  const module = moduleForPrismaModel(prismaModel);

  const run = async (tx) => {
    return tx.artifact.updateMany({
      where: { module, entityId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  };

  if (isTransactionClient(prismaClient)) {
    return run(prismaClient);
  }
  return prismaClient.$transaction(run);
}
