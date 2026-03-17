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
  emailTemplate: {
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

describe('emailTemplatesRouter', () => {
  let emailTemplatesRouter;
  let caller;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/lib/routers/email-templates');
    emailTemplatesRouter = mod.emailTemplatesRouter;
    caller = emailTemplatesRouter.createCaller({
      prisma: mockPrisma,
      kv: {},
      session: { user: { id: 'user-1', email: 'test@example.com', role: 'ADMIN' } },
      user: { id: 'user-1' },
    });
  });

  describe('list', () => {
    it('returns templates ordered by createdAt desc with campaign count', async () => {
      const mockTemplates = [
        { id: 'tpl-1', name: 'Newsletter', _count: { campaigns: 3 } },
        { id: 'tpl-2', name: 'Promo', _count: { campaigns: 0 } },
      ];
      mockPrisma.emailTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await caller.list();

      expect(result).toEqual(mockTemplates);
      expect(mockPrisma.emailTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { campaigns: true } } },
        })
      );
    });
  });

  describe('getById', () => {
    it('returns a single template by id', async () => {
      const mockTemplate = { id: 'tpl-1', name: 'Newsletter', htmlBody: '<p>Hello</p>' };
      mockPrisma.emailTemplate.findUniqueOrThrow.mockResolvedValue(mockTemplate);

      const result = await caller.getById({ id: 'tpl-1' });

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.emailTemplate.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
      });
    });
  });

  describe('create', () => {
    it('creates a template with createdById from ctx.user.id', async () => {
      const mockTemplate = { id: 'tpl-new', name: 'My Template', htmlBody: '<p>Body</p>', createdById: 'user-1' };
      mockPrisma.emailTemplate.create.mockResolvedValue(mockTemplate);

      const result = await caller.create({ name: 'My Template', htmlBody: '<p>Body</p>' });

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.emailTemplate.create).toHaveBeenCalledWith({
        data: {
          name: 'My Template',
          subject: undefined,
          htmlBody: '<p>Body</p>',
          category: undefined,
          createdById: 'user-1',
        },
      });
    });

    it('creates a template with optional subject and category', async () => {
      const mockTemplate = { id: 'tpl-new', name: 'Promo', subject: 'Sale!', htmlBody: '<p>Buy</p>', category: 'marketing' };
      mockPrisma.emailTemplate.create.mockResolvedValue(mockTemplate);

      const result = await caller.create({ name: 'Promo', subject: 'Sale!', htmlBody: '<p>Buy</p>', category: 'marketing' });

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.emailTemplate.create).toHaveBeenCalledWith({
        data: {
          name: 'Promo',
          subject: 'Sale!',
          htmlBody: '<p>Buy</p>',
          category: 'marketing',
          createdById: 'user-1',
        },
      });
    });

    it('rejects empty name', async () => {
      await expect(caller.create({ name: '', htmlBody: '<p>Body</p>' })).rejects.toThrow();
    });

    it('rejects name longer than 100 chars', async () => {
      await expect(caller.create({ name: 'x'.repeat(101), htmlBody: '<p>Body</p>' })).rejects.toThrow();
    });

    it('rejects empty htmlBody', async () => {
      await expect(caller.create({ name: 'Test', htmlBody: '' })).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('updates specified fields only', async () => {
      const mockTemplate = { id: 'tpl-1', name: 'Updated' };
      mockPrisma.emailTemplate.update.mockResolvedValue(mockTemplate);

      const result = await caller.update({ id: 'tpl-1', name: 'Updated' });

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.emailTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
        data: { name: 'Updated' },
      });
    });
  });

  describe('delete', () => {
    it('deletes a template by id', async () => {
      mockPrisma.emailTemplate.delete.mockResolvedValue({ id: 'tpl-1' });

      const result = await caller.delete({ id: 'tpl-1' });

      expect(result).toEqual({ id: 'tpl-1' });
      expect(mockPrisma.emailTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
      });
    });
  });

  describe('duplicate', () => {
    it('creates a copy with "(Copy)" suffix and isStarter false', async () => {
      const original = {
        id: 'tpl-1',
        name: 'Newsletter',
        subject: 'Weekly Update',
        htmlBody: '<p>Content</p>',
        category: 'newsletter',
        isStarter: true,
      };
      mockPrisma.emailTemplate.findUniqueOrThrow.mockResolvedValue(original);
      const copied = { ...original, id: 'tpl-copy', name: 'Newsletter (Copy)', isStarter: false, createdById: 'user-1' };
      mockPrisma.emailTemplate.create.mockResolvedValue(copied);

      const result = await caller.duplicate({ id: 'tpl-1' });

      expect(result).toEqual(copied);
      expect(mockPrisma.emailTemplate.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
      });
      expect(mockPrisma.emailTemplate.create).toHaveBeenCalledWith({
        data: {
          name: 'Newsletter (Copy)',
          subject: 'Weekly Update',
          htmlBody: '<p>Content</p>',
          category: 'newsletter',
          isStarter: false,
          createdById: 'user-1',
        },
      });
    });
  });
});
