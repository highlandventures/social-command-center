import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @vercel/blob
vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.vercel-storage.com/test.png' }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { put } from '@vercel/blob';
import {
  renderChart,
  renderCharts,
  buildEngagementTrendSpec,
  buildContentTypeSpec,
  buildSentimentDistSpec,
} from '@/lib/chart-renderer';

describe('chart-renderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renderChart', () => {
    it('POSTs to QuickChart.io and uploads PNG to Vercel Blob', async () => {
      const fakePng = Buffer.from('fake-png');
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(fakePng.buffer.slice(fakePng.byteOffset, fakePng.byteOffset + fakePng.byteLength)),
      });

      const spec = {
        id: 'engagement-trend',
        config: { type: 'line', data: { labels: ['Mon'], datasets: [{ label: 'Rate', data: [1.5] }] } },
        label: 'Engagement Trend',
      };

      const result = await renderChart(spec);

      // Should have POSTed to QuickChart.io
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://quickchart.io/chart');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toMatchObject({
        chart: spec.config,
        format: 'png',
        version: 4,
      });

      // Should have uploaded to Vercel Blob
      expect(put).toHaveBeenCalledOnce();
      const [blobPath, , blobOpts] = put.mock.calls[0];
      expect(blobPath).toMatch(/^reports\/charts\/engagement-trend-\d+\.png$/);
      expect(blobOpts.access).toBe('public');
      expect(blobOpts.contentType).toBe('image/png');

      // Should return specId and imageUrl
      expect(result).toEqual({
        specId: 'engagement-trend',
        imageUrl: 'https://blob.vercel-storage.com/test.png',
      });
    });

    it('returns null imageUrl when QuickChart.io fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const spec = {
        id: 'failed-chart',
        config: { type: 'bar', data: { labels: [], datasets: [] } },
        label: 'Failed',
      };

      const result = await renderChart(spec);

      expect(result).toEqual({
        specId: 'failed-chart',
        imageUrl: null,
      });
    });

    it('returns null imageUrl when QuickChart.io returns non-ok status', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const spec = {
        id: 'error-chart',
        config: { type: 'bar', data: { labels: [], datasets: [] } },
        label: 'Error',
      };

      const result = await renderChart(spec);

      expect(result).toEqual({
        specId: 'error-chart',
        imageUrl: null,
      });
    });
  });

  describe('renderCharts', () => {
    it('renders multiple specs in parallel and returns array of results', async () => {
      const fakePng = Buffer.from('fake-png');
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(fakePng.buffer.slice(fakePng.byteOffset, fakePng.byteOffset + fakePng.byteLength)),
      });

      const specs = [
        { id: 'chart-1', config: { type: 'line', data: {} }, label: 'Chart 1' },
        { id: 'chart-2', config: { type: 'bar', data: {} }, label: 'Chart 2' },
      ];

      const results = await renderCharts(specs);

      expect(results).toHaveLength(2);
      expect(results[0].specId).toBe('chart-1');
      expect(results[1].specId).toBe('chart-2');
      expect(results[0].imageUrl).toBe('https://blob.vercel-storage.com/test.png');
      expect(results[1].imageUrl).toBe('https://blob.vercel-storage.com/test.png');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('buildEngagementTrendSpec', () => {
    it('returns a valid line chart spec with correct structure', () => {
      const dailyData = [
        { date: '2026-03-01', engagementRate: 2.5 },
        { date: '2026-03-02', engagementRate: 3.1 },
        { date: '2026-03-03', engagementRate: 1.8 },
      ];

      const spec = buildEngagementTrendSpec(dailyData);

      expect(spec.id).toBe('engagement-trend');
      expect(spec.label).toBe('Engagement Trend');
      expect(spec.config.type).toBe('line');
      expect(spec.config.data.labels).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
      expect(spec.config.data.datasets).toHaveLength(1);
      expect(spec.config.data.datasets[0].data).toEqual([2.5, 3.1, 1.8]);
    });
  });

  describe('buildContentTypeSpec', () => {
    it('returns a valid bar chart spec with content type counts', () => {
      const typeCounts = [
        { type: 'POST', count: 15 },
        { type: 'THREAD', count: 5 },
        { type: 'ARTICLE', count: 3 },
      ];

      const spec = buildContentTypeSpec(typeCounts);

      expect(spec.id).toBe('content-type-breakdown');
      expect(spec.label).toBe('Content Type Breakdown');
      expect(spec.config.type).toBe('bar');
      expect(spec.config.data.labels).toEqual(['POST', 'THREAD', 'ARTICLE']);
      expect(spec.config.data.datasets[0].data).toEqual([15, 5, 3]);
    });
  });

  describe('buildSentimentDistSpec', () => {
    it('returns a valid doughnut chart spec with sentiment counts', () => {
      const sentimentCounts = { positive: 45, negative: 12, neutral: 33 };

      const spec = buildSentimentDistSpec(sentimentCounts);

      expect(spec.id).toBe('sentiment-distribution');
      expect(spec.label).toBe('Sentiment Distribution');
      expect(spec.config.type).toBe('doughnut');
      expect(spec.config.data.labels).toEqual(['Positive', 'Negative', 'Neutral']);
      expect(spec.config.data.datasets[0].data).toEqual([45, 12, 33]);
    });
  });
});
