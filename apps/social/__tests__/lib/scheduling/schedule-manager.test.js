import { describe, it, expect, vi } from 'vitest';

// Mock prisma before any imports
vi.mock('@/lib/db', () => ({
  default: {
    schedule: {
      create: vi.fn().mockResolvedValue({ id: 'sched-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    report: {
      create: vi.fn().mockResolvedValue({ id: 'rpt-1' }),
    },
  },
}));

// SCHED-01: Create schedule with cadence enum
describe.skip('schedules.create', () => {
  it('creates a schedule with WEEKLY cadence and required fields', async () => {
    const { createSchedule } = await import('@/lib/scheduling/schedule-manager.js');
    const result = await createSchedule({
      name: 'Weekly Performance',
      cadence: 'WEEKLY',
      reportType: 'performance',
      recipients: ['team@example.com'],
    });
    expect(result).toHaveProperty('id');
    expect(result.cadence).toBe('WEEKLY');
  });

  it('validates required fields (name, cadence, reportType, recipients)', async () => {
    const { createSchedule } = await import('@/lib/scheduling/schedule-manager.js');
    await expect(createSchedule({})).rejects.toThrow();
  });

  it('accepts MONTHLY, QUARTERLY, and YEARLY cadences', async () => {
    const { createSchedule } = await import('@/lib/scheduling/schedule-manager.js');
    for (const cadence of ['MONTHLY', 'QUARTERLY', 'YEARLY']) {
      const result = await createSchedule({
        name: `${cadence} Report`,
        cadence,
        reportType: 'performance',
        recipients: ['team@example.com'],
      });
      expect(result).toHaveProperty('id');
    }
  });
});

// SCHED-04: List schedules with run metadata
describe.skip('schedules.list', () => {
  it('returns all schedules with nextRunAt, lastRunAt, lastReportId', async () => {
    const { listSchedules } = await import('@/lib/scheduling/schedule-manager.js');
    const schedules = await listSchedules();
    expect(Array.isArray(schedules)).toBe(true);
    for (const s of schedules) {
      expect(s).toHaveProperty('nextRunAt');
      expect(s).toHaveProperty('lastRunAt');
      expect(s).toHaveProperty('lastReportId');
    }
  });
});

// SCHED-03: Toggle enabled flag
describe.skip('schedules.toggle', () => {
  it('toggles enabled flag and updates updatedAt', async () => {
    const { toggleSchedule } = await import('@/lib/scheduling/schedule-manager.js');
    const result = await toggleSchedule('sched-1', false);
    expect(result.enabled).toBe(false);
    expect(result).toHaveProperty('updatedAt');
  });
});

// SCHED-03: Edit schedule
describe.skip('schedules.update', () => {
  it('edits schedule name, cadence, and recipients', async () => {
    const { updateSchedule } = await import('@/lib/scheduling/schedule-manager.js');
    const result = await updateSchedule('sched-1', {
      name: 'Updated Name',
      cadence: 'MONTHLY',
      recipients: ['new@example.com'],
    });
    expect(result).toHaveProperty('id');
  });
});

// SCHED-03: Delete schedule
describe.skip('schedules.delete', () => {
  it('deletes schedule by id', async () => {
    const { deleteSchedule } = await import('@/lib/scheduling/schedule-manager.js');
    await expect(deleteSchedule('sched-1')).resolves.not.toThrow();
  });
});

// SCHED-02: Cron finds due schedules and generates reports
describe.skip('run-schedules cron', () => {
  it('finds due schedules where nextRunAt <= now AND enabled', async () => {
    const { runDueSchedules } = await import('@/lib/scheduling/schedule-manager.js');
    const results = await runDueSchedules();
    expect(Array.isArray(results)).toBe(true);
  });

  it('generates report via generateEnrichedReport for each due schedule', async () => {
    const { runDueSchedules } = await import('@/lib/scheduling/schedule-manager.js');
    const results = await runDueSchedules();
    for (const r of results) {
      expect(r).toHaveProperty('reportId');
    }
  });

  it('advances nextRunAt after successful run', async () => {
    const { runDueSchedules } = await import('@/lib/scheduling/schedule-manager.js');
    const results = await runDueSchedules();
    for (const r of results) {
      expect(r).toHaveProperty('nextRunAt');
    }
  });
});

// DIST-01 + DIST-03: Email delivery after report generation
describe.skip('run-schedules email delivery', () => {
  it('sends email after report generation when recipients configured', async () => {
    const { runDueSchedules } = await import('@/lib/scheduling/schedule-manager.js');
    const results = await runDueSchedules();
    for (const r of results) {
      if (r.recipients?.length > 0) {
        expect(r).toHaveProperty('emailSent', true);
      }
    }
  });

  it('uses per-schedule recipients array for delivery', async () => {
    const { runDueSchedules } = await import('@/lib/scheduling/schedule-manager.js');
    const results = await runDueSchedules();
    for (const r of results) {
      expect(r).toHaveProperty('recipients');
      expect(Array.isArray(r.recipients)).toBe(true);
    }
  });
});

// SCHED-02: computeNextRun helper
describe('computeNextRun', () => {
  it('adds 7 days for WEEKLY cadence', async () => {
    const { computeNextRun } = await import('@/lib/scheduling/schedule-helpers.js');
    const base = new Date('2026-03-01T00:00:00Z');
    const next = computeNextRun('WEEKLY', base);
    expect(next.toISOString()).toBe('2026-03-08T00:00:00.000Z');
  });

  it('adds 1 month for MONTHLY cadence', async () => {
    const { computeNextRun } = await import('@/lib/scheduling/schedule-helpers.js');
    const base = new Date('2026-03-01T00:00:00Z');
    const next = computeNextRun('MONTHLY', base);
    expect(next.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('adds 3 months for QUARTERLY cadence', async () => {
    const { computeNextRun } = await import('@/lib/scheduling/schedule-helpers.js');
    const base = new Date('2026-03-01T00:00:00Z');
    const next = computeNextRun('QUARTERLY', base);
    expect(next.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('adds 1 year for YEARLY cadence', async () => {
    const { computeNextRun } = await import('@/lib/scheduling/schedule-helpers.js');
    const base = new Date('2026-03-01T00:00:00Z');
    const next = computeNextRun('YEARLY', base);
    expect(next.toISOString()).toBe('2027-03-01T00:00:00.000Z');
  });
});

// SCHED-02: computeDateRange helper
describe('computeDateRange', () => {
  it('returns 7-day lookback for WEEKLY', async () => {
    const { computeDateRange } = await import('@/lib/scheduling/schedule-helpers.js');
    const ref = new Date('2026-03-08T00:00:00Z');
    const range = computeDateRange('WEEKLY', ref);
    expect(range.dateStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(range.dateEnd.toISOString()).toBe('2026-03-08T00:00:00.000Z');
  });

  it('returns 1-month lookback for MONTHLY', async () => {
    const { computeDateRange } = await import('@/lib/scheduling/schedule-helpers.js');
    const ref = new Date('2026-04-01T00:00:00Z');
    const range = computeDateRange('MONTHLY', ref);
    expect(range.dateStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(range.dateEnd.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('returns 3-month lookback for QUARTERLY', async () => {
    const { computeDateRange } = await import('@/lib/scheduling/schedule-helpers.js');
    const ref = new Date('2026-06-01T00:00:00Z');
    const range = computeDateRange('QUARTERLY', ref);
    expect(range.dateStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(range.dateEnd.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('returns 1-year lookback for YEARLY', async () => {
    const { computeDateRange } = await import('@/lib/scheduling/schedule-helpers.js');
    const ref = new Date('2027-03-01T00:00:00Z');
    const range = computeDateRange('YEARLY', ref);
    expect(range.dateStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(range.dateEnd.toISOString()).toBe('2027-03-01T00:00:00.000Z');
  });
});

// cadenceToReportType helper
describe('cadenceToReportType', () => {
  it('maps WEEKLY to WEEKLY_PERFORMANCE', async () => {
    const { cadenceToReportType } = await import('@/lib/scheduling/schedule-helpers.js');
    expect(cadenceToReportType('WEEKLY')).toBe('WEEKLY_PERFORMANCE');
  });

  it('maps MONTHLY to MONTHLY_SUMMARY', async () => {
    const { cadenceToReportType } = await import('@/lib/scheduling/schedule-helpers.js');
    expect(cadenceToReportType('MONTHLY')).toBe('MONTHLY_SUMMARY');
  });

  it('maps QUARTERLY and YEARLY to CUSTOM', async () => {
    const { cadenceToReportType } = await import('@/lib/scheduling/schedule-helpers.js');
    expect(cadenceToReportType('QUARTERLY')).toBe('CUSTOM');
    expect(cadenceToReportType('YEARLY')).toBe('CUSTOM');
  });
});
