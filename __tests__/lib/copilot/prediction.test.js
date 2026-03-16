import { describe, it, expect, vi } from 'vitest';

// Mock prisma before any imports
vi.mock('@/lib/db', () => ({
  default: {
    socialPost: { aggregate: vi.fn().mockResolvedValue({ _avg: { engagementRate: 2.5 } }) },
  },
}));

describe.skip('lib/copilot/prediction', () => {
  let formatPredictionCard;

  it('formatPredictionCard returns score card object', async () => {
    const mod = await import('@/lib/copilot/prediction');
    formatPredictionCard = mod.formatPredictionCard;

    const card = await formatPredictionCard({
      draftContent: 'Check out our latest product update!',
      accountId: 'acct-1',
    });
    expect(card).toHaveProperty('engagementRate');
    expect(card).toHaveProperty('impressionsEstimate');
    expect(card).toHaveProperty('confidence');
    expect(card).toHaveProperty('comparisonToAvg');
  });

  it('handles missing account context gracefully', async () => {
    const mod = await import('@/lib/copilot/prediction');
    formatPredictionCard = mod.formatPredictionCard;

    const card = await formatPredictionCard({
      draftContent: 'A simple post',
      accountId: null,
    });
    expect(card).toHaveProperty('engagementRate');
    expect(card.comparisonToAvg).toBeNull();
  });
});
