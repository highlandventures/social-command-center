/**
 * Unit tests for cron authentication.
 *
 * Verifies that:
 * - Valid Bearer tokens are accepted
 * - Missing auth headers are rejected
 * - Wrong tokens are rejected
 * - Edge cases are handled safely
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { verifyCronAuth } from '@/lib/cron-auth';

const TEST_CRON_SECRET = 'test-cron-secret-abc123';

beforeAll(() => {
  process.env.CRON_SECRET = TEST_CRON_SECRET;
});

afterAll(() => {
  delete process.env.CRON_SECRET;
});

// Helper to create a mock Request with headers
function mockRequest(authHeader) {
  return {
    headers: {
      get: (name) => {
        if (name.toLowerCase() === 'authorization') return authHeader;
        return null;
      },
    },
  };
}

describe('verifyCronAuth', () => {
  it('accepts valid Bearer token', () => {
    const req = mockRequest(`Bearer ${TEST_CRON_SECRET}`);
    expect(verifyCronAuth(req)).toBe(true);
  });

  it('rejects missing authorization header', () => {
    const req = mockRequest(null);
    expect(verifyCronAuth(req)).toBe(false);
  });

  it('rejects empty authorization header', () => {
    const req = mockRequest('');
    expect(verifyCronAuth(req)).toBe(false);
  });

  it('rejects wrong token', () => {
    const req = mockRequest('Bearer wrong-token-xyz');
    expect(verifyCronAuth(req)).toBe(false);
  });

  it('rejects token without Bearer prefix', () => {
    const req = mockRequest(TEST_CRON_SECRET);
    expect(verifyCronAuth(req)).toBe(false);
  });

  it('rejects Basic auth scheme', () => {
    const req = mockRequest(`Basic ${TEST_CRON_SECRET}`);
    expect(verifyCronAuth(req)).toBe(false);
  });

  it('is case-sensitive on the token value', () => {
    const req = mockRequest(`Bearer ${TEST_CRON_SECRET.toUpperCase()}`);
    expect(verifyCronAuth(req)).toBe(false);
  });

  it('rejects token with extra whitespace', () => {
    const req = mockRequest(`Bearer  ${TEST_CRON_SECRET}`);
    expect(verifyCronAuth(req)).toBe(false);
  });

  it('rejects token with trailing whitespace', () => {
    const req = mockRequest(`Bearer ${TEST_CRON_SECRET} `);
    expect(verifyCronAuth(req)).toBe(false);
  });
});
