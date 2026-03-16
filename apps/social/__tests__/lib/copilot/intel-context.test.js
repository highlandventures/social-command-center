import { describe, it, expect, vi } from 'vitest';

// Mock prisma before any imports
vi.mock('@/lib/db', () => ({
  default: {
    socialPost: { findMany: vi.fn().mockResolvedValue([]) },
    competitorSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
    mention: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

describe.skip('lib/copilot/intel-context', () => {
  let getCondensedIntelSummary;

  it('getCondensedIntelSummary returns combined intel from 3 sources', async () => {
    const mod = await import('@/lib/copilot/intel-context');
    getCondensedIntelSummary = mod.getCondensedIntelSummary;

    const result = await getCondensedIntelSummary({ accountId: 'acct-1' });
    expect(typeof result).toBe('string');
    expect(result).toMatch(/performance/i);
    expect(result).toMatch(/competitor/i);
    expect(result).toMatch(/audience/i);
  });

  it('returns fallback message when no intel data exists', async () => {
    const mod = await import('@/lib/copilot/intel-context');
    getCondensedIntelSummary = mod.getCondensedIntelSummary;

    const result = await getCondensedIntelSummary({ accountId: null });
    expect(typeof result).toBe('string');
    expect(result).toMatch(/cron/i);
  });

  it('respects ~500 token budget', async () => {
    const mod = await import('@/lib/copilot/intel-context');
    getCondensedIntelSummary = mod.getCondensedIntelSummary;

    const result = await getCondensedIntelSummary({ accountId: 'acct-1' });
    // ~500 tokens is roughly 2500 chars
    expect(result.length).toBeLessThan(2500);
  });
});
