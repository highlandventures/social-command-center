/**
 * Late API — Reddit Publishing Adapter
 *
 * Uses Late (getlate.dev) as a proxy for Reddit posting.
 * This avoids needing a direct Reddit OAuth app registration.
 *
 * Free tier: 20 posts/month.
 * Docs: https://docs.getlate.dev/platforms/reddit
 */

const LATE_BASE_URL = 'https://api.getlate.dev/v1';

/**
 * Make an authenticated request to the Late API.
 */
async function lateRequest(method, path, body) {
  const apiKey = process.env.LATE_API_KEY;
  if (!apiKey) {
    throw new Error('LATE_API_KEY is not configured. Set it in your environment variables.');
  }

  const res = await fetch(`${LATE_BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error || data?.message || `Late API ${res.status}`;
    throw new Error(`Late API error: ${msg}`);
  }

  return data;
}

/**
 * Get the Late OAuth connect URL for Reddit.
 * The user visits this URL to authorize their Reddit account via Late.
 *
 * @param {string} redirectUrl — Where Late sends the user after auth
 * @returns {{ authUrl: string }}
 */
export async function getRedditConnectUrl(redirectUrl) {
  return lateRequest('GET', `/connect/reddit?redirectUrl=${encodeURIComponent(redirectUrl)}`);
}

/**
 * List connected Late accounts (to find the Reddit accountId).
 * @returns {Array} accounts
 */
export async function listLateAccounts() {
  return lateRequest('GET', '/accounts');
}

/**
 * List subreddits the connected Reddit account can post to.
 * @returns {Array} subreddits
 */
export async function listRedditSubreddits() {
  return lateRequest('GET', '/connect/reddit/subreddits');
}

/**
 * Get available flairs for a subreddit.
 * @param {string} accountId — Late account ID
 * @param {string} subreddit — Subreddit name (no r/ prefix)
 * @returns {Array} flairs
 */
export async function getSubredditFlairs(accountId, subreddit) {
  return lateRequest('GET', `/accounts/${accountId}/reddit-flairs?subreddit=${encodeURIComponent(subreddit)}`);
}

/**
 * Publish a Reddit post via Late.
 *
 * @param {object} opts
 * @param {string} opts.accountId — Late Reddit account ID
 * @param {string} opts.subreddit — Target subreddit (no r/ prefix)
 * @param {string} opts.title — Post title (max 300 chars)
 * @param {string} opts.content — Post body (Markdown supported)
 * @param {string} [opts.flairId] — Optional flair ID
 * @param {string} [opts.url] — If set, creates a link post instead of text
 * @param {Date} [opts.scheduledFor] — If set, schedules instead of publishing now
 * @returns {object} Late post response with platformPostUrl
 */
export async function publishRedditPost({
  accountId,
  subreddit,
  title,
  content,
  flairId,
  url,
  scheduledFor,
}) {
  // Late uses first line of content as title, rest as body
  const fullContent = `${title}\n\n${content}`;

  const payload = {
    content: fullContent,
    platforms: [
      {
        platform: 'reddit',
        accountId,
        platformSpecificData: {
          subreddit: subreddit.replace(/^r\//, ''),
          ...(flairId ? { flairId } : {}),
          ...(url ? { url } : {}),
        },
      },
    ],
    ...(scheduledFor
      ? { scheduledFor: scheduledFor.toISOString(), timezone: 'UTC' }
      : { publishNow: true }),
  };

  return lateRequest('POST', '/posts', payload);
}

/**
 * Delete/unpublish a Reddit post via Late.
 * @param {string} postId — Late post ID
 * @param {string} platform — 'reddit'
 */
export async function unpublishRedditPost(postId) {
  return lateRequest('POST', `/posts/${postId}/unpublish`, {
    platform: 'reddit',
  });
}
