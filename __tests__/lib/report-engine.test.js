import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chart-renderer
vi.mock('@/lib/chart-renderer', () => ({
  renderCharts: vi.fn().mockResolvedValue([
    { specId: 'engagement-trend', imageUrl: 'https://blob.test/engagement.png' },
    { specId: 'content-type-breakdown', imageUrl: 'https://blob.test/content-type.png' },
    { specId: 'sentiment-distribution', imageUrl: 'https://blob.test/sentiment.png' },
  ]),
  buildEngagementTrendSpec: vi.fn().mockReturnValue({ id: 'engagement-trend', config: {}, label: 'Engagement Trend' }),
  buildContentTypeSpec: vi.fn().mockReturnValue({ id: 'content-type-breakdown', config: {}, label: 'Content Type Breakdown' }),
  buildSentimentDistSpec: vi.fn().mockReturnValue({ id: 'sentiment-distribution', config: {}, label: 'Sentiment Distribution' }),
}));

// Mock report-content-schema
vi.mock('@/lib/report-content-schema', () => ({
  validateReportContent: vi.fn().mockReturnValue({ success: true, data: {} }),
  EMPTY_REPORT_CONTENT: {
    kpis: [],
    executiveSummary: '',
    sentimentThemes: null,
    charts: [],
    recommendations: [],
    topContent: [],
    coveragePeriod: { start: '', end: '' },
    benchmarkPeriod: null,
  },
}));

import { prisma } from '@/lib/db';
import { generateInsight } from '@/lib/ai';
import { renderCharts, buildEngagementTrendSpec, buildContentTypeSpec, buildSentimentDistSpec } from '@/lib/chart-renderer';
import { validateReportContent } from '@/lib/report-content-schema';
import {
  calculateKPIs,
  calculateDelta,
  getPreviousPeriod,
  generateEnrichedReport,
} from '@/lib/report-engine';

// -------------------------------------------------------
// Sample data fixtures
// -------------------------------------------------------

const samplePosts = [
  {
    id: 'post-1',
    content: 'Great update on our product launch with amazing results',
    contentType: 'POST',
    platform: 'X',
    publishedAt: new Date('2026-03-10'),
    metrics: [{ impressions: 5000, engagements: 200, engagementRate: 4.0, fetchedAt: new Date() }],
  },
  {
    id: 'post-2',
    content: 'Thread about our quarterly earnings and future plans',
    contentType: 'THREAD',
    platform: 'X',
    publishedAt: new Date('2026-03-11'),
    metrics: [{ impressions: 3000, engagements: 150, engagementRate: 5.0, fetchedAt: new Date() }],
  },
  {
    id: 'post-3',
    content: 'Check out our new feature release today!',
    contentType: 'POST',
    platform: 'REDDIT',
    publishedAt: new Date('2026-03-12'),
    metrics: [{ impressions: 2000, engagements: 80, engagementRate: 4.0, fetchedAt: new Date() }],
  },
];

const sampleAccountMetrics = [
  { date: new Date('2026-03-08'), followers: 10000, platform: 'X' },
  { date: new Date('2026-03-15'), followers: 10250, platform: 'X' },
];

const sampleListeningHits = [
  { id: 'lh-1', content: 'Love this brand!', sentiment: 'POSITIVE', engagementCount: 50, platform: 'X', detectedAt: new Date('2026-03-10') },
  { id: 'lh-2', content: 'Not happy with service', sentiment: 'NEGATIVE', engagementCount: 20, platform: 'REDDIT', detectedAt: new Date('2026-03-11') },
  { id: 'lh-3', content: 'Interesting approach', sentiment: 'NEUTRAL', engagementCount: 10, platform: 'X', detectedAt: new Date('2026-03-12') },
  { id: 'lh-4', content: 'Best product in market', sentiment: 'POSITIVE', engagementCount: 30, platform: 'X', detectedAt: new Date('2026-03-13') },
  { id: 'lh-5', content: 'Average experience', sentiment: 'NEUTRAL', engagementCount: 5, platform: 'REDDIT', detectedAt: new Date('2026-03-14') },
];

// -------------------------------------------------------
// Tests
// -------------------------------------------------------

describe('report-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateKPIs', () => {
    it('returns 5 KPI objects with correct labels from sample data', () => {
      const kpis = calculateKPIs(samplePosts, sampleAccountMetrics, sampleListeningHits);

      expect(kpis).toHaveLength(5);
      expect(kpis.map((k) => k.label)).toEqual([
        'Impressions',
        'Engagement Rate',
        'Follower Growth',
        'Top Post',
        'Sentiment',
      ]);
    });

    it('correctly calculates total impressions', () => {
      const kpis = calculateKPIs(samplePosts, sampleAccountMetrics, sampleListeningHits);
      const impressions = kpis.find((k) => k.label === 'Impressions');

      // 5000 + 3000 + 2000 = 10000
      expect(impressions.value).toBe(10000);
      expect(impressions.format).toBe('number');
    });

    it('correctly calculates average engagement rate', () => {
      const kpis = calculateKPIs(samplePosts, sampleAccountMetrics, sampleListeningHits);
      const engRate = kpis.find((k) => k.label === 'Engagement Rate');

      // (4.0 + 5.0 + 4.0) / 3 = 4.33
      expect(engRate.value).toBeCloseTo(4.33, 1);
      expect(engRate.format).toBe('percent');
    });

    it('correctly calculates follower growth delta', () => {
      const kpis = calculateKPIs(samplePosts, sampleAccountMetrics, sampleListeningHits);
      const followerGrowth = kpis.find((k) => k.label === 'Follower Growth');

      // 10250 - 10000 = 250
      expect(followerGrowth.value).toBe(250);
      expect(followerGrowth.format).toBe('delta');
    });

    it('identifies the top post by engagement rate', () => {
      const kpis = calculateKPIs(samplePosts, sampleAccountMetrics, sampleListeningHits);
      const topPost = kpis.find((k) => k.label === 'Top Post');

      // post-2 has 5.0% engagement rate (highest)
      expect(topPost.value).toContain('Thread about our quarterly');
      expect(topPost.format).toBe('text');
      expect(topPost.subValue).toContain('5.0');
    });

    it('correctly calculates sentiment score', () => {
      const kpis = calculateKPIs(samplePosts, sampleAccountMetrics, sampleListeningHits);
      const sentiment = kpis.find((k) => k.label === 'Sentiment');

      // 2 positive out of 5 total = 40%
      expect(sentiment.value).toBe(40);
      expect(sentiment.format).toBe('percent');
    });

    it('returns graceful defaults when input arrays are empty', () => {
      const kpis = calculateKPIs([], [], []);

      expect(kpis).toHaveLength(5);
      const impressions = kpis.find((k) => k.label === 'Impressions');
      expect(impressions.value).toBe(0);

      const engRate = kpis.find((k) => k.label === 'Engagement Rate');
      expect(engRate.value).toBe(0);

      const followerGrowth = kpis.find((k) => k.label === 'Follower Growth');
      expect(followerGrowth.value).toBe(0);

      const topPost = kpis.find((k) => k.label === 'Top Post');
      expect(topPost.value).toBe('N/A');

      const sentiment = kpis.find((k) => k.label === 'Sentiment');
      expect(sentiment.value).toBeNull();
    });

    it('handles posts without metrics gracefully', () => {
      const postsNoMetrics = [
        { id: 'p1', content: 'Hello', contentType: 'POST', metrics: [] },
        { id: 'p2', content: 'World', contentType: 'POST', metrics: [null] },
      ];
      const kpis = calculateKPIs(postsNoMetrics, [], []);
      expect(kpis).toHaveLength(5);
      expect(kpis.find((k) => k.label === 'Impressions').value).toBe(0);
    });
  });

  describe('calculateDelta', () => {
    it('returns positive delta when current > previous', () => {
      const result = calculateDelta(100, 80);
      expect(result.value).toBe(25.0);
      expect(result.direction).toBe('up');
    });

    it('returns negative delta when current < previous', () => {
      const result = calculateDelta(95, 100);
      expect(result.value).toBe(-5.0);
      expect(result.direction).toBe('down');
    });

    it('returns flat when previous is 0', () => {
      const result = calculateDelta(100, 0);
      expect(result.value).toBeNull();
      expect(result.direction).toBe('flat');
    });

    it('returns flat when previous is null', () => {
      const result = calculateDelta(100, null);
      expect(result.value).toBeNull();
      expect(result.direction).toBe('flat');
    });

    it('returns flat when change is within 1% threshold', () => {
      const result = calculateDelta(100, 99.5);
      // (100 - 99.5) / 99.5 * 100 = 0.5% -- within 1% threshold
      expect(result.direction).toBe('flat');
    });

    it('returns correct direction at threshold boundary', () => {
      // Just above 1% threshold
      const result = calculateDelta(102, 100);
      // (102 - 100) / 100 * 100 = 2% -- above 1% threshold
      expect(result.direction).toBe('up');
    });
  });

  describe('getPreviousPeriod', () => {
    it('returns the prior 7-day range for a weekly period', () => {
      const dateStart = new Date('2026-03-08');
      const dateEnd = new Date('2026-03-15');
      const prev = getPreviousPeriod(dateStart, dateEnd);

      expect(prev.start.toISOString()).toBe(new Date('2026-03-01').toISOString());
      expect(prev.end.toISOString()).toBe(new Date('2026-03-08').toISOString());
    });

    it('returns the prior 30-day range for a monthly period', () => {
      const dateStart = new Date('2026-02-15');
      const dateEnd = new Date('2026-03-15');
      const prev = getPreviousPeriod(dateStart, dateEnd);

      // 28 day difference
      const duration = dateEnd.getTime() - dateStart.getTime();
      expect(prev.end.getTime()).toBe(dateStart.getTime());
      expect(prev.start.getTime()).toBe(dateStart.getTime() - duration);
    });
  });

  describe('generateEnrichedReport', () => {
    beforeEach(() => {
      // Setup prisma mocks for data fetching
      prisma.post = {
        findMany: vi.fn().mockResolvedValue(samplePosts),
      };
      prisma.accountMetrics = {
        findMany: vi.fn().mockResolvedValue(sampleAccountMetrics),
      };
      prisma.listeningHit = {
        findMany: vi.fn().mockResolvedValue(sampleListeningHits),
      };

      // Setup AI mock to return enriched content
      generateInsight.mockResolvedValue({
        executiveSummary: 'Strong week with 10K impressions and 4.3% engagement rate.',
        sentimentThemes: {
          positive: [{ theme: 'Product quality', detail: 'Users love the product', volume: 2 }],
          negative: [{ theme: 'Service issues', detail: 'Some complaints about support', volume: 1 }],
          emerging: [{ topic: 'New feature interest', signals: 'Growing mentions of upcoming launch' }],
        },
        recommendations: [
          { recommendation: 'Increase thread content', priority: 'HIGH', expectedImpact: 'Higher engagement' },
        ],
        topContent: [
          { title: 'Thread about quarterly earnings', engagementRate: 5.0, impressions: 3000 },
        ],
      });

      // Validate returns success
      validateReportContent.mockReturnValue({ success: true });
    });

    it('orchestrates data fetch, KPI calc, AI, charts, and returns canonical content', async () => {
      const result = await generateEnrichedReport({
        reportType: 'WEEKLY_PERFORMANCE',
        dateStart: new Date('2026-03-08'),
        dateEnd: new Date('2026-03-15'),
        benchmarkPeriod: null,
      });

      // Should have KPIs
      expect(result.kpis).toHaveLength(5);
      expect(result.kpis[0].label).toBe('Impressions');

      // Should have executive summary from AI
      expect(result.executiveSummary).toBeTruthy();

      // Should have charts array
      expect(result.charts).toHaveLength(3);
      expect(result.charts[0].imageUrl).toBe('https://blob.test/engagement.png');

      // Should have coverage period
      expect(result.coveragePeriod.start).toBeTruthy();
      expect(result.coveragePeriod.end).toBeTruthy();
    });

    it('computes deltas when benchmarkPeriod is provided', async () => {
      const result = await generateEnrichedReport({
        reportType: 'WEEKLY_PERFORMANCE',
        dateStart: new Date('2026-03-08'),
        dateEnd: new Date('2026-03-15'),
        benchmarkPeriod: { start: new Date('2026-03-01'), end: new Date('2026-03-08') },
      });

      // KPIs should have delta and direction fields when benchmarkPeriod is provided
      // The specific values depend on mock data for both periods
      expect(result.kpis).toHaveLength(5);
      // At minimum, delta fields should be present on numeric KPIs
      const impressionsKPI = result.kpis.find((k) => k.label === 'Impressions');
      expect(impressionsKPI).toHaveProperty('delta');
      expect(impressionsKPI).toHaveProperty('direction');
    });

    it('pre-aggregates AI context to avoid token bloat (top 5 posts max)', async () => {
      // Create 10 posts to verify truncation
      const manyPosts = Array.from({ length: 10 }, (_, i) => ({
        id: `post-${i}`,
        content: `Post content ${i} with some longer text to simulate real content`,
        contentType: 'POST',
        platform: 'X',
        publishedAt: new Date('2026-03-10'),
        metrics: [{ impressions: 1000 * (i + 1), engagements: 50 * (i + 1), engagementRate: 2 + i * 0.5, fetchedAt: new Date() }],
      }));

      prisma.post.findMany.mockResolvedValue(manyPosts);

      await generateEnrichedReport({
        reportType: 'WEEKLY_PERFORMANCE',
        dateStart: new Date('2026-03-08'),
        dateEnd: new Date('2026-03-15'),
        benchmarkPeriod: null,
      });

      // The AI context should be limited -- check generateInsight was called with bounded data
      expect(generateInsight).toHaveBeenCalledOnce();
      const aiContext = generateInsight.mock.calls[0][1];
      // Top posts should be capped at 5
      expect(aiContext.topPosts.length).toBeLessThanOrEqual(5);
    });

    it('includes sentiment themes from AI response', async () => {
      const result = await generateEnrichedReport({
        reportType: 'WEEKLY_PERFORMANCE',
        dateStart: new Date('2026-03-08'),
        dateEnd: new Date('2026-03-15'),
        benchmarkPeriod: null,
      });

      expect(result.sentimentThemes).toBeTruthy();
      expect(result.sentimentThemes.positive).toHaveLength(1);
      expect(result.sentimentThemes.negative).toHaveLength(1);
      expect(result.sentimentThemes.emerging).toHaveLength(1);
    });

    it('accepts arbitrary date ranges for ad hoc reports (CUSTOM type)', async () => {
      const result = await generateEnrichedReport({
        reportType: 'CUSTOM',
        dateStart: new Date('2026-01-01'),
        dateEnd: new Date('2026-03-15'),
        benchmarkPeriod: null,
      });

      // Should still produce valid content
      expect(result.kpis).toHaveLength(5);
      expect(result.executiveSummary).toBeTruthy();
      expect(result.coveragePeriod.start).toBeTruthy();
    });

    it('calls chart spec builders and renderCharts', async () => {
      await generateEnrichedReport({
        reportType: 'WEEKLY_PERFORMANCE',
        dateStart: new Date('2026-03-08'),
        dateEnd: new Date('2026-03-15'),
        benchmarkPeriod: null,
      });

      expect(buildEngagementTrendSpec).toHaveBeenCalledOnce();
      expect(buildContentTypeSpec).toHaveBeenCalledOnce();
      expect(buildSentimentDistSpec).toHaveBeenCalledOnce();
      expect(renderCharts).toHaveBeenCalledOnce();
    });

    it('validates content against report schema', async () => {
      await generateEnrichedReport({
        reportType: 'WEEKLY_PERFORMANCE',
        dateStart: new Date('2026-03-08'),
        dateEnd: new Date('2026-03-15'),
        benchmarkPeriod: null,
      });

      expect(validateReportContent).toHaveBeenCalledOnce();
    });
  });
});
