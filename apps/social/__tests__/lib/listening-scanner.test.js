import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeSentiment,
  normalize,
  computeContentRelevance,
  getTopicType,
  TOPIC_WEIGHT_PROFILES,
  resolveFinancialSentiment,
  computeEngagementVelocity,
  generateTopicDedupKey,
  TOPIC_DEDUP_TTL_SECONDS,
  batchValidateRelevance,
} from '@/lib/listening-scanner';

// Mock generateInsight for batchValidateRelevance tests
vi.mock('@/lib/ai', () => ({
  generateInsight: vi.fn(),
}));

import { generateInsight } from '@/lib/ai';

describe('listening-scanner', () => {
  describe('analyzeSentiment', () => {
    it('returns POSITIVE for text with positive keywords', () => {
      expect(analyzeSentiment('This is a great product, very bullish on the future')).toBe('POSITIVE');
    });

    it('returns NEGATIVE for text with negative keywords', () => {
      expect(analyzeSentiment('This is a terrible scam, avoid at all costs')).toBe('NEGATIVE');
    });

    it('returns NEUTRAL for balanced or empty text', () => {
      expect(analyzeSentiment('Figure announced a new product today')).toBe('NEUTRAL');
    });

    it('returns NEUTRAL for empty string', () => {
      expect(analyzeSentiment('')).toBe('NEUTRAL');
    });

    it('handles negation — "not great" should be negative', () => {
      expect(analyzeSentiment('This project is not great at all')).toBe('NEGATIVE');
    });

    it('handles negation of negative — "not terrible" should be positive', () => {
      expect(analyzeSentiment("This product is not terrible, it's decent")).toBe('POSITIVE');
    });

    it('is case insensitive', () => {
      expect(analyzeSentiment('BULLISH ON FIGR')).toBe('POSITIVE');
    });
  });

  describe('normalize', () => {
    it('returns 0 for 0 value', () => {
      expect(normalize(0)).toBe(0);
    });

    it('returns 0 for negative value', () => {
      expect(normalize(-5)).toBe(0);
    });

    it('returns 0 for null/undefined', () => {
      expect(normalize(null)).toBe(0);
      expect(normalize(undefined)).toBe(0);
    });

    it('returns value between 0 and 1 for positive value', () => {
      const result = normalize(1000);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('caps at 1 for very large values', () => {
      expect(normalize(1_000_000)).toBe(1);
    });

    it('returns smaller value for smaller inputs', () => {
      expect(normalize(10)).toBeLessThan(normalize(10000));
    });

    it('respects custom maxExpected', () => {
      const withDefault = normalize(500, 100000);
      const withSmallMax = normalize(500, 1000);
      expect(withSmallMax).toBeGreaterThan(withDefault);
    });
  });

  describe('computeContentRelevance', () => {
    it('returns high relevance for content matching high-weight terms', () => {
      const score = computeContentRelevance(
        'Figure just launched a new HELOC product on Provenance blockchain',
        '"Figure Markets" OR "provenance blockchain"'
      );
      expect(score).toBeGreaterThanOrEqual(0.5);
    });

    it('returns 0 for content with no matching terms', () => {
      const score = computeContentRelevance(
        'Today I went to the grocery store and bought some apples',
        '"Figure Markets" OR "$FIGR"'
      );
      expect(score).toBe(0);
    });

    it('returns 0.5 for empty query (no matchable terms)', () => {
      const score = computeContentRelevance(
        'Some content about crypto',
        'OR AND NOT'
      );
      expect(score).toBe(0.5);
    });

    it('strips X search operators before matching', () => {
      const score = computeContentRelevance(
        'Securitize is launching a new product',
        'from:securitize OR "Securitize" min_faves:5 lang:en -giveaway'
      );
      expect(score).toBeGreaterThan(0);
    });

    it('weights brand terms higher than generic terms', () => {
      // "figure" is HIGH_WEIGHT (3x), generic terms are 1x
      const scoreWithBrand = computeContentRelevance(
        'Figure is expanding into new markets',
        '"Figure" markets expanding'
      );
      const scoreWithoutBrand = computeContentRelevance(
        'expanding into new markets today',
        '"Figure" markets expanding'
      );
      expect(scoreWithBrand).toBeGreaterThan(scoreWithoutBrand);
    });

    it('returns between 0 and 1', () => {
      const score = computeContentRelevance(
        'Figure $FIGR provenance blockchain HELOC lending',
        '"Figure" OR "$FIGR" OR "provenance"'
      );
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('getTopicType', () => {
    it('returns KOL for topic with "KOL" in name', () => {
      expect(getTopicType({ name: 'KOL Influencers' })).toBe('KOL');
    });

    it('returns COMPETITOR for topic with "Competitor" in name', () => {
      expect(getTopicType({ name: 'Competitor: Securitize' })).toBe('COMPETITOR');
    });

    it('returns BRAND for generic topic names', () => {
      expect(getTopicType({ name: 'Figure Brand Monitor' })).toBe('BRAND');
    });

    it('is case insensitive', () => {
      expect(getTopicType({ name: 'kol tracking' })).toBe('KOL');
      expect(getTopicType({ name: 'competitor analysis' })).toBe('COMPETITOR');
    });
  });

  describe('topic-adaptive weights', () => {
    it('KOL profile emphasizes followers', () => {
      expect(TOPIC_WEIGHT_PROFILES.KOL.followers).toBe(0.35);
    });

    it('COMPETITOR profile emphasizes content relevance', () => {
      expect(TOPIC_WEIGHT_PROFILES.COMPETITOR.contentRelevance).toBe(0.55);
    });

    it('BRAND profile uses balanced weights', () => {
      expect(TOPIC_WEIGHT_PROFILES.BRAND.contentRelevance).toBe(0.45);
      expect(TOPIC_WEIGHT_PROFILES.BRAND.engagement).toBe(0.25);
    });

    it('all profiles have weights summing to 1.0', () => {
      for (const [type, profile] of Object.entries(TOPIC_WEIGHT_PROFILES)) {
        const sum = profile.contentRelevance + profile.engagement + profile.followers + profile.recency;
        expect(sum).toBeCloseTo(1.0, 10);
      }
    });
  });

  describe('resolveFinancialSentiment', () => {
    it('returns bearish for "shorting BTC aggressively"', () => {
      expect(resolveFinancialSentiment('shorting BTC aggressively', 'short')).toBe('bearish');
    });

    it('returns neutral for "short video about crypto"', () => {
      expect(resolveFinancialSentiment('short video about crypto', 'short')).toBe('neutral');
    });

    it('returns positive for "to the moon!"', () => {
      expect(resolveFinancialSentiment('to the moon!', 'moon')).toBe('positive');
    });

    it('returns neutral for "full moon tonight"', () => {
      expect(resolveFinancialSentiment('full moon tonight', 'moon')).toBe('neutral');
    });

    it('returns negative for "rug pull alert"', () => {
      expect(resolveFinancialSentiment('rug pull alert', 'rug')).toBe('negative');
    });

    it('returns neutral for "under the rug"', () => {
      expect(resolveFinancialSentiment('under the rug', 'rug')).toBe('neutral');
    });

    it('returns null for unknown term', () => {
      expect(resolveFinancialSentiment('some text', 'unknown')).toBeNull();
    });

    it('handles dump in financial context', () => {
      expect(resolveFinancialSentiment('token dump incoming', 'dump')).toBe('negative');
    });

    it('handles dump in non-financial context', () => {
      expect(resolveFinancialSentiment('data dump from the server', 'dump')).toBe('neutral');
    });
  });

  describe('computeEngagementVelocity', () => {
    it('returns engagement per hour', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(computeEngagementVelocity(100, twoHoursAgo)).toBe(50);
    });

    it('floors age at 0.5 hours for very recent posts', () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      // 50 / 0.5 = 100
      expect(computeEngagementVelocity(50, tenMinAgo)).toBe(100);
    });

    it('returns 0 for zero engagement', () => {
      expect(computeEngagementVelocity(0, new Date())).toBe(0);
    });

    it('returns 0 for falsy engagement', () => {
      expect(computeEngagementVelocity(null, new Date())).toBe(0);
      expect(computeEngagementVelocity(undefined, new Date())).toBe(0);
    });
  });

  describe('cross-query dedup', () => {
    it('generates correct Redis key format', () => {
      expect(generateTopicDedupKey('topic-123', 'post-456')).toBe('listening:dedup:topic-123:post-456');
    });

    it('generates key with different inputs', () => {
      expect(generateTopicDedupKey('abc', 'def')).toBe('listening:dedup:abc:def');
    });

    it('has correct TTL of 7 days in seconds', () => {
      expect(TOPIC_DEDUP_TTL_SECONDS).toBe(604800);
    });
  });

  describe('batchValidateRelevance', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('calls generateInsight with correct model and returns multipliers', async () => {
      generateInsight.mockResolvedValue([
        { index: 0, multiplier: 1.3, reason: 'highly relevant to Figure ecosystem' },
      ]);

      const hits = [
        { content: 'Figure Markets launches new HELOC product', authorFollowers: 5000, engagementCount: 200 },
      ];
      const result = await batchValidateRelevance(hits, 'Figure Brand Monitor');

      expect(generateInsight).toHaveBeenCalledTimes(1);
      // Verify model is claude-haiku-4-5-20251001
      const callArgs = generateInsight.mock.calls[0];
      expect(callArgs[0]).toBe('listening/relevance-validation');
      expect(callArgs[2].model).toBe('claude-haiku-4-5-20251001');
      // Verify systemPrompt mentions 0.5-1.5 range
      expect(callArgs[2].systemPrompt).toContain('0.5');
      expect(callArgs[2].systemPrompt).toContain('1.5');

      expect(result).toEqual([
        { index: 0, multiplier: 1.3, reason: 'highly relevant to Figure ecosystem' },
      ]);
    });

    it('truncates content to 500 chars per hit', async () => {
      generateInsight.mockResolvedValue([
        { index: 0, multiplier: 1.0, reason: 'ok' },
      ]);

      const longContent = 'A'.repeat(1000);
      const hits = [{ content: longContent, authorFollowers: 100, engagementCount: 10 }];
      await batchValidateRelevance(hits, 'Test Topic');

      const contextArg = generateInsight.mock.calls[0][1];
      // The context string should not contain the full 1000-char content
      expect(contextArg).not.toContain('A'.repeat(600));
      expect(contextArg).toContain('A'.repeat(500));
    });

    it('returns multiplier 1.0 for all hits when generateInsight throws', async () => {
      generateInsight.mockRejectedValue(new Error('API unavailable'));

      const hits = [
        { content: 'Post 1', authorFollowers: 100, engagementCount: 10 },
        { content: 'Post 2', authorFollowers: 200, engagementCount: 20 },
        { content: 'Post 3', authorFollowers: 300, engagementCount: 30 },
      ];
      const result = await batchValidateRelevance(hits, 'Test Topic');

      expect(result).toHaveLength(3);
      result.forEach((r, i) => {
        expect(r.index).toBe(i);
        expect(r.multiplier).toBe(1.0);
        expect(r.reason).toBe('fallback');
      });
    });

    it('returns empty array for empty hits', async () => {
      const result = await batchValidateRelevance([], 'Test Topic');
      expect(result).toEqual([]);
      expect(generateInsight).not.toHaveBeenCalled();
    });
  });

  describe('analyzeSentiment with financial context', () => {
    it('resolves "shorting BTC hard" using financial context instead of generic keyword', () => {
      // "short" appears in NEGATIVE_KEYWORDS but also in FINANCIAL_AMBIGUOUS_TERMS
      // Financial context should resolve "shorting" as bearish -> negativeCount++
      // and prevent double-counting from the NEGATIVE_KEYWORDS loop
      const result = analyzeSentiment('shorting BTC hard');
      expect(result).toBe('NEGATIVE');
    });

    it('resolves "short video about crypto" as neutral — not negative', () => {
      // Without financial context, "short" would be matched as negative keyword.
      // Financial context should resolve "short video" as neutral, skipping it in keywords.
      const result = analyzeSentiment('short video about crypto');
      expect(result).toBe('NEUTRAL');
    });

    it('non-financial text still works as before', () => {
      // Text without any financial ambiguous terms should behave identically
      expect(analyzeSentiment('This is a great product')).toBe('POSITIVE');
      expect(analyzeSentiment('This is terrible and awful')).toBe('NEGATIVE');
      expect(analyzeSentiment('Figure announced something today')).toBe('NEUTRAL');
    });

    it('resolves "to the moon" as positive via financial context', () => {
      // "moon" is in POSITIVE_KEYWORDS AND FINANCIAL_AMBIGUOUS_TERMS
      // Financial context should resolve "to the moon" as positive
      const result = analyzeSentiment('to the moon! amazing!');
      expect(result).toBe('POSITIVE');
    });

    it('resolves "full moon tonight" neutrally — moon is not financial here', () => {
      // "moon" would normally match POSITIVE_KEYWORDS
      // Financial context should resolve "full moon" as neutral, preventing positive count
      const result = analyzeSentiment('full moon tonight over the city');
      expect(result).toBe('NEUTRAL');
    });
  });

  describe('integrated scoring with topic-adaptive weights', () => {
    it('KOL topic scoring uses follower weight 0.35 (not default 0.20)', () => {
      const kolWeights = TOPIC_WEIGHT_PROFILES[getTopicType({ name: 'KOL Influencers' })];
      expect(kolWeights.followers).toBe(0.35);
      // Verify it differs from BRAND default
      expect(kolWeights.followers).not.toBe(TOPIC_WEIGHT_PROFILES.BRAND.followers);
    });

    it('COMPETITOR topic scoring uses contentRelevance weight 0.55 (not default 0.45)', () => {
      const compWeights = TOPIC_WEIGHT_PROFILES[getTopicType({ name: 'Competitor: Securitize' })];
      expect(compWeights.contentRelevance).toBe(0.55);
      expect(compWeights.contentRelevance).not.toBe(TOPIC_WEIGHT_PROFILES.BRAND.contentRelevance);
    });

    it('blended engagement calculation works correctly', () => {
      // Test the blending formula: 0.6 * normalize(engagement) + 0.4 * normalize(velocity, 500)
      const engagement = 5000;
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const velocity = computeEngagementVelocity(engagement, twoHoursAgo); // 2500/hr
      const blended = 0.6 * normalize(engagement, 100000) + 0.4 * normalize(velocity, 500);

      // Blended should be between the two individual values
      expect(blended).toBeGreaterThan(0);
      expect(blended).toBeLessThanOrEqual(1);
      // With velocity of 2500/hr normalized to max 500, the velocity component should be high
      expect(blended).toBeGreaterThan(normalize(engagement, 100000));
    });
  });
});
