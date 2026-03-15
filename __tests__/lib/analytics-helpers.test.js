import { describe, it, expect } from 'vitest';
import { rangeToDays, rangeToDate, rangeToEndDate } from '@/lib/routers/analytics';

describe('analytics helpers', () => {
  describe('rangeToDays', () => {
    it('returns 7 for "7d"', () => {
      expect(rangeToDays('7d')).toBe(7);
    });

    it('returns 30 for "30d"', () => {
      expect(rangeToDays('30d')).toBe(30);
    });

    it('returns 90 for "90d"', () => {
      expect(rangeToDays('90d')).toBe(90);
    });

    it('returns 365 for "365d"', () => {
      expect(rangeToDays('365d')).toBe(365);
    });

    it('defaults to 30 for unknown range', () => {
      expect(rangeToDays('unknown')).toBe(30);
    });

    it('computes custom range from start/end dates', () => {
      expect(rangeToDays('custom', '2026-01-01', '2026-01-15')).toBe(14);
    });

    it('returns at least 1 for same-day custom range', () => {
      expect(rangeToDays('custom', '2026-01-01', '2026-01-01')).toBe(1);
    });

    it('ignores startDate/endDate when range is not custom', () => {
      expect(rangeToDays('7d', '2026-01-01', '2026-06-01')).toBe(7);
    });
  });

  describe('rangeToDate', () => {
    it('returns a Date in the past for standard ranges', () => {
      const now = Date.now();
      const result = rangeToDate('7d');
      const diff = now - result.getTime();
      // Should be approximately 7 days in milliseconds (within 1 second tolerance)
      expect(diff).toBeGreaterThan(6.99 * 24 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(7.01 * 24 * 60 * 60 * 1000);
    });

    it('returns start-of-day UTC for custom startDate', () => {
      const result = rangeToDate('custom', '2026-03-01');
      expect(result.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    });

    it('falls back to default when custom has no startDate', () => {
      const result = rangeToDate('custom');
      expect(result).toBeInstanceOf(Date);
      // Should be ~30 days ago (default rangeToDays)
      const diff = Date.now() - result.getTime();
      expect(diff).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    });
  });

  describe('rangeToEndDate', () => {
    it('returns end-of-day UTC for custom endDate', () => {
      const result = rangeToEndDate('custom', '2026-03-15');
      expect(result.toISOString()).toBe('2026-03-15T23:59:59.999Z');
    });

    it('returns approximately now for non-custom range', () => {
      const before = Date.now();
      const result = rangeToEndDate('30d');
      const after = Date.now();
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });

    it('returns approximately now when custom has no endDate', () => {
      const before = Date.now();
      const result = rangeToEndDate('custom');
      const after = Date.now();
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });
  });
});
