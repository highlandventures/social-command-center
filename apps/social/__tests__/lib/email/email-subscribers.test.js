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
  emailSubscriber: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

describe('emailSubscribersRouter', () => {
  let emailSubscribersRouter;
  let caller;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/lib/routers/email-subscribers');
    emailSubscribersRouter = mod.emailSubscribersRouter;
    caller = emailSubscribersRouter.createCaller({
      prisma: mockPrisma,
      kv: {},
      session: { user: { id: 'user-1' } },
      user: { id: 'user-1' },
    });
  });

  describe('list', () => {
    it('returns subscribers with cursor pagination', async () => {
      const mockSubs = Array.from({ length: 3 }, (_, i) => ({
        id: `sub-${i}`,
        email: `user${i}@example.com`,
        status: 'ACTIVE',
        listId: 'list-1',
      }));
      mockPrisma.emailSubscriber.findMany.mockResolvedValue(mockSubs);

      const result = await caller.list({ listId: 'list-1', limit: 50 });

      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBeUndefined();
      expect(mockPrisma.emailSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ listId: 'list-1' }),
          take: 51,
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('returns nextCursor when more items exist', async () => {
      // Return limit+1 items so the router detects there's a next page
      const mockSubs = Array.from({ length: 4 }, (_, i) => ({
        id: `sub-${i}`,
        email: `user${i}@example.com`,
        status: 'ACTIVE',
        listId: 'list-1',
      }));
      mockPrisma.emailSubscriber.findMany.mockResolvedValue(mockSubs);

      const result = await caller.list({ listId: 'list-1', limit: 3 });

      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBe('sub-3');
    });

    it('filters by status when provided', async () => {
      mockPrisma.emailSubscriber.findMany.mockResolvedValue([]);

      await caller.list({ listId: 'list-1', status: 'BOUNCED' });

      expect(mockPrisma.emailSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ listId: 'list-1', status: 'BOUNCED' }),
        })
      );
    });

    it('applies search filter on email/firstName/lastName', async () => {
      mockPrisma.emailSubscriber.findMany.mockResolvedValue([]);

      await caller.list({ listId: 'list-1', search: 'john' });

      const callArgs = mockPrisma.emailSubscriber.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('OR');
      expect(callArgs.where.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ email: { contains: 'john', mode: 'insensitive' } }),
          expect.objectContaining({ firstName: { contains: 'john', mode: 'insensitive' } }),
          expect.objectContaining({ lastName: { contains: 'john', mode: 'insensitive' } }),
        ])
      );
    });

    it('uses cursor for pagination', async () => {
      mockPrisma.emailSubscriber.findMany.mockResolvedValue([]);

      await caller.list({ listId: 'list-1', cursor: 'sub-5' });

      expect(mockPrisma.emailSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'sub-5' },
          skip: 1,
        })
      );
    });
  });

  describe('create', () => {
    it('creates a subscriber with email normalized to lowercase', async () => {
      const mockSub = { id: 'sub-new', email: 'test@example.com', status: 'ACTIVE', listId: 'list-1' };
      mockPrisma.emailSubscriber.create.mockResolvedValue(mockSub);

      const result = await caller.create({
        listId: 'list-1',
        email: 'Test@Example.COM',
      });

      expect(result).toEqual(mockSub);
      expect(mockPrisma.emailSubscriber.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          listId: 'list-1',
          email: 'test@example.com',
          status: 'ACTIVE',
        }),
      });
    });

    it('accepts optional firstName and lastName', async () => {
      const mockSub = { id: 'sub-new', email: 'j@e.com', firstName: 'John', lastName: 'Doe' };
      mockPrisma.emailSubscriber.create.mockResolvedValue(mockSub);

      await caller.create({
        listId: 'list-1',
        email: 'j@e.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(mockPrisma.emailSubscriber.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
        }),
      });
    });

    it('rejects invalid email', async () => {
      await expect(
        caller.create({ listId: 'list-1', email: 'not-an-email' })
      ).rejects.toThrow();
    });
  });

  describe('importCSV', () => {
    it('imports subscribers with skipDuplicates and returns counts', async () => {
      mockPrisma.emailSubscriber.createMany.mockResolvedValue({ count: 2 });

      const result = await caller.importCSV({
        listId: 'list-1',
        subscribers: [
          { email: 'a@b.com', firstName: 'A' },
          { email: 'C@D.com' },
        ],
      });

      expect(result).toEqual({ imported: 2, total: 2 });
      expect(mockPrisma.emailSubscriber.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ listId: 'list-1', email: 'a@b.com', status: 'ACTIVE' }),
          expect.objectContaining({ listId: 'list-1', email: 'c@d.com', status: 'ACTIVE' }),
        ]),
        skipDuplicates: true,
      });
    });

    it('rejects invalid emails in the array', async () => {
      await expect(
        caller.importCSV({
          listId: 'list-1',
          subscribers: [{ email: 'not-email' }],
        })
      ).rejects.toThrow();
    });
  });

  describe('updateStatus', () => {
    it('updates subscriber status', async () => {
      const mockSub = { id: 'sub-1', status: 'UNSUBSCRIBED' };
      mockPrisma.emailSubscriber.update.mockResolvedValue(mockSub);

      const result = await caller.updateStatus({ id: 'sub-1', status: 'UNSUBSCRIBED' });

      expect(result).toEqual(mockSub);
      expect(mockPrisma.emailSubscriber.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { status: 'UNSUBSCRIBED' },
      });
    });

    it('rejects invalid status', async () => {
      await expect(
        caller.updateStatus({ id: 'sub-1', status: 'INVALID' })
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('deletes a subscriber by id', async () => {
      mockPrisma.emailSubscriber.delete.mockResolvedValue({ id: 'sub-1' });

      const result = await caller.delete({ id: 'sub-1' });

      expect(result).toEqual({ id: 'sub-1' });
      expect(mockPrisma.emailSubscriber.delete).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
      });
    });
  });
});
