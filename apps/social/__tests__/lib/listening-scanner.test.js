import { describe, it, expect } from 'vitest';
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
} from '@/lib/listening-scanner';

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
});
