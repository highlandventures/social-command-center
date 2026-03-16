import { describe, it, expect, vi } from 'vitest';

// Mock prisma before any imports
vi.mock('@/lib/db', () => ({
  default: {
    socialPost: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

describe.skip('lib/copilot/brand-voice', () => {
  let getTopPostsForAccount;

  it('getTopPostsForAccount returns top posts sorted by engagement', async () => {
    const mod = await import('@/lib/copilot/brand-voice');
    getTopPostsForAccount = mod.getTopPostsForAccount;

    const posts = await getTopPostsForAccount({ accountId: 'acct-1' });
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThanOrEqual(3);
    expect(posts.length).toBeLessThanOrEqual(5);
    for (const post of posts) {
      expect(post).toHaveProperty('content');
      expect(post).toHaveProperty('contentType');
      expect(post).toHaveProperty('engagementRate');
    }
  });

  it('returns empty array when accountId is null', async () => {
    const mod = await import('@/lib/copilot/brand-voice');
    getTopPostsForAccount = mod.getTopPostsForAccount;

    const posts = await getTopPostsForAccount({ accountId: null });
    expect(posts).toEqual([]);
  });

  it('truncates post content to 200 chars', async () => {
    const mod = await import('@/lib/copilot/brand-voice');
    getTopPostsForAccount = mod.getTopPostsForAccount;

    const posts = await getTopPostsForAccount({ accountId: 'acct-1' });
    for (const post of posts) {
      expect(post.content.length).toBeLessThanOrEqual(200);
    }
  });
});
