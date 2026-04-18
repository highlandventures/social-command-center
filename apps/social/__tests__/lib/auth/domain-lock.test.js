import { describe, it, expect, vi } from 'vitest';

// Prisma is imported by next-auth-options; stub it so the module loads cleanly.
vi.mock('@/lib/db', () => ({ prisma: {} }));

import { isDomainAllowed } from '@/lib/next-auth-options';

describe('isDomainAllowed', () => {
  it('allows @figure.com by default with no env set', () => {
    expect(isDomainAllowed('miso@figure.com', undefined)).toBe(true);
    expect(isDomainAllowed('anyone@figure.com', '')).toBe(true);
  });

  it('is case-insensitive on the domain', () => {
    expect(isDomainAllowed('alice@FIGURE.COM', '')).toBe(true);
    expect(isDomainAllowed('bob@Figure.Com', '')).toBe(true);
  });

  it('rejects non-allowlisted domains when env is empty', () => {
    expect(isDomainAllowed('eve@random.com', '')).toBe(false);
    expect(isDomainAllowed('miso@highlandventures.io', undefined)).toBe(false);
  });

  it('allows domains listed in ALLOWED_EMAIL_DOMAINS (comma-separated)', () => {
    const env = 'highlandventures.io,partner.co,agency.io';
    expect(isDomainAllowed('miso@highlandventures.io', env)).toBe(true);
    expect(isDomainAllowed('user@partner.co', env)).toBe(true);
    expect(isDomainAllowed('external@agency.io', env)).toBe(true);
    expect(isDomainAllowed('still-allowed@figure.com', env)).toBe(true);
  });

  it('still rejects domains not in the allowlist', () => {
    const env = 'partner.co';
    expect(isDomainAllowed('eve@random.com', env)).toBe(false);
  });

  it('trims whitespace around allowlist entries', () => {
    expect(isDomainAllowed('user@partner.co', '  partner.co , other.com  ')).toBe(true);
  });

  it('returns false for malformed / missing email', () => {
    expect(isDomainAllowed(null, 'figure.com')).toBe(false);
    expect(isDomainAllowed(undefined, 'figure.com')).toBe(false);
    expect(isDomainAllowed('', '')).toBe(false);
    expect(isDomainAllowed('no-at-sign', '')).toBe(false);
    expect(isDomainAllowed('trailing@', '')).toBe(false);
  });
});
