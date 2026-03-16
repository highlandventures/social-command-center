import { describe, it, expect } from 'vitest';

describe.skip('lib/copilot/draft-detector', () => {
  let isDraftContent;

  it('detects explicit draft markers', async () => {
    const mod = await import('@/lib/copilot/draft-detector');
    isDraftContent = mod.isDraftContent;

    const result = isDraftContent("Here's a draft: We're excited to announce our new product launch.");
    expect(result).toBe(true);
  });

  it('detects thread format', async () => {
    const mod = await import('@/lib/copilot/draft-detector');
    isDraftContent = mod.isDraftContent;

    const result = isDraftContent("1. First tweet\n2. Second tweet\n3. Third tweet");
    expect(result).toBe(true);
  });

  it('returns false for conversational messages', async () => {
    const mod = await import('@/lib/copilot/draft-detector');
    isDraftContent = mod.isDraftContent;

    const result = isDraftContent("What topics should I write about?");
    expect(result).toBe(false);
  });
});
