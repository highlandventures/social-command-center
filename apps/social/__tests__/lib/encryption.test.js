/**
 * Unit tests for AES-256-GCM encryption module.
 *
 * These tests verify that:
 * - encrypt/decrypt are symmetric (roundtrip)
 * - Different plaintexts produce different ciphertexts
 * - Same plaintext produces different ciphertexts (random IV)
 * - Ciphertext format is correct (iv:tag:data)
 * - Tampered ciphertext is rejected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to set the env var BEFORE importing the module,
// because encryption.js reads KEY at module load time.
const TEST_KEY_HEX = 'a'.repeat(64); // 32 bytes in hex = valid AES-256 key
process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY_HEX;

// Dynamic import so env is set first
let encrypt, decrypt;

beforeEach(async () => {
  // Re-import to pick up env
  vi.resetModules();
  const mod = await import('@/lib/encryption');
  encrypt = mod.encrypt;
  decrypt = mod.decrypt;
});

describe('encryption', () => {
  it('roundtrips plaintext through encrypt → decrypt', () => {
    const plaintext = 'oauth_access_token_abc123';
    const ciphertext = encrypt(plaintext);
    const result = decrypt(ciphertext);
    expect(result).toBe(plaintext);
  });

  it('handles empty string', () => {
    const ciphertext = encrypt('');
    const result = decrypt(ciphertext);
    expect(result).toBe('');
  });

  it('handles unicode content', () => {
    const plaintext = 'token_with_émojis_🔐_and_日本語';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('handles long tokens', () => {
    const plaintext = 'x'.repeat(2048);
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces ciphertext in iv:tag:data format', () => {
    const ciphertext = encrypt('test');
    const parts = ciphertext.split(':');
    expect(parts).toHaveLength(3);

    const [iv, tag, data] = parts;
    // IV = 16 bytes = 32 hex chars
    expect(iv).toHaveLength(32);
    // Auth tag = 16 bytes = 32 hex chars
    expect(tag).toHaveLength(32);
    // Encrypted data should be non-empty hex
    expect(data.length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/.test(data)).toBe(true);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const plaintext = 'same_token_value';
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);

    // But both should decrypt to the same value
    expect(decrypt(c1)).toBe(plaintext);
    expect(decrypt(c2)).toBe(plaintext);
  });

  it('produces different ciphertexts for different plaintexts', () => {
    const c1 = encrypt('token_a');
    const c2 = encrypt('token_b');
    expect(c1).not.toBe(c2);
  });

  it('rejects tampered ciphertext (modified data)', () => {
    const ciphertext = encrypt('sensitive_token');
    const parts = ciphertext.split(':');
    // Flip a character in the encrypted data
    const tampered = parts[2][0] === 'a' ? 'b' + parts[2].slice(1) : 'a' + parts[2].slice(1);
    const tamperedCiphertext = `${parts[0]}:${parts[1]}:${tampered}`;

    expect(() => decrypt(tamperedCiphertext)).toThrow();
  });

  it('rejects tampered ciphertext (modified auth tag)', () => {
    const ciphertext = encrypt('sensitive_token');
    const parts = ciphertext.split(':');
    const tamperedTag = 'f'.repeat(32);
    const tamperedCiphertext = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    expect(() => decrypt(tamperedCiphertext)).toThrow();
  });
});
