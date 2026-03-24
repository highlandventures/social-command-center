import { createClient } from '@vercel/kv';

// Vercel KV client — used for caching, rate limit tracking, and job state
export const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Cache TTLs (in seconds) per data type — from spec §2.3
export const CACHE_TTL = {
  USER_PROFILE: 3600,        // 1 hour
  POST_METRICS_OLD: 21600,   // 6 hours (posts >48h old)
  POST_METRICS_FRESH: 900,   // 15 minutes (posts <48h old)
  FOLLOWER_COUNT: 43200,     // 12 hours
  MENTIONS: 300,             // 5 minutes
  SEARCH_RESULTS: 600,       // 10 minutes
  ACCOUNT_ANALYTICS: 3600,   // 1 hour
};

// Helper: get-or-fetch with automatic TTL caching
// Falls through to fetchFn if KV is unavailable (e.g. local dev without Upstash)
export async function cachedFetch(key, ttlSeconds, fetchFn) {
  try {
    const cached = await kv.get(key);
    if (cached) return cached;
  } catch {
    // KV unavailable — skip cache, call fetchFn directly
    return fetchFn();
  }

  const fresh = await fetchFn();
  try {
    await kv.set(key, fresh, { ex: ttlSeconds });
  } catch {
    // KV write failed — non-fatal, data still returned
  }
  return fresh;
}
