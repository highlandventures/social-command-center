import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@prisma/client', () => ({
  Prisma: { sql: (strings, ...values) => ({ strings, values }) },
}));

import { descendantsOf, lineageOf } from '@/lib/artifacts/sql';

function makeMockPrisma() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    artifactRelationship: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

describe('descendantsOf', () => {
  let prisma;
  beforeEach(() => {
    prisma = makeMockPrisma();
  });

  it('calls $queryRaw with the rootId bound as a parameter', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'art_root' }]);
    await descendantsOf(prisma, { rootId: 'art_root', maxDepth: 5 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const { values } = prisma.$queryRaw.mock.calls[0][0];
    expect(values).toContain('art_root');
    expect(values).toContain(5);
  });

  it('clamps maxDepth to [1, 20]', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await descendantsOf(prisma, { rootId: 'x', maxDepth: 999 });
    expect(prisma.$queryRaw.mock.calls[0][0].values).toContain(20);

    await descendantsOf(prisma, { rootId: 'x', maxDepth: 0 });
    expect(prisma.$queryRaw.mock.calls[1][0].values).toContain(1);

    await descendantsOf(prisma, { rootId: 'x', maxDepth: undefined });
    expect(prisma.$queryRaw.mock.calls[2][0].values).toContain(10); // default
  });

  it('returns { artifacts: [], edges: [] } when root has no matches', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await descendantsOf(prisma, { rootId: 'missing' });
    expect(result).toEqual({ artifacts: [], edges: [] });
    expect(prisma.artifactRelationship.findMany).not.toHaveBeenCalled();
  });

  it('fetches edges scoped to returned artifact ids', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    prisma.artifactRelationship.findMany.mockResolvedValue([
      { id: 'e1', sourceId: 'a', targetId: 'b', relationshipType: 'PARENT_OF' },
    ]);
    const result = await descendantsOf(prisma, { rootId: 'a' });

    expect(prisma.artifactRelationship.findMany).toHaveBeenCalledWith({
      where: {
        sourceId: { in: ['a', 'b', 'c'] },
        targetId: { in: ['a', 'b', 'c'] },
        archivedAt: null,
      },
      select: { id: true, sourceId: true, targetId: true, relationshipType: true },
    });
    expect(result.edges).toHaveLength(1);
    expect(result.artifacts).toHaveLength(3);
  });
});

describe('lineageOf', () => {
  let prisma;
  beforeEach(() => {
    prisma = makeMockPrisma();
  });

  it('calls $queryRaw with artifactId bound as a parameter', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await lineageOf(prisma, { artifactId: 'art_x', maxDepth: 3 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const { values } = prisma.$queryRaw.mock.calls[0][0];
    expect(values).toContain('art_x');
    expect(values).toContain(3);
  });

  it('clamps maxDepth to [1, 20]', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await lineageOf(prisma, { artifactId: 'x', maxDepth: 50 });
    expect(prisma.$queryRaw.mock.calls[0][0].values).toContain(20);
  });

  it('returns the raw result from $queryRaw', async () => {
    const scripted = [{ id: 'd', depth: 0 }, { id: 'c', depth: 1 }, { id: 'b', depth: 2 }, { id: 'a', depth: 3 }];
    prisma.$queryRaw.mockResolvedValue(scripted);

    const result = await lineageOf(prisma, { artifactId: 'd' });
    expect(result).toEqual(scripted);
  });
});
