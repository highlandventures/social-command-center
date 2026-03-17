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

// Mock AI module
vi.mock('@/lib/ai', () => ({
  generateInsight: vi.fn(),
}));

const mockPrisma = {
  emailCampaign: {
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  emailSubscriber: {
    findMany: vi.fn(),
  },
  emailSend: {
    createMany: vi.fn(),
  },
};

describe('emailCampaignsRouter', () => {
  let emailCampaignsRouter;
  let caller;
  let generateInsight;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/lib/routers/email-campaigns');
    emailCampaignsRouter = mod.emailCampaignsRouter;
    caller = emailCampaignsRouter.createCaller({
      prisma: mockPrisma,
      kv: {},
      session: { user: { id: 'user-1', email: 'test@example.com', role: 'ADMIN' } },
      user: { id: 'user-1' },
    });
    const aiMod = await import('@/lib/ai');
    generateInsight = aiMod.generateInsight;
  });

  describe('list', () => {
    it('returns campaigns with list, template, and send count', async () => {
      const mockCampaigns = [
        {
          id: 'camp-1',
          name: 'Welcome',
          list: { id: 'list-1', name: 'Main', _count: { subscribers: 50 } },
          template: { id: 'tpl-1', name: 'Newsletter' },
          _count: { sends: 25 },
        },
      ];
      mockPrisma.emailCampaign.findMany.mockResolvedValue(mockCampaigns);

      const result = await caller.list();

      expect(result).toEqual(mockCampaigns);
      expect(mockPrisma.emailCampaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          include: expect.objectContaining({
            list: expect.objectContaining({
              select: expect.objectContaining({ id: true, name: true }),
            }),
            template: expect.objectContaining({
              select: expect.objectContaining({ id: true, name: true }),
            }),
            _count: { select: { sends: true } },
          }),
        })
      );
    });
  });

  describe('getById', () => {
    it('returns a campaign with list and template details', async () => {
      const mockCampaign = { id: 'camp-1', name: 'Welcome', list: {}, template: {} };
      mockPrisma.emailCampaign.findUniqueOrThrow.mockResolvedValue(mockCampaign);

      const result = await caller.getById({ id: 'camp-1' });

      expect(result).toEqual(mockCampaign);
      expect(mockPrisma.emailCampaign.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'camp-1' } })
      );
    });
  });

  describe('create', () => {
    it('creates a DRAFT campaign with createdById', async () => {
      const mockCampaign = { id: 'camp-new', name: 'New Campaign', status: 'DRAFT', createdById: 'user-1' };
      mockPrisma.emailCampaign.create.mockResolvedValue(mockCampaign);

      const result = await caller.create({
        name: 'New Campaign',
        subject: 'Hello!',
        listId: 'list-1',
      });

      expect(result).toEqual(mockCampaign);
      expect(mockPrisma.emailCampaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Campaign',
          subject: 'Hello!',
          listId: 'list-1',
          status: 'DRAFT',
          createdById: 'user-1',
        }),
      });
    });
  });

  describe('update', () => {
    it('updates a DRAFT campaign using updateMany with status guard', async () => {
      mockPrisma.emailCampaign.updateMany.mockResolvedValue({ count: 1 });

      const result = await caller.update({ id: 'camp-1', name: 'Updated Name' });

      expect(result).toEqual({ count: 1 });
      expect(mockPrisma.emailCampaign.updateMany).toHaveBeenCalledWith({
        where: { id: 'camp-1', status: 'DRAFT' },
        data: { name: 'Updated Name' },
      });
    });

    it('throws CONFLICT when updating non-DRAFT campaign', async () => {
      mockPrisma.emailCampaign.updateMany.mockResolvedValue({ count: 0 });

      await expect(caller.update({ id: 'camp-1', name: 'Updated' })).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('deletes a DRAFT campaign using deleteMany with status guard', async () => {
      mockPrisma.emailCampaign.deleteMany.mockResolvedValue({ count: 1 });

      const result = await caller.delete({ id: 'camp-1' });

      expect(result).toEqual({ count: 1 });
      expect(mockPrisma.emailCampaign.deleteMany).toHaveBeenCalledWith({
        where: { id: 'camp-1', status: 'DRAFT' },
      });
    });

    it('throws CONFLICT when deleting non-DRAFT campaign', async () => {
      mockPrisma.emailCampaign.deleteMany.mockResolvedValue({ count: 0 });

      await expect(caller.delete({ id: 'camp-1' })).rejects.toThrow();
    });
  });

  describe('preview', () => {
    it('returns htmlContent and subject for a campaign', async () => {
      mockPrisma.emailCampaign.findUniqueOrThrow.mockResolvedValue({
        id: 'camp-1',
        htmlContent: '<p>Preview</p>',
        subject: 'Hello World',
      });

      const result = await caller.preview({ id: 'camp-1' });

      expect(result).toEqual({ htmlContent: '<p>Preview</p>', subject: 'Hello World' });
    });
  });

  describe('suggestContent', () => {
    it('calls generateInsight and returns subject lines and body suggestion', async () => {
      generateInsight.mockResolvedValue({
        subjectLines: ['Subject 1', 'Subject 2', 'Subject 3', 'Subject 4', 'Subject 5'],
        bodySuggestion: 'A compelling email body.',
      });

      const result = await caller.suggestContent({
        campaignName: 'Product Launch',
        templateName: 'Announcement',
        htmlContent: '<p>Some content here</p>',
      });

      expect(result).toEqual({
        subjectLines: ['Subject 1', 'Subject 2', 'Subject 3', 'Subject 4', 'Subject 5'],
        bodySuggestion: 'A compelling email body.',
      });
      expect(generateInsight).toHaveBeenCalledWith(
        'email_content_suggestions',
        expect.any(String),
        expect.objectContaining({
          systemPrompt: expect.stringContaining('email marketing expert'),
          maxTokens: 512,
        })
      );
    });
  });

  describe('schedule', () => {
    it('schedules a DRAFT campaign with future date as SCHEDULED', async () => {
      const futureDate = new Date('2026-04-01T10:00:00Z');
      mockPrisma.emailCampaign.updateMany.mockResolvedValue({ count: 1 });

      const result = await caller.schedule({ id: 'camp-1', scheduledFor: futureDate.toISOString() });

      expect(result).toEqual(expect.objectContaining({ status: 'SCHEDULED' }));
      expect(mockPrisma.emailCampaign.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'camp-1', status: 'DRAFT' },
          data: expect.objectContaining({ status: 'SCHEDULED' }),
        })
      );
    });

    it('sends immediately when no scheduledFor, creating EmailSend records', async () => {
      mockPrisma.emailCampaign.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.emailCampaign.findUniqueOrThrow.mockResolvedValue({
        id: 'camp-1',
        listId: 'list-1',
      });
      mockPrisma.emailSubscriber.findMany.mockResolvedValue([
        { id: 'sub-1' },
        { id: 'sub-2' },
        { id: 'sub-3' },
      ]);
      mockPrisma.emailSend.createMany.mockResolvedValue({ count: 3 });

      const result = await caller.schedule({ id: 'camp-1' });

      expect(result).toEqual(expect.objectContaining({ status: 'SENDING' }));
      expect(mockPrisma.emailSubscriber.findMany).toHaveBeenCalledWith({
        where: { listId: 'list-1', status: 'ACTIVE' },
        select: { id: true },
      });
      expect(mockPrisma.emailSend.createMany).toHaveBeenCalledWith({
        data: [
          { campaignId: 'camp-1', subscriberId: 'sub-1', status: 'QUEUED' },
          { campaignId: 'camp-1', subscriberId: 'sub-2', status: 'QUEUED' },
          { campaignId: 'camp-1', subscriberId: 'sub-3', status: 'QUEUED' },
        ],
        skipDuplicates: true,
      });
    });

    it('throws CONFLICT when scheduling non-DRAFT campaign', async () => {
      mockPrisma.emailCampaign.updateMany.mockResolvedValue({ count: 0 });

      await expect(caller.schedule({ id: 'camp-1' })).rejects.toThrow();
    });
  });
});
