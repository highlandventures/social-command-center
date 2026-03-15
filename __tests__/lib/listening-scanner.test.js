import { describe, it, expect } from 'vitest';
import { analyzeSentiment, normalize, computeContentRelevance } from '@/lib/listening-scanner';

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
});
