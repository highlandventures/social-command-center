import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock trpc to expose real router + procedures without auth middleware.
vi.mock('@/lib/trpc', async () => {
  const { initTRPC } = await import('@trpc/server');
  const t = initTRPC.create();
  return {
    router: t.router,
    protectedProcedure: t.procedure,
    internalProcedure: t.procedure,
    adminProcedure: t.procedure,
  };
});

// Mock the SQL helpers — unit tests for those live in sql.test.js.
vi.mock('@/lib/artifacts/sql', () => ({
  descendantsOf: vi.fn().mockResolvedValue({ artifacts: [], edges: [] }),
  lineageOf: vi.fn().mockResolvedValue([]),
}));

import { descendantsOf, lineageOf } from '@/lib/artifacts/sql';

function makeMockPrisma() {
  return {
    artifact: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    artifactRelationship: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    post: { update: vi.fn() },
    gtmProject: { update: vi.fn() },
    gtmTask: { update: vi.fn() },
    emailCampaign: { update: vi.fn() },
    $transaction: vi.fn(async (fn) => {
      if (typeof fn === 'function') {
        const tx = makeMockPrisma();
        // Reuse the outer mocks so assertions work.
        return fn(tx);
      }
      return Promise.all(fn);
    }),
  };
}

function buildCaller(prisma, user = { id: 'u1', role: 'ADMIN' }) {
  // Deferred-import to ensure vi.mock('@/lib/trpc') is applied first.
  return new Promise(async (resolve) => {
    const mod = await import('@/lib/routers/hub');
    resolve(
      mod.hubRouter.createCaller({
        prisma,
        kv: {},
        session: { user },
        user,
      }),
    );
  });
}

describe('hub.getTree', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires the root artifact to exist', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findUnique.mockResolvedValue(null);
    const caller = await buildCaller(prisma);

    await expect(caller.getTree({ artifactId: 'missing' })).rejects.toThrow(/not found/i);
  });

  it('returns flat artifacts + edges on success', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findUnique.mockResolvedValue({
      id: 'r', module: 'SOCIAL', type: 'POST', ownerId: 'u1',
    });
    descendantsOf.mockResolvedValue({
      artifacts: [
        { id: 'r', module: 'SOCIAL', ownerId: 'u1' },
        { id: 'c', module: 'SOCIAL', ownerId: 'u1' },
      ],
      edges: [{ id: 'e1', sourceId: 'r', targetId: 'c', relationshipType: 'PARENT_OF' }],
    });
    const caller = await buildCaller(prisma);

    const result = await caller.getTree({ artifactId: 'r' });
    expect(result.artifacts).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(descendantsOf).toHaveBeenCalledWith(prisma, { rootId: 'r', maxDepth: 10 });
  });

  it('filters out artifacts the caller cannot read', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findUnique.mockResolvedValue({ id: 'r', module: 'SOCIAL', ownerId: 'u1' });
    descendantsOf.mockResolvedValue({
      artifacts: [
        { id: 'r', module: 'SOCIAL', ownerId: 'u1' },
        { id: 'c', module: 'EMAIL', ownerId: 'someone-else' }, // agency cannot read EMAIL
      ],
      edges: [{ id: 'e1', sourceId: 'r', targetId: 'c', relationshipType: 'PARENT_OF' }],
    });
    const caller = await buildCaller(prisma, { id: 'u-agency', role: 'AGENCY' });

    const result = await caller.getTree({ artifactId: 'r' });
    expect(result.artifacts.map((a) => a.id)).toEqual(['r']); // EMAIL child pruned
    expect(result.edges).toHaveLength(0); // edge referencing unreadable artifact pruned
  });
});

describe('hub.traceLineage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns lineageOf helper output filtered by readability', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findUnique.mockResolvedValue({ id: 'a', module: 'SOCIAL' });
    lineageOf.mockResolvedValue([
      { id: 'a', module: 'SOCIAL' },
      { id: 'b', module: 'SOCIAL' },
    ]);
    const caller = await buildCaller(prisma);
    const result = await caller.traceLineage({ artifactId: 'a' });
    expect(result).toHaveLength(2);
    expect(lineageOf).toHaveBeenCalledWith(prisma, { artifactId: 'a', maxDepth: 10 });
  });
});

describe('hub.findArtifact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs ILIKE on title with optional filters and cursor pagination', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findMany.mockResolvedValue([
      { id: 'a1', module: 'SOCIAL', title: 'hello' },
      { id: 'a2', module: 'SOCIAL', title: 'hello 2' },
      { id: 'a3', module: 'SOCIAL', title: 'hello 3' }, // triggers nextCursor
    ]);
    const caller = await buildCaller(prisma);

    const result = await caller.findArtifact({ q: 'hello', limit: 2 });
    expect(prisma.artifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: { contains: 'hello', mode: 'insensitive' },
          archivedAt: null,
        }),
        take: 3,
      }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('a3');
  });

  it('applies read policy after fetch', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findMany.mockResolvedValue([
      { id: 'a1', module: 'EMAIL', ownerId: 'other' }, // AGENCY can't read
      { id: 'a2', module: 'SOCIAL', ownerId: 'other' },
    ]);
    const caller = await buildCaller(prisma, { id: 'u1', role: 'AGENCY' });

    const result = await caller.findArtifact({ q: 'x' });
    expect(result.items.map((a) => a.id)).toEqual(['a2']);
  });
});

describe('hub.whatAmIWorkingOn', () => {
  it('queries artifacts where ownerId matches current user, excluding archived', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findMany.mockResolvedValue([{ id: 'x' }]);
    const caller = await buildCaller(prisma, { id: 'me', role: 'INTERNAL' });
    await caller.whatAmIWorkingOn();

    expect(prisma.artifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'me', archivedAt: null } }),
    );
  });
});

describe('hub.link', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts a relationship and writes an audit log', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findUnique
      .mockResolvedValueOnce({ id: 'a', module: 'SOCIAL', ownerId: 'u1' })
      .mockResolvedValueOnce({ id: 'b', module: 'SOCIAL', ownerId: 'u1' });
    prisma.artifactRelationship.upsert.mockResolvedValue({ id: 'e1' });
    const caller = await buildCaller(prisma);

    const result = await caller.link({ sourceId: 'a', targetId: 'b', relationshipType: 'RELATES_TO' });
    expect(result).toEqual({ id: 'e1' });
    expect(prisma.artifactRelationship.upsert).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects self-links', async () => {
    const prisma = makeMockPrisma();
    const caller = await buildCaller(prisma);
    await expect(
      caller.link({ sourceId: 'a', targetId: 'a', relationshipType: 'RELATES_TO' }),
    ).rejects.toThrow(/self-links/i);
  });

  it('FORBIDDEN when AGENCY cannot write source artifact', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findUnique.mockResolvedValue({ id: 'a', module: 'SOCIAL', ownerId: 'other' });
    const caller = await buildCaller(prisma, { id: 'u-agency', role: 'AGENCY' });

    await expect(
      caller.link({ sourceId: 'a', targetId: 'b', relationshipType: 'RELATES_TO' }),
    ).rejects.toThrow(/authorized/i);
  });
});

describe('hub.unlink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires confirm: true (Zod validation)', async () => {
    const prisma = makeMockPrisma();
    const caller = await buildCaller(prisma);
    await expect(
      caller.unlink({ sourceId: 'a', targetId: 'b', relationshipType: 'RELATES_TO' }),
    ).rejects.toThrow();
  });

  it('soft-deletes the edge with confirm: true', async () => {
    const prisma = makeMockPrisma();
    prisma.artifactRelationship.updateMany.mockResolvedValue({ count: 1 });
    const caller = await buildCaller(prisma);

    const result = await caller.unlink({
      sourceId: 'a', targetId: 'b', relationshipType: 'RELATES_TO', confirm: true,
    });
    expect(result).toEqual({ archived: 1 });
    expect(prisma.artifactRelationship.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: null }),
        data: { archivedAt: expect.any(Date) },
      }),
    );
  });

  it('NOT_FOUND when no matching edge', async () => {
    const prisma = makeMockPrisma();
    prisma.artifactRelationship.updateMany.mockResolvedValue({ count: 0 });
    const caller = await buildCaller(prisma);
    await expect(
      caller.unlink({ sourceId: 'a', targetId: 'b', relationshipType: 'RELATES_TO', confirm: true }),
    ).rejects.toThrow(/not found|already archived/i);
  });
});

describe('hub.updateArtifact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows INTERNAL to change title/status', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findUnique.mockResolvedValue({
      id: 'a', module: 'GTM', type: 'PROJECT', ownerId: 'u1', entityId: 'proj-1',
    });
    prisma.artifact.update.mockResolvedValue({ id: 'a', title: 'New', status: 'ACTIVE' });
    const caller = await buildCaller(prisma, { id: 'u2', role: 'INTERNAL' });

    await caller.updateArtifact({ id: 'a', title: 'New', status: 'ACTIVE' });

    // Mirror back onto the module row (GtmProject: title→name)
    expect(prisma.gtmProject.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: { name: 'New', status: 'ACTIVE' },
    });
  });

  it('FORBIDDEN when non-ADMIN tries to flip type', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findUnique.mockResolvedValue({
      id: 'a', module: 'GTM', ownerId: 'u-internal',
    });
    const caller = await buildCaller(prisma, { id: 'u-internal', role: 'INTERNAL' });

    await expect(
      caller.updateArtifact({ id: 'a', type: 'CAMPAIGN' }),
    ).rejects.toThrow(/ADMIN/i);
  });

  it('ADMIN can flip type', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findUnique.mockResolvedValue({
      id: 'a', module: 'GTM', type: 'PROJECT', ownerId: 'u1', entityId: 'proj-1',
    });
    prisma.artifact.update.mockResolvedValue({ id: 'a', type: 'CAMPAIGN' });
    const caller = await buildCaller(prisma, { id: 'admin', role: 'ADMIN' });

    const result = await caller.updateArtifact({ id: 'a', type: 'CAMPAIGN' });
    expect(result.type).toBe('CAMPAIGN');
  });
});

describe('hub.archiveArtifact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires confirm: true', async () => {
    const prisma = makeMockPrisma();
    const caller = await buildCaller(prisma);
    await expect(caller.archiveArtifact({ id: 'a' })).rejects.toThrow();
  });

  it('sets archivedAt when confirmed', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findUnique.mockResolvedValue({
      id: 'a', module: 'GTM', ownerId: 'u1', archivedAt: null,
    });
    prisma.artifact.update.mockResolvedValue({ id: 'a', archivedAt: new Date() });
    const caller = await buildCaller(prisma);

    await caller.archiveArtifact({ id: 'a', confirm: true });
    expect(prisma.artifact.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it('CONFLICT when already archived', async () => {
    const prisma = makeMockPrisma();
    prisma.artifact.findUnique.mockResolvedValue({
      id: 'a', module: 'GTM', ownerId: 'u1', archivedAt: new Date(),
    });
    const caller = await buildCaller(prisma);
    await expect(caller.archiveArtifact({ id: 'a', confirm: true })).rejects.toThrow(/already archived/i);
  });
});
