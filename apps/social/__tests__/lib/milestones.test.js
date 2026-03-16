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

describe.skip('milestonesRouter', () => {
  let milestonesRouter;
  let prisma;

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await import('@/lib/db');
    prisma = db.prisma;
    const mod = await import('@/lib/routers/milestones.js');
    milestonesRouter = mod.milestonesRouter;
  });

  it('list: returns all milestones ordered by startDate desc', async () => {
    // Will test that findMany is called with orderBy: { startDate: 'desc' }
  });

  it('create: creates milestone with name, description, startDate, endDate', async () => {
    // Will test milestone creation with required fields
  });

  it('create: rejects endDate before startDate', async () => {
    // Will test validation that endDate >= startDate
  });

  it('update: updates milestone fields', async () => {
    // Will test partial update of milestone by id
  });

  it('delete: removes milestone by id', async () => {
    // Will test deletion by id
  });
});
