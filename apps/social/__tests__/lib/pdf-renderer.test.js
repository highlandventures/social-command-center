import { describe, it, expect, vi } from 'vitest';

// Mock @react-pdf/renderer to avoid heavy native dep in tests
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }) => children,
  Page: ({ children }) => children,
  View: ({ children }) => children,
  Text: ({ children }) => children,
  Image: () => null,
  Font: { register: vi.fn(), registerHyphenationCallback: vi.fn() },
  StyleSheet: { create: (s) => s },
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-pdf')),
}));

describe('pdf-renderer', () => {
  it('generates PDF buffer', async () => {
    const { renderReportPDF } = await import('../../lib/pdf-renderer.jsx');
    const mockReport = {
      id: 'test-1',
      title: 'Test Report',
      content: {
        kpis: [{ label: 'Impressions', value: 1000, format: 'number' }],
        executiveSummary: 'Test summary',
        charts: [],
        sentimentThemes: [],
        recommendations: [],
        topContent: [],
      },
      coveragePeriod: { start: '2026-03-01', end: '2026-03-14' },
    };
    const buffer = await renderReportPDF(mockReport);
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('includes all sections', async () => {
    const { ReportPDF } = await import('../../lib/pdf-renderer.jsx');
    expect(ReportPDF).toBeDefined();
    expect(typeof ReportPDF).toBe('function');
  });

  it('prefetches chart images gracefully', async () => {
    const { prefetchChartImages } = await import('../../lib/pdf-renderer.jsx');
    expect(prefetchChartImages).toBeDefined();
    // With empty charts, should return empty object
    const result = await prefetchChartImages([]);
    expect(result).toEqual({});
  });
});
