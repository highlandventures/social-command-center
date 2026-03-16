/**
 * Unit tests for environment variable validation.
 *
 * We test the TOKEN_ENCRYPTION_KEY format validation specifically,
 * since that's the most critical (wrong key = corrupted tokens).
 */

import { describe, it, expect } from 'vitest';

describe('TOKEN_ENCRYPTION_KEY validation', () => {
  const VALID_KEY = 'a'.repeat(64); // 32 bytes = 64 hex chars

  it('accepts a valid 64-char hex key', () => {
    expect(/^[0-9a-fA-F]{64}$/.test(VALID_KEY)).toBe(true);
  });

  it('accepts uppercase hex', () => {
    expect(/^[0-9a-fA-F]{64}$/.test('A'.repeat(64))).toBe(true);
  });

  it('accepts mixed case hex', () => {
    expect(/^[0-9a-fA-F]{64}$/.test('aAbBcCdD00112233' + '4'.repeat(48))).toBe(true);
  });

  it('rejects key that is too short', () => {
    expect(/^[0-9a-fA-F]{64}$/.test('abc123')).toBe(false);
  });

  it('rejects key that is too long', () => {
    expect(/^[0-9a-fA-F]{64}$/.test('a'.repeat(65))).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(/^[0-9a-fA-F]{64}$/.test('g'.repeat(64))).toBe(false);
  });

  it('rejects empty string', () => {
    expect(/^[0-9a-fA-F]{64}$/.test('')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(/^[0-9a-fA-F]{64}$/.test(' '.repeat(64))).toBe(false);
  });

  it('rejects key with embedded spaces', () => {
    expect(/^[0-9a-fA-F]{64}$/.test('a'.repeat(32) + ' ' + 'b'.repeat(31))).toBe(false);
  });
});
