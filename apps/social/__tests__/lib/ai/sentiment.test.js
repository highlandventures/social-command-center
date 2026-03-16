/**
 * Unit tests for keyword-based sentiment analysis.
 *
 * Tests the pure `analyzeSentimentKeyword` function which requires
 * no API calls — fast, deterministic, and safe to run in CI.
 */

import { describe, it, expect } from 'vitest';
import { analyzeSentimentKeyword } from '@/lib/ai/sentiment';

describe('analyzeSentimentKeyword', () => {
  // ── Positive sentiment ──

  it('detects clearly positive text', () => {
    const result = analyzeSentimentKeyword('This product is amazing and brilliant! Love it.');
    expect(result.sentiment).toBe('POSITIVE');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects positive with multiple keywords', () => {
    const result = analyzeSentimentKeyword(
      'Incredible work, this is fantastic. Truly outstanding and impressive.'
    );
    expect(result.sentiment).toBe('POSITIVE');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('detects bullish as positive', () => {
    const result = analyzeSentimentKeyword('Very bullish on this project, excited about the future.');
    expect(result.sentiment).toBe('POSITIVE');
  });

  // ── Negative sentiment ──

  it('detects clearly negative text', () => {
    const result = analyzeSentimentKeyword('This is terrible and broken. Such a failure.');
    expect(result.sentiment).toBe('NEGATIVE');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects complaint-style negative', () => {
    const result = analyzeSentimentKeyword(
      'The app crashed again, this is a disaster. Totally frustrated with these bugs.'
    );
    expect(result.sentiment).toBe('NEGATIVE');
  });

  it('detects bearish as negative', () => {
    const result = analyzeSentimentKeyword('Looking bearish, concerned about the poor performance.');
    expect(result.sentiment).toBe('NEGATIVE');
  });

  // ── Neutral sentiment ──

  it('returns NEUTRAL for text with no sentiment keywords', () => {
    const result = analyzeSentimentKeyword('The meeting is scheduled for Tuesday at 3pm.');
    expect(result.sentiment).toBe('NEUTRAL');
  });

  it('returns NEUTRAL for balanced positive and negative', () => {
    const result = analyzeSentimentKeyword(
      'The product is amazing but the service was terrible. Good features, bad support.'
    );
    expect(result.sentiment).toBe('NEUTRAL');
  });

  // ── Edge cases ──

  it('returns NEUTRAL with 0 confidence for null input', () => {
    const result = analyzeSentimentKeyword(null);
    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.confidence).toBe(0);
  });

  it('returns NEUTRAL with 0 confidence for undefined input', () => {
    const result = analyzeSentimentKeyword(undefined);
    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.confidence).toBe(0);
  });

  it('returns NEUTRAL with 0 confidence for non-string input', () => {
    const result = analyzeSentimentKeyword(42);
    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.confidence).toBe(0);
  });

  it('returns NEUTRAL for empty string', () => {
    const result = analyzeSentimentKeyword('');
    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.confidence).toBe(0);
  });

  it('handles single-word input', () => {
    const result = analyzeSentimentKeyword('amazing');
    expect(result.sentiment).toBe('POSITIVE');
  });

  it('is case-insensitive', () => {
    const result = analyzeSentimentKeyword('AMAZING FANTASTIC BRILLIANT');
    expect(result.sentiment).toBe('POSITIVE');
  });

  it('handles punctuation-heavy text', () => {
    const result = analyzeSentimentKeyword('Amazing!!! Incredible!!! Best thing ever!!!');
    expect(result.sentiment).toBe('POSITIVE');
  });

  // ── Multi-word phrases ──

  it('detects multi-word phrase "well done"', () => {
    const result = analyzeSentimentKeyword('Well done on the launch, really well done team.');
    expect(result.sentiment).toBe('POSITIVE');
  });

  // ── Confidence scoring ──

  it('returns higher confidence for stronger signals', () => {
    const weak = analyzeSentimentKeyword('This is good.');
    const strong = analyzeSentimentKeyword(
      'This is amazing, incredible, fantastic, brilliant, outstanding, and phenomenal!'
    );
    expect(strong.confidence).toBeGreaterThanOrEqual(weak.confidence);
  });

  it('confidence is between 0 and 1', () => {
    const texts = [
      'amazing product',
      'terrible failure',
      'meeting at noon',
      'love it but hate the price',
    ];
    for (const text of texts) {
      const result = analyzeSentimentKeyword(text);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('confidence never exceeds 0.95', () => {
    // Even with tons of positive keywords, confidence should cap at 0.95
    const result = analyzeSentimentKeyword(
      'amazing brilliant excellent fantastic great incredible inspiring love outstanding perfect phenomenal remarkable stellar tremendous wonderful'
    );
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });
});
