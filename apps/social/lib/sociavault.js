/**
 * SociaVault API adapter for Reddit data.
 *
 * Docs: https://docs.sociavault.com
 * Endpoints used:
 *   GET /v1/scrape/reddit/search       — Search Reddit for posts
 *   GET /v1/scrape/reddit/subreddit    — Get recent posts from a subreddit
 *   GET /v1/scrape/reddit/subreddit/search — Search within a subreddit
 *
 * Credits: 1 per request. All plans include full API access.
 */

import { prisma } from './db';
import { API_COSTS } from './api-costs';

const SOCIAVAULT_BASE = 'https://api.sociavault.com/v1/scrape/reddit';

/** Log a SociaVault API call to the cost tracker */
async function logSociaVaultCall(endpoint, statusCode, responseTime) {
  try {
    await prisma.aPICallLog.create({
      data: {
        provider: 'sociavault',
        endpoint,
        method: 'GET',
        statusCode,
        responseTime,
        estimatedCost: (statusCode >= 200 && statusCode < 300) ? API_COSTS.SOCIAVAULT : 0,
      },
    });
  } catch (err) {
    console.error('SociaVault cost logging failed:', err.message);
  }
}

function getApiKey() {
  const key = process.env.SOCIAVAULT_API_KEY;
  if (!key) {
    console.warn('[SociaVault] No SOCIAVAULT_API_KEY set — Reddit search disabled');
    return null;
  }
  return key;
}

/**
 * Search Reddit globally for posts matching a query.
 *
 * @param {string} query - Search terms
 * @param {Object} options
 * @param {string} [options.sort='new'] - Sort: best, hot, new, top, rising
 * @param {string} [options.timeframe='week'] - Time filter: all, day, week, month, year
 * @param {boolean} [options.full=true] - Full or trimmed response
 * @returns {Promise<Array>} Normalized hit objects
 */
export async function searchReddit(query, { sort = 'new', timeframe = 'week', full = true } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const start = Date.now();
  try {
    const params = new URLSearchParams({
      query,
      sort,
      timeframe,
      full: String(full),
    });

    const res = await fetch(`${SOCIAVAULT_BASE}/search?${params}`, {
      headers: { 'x-api-key': apiKey },
    });

    await logSociaVaultCall('/search', res.status, Date.now() - start);

    if (!res.ok) {
      console.error(`[SociaVault] Search failed (${res.status}): ${await res.text().catch(() => '')}`);
      return [];
    }

    const data = await res.json();
    const normalized = normalizeRedditPosts(data);
    console.log(`[SociaVault] Search "${query}": ${normalized.length} posts normalized`);
    return normalized;
  } catch (err) {
    console.error('[SociaVault] Search error:', err.message);
    return [];
  }
}

/**
 * Search within a specific subreddit.
 *
 * @param {string} subreddit - Subreddit name (without r/ prefix)
 * @param {string} query - Search terms
 * @param {Object} options
 * @param {string} [options.sort='new']
 * @param {string} [options.timeframe='week']
 * @returns {Promise<Array>} Normalized hit objects
 */
export async function searchSubreddit(subreddit, query, { sort = 'new', timeframe = 'week' } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const start = Date.now();
  try {
    const params = new URLSearchParams({
      subreddit,
      query,
      sort,
      timeframe,
    });

    const res = await fetch(`${SOCIAVAULT_BASE}/subreddit/search?${params}`, {
      headers: { 'x-api-key': apiKey },
    });

    await logSociaVaultCall(`/subreddit/search?sub=${subreddit}`, res.status, Date.now() - start);

    if (!res.ok) {
      console.error(`[SociaVault] Subreddit search failed (${res.status}): ${await res.text().catch(() => '')}`);
      return [];
    }

    const data = await res.json();
    const normalized = normalizeRedditPosts(data);
    console.log(`[SociaVault] Subreddit search r/${subreddit} "${query}": ${normalized.length} posts normalized`);
    return normalized;
  } catch (err) {
    console.error('[SociaVault] Subreddit search error:', err.message);
    return [];
  }
}

/**
 * Get recent posts from a subreddit (no keyword filter).
 *
 * @param {string} subreddit - Subreddit name
 * @param {Object} options
 * @param {string} [options.sort='new']
 * @param {string} [options.timeframe='week']
 * @returns {Promise<Array>} Normalized hit objects
 */
export async function getSubredditPosts(subreddit, { sort = 'new', timeframe = 'week' } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const start = Date.now();
  try {
    const params = new URLSearchParams({ subreddit, sort });
    // SociaVault only allows timeframe when sort=top
    if (sort === 'top' && timeframe) params.set('timeframe', timeframe);

    const res = await fetch(`${SOCIAVAULT_BASE}/subreddit?${params}`, {
      headers: { 'x-api-key': apiKey },
    });

    await logSociaVaultCall(`/subreddit?sub=${subreddit}`, res.status, Date.now() - start);

    if (!res.ok) {
      console.error(`[SociaVault] Subreddit posts failed (${res.status}): ${await res.text().catch(() => '')}`);
      return [];
    }

    const data = await res.json();
    const normalized = normalizeRedditPosts(data);
    console.log(`[SociaVault] Subreddit posts r/${subreddit}: ${normalized.length} posts normalized`);
    return normalized;
  } catch (err) {
    console.error('[SociaVault] Subreddit posts error:', err.message);
    return [];
  }
}

// ── Normalize SociaVault response to match our ListeningHit shape ──

function extractPostsArray(apiResponse) {
  // SociaVault returns posts as an object with numeric keys: { "0": {...}, "1": {...} }
  // wrapped in { success, data: { success, posts: {...} } }
  // Handle all known shapes:

  if (Array.isArray(apiResponse)) return apiResponse;

  // Unwrap nested data envelope: { data: { posts: {...} } }
  const inner = apiResponse?.data || apiResponse;
  const postsRaw = inner?.posts || inner?.data || inner;

  if (Array.isArray(postsRaw)) return postsRaw;

  // Object with numeric keys like { "0": {...}, "1": {...} }
  if (postsRaw && typeof postsRaw === 'object' && !Array.isArray(postsRaw)) {
    const values = Object.values(postsRaw);
    // Only convert if entries look like post objects (have id/title/author)
    if (values.length > 0 && typeof values[0] === 'object') {
      return values;
    }
  }

  return [];
}

function normalizeRedditPosts(apiResponse) {
  const posts = extractPostsArray(apiResponse);

  return posts.map((post) => {
    // Subreddit search uses different field names than global search
    const subredditName = typeof post.subreddit === 'object'
      ? (post.subreddit?.name || post.subreddit?.display_name)
      : post.subreddit;

    return {
      id: post.id || post.post_id || post.name || null,
      author: post.author || post.author_fullname || 'unknown',
      content: (post.title || '') + (post.selftext ? `\n${post.selftext}` : '') + (post.body || ''),
      title: post.title || null,
      subreddit: subredditName ? `r/${subredditName.replace(/^r\//, '')}` : (post.subreddit_name_prefixed || null),
      permalink: post.permalink
        ? post.permalink.startsWith('http') ? post.permalink : `https://reddit.com${post.permalink}`
        : (post.url || null),
      ups: post.ups || post.votes || post.score || post.upvotes || 0,
      num_comments: post.num_comments || post.comments || 0,
      created_utc: post.created_utc || post.created || null,
      created_at: post.created_at || post.created_at_iso || null,
      link_karma: post.score || post.ups || post.votes || 0,
      subreddit_subscribers: post.subreddit_subscribers || post.subscribers
        || (typeof post.subreddit === 'object' ? post.subreddit?.subscribers : 0) || 0,
      upvote_ratio: post.upvote_ratio || null,
      total_awards: post.total_awards_received || 0,
    };
  }).filter((p) => p.id); // Drop entries without an ID
}
