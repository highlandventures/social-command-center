import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, internalProcedure } from '../trpc';
import { canRead, canWrite, canFlipType } from '../artifacts/policies';
import { descendantsOf, lineageOf } from '../artifacts/sql';
import { ARTIFACT_TYPE, ARTIFACT_MODULE, RELATIONSHIP_TYPE } from '../artifacts/types';

const ARTIFACT_TYPE_ENUM = z.enum(Object.values(ARTIFACT_TYPE));
const ARTIFACT_MODULE_ENUM = z.enum(Object.values(ARTIFACT_MODULE));
const RELATIONSHIP_TYPE_ENUM = z.enum(Object.values(RELATIONSHIP_TYPE));

/**
 * Per-module "mirror back" field mapping — which module-row column receives
 * the artifact's `title` / `status` when `hub.updateArtifact` changes them.
 * Skipped (no entry) = the underlying table has no compatible column.
 */
const MIRROR_BACK = {
  post: { status: 'status' }, // Post has no title column (uses `content`)
  gtmProject: { title: 'name', status: 'status' },
  gtmTask: { title: 'title', status: 'status' },
  gtmMoment: { title: 'label' },
  emailCampaign: { title: 'name', status: 'status' },
  notionTaskInbox: { title: 'title', status: 'status' },
  report: { title: 'title', status: 'status' },
  homeTask: { title: 'title', status: 'status' },
  intelligenceTask: { title: 'title', status: 'status' },
  weeklyBriefing: {},
};

const MODULE_TO_DELEGATE = {
  SOCIAL: (artifact) => (artifact.type === 'REPORT' ? 'report' : 'post'),
  GTM: (artifact) => {
    if (artifact.type === 'TASK' || artifact.type === 'SUBTASK') return 'gtmTask';
    if (artifact.type === 'MILESTONE') return 'gtmMoment';
    if (artifact.type === 'CAMPAIGN') return artifact.gtmProject ? 'gtmProject' : 'gtmMoment';
    return 'gtmProject';
  },
  EMAIL: () => 'emailCampaign',
  LC_REVIEW: () => 'notionTaskInbox',
  HUB: (artifact) => {
    if (artifact.type === 'REPORT') return 'weeklyBriefing';
    // HUB + TASK is ambiguous between HomeTask and IntelligenceTask.
    // Resolve by existence of a HomeTask with this entityId.
    return null; // caller must resolve explicitly
  },
};

async function requireArtifact(ctx, artifactId, { forWrite = false } = {}) {
  const artifact = await ctx.prisma.artifact.findUnique({ where: { id: artifactId } });
  if (!artifact) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Artifact not found' });
  }
  const check = forWrite ? canWrite : canRead;
  if (!check(ctx.user, artifact)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Not authorized to ${forWrite ? 'write' : 'read'} this artifact`,
    });
  }
  return artifact;
}

async function writeAudit(ctx, { action, target, metadata }) {
  try {
    await ctx.prisma.auditLog.create({
      data: { userId: ctx.user.id, action, target, metadata },
    });
  } catch (err) {
    // Audit log must never block the primary write — log + continue.
    console.warn('[hub] auditLog write failed:', err.message);
  }
}

export const hubRouter = router({
  // ----------------------------------------------------------------------
  // READ procedures
  // ----------------------------------------------------------------------

  /** hub.getTree — returns root + descendants (flat) with PARENT_OF edges. */
  getTree: protectedProcedure
    .input(
      z.object({
        artifactId: z.string(),
        maxDepth: z.number().int().min(1).max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireArtifact(ctx, input.artifactId);
      const { artifacts, edges } = await descendantsOf(ctx.prisma, {
        rootId: input.artifactId,
        maxDepth: input.maxDepth ?? 10,
      });
      // Filter out artifacts the caller cannot read (mixed-module trees).
      const readable = artifacts.filter((a) => canRead(ctx.user, a));
      const readableIds = new Set(readable.map((a) => a.id));
      const prunedEdges = edges.filter(
        (e) => readableIds.has(e.sourceId) && readableIds.has(e.targetId),
      );
      return { artifacts: readable, edges: prunedEdges };
    }),

  /** hub.getRelated — 1-hop neighbors in either direction, optionally filtered. */
  getRelated: protectedProcedure
    .input(
      z.object({
        artifactId: z.string(),
        relationshipType: RELATIONSHIP_TYPE_ENUM.optional(),
        direction: z.enum(['outbound', 'inbound', 'both']).default('both'),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireArtifact(ctx, input.artifactId);

      const where = { archivedAt: null };
      if (input.relationshipType) where.relationshipType = input.relationshipType;

      const conditions = [];
      if (input.direction === 'outbound' || input.direction === 'both') {
        conditions.push({ ...where, sourceId: input.artifactId });
      }
      if (input.direction === 'inbound' || input.direction === 'both') {
        conditions.push({ ...where, targetId: input.artifactId });
      }

      const edges = await ctx.prisma.artifactRelationship.findMany({
        where: conditions.length === 1 ? conditions[0] : { OR: conditions },
        include: {
          source: true,
          target: true,
        },
      });

      // Filter out edges where the remote artifact is unreadable.
      return edges.filter((e) => {
        const remote = e.sourceId === input.artifactId ? e.target : e.source;
        return remote && canRead(ctx.user, remote);
      });
    }),

  /** hub.traceLineage — walks DERIVED_FROM back to origin. */
  traceLineage: protectedProcedure
    .input(
      z.object({
        artifactId: z.string(),
        maxDepth: z.number().int().min(1).max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireArtifact(ctx, input.artifactId);
      const lineage = await lineageOf(ctx.prisma, {
        artifactId: input.artifactId,
        maxDepth: input.maxDepth ?? 10,
      });
      return lineage.filter((a) => canRead(ctx.user, a));
    }),

  /** hub.findArtifact — fuzzy search on title, optional type/module filter, cursor pagination. */
  findArtifact: protectedProcedure
    .input(
      z.object({
        q: z.string().min(1).max(200),
        types: z.array(ARTIFACT_TYPE_ENUM).optional(),
        modules: z.array(ARTIFACT_MODULE_ENUM).optional(),
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        archivedAt: null,
        title: { contains: input.q, mode: 'insensitive' },
      };
      if (input.types?.length) where.type = { in: input.types };
      if (input.modules?.length) where.module = { in: input.modules };

      const results = await ctx.prisma.artifact.findMany({
        where,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { updatedAt: 'desc' },
      });

      let nextCursor = undefined;
      if (results.length > input.limit) {
        nextCursor = results.pop().id;
      }

      // Apply read policy after DB fetch (small N; fine).
      const readable = results.filter((a) => canRead(ctx.user, a));
      return { items: readable, nextCursor };
    }),

  /** hub.whatAmIWorkingOn — caller's owned artifacts across modules. */
  whatAmIWorkingOn: protectedProcedure
    .input(
      z
        .object({
          includeArchived: z.boolean().default(false),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const where = { ownerId: ctx.user.id };
      if (!input.includeArchived) where.archivedAt = null;
      return ctx.prisma.artifact.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 200,
      });
    }),

  // ----------------------------------------------------------------------
  // WRITE procedures (internalProcedure — blocks AGENCY by default; ownership
  // override inside canWrite allows AGENCY to edit their own rows.)
  // ----------------------------------------------------------------------

  /** hub.link — create (or re-activate) a relationship between two artifacts. */
  link: internalProcedure
    .input(
      z.object({
        sourceId: z.string(),
        targetId: z.string(),
        relationshipType: RELATIONSHIP_TYPE_ENUM,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.sourceId === input.targetId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Self-links are not allowed.' });
      }
      const [source, target] = await Promise.all([
        requireArtifact(ctx, input.sourceId, { forWrite: true }),
        requireArtifact(ctx, input.targetId, { forWrite: true }),
      ]);

      const edge = await ctx.prisma.artifactRelationship.upsert({
        where: {
          sourceId_targetId_relationshipType: {
            sourceId: input.sourceId,
            targetId: input.targetId,
            relationshipType: input.relationshipType,
          },
        },
        create: {
          sourceId: input.sourceId,
          targetId: input.targetId,
          relationshipType: input.relationshipType,
          createdById: ctx.user.id,
        },
        update: {
          archivedAt: null, // re-activate a soft-deleted edge
        },
      });

      await writeAudit(ctx, {
        action: 'hub.link',
        target: edge.id,
        metadata: { sourceId: input.sourceId, targetId: input.targetId, relationshipType: input.relationshipType },
      });

      return edge;
    }),

  /** hub.unlink — soft-delete a relationship. Destructive → requires confirm. */
  unlink: internalProcedure
    .input(
      z.object({
        sourceId: z.string(),
        targetId: z.string(),
        relationshipType: RELATIONSHIP_TYPE_ENUM,
        confirm: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.artifactRelationship.updateMany({
        where: {
          sourceId: input.sourceId,
          targetId: input.targetId,
          relationshipType: input.relationshipType,
          archivedAt: null,
        },
        data: { archivedAt: new Date() },
      });

      if (result.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Edge not found or already archived.' });
      }

      await writeAudit(ctx, {
        action: 'hub.unlink',
        target: `${input.sourceId}:${input.targetId}:${input.relationshipType}`,
        metadata: input,
      });

      return { archived: result.count };
    }),

  /** hub.updateArtifact — edit title/status/metadata. Type flip is ADMIN-only. */
  updateArtifact: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(500).optional(),
        status: z.string().max(100).optional(),
        metadata: z.record(z.any()).optional(),
        type: ARTIFACT_TYPE_ENUM.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const artifact = await requireArtifact(ctx, input.id, { forWrite: true });

      if (input.type !== undefined && !canFlipType(ctx.user)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only ADMIN users can change an artifact type.',
        });
      }

      const data = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.status !== undefined) data.status = input.status;
      if (input.metadata !== undefined) data.metadata = input.metadata;
      if (input.type !== undefined) data.type = input.type;

      const updated = await ctx.prisma.artifact.update({
        where: { id: input.id },
        data,
      });

      // Best-effort mirror back onto the module row when title/status changed.
      const resolveDelegate = MODULE_TO_DELEGATE[artifact.module];
      const delegateName = resolveDelegate ? resolveDelegate(artifact) : null;
      const mirror = delegateName ? MIRROR_BACK[delegateName] : null;
      if (delegateName && mirror && (input.title !== undefined || input.status !== undefined)) {
        const moduleData = {};
        if (input.title !== undefined && mirror.title) moduleData[mirror.title] = input.title;
        if (input.status !== undefined && mirror.status) moduleData[mirror.status] = input.status;
        if (Object.keys(moduleData).length > 0) {
          try {
            await ctx.prisma[delegateName].update({
              where: { id: artifact.entityId },
              data: moduleData,
            });
          } catch (err) {
            console.warn(`[hub.updateArtifact] mirror-back to ${delegateName} failed:`, err.message);
          }
        }
      }

      await writeAudit(ctx, {
        action: 'hub.updateArtifact',
        target: input.id,
        metadata: data,
      });

      return updated;
    }),

  /** hub.reparent — change an artifact's parent. Destructive → requires confirm. */
  reparent: internalProcedure
    .input(
      z.object({
        id: z.string(),
        newParentId: z.string().nullable(),
        confirm: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const target = await requireArtifact(ctx, input.id, { forWrite: true });
      if (input.newParentId) {
        await requireArtifact(ctx, input.newParentId, { forWrite: true });
      }

      return ctx.prisma.$transaction(async (tx) => {
        // Archive the old PARENT_OF edge, if any.
        if (target.parentId) {
          await tx.artifactRelationship.updateMany({
            where: {
              sourceId: target.parentId,
              targetId: target.id,
              relationshipType: 'PARENT_OF',
              archivedAt: null,
            },
            data: { archivedAt: new Date() },
          });
        }

        // Update the primary parentId on the artifact row.
        const updated = await tx.artifact.update({
          where: { id: target.id },
          data: { parentId: input.newParentId },
        });

        // Write the new PARENT_OF edge (idempotent — re-activates if soft-deleted).
        if (input.newParentId) {
          await tx.artifactRelationship.upsert({
            where: {
              sourceId_targetId_relationshipType: {
                sourceId: input.newParentId,
                targetId: target.id,
                relationshipType: 'PARENT_OF',
              },
            },
            create: {
              sourceId: input.newParentId,
              targetId: target.id,
              relationshipType: 'PARENT_OF',
              createdById: ctx.user.id,
            },
            update: { archivedAt: null },
          });
        }

        await writeAudit(ctx, {
          action: 'hub.reparent',
          target: target.id,
          metadata: { oldParentId: target.parentId, newParentId: input.newParentId },
        });

        return updated;
      });
    }),

  /** hub.archiveArtifact — soft-delete the artifact row. Module row untouched. */
  archiveArtifact: internalProcedure
    .input(z.object({ id: z.string(), confirm: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const artifact = await requireArtifact(ctx, input.id, { forWrite: true });
      if (artifact.archivedAt) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Artifact already archived.' });
      }

      const updated = await ctx.prisma.artifact.update({
        where: { id: input.id },
        data: { archivedAt: new Date() },
      });

      await writeAudit(ctx, {
        action: 'hub.archiveArtifact',
        target: input.id,
        metadata: {},
      });

      return updated;
    }),
});
