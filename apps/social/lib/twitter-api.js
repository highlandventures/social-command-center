/**
 * Shared TwitterAPI.io request helper.
 *
 * Centralises the fetch + APICallLog pattern that was previously duplicated
 * across poll-competitors, daily-analytics, and poll-metrics cron routes.
 *
 * Base URL: https://api.twitterapi.io
 * Paths should include the leading `/twitter/` segment,
 * e.g. `/twitter/user/info`, `/twitter/user/last_tweets`.
 */

import { prisma } from '@/lib/db';
import { API_COSTS } from '@/lib/api-costs';

export async function twitterApiIoRequest(apiKey, path, params = {}, opts = {}) {
  const url = new URL(`https://api.twitterapi.io${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

  const start = Date.now();
  const res = await fetch(url, {
    headers: { 'X-API-Key': apiKey },
  });

  // Track in API call log
  await prisma.aPICallLog.create({
    data: {
      provider: 'twitterapi_io',
      endpoint: path,
      method: 'GET',
      statusCode: res.status,
      responseTime: Date.now() - start,
      estimatedCost: API_COSTS.TWITTERAPI_IO,
      ...(opts.accountId ? { accountId: opts.accountId } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`TwitterAPI.io ${res.status}: ${await res.text().catch(() => 'unknown')}`);
  }
  return res.json();
}
