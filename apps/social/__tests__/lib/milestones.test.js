import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db before importing the router
vi.mock('@/lib/db', () => ({
  prisma: {
    milestone: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock trpc to provide real router/protectedProcedure
vi.mock('@/lib/trpc', async () => {
  const { initTRPC } = await import('@trpc/server');
  const t = initTRPC.create();
  return {
    router: t.router,
    protectedProcedure: t.procedure,
  };
});

describe('milestonesRouter', () => {
  let caller;
  let prisma;

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await import('@/lib/db');
    prisma = db.prisma;
    const mod = await import('@/lib/routers/milestones.js');
    const milestonesRouter = mod.milestonesRouter;

    caller = milestonesRouter.createCaller({
      prisma,
      user: { id: 'user-1' },
      session: { user: { id: 'user-1' } },
    });
  });

  it('list: returns all milestones ordered by startDate desc', async () => {
    const milestones = [
      { id: 'm-1', name: 'Q1 Campaign', startDate: new Date('2026-03-01'), endDate: new Date('2026-03-31') },
      { id: 'm-2', name: 'Launch Week', startDate: new Date('2026-02-15'), endDate: new Date('2026-02-22') },
    ];
    prisma.milestone.findMany.mockResolvedValue(milestones);

    const result = await caller.list();
    expect(result).toEqual(milestones);
    expect(prisma.milestone.findMany).toHaveBeenCalledWith({
      orderBy: { startDate: 'desc' },
    });
  });

  it('create: creates milestone with name, description, startDate, endDate', async () => {
    const created = {
      id: 'm-new',
      name: 'Spring Campaign',
      description: 'Q2 push',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-30'),
      createdById: 'user-1',
    };
    prisma.milestone.create.mockResolvedValue(created);

    const result = await caller.create({
      name: 'Spring Campaign',
      description: 'Q2 push',
      startDate: '2026-04-01T00:00:00Z',
      endDate: '2026-04-30T00:00:00Z',
    });
    expect(result).toEqual(created);
    expect(prisma.milestone.create).toHaveBeenCalledWith({
      data: {
        name: 'Spring Campaign',
        description: 'Q2 push',
        startDate: new Date('2026-04-01T00:00:00Z'),
        endDate: new Date('2026-04-30T00:00:00Z'),
        createdById: 'user-1',
      },
    });
  });

  it('create: rejects endDate before startDate', async () => {
    await expect(
      caller.create({
        name: 'Bad Range',
        startDate: '2026-04-30T00:00:00Z',
        endDate: '2026-04-01T00:00:00Z',
      })
    ).rejects.toThrow();
  });

  it('update: updates milestone fields', async () => {
    const updated = { id: 'm-1', name: 'Updated Name' };
    prisma.milestone.update.mockResolvedValue(updated);

    const result = await caller.update({ id: 'm-1', name: 'Updated Name' });
    expect(result.name).toBe('Updated Name');
    expect(prisma.milestone.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { name: 'Updated Name' },
    });
  });

  it('delete: removes milestone by id', async () => {
    prisma.milestone.delete.mockResolvedValue({ id: 'm-1' });

    const result = await caller.delete({ id: 'm-1' });
    expect(result.id).toBe('m-1');
    expect(prisma.milestone.delete).toHaveBeenCalledWith({
      where: { id: 'm-1' },
    });
  });
});
