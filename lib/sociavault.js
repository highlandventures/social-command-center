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

const SOCIAVAULT_BASE = 'https://api.sociavault.com/v1/scrape/reddit';

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

    if (!res.ok) {
      console.error(`[SociaVault] Search failed (${res.status}): ${await res.text().catch(() => '')}`);
      return [];
    }

    const data = await res.json();
    return normalizeRedditPosts(data);
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

    if (!res.ok) {
      console.error(`[SociaVault] Subreddit search failed (${res.status}): ${await res.text().catch(() => '')}`);
      return [];
    }

    const data = await res.json();
    return normalizeRedditPosts(data);
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

  try {
    const params = new URLSearchParams({
      subreddit,
      sort,
      timeframe,
    });

    const res = await fetch(`${SOCIAVAULT_BASE}/subreddit?${params}`, {
      headers: { 'x-api-key': apiKey },
    });

    if (!res.ok) {
      console.error(`[SociaVault] Subreddit posts failed (${res.status}): ${await res.text().catch(() => '')}`);
      return [];
    }

    const data = await res.json();
    return normalizeRedditPosts(data);
  } catch (err) {
    console.error('[SociaVault] Subreddit posts error:', err.message);
    return [];
  }
}

// ── Normalize SociaVault response to match our ListeningHit shape ──

function normalizeRedditPosts(apiResponse) {
  // SociaVault returns { data: [...] } or an array directly
  const posts = Array.isArray(apiResponse) ? apiResponse : (apiResponse?.data || apiResponse?.posts || []);

  return posts.map((post) => ({
    id: post.id || post.name || null,
    author: post.author || post.author_fullname || 'unknown',
    content: (post.title || '') + (post.selftext ? `\n${post.selftext}` : '') + (post.body || ''),
    subreddit: post.subreddit ? `r/${post.subreddit}` : (post.subreddit_name_prefixed || null),
    permalink: post.permalink
      ? post.permalink.startsWith('http') ? post.permalink : `https://reddit.com${post.permalink}`
      : null,
    ups: post.ups || post.score || post.upvotes || 0,
    num_comments: post.num_comments || post.comments || 0,
    created_utc: post.created_utc || post.created || null,
    link_karma: post.score || post.ups || 0,
  })).filter((p) => p.id); // Drop entries without an ID
}
