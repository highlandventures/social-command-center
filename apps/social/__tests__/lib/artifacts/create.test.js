import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  createWithArtifact,
  updateArtifactFromModule,
  archiveArtifact,
} from '@/lib/artifacts/create';
import {
  ARTIFACT_TYPE,
  ARTIFACT_MODULE,
  RELATIONSHIP_TYPE,
  defaultTypeForModule,
  moduleForPrismaModel,
} from '@/lib/artifacts/types';

function mockTx() {
  const tx = {
    artifact: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    artifactRelationship: {
      create: vi.fn(),
    },
    post: { create: vi.fn(), update: vi.fn() },
    gtmTask: { create: vi.fn(), update: vi.fn() },
    gtmProject: { create: vi.fn(), update: vi.fn() },
    gtmMoment: { create: vi.fn(), update: vi.fn() },
    emailCampaign: { create: vi.fn(), update: vi.fn() },
    notionTaskInbox: { create: vi.fn(), update: vi.fn() },
    report: { create: vi.fn(), update: vi.fn() },
    homeTask: { create: vi.fn(), update: vi.fn() },
    intelligenceTask: { create: vi.fn(), update: vi.fn() },
    weeklyBriefing: { create: vi.fn(), update: vi.fn() },
  };
  return tx;
}

function mockBaseClient(tx) {
  return {
    $transaction: vi.fn(async (fn) => fn(tx)),
  };
}

describe('createWithArtifact', () => {
  let tx;
  let base;

  beforeEach(() => {
    tx = mockTx();
    base = mockBaseClient(tx);
  });

  it('creates module row + artifact row + wires artifactId, in that order', async () => {
    tx.post.create.mockResolvedValue({ id: 'post_1', content: 'hello world' });
    tx.artifact.create.mockResolvedValue({ id: 'art_1' });
    tx.post.update.mockResolvedValue({ id: 'post_1', artifactId: 'art_1' });

    const result = await createWithArtifact(base, {
      module: ARTIFACT_MODULE.SOCIAL,
      type: ARTIFACT_TYPE.POST,
      prismaModel: 'post',
      title: 'hello world',
      ownerId: 'user_1',
      status: 'DRAFT',
      moduleCreate: (t) => t.post.create({ data: { content: 'hello world' } }),
    });

    expect(base.$transaction).toHaveBeenCalledOnce();
    expect(tx.post.create).toHaveBeenCalledOnce();
    expect(tx.artifact.create).toHaveBeenCalledWith({
      data: {
        type: 'POST',
        title: 'hello world',
        parentId: null,
        ownerId: 'user_1',
        status: 'DRAFT',
        module: 'SOCIAL',
        entityId: 'post_1',
        metadata: null,
      },
    });
    expect(tx.post.update).toHaveBeenCalledWith({
      where: { id: 'post_1' },
      data: { artifactId: 'art_1' },
    });

    // order: module create → artifact create → module update
    const postCreateOrder = tx.post.create.mock.invocationCallOrder[0];
    const artifactCreateOrder = tx.artifact.create.mock.invocationCallOrder[0];
    const postUpdateOrder = tx.post.update.mock.invocationCallOrder[0];
    expect(postCreateOrder).toBeLessThan(artifactCreateOrder);
    expect(artifactCreateOrder).toBeLessThan(postUpdateOrder);

    expect(result.moduleRow.artifactId).toBe('art_1');
    expect(result.artifact.id).toBe('art_1');
  });

  it('writes PARENT_OF edge when parentArtifactId is set', async () => {
    tx.gtmTask.create.mockResolvedValue({ id: 'task_1' });
    tx.artifact.create.mockResolvedValue({ id: 'art_task' });
    tx.gtmTask.update.mockResolvedValue({});

    await createWithArtifact(base, {
      module: ARTIFACT_MODULE.GTM,
      type: ARTIFACT_TYPE.TASK,
      prismaModel: 'gtmTask',
      title: 'Do the thing',
      ownerId: 'user_1',
      parentArtifactId: 'art_parent',
      status: 'TODO',
      moduleCreate: (t) => t.gtmTask.create({ data: { title: 'Do the thing' } }),
    });

    expect(tx.artifactRelationship.create).toHaveBeenCalledWith({
      data: {
        sourceId: 'art_parent',
        targetId: 'art_task',
        relationshipType: RELATIONSHIP_TYPE.PARENT_OF,
        createdById: 'user_1',
      },
    });
  });

  it('does NOT write a PARENT_OF edge when parentArtifactId is null', async () => {
    tx.gtmProject.create.mockResolvedValue({ id: 'proj_1' });
    tx.artifact.create.mockResolvedValue({ id: 'art_proj' });
    tx.gtmProject.update.mockResolvedValue({});

    await createWithArtifact(base, {
      module: ARTIFACT_MODULE.GTM,
      type: ARTIFACT_TYPE.PROJECT,
      prismaModel: 'gtmProject',
      title: 'Q2 Launch',
      ownerId: 'user_1',
      moduleCreate: (t) => t.gtmProject.create({ data: { name: 'Q2 Launch' } }),
    });

    expect(tx.artifactRelationship.create).not.toHaveBeenCalled();
  });

  it('rejects unknown prismaModel', async () => {
    await expect(
      createWithArtifact(base, {
        module: 'SOCIAL',
        type: 'POST',
        prismaModel: 'bogusModel',
        title: 't',
        moduleCreate: () => ({ id: 'x' }),
      }),
    ).rejects.toThrow(/Unknown prismaModel/);
  });

  it('rejects a moduleCreate return without an id', async () => {
    await expect(
      createWithArtifact(base, {
        module: 'SOCIAL',
        type: 'POST',
        prismaModel: 'post',
        title: 't',
        moduleCreate: () => ({}),
      }),
    ).rejects.toThrow(/must return a row with { id }/);
  });

  it('aborts the artifact write when moduleCreate throws', async () => {
    const boom = new Error('module create failed');
    await expect(
      createWithArtifact(base, {
        module: 'SOCIAL',
        type: 'POST',
        prismaModel: 'post',
        title: 't',
        moduleCreate: () => {
          throw boom;
        },
      }),
    ).rejects.toThrow(boom);

    expect(tx.artifact.create).not.toHaveBeenCalled();
    expect(tx.artifactRelationship.create).not.toHaveBeenCalled();
  });

  it('runs inline when given a tx client (no nested $transaction)', async () => {
    tx.post.create.mockResolvedValue({ id: 'p2' });
    tx.artifact.create.mockResolvedValue({ id: 'a2' });
    tx.post.update.mockResolvedValue({});

    await createWithArtifact(tx, {
      module: 'SOCIAL',
      type: 'POST',
      prismaModel: 'post',
      title: 't',
      moduleCreate: (t) => t.post.create({ data: {} }),
    });

    expect(base.$transaction).not.toHaveBeenCalled();
    expect(tx.artifact.create).toHaveBeenCalledOnce();
  });
});

describe('updateArtifactFromModule', () => {
  let tx;
  let base;

  beforeEach(() => {
    tx = mockTx();
    base = mockBaseClient(tx);
  });

  it('is a silent no-op when no artifact row exists for (module, entityId)', async () => {
    tx.artifact.findUnique.mockResolvedValue(null);

    await updateArtifactFromModule(base, {
      prismaModel: 'gtmTask',
      entityId: 'task_historical',
      patch: { title: 'new title' },
    });

    expect(tx.artifact.update).not.toHaveBeenCalled();
  });

  it('mirrors mapped fields to the artifact row', async () => {
    tx.artifact.findUnique.mockResolvedValue({ id: 'art_1' });
    tx.artifact.update.mockResolvedValue({});

    await updateArtifactFromModule(base, {
      prismaModel: 'gtmTask',
      entityId: 'task_1',
      patch: { title: 'renamed', status: 'DONE', priority: 'HIGH' },
    });

    expect(tx.artifact.update).toHaveBeenCalledWith({
      where: { id: 'art_1' },
      data: { title: 'renamed', status: 'DONE' },
    });
  });

  it('skips when patch has no mirrored fields', async () => {
    await updateArtifactFromModule(base, {
      prismaModel: 'gtmTask',
      entityId: 'task_1',
      patch: { priority: 'HIGH' },
    });

    expect(tx.artifact.findUnique).not.toHaveBeenCalled();
    expect(tx.artifact.update).not.toHaveBeenCalled();
  });

  it('derives Post artifact title from content.slice(0, 120)', async () => {
    tx.artifact.findUnique.mockResolvedValue({ id: 'art_p' });
    tx.artifact.update.mockResolvedValue({});

    const longContent = 'x'.repeat(200);
    await updateArtifactFromModule(base, {
      prismaModel: 'post',
      entityId: 'post_1',
      patch: { content: longContent },
    });

    const callArg = tx.artifact.update.mock.calls[0][0];
    expect(callArg.data.title).toHaveLength(120);
  });
});

describe('archiveArtifact', () => {
  it('sets archivedAt with an updateMany guarded by archivedAt: null', async () => {
    const tx = mockTx();
    const base = mockBaseClient(tx);
    tx.artifact.updateMany.mockResolvedValue({ count: 1 });

    await archiveArtifact(base, { prismaModel: 'post', entityId: 'post_1' });

    expect(tx.artifact.updateMany).toHaveBeenCalledWith({
      where: { module: 'SOCIAL', entityId: 'post_1', archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    });
  });
});

describe('defaultTypeForModule', () => {
  it('covers every prismaModel', () => {
    expect(defaultTypeForModule({ prismaModel: 'post' })).toBe('POST');
    expect(defaultTypeForModule({ prismaModel: 'report' })).toBe('REPORT');
    expect(defaultTypeForModule({ prismaModel: 'gtmProject' })).toBe('PROJECT');
    expect(defaultTypeForModule({ prismaModel: 'gtmProject', flags: { isCampaign: true } })).toBe(
      'CAMPAIGN',
    );
    expect(defaultTypeForModule({ prismaModel: 'gtmTask' })).toBe('TASK');
    expect(defaultTypeForModule({ prismaModel: 'gtmMoment', entity: { type: 'LAUNCH' } })).toBe(
      'CAMPAIGN',
    );
    expect(defaultTypeForModule({ prismaModel: 'gtmMoment', entity: { type: 'MILESTONE' } })).toBe(
      'MILESTONE',
    );
    expect(defaultTypeForModule({ prismaModel: 'emailCampaign' })).toBe('EMAIL');
    expect(defaultTypeForModule({ prismaModel: 'notionTaskInbox' })).toBe('LC_TICKET');
    expect(defaultTypeForModule({ prismaModel: 'homeTask' })).toBe('TASK');
    expect(defaultTypeForModule({ prismaModel: 'intelligenceTask' })).toBe('TASK');
    expect(defaultTypeForModule({ prismaModel: 'weeklyBriefing' })).toBe('REPORT');
  });

  it('throws on unknown prismaModel', () => {
    expect(() => defaultTypeForModule({ prismaModel: 'nope' })).toThrow(/No default ArtifactType/);
  });
});

describe('moduleForPrismaModel', () => {
  it('maps each Prisma delegate to its ArtifactModule', () => {
    expect(moduleForPrismaModel('post')).toBe('SOCIAL');
    expect(moduleForPrismaModel('report')).toBe('SOCIAL');
    expect(moduleForPrismaModel('gtmProject')).toBe('GTM');
    expect(moduleForPrismaModel('gtmTask')).toBe('GTM');
    expect(moduleForPrismaModel('gtmMoment')).toBe('GTM');
    expect(moduleForPrismaModel('emailCampaign')).toBe('EMAIL');
    expect(moduleForPrismaModel('notionTaskInbox')).toBe('LC_REVIEW');
    expect(moduleForPrismaModel('homeTask')).toBe('HUB');
    expect(moduleForPrismaModel('intelligenceTask')).toBe('HUB');
    expect(moduleForPrismaModel('weeklyBriefing')).toBe('HUB');
  });

  it('throws on unknown', () => {
    expect(() => moduleForPrismaModel('bogus')).toThrow(/Unknown prismaModel/);
  });
});
