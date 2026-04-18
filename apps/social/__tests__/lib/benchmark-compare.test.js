import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db before importing benchmark comparison module
vi.mock('@/lib/db', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
    },
    accountMetrics: {
      findMany: vi.fn(),
    },
    listeningHit: {
      findMany: vi.fn(),
    },
    milestone: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock AI to avoid Anthropic API calls
vi.mock('@/lib/ai', () => ({
  generateInsight: vi.fn().mockResolvedValue({}),
}));

describe('resolveComparisonPeriod', () => {
  let resolveComparisonPeriod;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/lib/benchmark-compare.js');
    resolveComparisonPeriod = mod.resolveComparisonPeriod;
  });

  it('resolves WoW to previous week date range', () => {
    const start = '2026-03-08T00:00:00Z';
    const end = '2026-03-15T00:00:00Z';
    const result = resolveComparisonPeriod(start, end, 'WoW');

    expect(result).not.toBeNull();
    // Previous period should be same duration, immediately before
    expect(result.start.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(result.end.toISOString()).toBe('2026-03-08T00:00:00.000Z');
  });

  it('resolves MoM to previous month date range', () => {
    const start = '2026-03-01T00:00:00Z';
    const end = '2026-03-31T00:00:00Z';
    const result = resolveComparisonPeriod(start, end, 'MoM');

    expect(result).not.toBeNull();
    // 30-day duration mirrored back
    const durationMs = new Date(end) - new Date(start);
    const expectedStart = new Date(new Date(start).getTime() - durationMs);
    expect(result.start.toISOString()).toBe(expectedStart.toISOString());
    expect(result.end.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('resolves QoQ to previous quarter date range', () => {
    const start = '2026-01-01T00:00:00Z';
    const end = '2026-04-01T00:00:00Z';
    const result = resolveComparisonPeriod(start, end, 'QoQ');

    expect(result).not.toBeNull();
    expect(result.end.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('resolves YoY to previous year date range', () => {
    const start = '2026-01-01T00:00:00Z';
    const end = '2026-12-31T00:00:00Z';
    const result = resolveComparisonPeriod(start, end, 'YoY');

    expect(result).not.toBeNull();
    expect(result.end.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns null for invalid comparison type', () => {
    const result = resolveComparisonPeriod('2026-03-01', '2026-03-08', 'INVALID');
    expect(result).toBeNull();
  });
});

describe('computeBenchmarkDeltas', () => {
  let computeBenchmarkDeltas;
  let prisma;

  // Sample posts with metrics for testing.
  // Phase 17-03: weighted-avg formula uses `engagements`, so derive it from
  // impressions * engRate/100 to keep the test stable.
  const mockPosts = (impressions, engRate) => [
    {
      id: 'p-1',
      content: 'Test post',
      contentType: 'POST',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-03-10'),
      metrics: [
        {
          impressions,
          engagements: Math.round((impressions * engRate) / 100),
          engagementRate: engRate,
          fetchedAt: new Date(),
        },
      ],
    },
  ];

  const mockAccountMetrics = (followers) => [
    { accountId: 'a-1', date: new Date('2026-03-08'), followers },
    { accountId: 'a-1', date: new Date('2026-03-14'), followers: followers + 100 },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await import('@/lib/db');
    prisma = db.prisma;
    const mod = await import('@/lib/benchmark-compare.js');
    computeBenchmarkDeltas = mod.computeBenchmarkDeltas;
  });

  it('computes KPI deltas between two periods', async () => {
    // Current period: 1000 impressions, 5% eng rate
    prisma.post.findMany
      .mockResolvedValueOnce(mockPosts(1000, 5.0))
      .mockResolvedValueOnce(mockPosts(500, 3.0));
    prisma.accountMetrics.findMany
      .mockResolvedValueOnce(mockAccountMetrics(5000))
      .mockResolvedValueOnce(mockAccountMetrics(4900));
    prisma.listeningHit.findMany
      .mockResolvedValueOnce([{ sentiment: 'POSITIVE' }, { sentiment: 'NEUTRAL' }])
      .mockResolvedValueOnce([{ sentiment: 'NEGATIVE' }]);

    const result = await computeBenchmarkDeltas(
      { start: new Date('2026-03-08'), end: new Date('2026-03-15') },
      { start: new Date('2026-03-01'), end: new Date('2026-03-08') }
    );

    expect(result.kpis).toBeDefined();
    expect(result.kpis.length).toBe(6);
    expect(result.benchmarkPeriod).toBeDefined();

    // Impressions: 1000 vs 500 = 100% up
    const impressionsKpi = result.kpis.find((k) => k.label === 'Impressions');
    expect(impressionsKpi.delta).toBe(100);
    expect(impressionsKpi.direction).toBe('up');

    // Engagement rate: 5.0 vs 3.0 = ~66.7% up
    const engKpi = result.kpis.find((k) => k.label === 'Engagement Rate');
    expect(engKpi.delta).toBeGreaterThan(60);
    expect(engKpi.direction).toBe('up');
  });

  it('returns noData flag when previous period has no data', async () => {
    prisma.post.findMany
      .mockResolvedValueOnce(mockPosts(1000, 5.0))
      .mockResolvedValueOnce([]); // no previous posts
    prisma.accountMetrics.findMany
      .mockResolvedValueOnce(mockAccountMetrics(5000))
      .mockResolvedValueOnce([]); // no previous account metrics
    prisma.listeningHit.findMany
      .mockResolvedValueOnce([{ sentiment: 'POSITIVE' }])
      .mockResolvedValueOnce([]); // no previous listening hits

    const result = await computeBenchmarkDeltas(
      { start: new Date('2026-03-08'), end: new Date('2026-03-15') },
      { start: new Date('2026-03-01'), end: new Date('2026-03-08') }
    );

    expect(result.noData).toBe(true);
  });

  it('handles null/zero previous values gracefully', async () => {
    prisma.post.findMany
      .mockResolvedValueOnce(mockPosts(1000, 5.0))
      .mockResolvedValueOnce(mockPosts(0, 0));
    prisma.accountMetrics.findMany
      .mockResolvedValueOnce(mockAccountMetrics(5000))
      .mockResolvedValueOnce([]);
    prisma.listeningHit.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await computeBenchmarkDeltas(
      { start: new Date('2026-03-08'), end: new Date('2026-03-15') },
      { start: new Date('2026-03-01'), end: new Date('2026-03-08') }
    );

    // Should not throw, KPIs should have flat direction for zero-value comparisons
    expect(result.kpis).toBeDefined();
    const impressionsKpi = result.kpis.find((k) => k.label === 'Impressions');
    // 1000 vs 0 => delta null (division by zero), direction flat
    expect(impressionsKpi.delta).toBeNull();
    expect(impressionsKpi.direction).toBe('flat');
  });
});

describe('benchmark against milestone', () => {
  let computeBenchmarkDeltas;
  let prisma;

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await import('@/lib/db');
    prisma = db.prisma;
    const mod = await import('@/lib/benchmark-compare.js');
    computeBenchmarkDeltas = mod.computeBenchmarkDeltas;
  });

  it('resolves milestone date range and computes deltas', async () => {
    // Simulate milestone period data
    prisma.post.findMany
      .mockResolvedValueOnce([
        {
          id: 'p-1', content: 'Current post', contentType: 'POST',
          metrics: [{ impressions: 2000, engagementRate: 6.0, fetchedAt: new Date() }],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'p-old', content: 'Milestone post', contentType: 'POST',
          metrics: [{ impressions: 1500, engagementRate: 4.5, fetchedAt: new Date() }],
        },
      ]);
    prisma.accountMetrics.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.listeningHit.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    // Use milestone dates directly (as the compareBenchmark endpoint would resolve them)
    const result = await computeBenchmarkDeltas(
      { start: new Date('2026-03-08'), end: new Date('2026-03-15') },
      { start: new Date('2026-02-01'), end: new Date('2026-02-28') }
    );

    expect(result.kpis).toBeDefined();
    expect(result.benchmarkPeriod.start).toEqual(new Date('2026-02-01'));
    expect(result.benchmarkPeriod.end).toEqual(new Date('2026-02-28'));

    // Impressions: 2000 vs 1500 = 33.3% up
    const impressionsKpi = result.kpis.find((k) => k.label === 'Impressions');
    expect(impressionsKpi.direction).toBe('up');
  });

  it('returns noData when milestone period has no data', async () => {
    prisma.post.findMany
      .mockResolvedValueOnce([
        {
          id: 'p-1', content: 'Current', contentType: 'POST',
          metrics: [{ impressions: 1000, engagementRate: 5.0, fetchedAt: new Date() }],
        },
      ])
      .mockResolvedValueOnce([]); // no milestone period posts
    prisma.accountMetrics.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.listeningHit.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await computeBenchmarkDeltas(
      { start: new Date('2026-03-08'), end: new Date('2026-03-15') },
      { start: new Date('2025-01-01'), end: new Date('2025-01-31') }
    );

    expect(result.noData).toBe(true);
  });
});
