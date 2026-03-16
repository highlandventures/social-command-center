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

// ADHC-01: Create ad hoc report
describe.skip('adhocReports.create', () => {
  it('creates AdHocReport record with status SCOPING', async () => {
    const { createAdHocReport } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const result = await createAdHocReport({ accountId: 'acct-1' });
    expect(result).toHaveProperty('id');
    expect(result.status).toBe('SCOPING');
  });
});

// ADHC-05: Get chat messages
describe.skip('adhocReports.getChatMessages', () => {
  it('returns messages for a given adHocId ordered by createdAt', async () => {
    const { getChatMessages } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const messages = await getChatMessages('adhoc-1');
    expect(Array.isArray(messages)).toBe(true);
  });

  it('returns empty array when no messages exist', async () => {
    const { getChatMessages } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const messages = await getChatMessages('adhoc-nonexistent');
    expect(messages).toEqual([]);
  });
});

// ADHC-05: Save message
describe.skip('adhocReports.saveMessage', () => {
  it('persists user message to AdHocReportMessage', async () => {
    const { saveMessage } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const result = await saveMessage({
      adHocId: 'adhoc-1',
      role: 'user',
      content: 'I need a report on engagement this week',
    });
    expect(result).toHaveProperty('id');
  });

  it('persists assistant message to AdHocReportMessage', async () => {
    const { saveMessage } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const result = await saveMessage({
      adHocId: 'adhoc-1',
      role: 'assistant',
      content: 'I can help with that. What metrics are you interested in?',
    });
    expect(result).toHaveProperty('id');
  });
});

// ADHC-01: Generate report from ad hoc conversation
describe.skip('adhocReports.generate', () => {
  it('transitions status SCOPING -> GENERATING -> READY', async () => {
    const { generateAdHocReport } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const result = await generateAdHocReport('adhoc-1');
    expect(result.status).toBe('READY');
    expect(result).toHaveProperty('reportId');
  });

  it('calls generateEnrichedReport with extracted params', async () => {
    const { generateAdHocReport } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const result = await generateAdHocReport('adhoc-1');
    expect(result).toHaveProperty('reportId');
  });
});

// ADHC-04: Re-run report with stored params
describe.skip('adhocReports.rerun', () => {
  it('re-runs report generation with stored reportParams', async () => {
    const { rerunAdHocReport } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const result = await rerunAdHocReport('adhoc-1');
    expect(result).toHaveProperty('reportId');
  });

  it('creates new Report record on rerun', async () => {
    const { rerunAdHocReport } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const result = await rerunAdHocReport('adhoc-1');
    expect(result.reportId).toBeDefined();
  });
});

// ADHC-03: Configure snapshots
describe.skip('adhocReports.configureSnapshots', () => {
  it('sets snapshotIntervals and computes nextSnapshotAt', async () => {
    const { configureSnapshots } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const result = await configureSnapshots('adhoc-1', {
      intervals: ['DAILY', 'WEEKLY'],
    });
    expect(result).toHaveProperty('nextSnapshotAt');
    expect(result).toHaveProperty('snapshotIntervals');
  });
});

// ADHC-03: Process due snapshots
describe.skip('adhocReports.processSnapshots', () => {
  it('finds due snapshots where nextSnapshotAt <= now', async () => {
    const { processDueSnapshots } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const results = await processDueSnapshots();
    expect(Array.isArray(results)).toBe(true);
  });

  it('regenerates report and advances nextSnapshotAt', async () => {
    const { processDueSnapshots } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const results = await processDueSnapshots();
    for (const r of results) {
      expect(r).toHaveProperty('reportId');
      expect(r).toHaveProperty('nextSnapshotAt');
    }
  });
});

// ADHC-02: System prompt for ad hoc conversations
describe.skip('ADHOC_SYSTEM_PROMPT', () => {
  it('includes instructions to ask clarifying questions about time range, metrics, baseline', async () => {
    const { ADHOC_SYSTEM_PROMPT } = await import('@/lib/adhoc-report/adhoc-chat.js');
    expect(typeof ADHOC_SYSTEM_PROMPT).toBe('string');
    expect(ADHOC_SYSTEM_PROMPT).toMatch(/time range/i);
    expect(ADHOC_SYSTEM_PROMPT).toMatch(/metrics/i);
    expect(ADHOC_SYSTEM_PROMPT).toMatch(/baseline|comparison/i);
  });
});

// ADHC-02: Extract report params from assistant message
describe.skip('extractReportParams', () => {
  it('extracts JSON params block from assistant message content', async () => {
    const { extractReportParams } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const message = 'Here are the report parameters:\n```json\n{"timeRange": "7d", "metrics": ["engagement"]}\n```';
    const params = extractReportParams(message);
    expect(params).toHaveProperty('timeRange', '7d');
    expect(params.metrics).toContain('engagement');
  });

  it('returns null when no JSON block found', async () => {
    const { extractReportParams } = await import('@/lib/adhoc-report/adhoc-chat.js');
    const result = extractReportParams('No params here');
    expect(result).toBeNull();
  });
});
