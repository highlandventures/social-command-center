import { describe, it, expect, vi } from 'vitest';

// Mock prisma before any imports
vi.mock('@/lib/db', () => ({
  default: {
    adHocReport: {
      create: vi.fn().mockResolvedValue({ id: 'adhoc-1', status: 'SCOPING' }),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    adHocReportMessage: {
      create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    report: {
      create: vi.fn().mockResolvedValue({ id: 'rpt-1' }),
    },
  },
}));

// ── ADHC-02: System prompt for ad hoc conversations ──
describe('ADHOC_SYSTEM_PROMPT', () => {
  it('is a non-empty string', async () => {
    const { ADHOC_SYSTEM_PROMPT } = await import('@/lib/adhoc/system-prompt.js');
    expect(typeof ADHOC_SYSTEM_PROMPT).toBe('string');
    expect(ADHOC_SYSTEM_PROMPT.length).toBeGreaterThan(50);
  });

  it('includes instructions about clarifying questions', async () => {
    const { ADHOC_SYSTEM_PROMPT } = await import('@/lib/adhoc/system-prompt.js');
    expect(ADHOC_SYSTEM_PROMPT).toMatch(/clarifying questions/i);
  });

  it('mentions time range, metrics focus, and comparison baseline', async () => {
    const { ADHOC_SYSTEM_PROMPT } = await import('@/lib/adhoc/system-prompt.js');
    expect(ADHOC_SYSTEM_PROMPT).toMatch(/time range/i);
    expect(ADHOC_SYSTEM_PROMPT).toMatch(/metrics/i);
    expect(ADHOC_SYSTEM_PROMPT).toMatch(/baseline|comparison/i);
  });

  it('instructs AI to output JSON block with action:"generate"', async () => {
    const { ADHOC_SYSTEM_PROMPT } = await import('@/lib/adhoc/system-prompt.js');
    expect(ADHOC_SYSTEM_PROMPT).toMatch(/action.*generate/i);
  });
});

// ── ADHC-02: Extract report params from assistant message ──
describe('extractReportParams', () => {
  it('returns null when no JSON block present', async () => {
    const { extractReportParams } = await import('@/lib/adhoc/param-extractor.js');
    const result = extractReportParams('Just a normal message with no params');
    expect(result).toBeNull();
  });

  it('returns null for empty string', async () => {
    const { extractReportParams } = await import('@/lib/adhoc/param-extractor.js');
    expect(extractReportParams('')).toBeNull();
  });

  it('extracts params from markdown code fence JSON block', async () => {
    const { extractReportParams } = await import('@/lib/adhoc/param-extractor.js');
    const text = `Great, I have enough info. Here are the parameters:

\`\`\`json
{"action":"generate","params":{"title":"Weekly Engagement Report","dateStart":"2026-03-09","dateEnd":"2026-03-16","reportType":"WEEKLY_PERFORMANCE","metricsScope":"engagement","comparisonBaseline":"previous_period"}}
\`\`\`

I'll generate this report for you now.`;
    const result = extractReportParams(text);
    expect(result).not.toBeNull();
    expect(result.title).toBe('Weekly Engagement Report');
    expect(result.dateStart).toBe('2026-03-09');
    expect(result.dateEnd).toBe('2026-03-16');
    expect(result.reportType).toBe('WEEKLY_PERFORMANCE');
    expect(result.metricsScope).toBe('engagement');
    expect(result.comparisonBaseline).toBe('previous_period');
  });

  it('extracts params from raw JSON with action:"generate"', async () => {
    const { extractReportParams } = await import('@/lib/adhoc/param-extractor.js');
    const text = 'Here are your params: {"action":"generate","params":{"title":"Test","dateStart":"2026-03-01","dateEnd":"2026-03-07","reportType":"CUSTOM","metricsScope":"all","comparisonBaseline":"none"}}';
    const result = extractReportParams(text);
    expect(result).not.toBeNull();
    expect(result.title).toBe('Test');
    expect(result.reportType).toBe('CUSTOM');
  });

  it('handles markdown code fence without json language tag', async () => {
    const { extractReportParams } = await import('@/lib/adhoc/param-extractor.js');
    const text = `\`\`\`
{"action":"generate","params":{"title":"Report","dateStart":"2026-03-01","dateEnd":"2026-03-07","reportType":"WEEKLY_PERFORMANCE","metricsScope":"engagement","comparisonBaseline":"previous_period"}}
\`\`\``;
    const result = extractReportParams(text);
    expect(result).not.toBeNull();
    expect(result.title).toBe('Report');
  });

  it('returns null for JSON without action:"generate"', async () => {
    const { extractReportParams } = await import('@/lib/adhoc/param-extractor.js');
    const text = '```json\n{"foo":"bar"}\n```';
    const result = extractReportParams(text);
    expect(result).toBeNull();
  });
});

// ── tRPC/DB-level tests (kept as skip -- require DB) ──

// ADHC-01: Create ad hoc report
describe.skip('adhocReports.create', () => {
  it('creates AdHocReport record with status SCOPING', async () => {});
});

// ADHC-05: Get chat messages
describe.skip('adhocReports.getChatMessages', () => {
  it('returns messages for a given adHocId ordered by createdAt', async () => {});
  it('returns empty array when no messages exist', async () => {});
});

// ADHC-05: Save message
describe.skip('adhocReports.saveMessage', () => {
  it('persists user message to AdHocReportMessage', async () => {});
  it('persists assistant message to AdHocReportMessage', async () => {});
});

// ADHC-01: Generate report from ad hoc conversation
describe.skip('adhocReports.generate', () => {
  it('transitions status SCOPING -> GENERATING -> READY', async () => {});
  it('calls generateEnrichedReport with extracted params', async () => {});
});

// ADHC-04: Re-run report with stored params
describe.skip('adhocReports.rerun', () => {
  it('re-runs report generation with stored reportParams', async () => {});
  it('creates new Report record on rerun', async () => {});
});

// ADHC-03: Configure snapshots
describe.skip('adhocReports.configureSnapshots', () => {
  it('sets snapshotIntervals and computes nextSnapshotAt', async () => {});
});

// ADHC-03: Process due snapshots
describe.skip('adhocReports.processSnapshots', () => {
  it('finds due snapshots where nextSnapshotAt <= now', async () => {});
  it('regenerates report and advances nextSnapshotAt', async () => {});
});
