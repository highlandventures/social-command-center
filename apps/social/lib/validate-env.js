/**
 * Environment variable validation.
 * Import this at the top of your app entry point or middleware
 * to fail fast on misconfigured deployments.
 *
 * Usage:
 *   import '@/lib/validate-env';
 *
 * Throws at startup if critical env vars are missing or malformed.
 */

const REQUIRED_VARS = [
  'POSTGRES_PRISMA_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'X_OFFICIAL_CLIENT_ID',
  'X_OFFICIAL_CLIENT_SECRET',
  'TWITTERAPI_IO_API_KEY',
  'ANTHROPIC_API_KEY',
  'TOKEN_ENCRYPTION_KEY',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'CRON_SECRET',
];

const errors = [];

// ── Check required vars exist ──
for (const name of REQUIRED_VARS) {
  if (!process.env[name]) {
    errors.push(`Missing required env var: ${name}`);
  }
}

// ── Validate TOKEN_ENCRYPTION_KEY format ──
const encKey = process.env.TOKEN_ENCRYPTION_KEY;
if (encKey) {
  if (!/^[0-9a-fA-F]{64}$/.test(encKey)) {
    errors.push(
      `TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got ${encKey.length} chars.`
    );
  }
}

// ── Report ──
if (errors.length > 0 && process.env.NODE_ENV === 'production') {
  console.error('━━━ Environment validation failed ━━━');
  for (const err of errors) {
    console.error(`  ✗ ${err}`);
  }
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  // In production, fail hard. In dev, warn only.
  throw new Error(`Environment validation failed: ${errors.length} error(s). Check logs above.`);
} else if (errors.length > 0) {
  console.warn('[env-validation] Warnings (dev mode — not fatal):');
  for (const err of errors) {
    console.warn(`  ⚠ ${err}`);
  }
}

export { REQUIRED_VARS };
