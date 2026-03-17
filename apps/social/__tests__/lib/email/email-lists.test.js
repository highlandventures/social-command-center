import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock trpc to provide real router/protectedProcedure without auth middleware
vi.mock('@/lib/trpc', async () => {
  const { initTRPC } = await import('@trpc/server');
  const t = initTRPC.create();
  return {
    router: t.router,
    protectedProcedure: t.procedure,
  };
});

const mockPrisma = {
  emailList: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

describe('emailListsRouter', () => {
  let emailListsRouter;
  let caller;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/lib/routers/email-lists');
    emailListsRouter = mod.emailListsRouter;
    caller = emailListsRouter.createCaller({
      prisma: mockPrisma,
      kv: {},
      session: { user: { id: 'user-1', email: 'test@example.com', role: 'ADMIN' } },
      user: { id: 'user-1' },
    });
  });

  describe('list', () => {
    it('returns lists ordered by createdAt desc with subscriber count', async () => {
      const mockLists = [
        { id: 'list-1', name: 'Newsletter', _count: { subscribers: 5 } },
        { id: 'list-2', name: 'Promo', _count: { subscribers: 10 } },
      ];
      mockPrisma.emailList.findMany.mockResolvedValue(mockLists);

      const result = await caller.list();

      expect(result).toEqual(mockLists);
      expect(mockPrisma.emailList.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { subscribers: true } } },
        })
      );
    });
  });

  describe('create', () => {
    it('creates a list with name and sets createdById from ctx.user.id', async () => {
      const mockList = { id: 'list-new', name: 'My List', createdById: 'user-1' };
      mockPrisma.emailList.create.mockResolvedValue(mockList);

      const result = await caller.create({ name: 'My List' });

      expect(result).toEqual(mockList);
      expect(mockPrisma.emailList.create).toHaveBeenCalledWith({
        data: { name: 'My List', description: undefined, createdById: 'user-1' },
      });
    });

    it('creates a list with optional description', async () => {
      const mockList = { id: 'list-new', name: 'My List', description: 'A description' };
      mockPrisma.emailList.create.mockResolvedValue(mockList);

      const result = await caller.create({ name: 'My List', description: 'A description' });

      expect(result).toEqual(mockList);
      expect(mockPrisma.emailList.create).toHaveBeenCalledWith({
        data: { name: 'My List', description: 'A description', createdById: 'user-1' },
      });
    });

    it('rejects empty name', async () => {
      await expect(caller.create({ name: '' })).rejects.toThrow();
    });

    it('rejects name longer than 100 chars', async () => {
      await expect(caller.create({ name: 'x'.repeat(101) })).rejects.toThrow();
    });

    it('rejects description longer than 500 chars', async () => {
      await expect(caller.create({ name: 'Test', description: 'x'.repeat(501) })).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('updates a list by id', async () => {
      const mockList = { id: 'list-1', name: 'Updated', description: 'New desc' };
      mockPrisma.emailList.update.mockResolvedValue(mockList);

      const result = await caller.update({ id: 'list-1', name: 'Updated', description: 'New desc' });

      expect(result).toEqual(mockList);
      expect(mockPrisma.emailList.update).toHaveBeenCalledWith({
        where: { id: 'list-1' },
        data: { name: 'Updated', description: 'New desc' },
      });
    });
  });

  describe('delete', () => {
    it('deletes a list by id', async () => {
      mockPrisma.emailList.delete.mockResolvedValue({ id: 'list-1' });

      const result = await caller.delete({ id: 'list-1' });

      expect(result).toEqual({ id: 'list-1' });
      expect(mockPrisma.emailList.delete).toHaveBeenCalledWith({
        where: { id: 'list-1' },
      });
    });
  });
});
