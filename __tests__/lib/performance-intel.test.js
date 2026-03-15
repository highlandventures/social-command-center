import { describe, it, expect } from 'vitest';
import {
  computeTiers,
  computeFormatPatterns,
  computeTimePatterns,
  computeTopicSignals,
  percentile,
} from '../../lib/routers/performance-intel.js';

// ── Test data factories ───────────────────────────────────────

function makePost(overrides = {}) {
  return {
    id: overrides.id || 'post-1',
    content: overrides.content || 'Test post content',
    contentType: overrides.contentType || 'POST',
    platform: overrides.platform || 'X',
    publishedAt: 'publishedAt' in overrides ? overrides.publishedAt : new Date('2026-03-10T14:00:00Z'),
    username: overrides.username || 'testuser',
    impressions: overrides.impressions ?? 1000,
    engagements: overrides.engagements ?? 50,
    engagementRate: overrides.engagementRate ?? 5,
    likes: overrides.likes ?? 30,
    retweets: overrides.retweets ?? 10,
    replies: overrides.replies ?? 10,
  };
}

// ── percentile ────────────────────────────────────────────────

describe('percentile', () => {
  it('returns 0 for empty array', () => {
    expect(percentile([], 75)).toBe(0);
  });

  it('returns the only value for single-element array', () => {
    expect(percentile([5], 75)).toBe(5);
  });

  it('computes 75th percentile correctly', () => {
    const sorted = [1, 2, 5, 8, 10];
    const p75 = percentile(sorted, 75);
    expect(p75).toBe(8);
  });

  it('computes 25th percentile correctly', () => {
    const sorted = [1, 2, 5, 8, 10];
    const p25 = percentile(sorted, 25);
    expect(p25).toBe(2);
  });
});

// ── computeTiers ──────────────────────────────────────────────

describe('computeTiers', () => {
  it('correctly assigns posts to tiers based on engagement rate percentiles', () => {
    const posts = [
      makePost({ id: 'p1', engagementRate: 10 }),
      makePost({ id: 'p2', engagementRate: 5 }),
      makePost({ id: 'p3', engagementRate: 2 }),
      makePost({ id: 'p4', engagementRate: 8 }),
      makePost({ id: 'p5', engagementRate: 1 }),
    ];

    const tiers = computeTiers(posts);

    // Sorted rates: [1, 2, 5, 8, 10]
    // P75 = 8, P25 = 2
    // Top (>=8): 10, 8
    // Average (>=2, <8): 5, 2
    // Poor (<2): 1
    const topIds = tiers.top.map((p) => p.id).sort();
    const avgIds = tiers.average.map((p) => p.id).sort();
    const poorIds = tiers.poor.map((p) => p.id).sort();

    expect(topIds).toEqual(['p1', 'p4']);
    expect(avgIds).toEqual(['p2', 'p3']);
    expect(poorIds).toEqual(['p5']);
  });

  it('returns empty tiers for empty post list', () => {
    const tiers = computeTiers([]);
    expect(tiers.top).toEqual([]);
    expect(tiers.average).toEqual([]);
    expect(tiers.poor).toEqual([]);
  });

  it('handles posts with zero impressions (0% engagement rate) in poor tier', () => {
    // With enough non-zero posts, 0% rate posts fall below p25 and land in poor tier
    const posts = [
      makePost({ id: 'p1', engagementRate: 10, impressions: 1000 }),
      makePost({ id: 'p2', engagementRate: 7, impressions: 500 }),
      makePost({ id: 'p3', engagementRate: 5, impressions: 800 }),
      makePost({ id: 'p4', engagementRate: 3, impressions: 300 }),
      makePost({ id: 'p5', engagementRate: 0, impressions: 0 }),
    ];

    const tiers = computeTiers(posts);

    // Sorted rates: [0, 3, 5, 7, 10]
    // P25 = 3, P75 = 7
    // Poor (<3): 0
    const poorIds = tiers.poor.map((p) => p.id).sort();
    expect(poorIds).toContain('p5');
    expect(poorIds.length).toBe(1);

    // Top (>=7): 10, 7
    const topIds = tiers.top.map((p) => p.id).sort();
    expect(topIds).toEqual(['p1', 'p2']);
  });

  it('handles single post (goes to all tiers based on percentile math)', () => {
    const posts = [makePost({ id: 'p1', engagementRate: 5 })];
    const tiers = computeTiers(posts);

    // Single post: p75 = p25 = 5, so engRate >= p75, goes to top
    expect(tiers.top.length + tiers.average.length + tiers.poor.length).toBe(1);
  });
});

// ── computeFormatPatterns ─────────────────────────────────────

describe('computeFormatPatterns', () => {
  it('groups posts by contentType and computes average engagement rate', () => {
    const posts = [
      makePost({ contentType: 'POST', engagementRate: 4, impressions: 1000 }),
      makePost({ contentType: 'POST', engagementRate: 6, impressions: 2000 }),
      makePost({ contentType: 'THREAD', engagementRate: 10, impressions: 3000 }),
      makePost({ contentType: 'THREAD', engagementRate: 8, impressions: 1500 }),
      makePost({ contentType: 'ARTICLE', engagementRate: 3, impressions: 500 }),
    ];

    const patterns = computeFormatPatterns(posts);

    const postPattern = patterns.find((p) => p.format === 'POST');
    const threadPattern = patterns.find((p) => p.format === 'THREAD');
    const articlePattern = patterns.find((p) => p.format === 'ARTICLE');

    expect(postPattern).toBeDefined();
    expect(postPattern.postCount).toBe(2);
    expect(postPattern.avgEngRate).toBe(5); // (4+6)/2

    expect(threadPattern).toBeDefined();
    expect(threadPattern.postCount).toBe(2);
    expect(threadPattern.avgEngRate).toBe(9); // (10+8)/2

    expect(articlePattern).toBeDefined();
    expect(articlePattern.postCount).toBe(1);
    expect(articlePattern.avgEngRate).toBe(3);
  });

  it('returns empty array for empty post list', () => {
    expect(computeFormatPatterns([])).toEqual([]);
  });

  it('computes average impressions per format', () => {
    const posts = [
      makePost({ contentType: 'POST', impressions: 1000 }),
      makePost({ contentType: 'POST', impressions: 3000 }),
    ];

    const patterns = computeFormatPatterns(posts);
    const postPattern = patterns.find((p) => p.format === 'POST');

    expect(postPattern.avgImpressions).toBe(2000); // (1000+3000)/2
  });
});

// ── computeTimePatterns ───────────────────────────────────────

describe('computeTimePatterns', () => {
  it('groups posts by day/hour and computes avg engagement rate', () => {
    // Monday 14:00 UTC
    const posts = [
      makePost({
        publishedAt: new Date('2026-03-09T14:00:00Z'), // Mon
        engagementRate: 8,
      }),
      makePost({
        publishedAt: new Date('2026-03-09T14:30:00Z'), // Mon same hour
        engagementRate: 6,
      }),
      makePost({
        publishedAt: new Date('2026-03-10T10:00:00Z'), // Tue
        engagementRate: 4,
      }),
    ];

    const patterns = computeTimePatterns(posts);

    const monSlot = patterns.find((p) => p.day === 'Mon' && p.hour === 14);
    expect(monSlot).toBeDefined();
    expect(monSlot.postCount).toBe(2);
    expect(monSlot.avgEngRate).toBe(7); // (8+6)/2

    const tueSlot = patterns.find((p) => p.day === 'Tue' && p.hour === 10);
    expect(tueSlot).toBeDefined();
    expect(tueSlot.postCount).toBe(1);
    expect(tueSlot.avgEngRate).toBe(4);
  });

  it('returns sorted by engagement rate (best first)', () => {
    const posts = [
      makePost({ publishedAt: new Date('2026-03-09T10:00:00Z'), engagementRate: 2 }),
      makePost({ publishedAt: new Date('2026-03-10T14:00:00Z'), engagementRate: 10 }),
      makePost({ publishedAt: new Date('2026-03-11T08:00:00Z'), engagementRate: 5 }),
    ];

    const patterns = computeTimePatterns(posts);
    expect(patterns[0].avgEngRate).toBeGreaterThanOrEqual(patterns[1].avgEngRate);
    expect(patterns[1].avgEngRate).toBeGreaterThanOrEqual(patterns[2].avgEngRate);
  });

  it('returns empty array for empty post list', () => {
    expect(computeTimePatterns([])).toEqual([]);
  });

  it('skips posts without publishedAt', () => {
    const posts = [
      makePost({ publishedAt: null, engagementRate: 5 }),
    ];
    expect(computeTimePatterns(posts)).toEqual([]);
  });
});

// ── computeTopicSignals ───────────────────────────────────────

describe('computeTopicSignals', () => {
  it('extracts common bigrams/trigrams from post content', () => {
    const posts = [
      makePost({ content: 'Real world assets are changing finance', engagementRate: 8 }),
      makePost({ content: 'Real world assets tokenization is growing', engagementRate: 10 }),
      makePost({ content: 'Real world assets discussion today', engagementRate: 6 }),
    ];

    const signals = computeTopicSignals(posts);

    // "real world" and "world assets" should appear 3 times each
    const realWorld = signals.find((s) => s.phrase === 'real world');
    const worldAssets = signals.find((s) => s.phrase === 'world assets');

    expect(realWorld).toBeDefined();
    expect(realWorld.occurrences).toBe(3);
    expect(worldAssets).toBeDefined();
    expect(worldAssets.occurrences).toBe(3);
  });

  it('returns empty array for empty post list', () => {
    expect(computeTopicSignals([])).toEqual([]);
  });

  it('filters out phrases with fewer than 2 occurrences', () => {
    const posts = [
      makePost({ content: 'unique phrase only appears once here', engagementRate: 5 }),
      makePost({ content: 'another completely different sentence', engagementRate: 3 }),
    ];

    const signals = computeTopicSignals(posts);
    // No phrase should appear 2+ times
    expect(signals.length).toBe(0);
  });

  it('strips URLs and mentions from content before analysis', () => {
    const posts = [
      makePost({ content: '@someone check https://example.com real world assets', engagementRate: 8 }),
      makePost({ content: '@other see https://test.com real world assets', engagementRate: 6 }),
    ];

    const signals = computeTopicSignals(posts);
    // Should find "real world" but no URL or mention fragments
    const hasUrl = signals.some((s) => s.phrase.includes('http') || s.phrase.includes('example'));
    expect(hasUrl).toBe(false);
  });
});
