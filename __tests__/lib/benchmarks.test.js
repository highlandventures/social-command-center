import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock redis before importing the router
vi.mock('@/lib/redis', () => ({
  cachedFetch: vi.fn(),
  CACHE_TTL: {},
  kv: { get: vi.fn(), set: vi.fn() },
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

describe('benchmarks router', () => {
  let benchmarksRouter;
  let cachedFetch;

  beforeEach(async () => {
    const redis = await import('@/lib/redis');
    cachedFetch = redis.cachedFetch;
    const mod = await import('@/lib/routers/benchmarks');
    benchmarksRouter = mod.benchmarksRouter;
  });

  describe('dashboard', () => {
    it('returns seed data when Redis is empty', async () => {
      cachedFetch.mockResolvedValue(null);

      const caller = benchmarksRouter.createCaller({ prisma: {}, kv: {}, session: { user: {} } });
      const result = await caller.dashboard();

      expect(result.status).toBe('ok');
      expect(result.isSeed).toBe(true);
      expect(result.meta.source).toBe('seed_defaults');
      expect(result.meta.universe_size).toBe(17);
      expect(result.benchmarks).toBeDefined();
      expect(result.yourAccounts).toHaveLength(3);
      expect(result.universe).toHaveLength(17);
    });

    it('returns live data when Redis has data', async () => {
      const liveData = {
        meta: { generated_at: '2026-03-15T00:00:00Z', universe_size: 20, source: 'pipeline' },
        benchmarks: { engagement_rate_pct: { full_universe: { p50_median: 2.0 }, top_10_pct: { mean: 4.0 } } },
        your_accounts: [{ handle: '@Test', display_name: 'Test', engagement_rate_pct: 1.5 }],
        your_accounts_vs_benchmarks: [],
        universe_accounts: [],
      };
      cachedFetch.mockResolvedValue(liveData);

      const caller = benchmarksRouter.createCaller({ prisma: {}, kv: {}, session: { user: {} } });
      const result = await caller.dashboard();

      expect(result.isSeed).toBe(false);
      expect(result.meta.source).toBe('pipeline');
      expect(result.yourAccounts).toHaveLength(1);
    });
  });

  describe('summary', () => {
    it('extracts correct summary values from seed data', async () => {
      cachedFetch.mockResolvedValue(null);

      const caller = benchmarksRouter.createCaller({ prisma: {}, kv: {}, session: { user: {} } });
      const result = await caller.summary();

      expect(result.universeSize).toBe(17);
      expect(result.top10PctEngRate).toBe(3.5);
      expect(result.medianEngRate).toBe(1.8);
      expect(result.top10PctImpressions).toBe(45000);
      expect(result.medianImpressions).toBe(12000);
      expect(result.accounts).toHaveLength(3);
      expect(result.accounts[0].handle).toBe('@Figure');
      expect(result.comparisons).toHaveLength(3);
    });

    it('maps account comparisons correctly', async () => {
      cachedFetch.mockResolvedValue(null);

      const caller = benchmarksRouter.createCaller({ prisma: {}, kv: {}, session: { user: {} } });
      const result = await caller.summary();

      const figureComp = result.comparisons.find(c => c.handle === '@Figure');
      expect(figureComp).toBeDefined();
      expect(figureComp.engVsMedian).toBe(-41.7);
      expect(figureComp.engVsTop10).toBe(-70.0);
    });
  });
});
