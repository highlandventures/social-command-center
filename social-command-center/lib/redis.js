import { createClient } from '@vercel/kv';

// Vercel KV client — used for caching, rate limit tracking, and job state
export const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Cache TTLs (in seconds) per data type — from spec §2.3
export const CACHE_TTL = {
  USER_PROFILE: 86400,       // 24 hours
  POST_METRICS_OLD: 21600,   // 6 hours (posts >48h old)
  POST_METRICS_FRESH: 900,   // 15 minutes (posts <48h old)
  FOLLOWER_COUNT: 43200,     // 12 hours
  MENTIONS: 300,             // 5 minutes
  SEARCH_RESULTS: 1800,      // 30 minutes
  ACCOUNT_ANALYTICS: 3600,   // 1 hour
};

// Helper: get-or-fetch with automatic TTL caching
export async function cachedFetch(key, ttlSeconds, fetchFn) {
  const cached = await kv.get(key);
  if (cached) return cached;

  const fresh = await fetchFn();
  await kv.set(key, fresh, { ex: ttlSeconds });
  return fresh;
}
