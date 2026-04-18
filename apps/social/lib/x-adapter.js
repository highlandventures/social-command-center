/**
 * X Platform Adapter — Hybrid Read/Write Routing
 *
 * WRITES → Always route to Official X API (OAuth 2.0)
 * READS  → Route to third-party (TwitterAPI.io) by default, fallback to official
 *
 * See spec §3.3 for full routing logic.
 */

import { kv, CACHE_TTL, cachedFetch } from './redis';
import { prisma } from './db';
import { API_COSTS } from './api-costs';

const READ_PROVIDER = process.env.X_READ_PROVIDER || 'third-party';
const FALLBACK_TO_OFFICIAL = process.env.X_READ_FALLBACK_TO_OFFICIAL === 'true';

// ---- OFFICIAL X API (writes + own-account analytics) ----

class XOfficialClient {
  constructor(accessToken) {
    this.baseUrl = 'https://api.x.com/2';
    this.accessToken = accessToken;
  }

  async request(method, path, body) {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Track rate limits in Redis (non-fatal if KV unavailable)
    try {
      const remaining = res.headers.get('x-rate-limit-remaining');
      const reset = res.headers.get('x-rate-limit-reset');
      if (remaining && reset) {
        await kv.set(`ratelimit:x:${path}`, { remaining: parseInt(remaining), reset: parseInt(reset) }, { ex: 900 });
      }
    } catch { /* KV unavailable */ }

    // Log API call for cost tracking (non-fatal)
    try {
      await prisma.aPICallLog.create({
        data: {
          provider: 'x_official',
          endpoint: path,
          method,
          statusCode: res.status,
          responseTime: Date.now() - start,
          estimatedCost: (res.status >= 200 && res.status < 300) ? (method === 'POST' ? API_COSTS.X_OFFICIAL_POST : API_COSTS.X_OFFICIAL_GET) : 0,
        },
      });
    } catch { /* logging failed */ }

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(`X API ${res.status}: ${JSON.stringify(error)}`);
    }

    return res.json();
  }

  // --- WRITES ---
  async publishTweet(content, replyToId = null, mediaIds = []) {
    const body = { text: content };
    if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };
    if (mediaIds.length) body.media = { media_ids: mediaIds };
    return this.request('POST', '/tweets', body);
  }

  async publishThread(tweets, mediaIds = []) {
    const published = [];
    let replyToId = null;
    for (let i = 0; i < tweets.length; i++) {
      // Attach media to first tweet only
      const tweetMediaIds = i === 0 ? mediaIds : [];
      const result = await this.publishTweet(tweets[i], replyToId, tweetMediaIds);
      published.push(result);
      replyToId = result.data.id;
    }
    return published;
  }

  /**
   * Upload a single image to X using the v2 media upload endpoint.
   * Requires OAuth 2.0 user context token with media.write scope.
   * Returns the media_id for use in tweet creation.
   *
   * @param {Buffer} imageBuffer - Raw image bytes
   * @param {string} mimeType - e.g. 'image/jpeg'
   * @returns {string} media_id
   */
  async uploadMedia(imageBuffer, mimeType) {
    const start = Date.now();

    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append('media', blob, `upload.${mimeType.split('/')[1]}`);
    formData.append('media_type', mimeType);
    formData.append('media_category', mimeType === 'image/gif' ? 'tweet_gif' : 'tweet_image');

    const res = await fetch(`${this.baseUrl}/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: formData,
    });

    // Log API call (non-fatal)
    try {
      await prisma.aPICallLog.create({
        data: {
          provider: 'x_official',
          endpoint: '/2/media/upload',
          method: 'POST',
          statusCode: res.status,
          responseTime: Date.now() - start,
          estimatedCost: API_COSTS.X_OFFICIAL_POST || 0,
        },
      });
    } catch { /* logging failed */ }

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(`X Media Upload ${res.status}: ${JSON.stringify(error)}`);
    }

    const data = await res.json();
    // v2 returns { data: { id, media_key } }
    return data.data?.id ?? data.media_id_string;
  }

  /**
   * Download images from Blob URLs and upload them to X.
   * @param {Array<{url: string, mimeType: string}>} mediaItems
   * @returns {string[]} Array of X media_id_strings
   */
  async uploadMediaFromUrls(mediaItems) {
    const mediaIds = [];
    for (const item of mediaItems) {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error(`Failed to download media from ${item.url}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const mediaId = await this.uploadMedia(buffer, item.mimeType);
      mediaIds.push(mediaId);
    }
    return mediaIds;
  }

  async publishArticle(title, content) {
    // X Articles use the same POST /tweets endpoint with extended text
    return this.request('POST', '/tweets', { text: `${title}\n\n${content}` });
  }

  async deleteTweet(tweetId) {
    return this.request('DELETE', `/tweets/${tweetId}`);
  }

  async likeTweet(userId, tweetId) {
    return this.request('POST', `/users/${userId}/likes`, { tweet_id: tweetId });
  }

  // --- READS (own account only — for private analytics) ---
  async getOwnTweetMetrics(tweetId) {
    return this.request('GET', `/tweets/${tweetId}?tweet.fields=public_metrics,non_public_metrics,organic_metrics`);
  }

  /**
   * Batch fetch metrics for up to 100 tweets in a single API call.
   * X API v2 supports comma-separated IDs: GET /2/tweets?ids=id1,id2,...
   * Returns { data: [ { id, public_metrics, non_public_metrics, ... }, ... ] }
   */
  async getBatchTweetMetrics(tweetIds) {
    if (!tweetIds.length) return { data: [] };
    // X API allows up to 100 IDs per request
    const ids = tweetIds.slice(0, 100).join(',');
    return this.request('GET', `/tweets?ids=${ids}&tweet.fields=public_metrics,non_public_metrics,organic_metrics`);
  }

  async getOwnAccountAnalytics(userId) {
    return this.request('GET', `/users/${userId}?user.fields=public_metrics,description,profile_image_url,verified_type`);
  }

  /**
   * Fetch the user's own recent tweets with full metrics.
   * non_public_metrics and organic_metrics provide reliable impression data
   * for owned tweets that public_metrics may not include.
   * X API v2: GET /2/users/:id/tweets
   */
  async getOwnTweets(userId, maxResults = 100) {
    return this.request(
      'GET',
      `/users/${userId}/tweets?tweet.fields=public_metrics,non_public_metrics,organic_metrics,created_at,text&max_results=${Math.min(maxResults, 100)}`
    );
  }
}

// ---- THIRD-PARTY READ PROVIDER (TwitterAPI.io) ----

class TwitterAPIioClient {
  constructor() {
    this.baseUrl = 'https://api.twitterapi.io/twitter';
    this.apiKey = process.env.TWITTERAPI_IO_API_KEY;
  }

  async request(path, params = {}) {
    const start = Date.now();
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

    const res = await fetch(url, {
      headers: { 'X-API-Key': this.apiKey },
    });

    await prisma.aPICallLog.create({
      data: {
        provider: 'twitterapi_io',
        endpoint: path,
        method: 'GET',
        statusCode: res.status,
        responseTime: Date.now() - start,
        estimatedCost: (res.status >= 200 && res.status < 300) ? API_COSTS.TWITTERAPI_IO : 0,
      },
    });

    if (!res.ok) throw new Error(`TwitterAPI.io ${res.status}`);
    return res.json();
  }

  /**
   * Paginated tweet search.
   *   maxPages — max pages to fetch (~20 tweets/page); default 5 ⇒ up to ~100 tweets.
   *   sinceId  — stop (and trim) once we encounter this tweet id; used as a
   *              high-water mark so we only return genuinely new tweets on each run.
   * Returns a single-page-shaped object `{ tweets: [...aggregated], pagesFetched, latestId }`
   * so callers that read `response?.tweets` still work unchanged.
   */
  async searchTweets(query, maxResults, options = {}) {
    const { maxPages = 5, sinceId } = options;
    const allTweets = [];
    let cursor = '';
    let pagesFetched = 0;
    let hitSinceId = false;

    for (let page = 0; page < maxPages; page++) {
      const params = { query, queryType: 'Latest' };
      if (cursor) params.cursor = cursor;

      const data = await this.request('/tweet/advanced_search', params);
      pagesFetched++;

      const pageTweets = data?.tweets || data?.data?.tweets || [];
      if (!pageTweets.length) break;

      if (sinceId) {
        for (const t of pageTweets) {
          const id = String(t.id ?? t.id_str ?? '');
          if (id && id === String(sinceId)) {
            hitSinceId = true;
            break;
          }
          allTweets.push(t);
        }
        if (hitSinceId) break;
      } else {
        allTweets.push(...pageTweets);
      }

      if (!data?.next_cursor) break;
      cursor = data.next_cursor;
    }

    const latestId = allTweets[0]
      ? String(allTweets[0].id ?? allTweets[0].id_str ?? '')
      : sinceId ?? null;

    return { tweets: allTweets, pagesFetched, latestId };
  }

  async getUserTimeline(username, maxResults = 20) {
    return this.request('/user/last_tweets', { userName: username });
  }

  /**
   * Paginated timeline fetch — pulls multiple pages of tweets using cursor.
   * Each page returns ~20 tweets. maxPages controls depth (e.g. 25 pages = ~500 tweets).
   * Returns { tweets: [...], followerCount, followingCount }.
   */
  async getUserTimelinePaginated(username, maxPages = 25) {
    const allTweets = [];
    let cursor = '';
    let followerCount = 0;
    let followingCount = 0;

    for (let page = 0; page < maxPages; page++) {
      const params = { userName: username };
      if (cursor) params.cursor = cursor;

      const data = await this.request('/user/last_tweets', params);
      // TwitterAPI.io nests tweets inside data.tweets
      const tweets = data?.data?.tweets || data?.tweets || [];
      if (!tweets.length) break;

      // Capture author follower count from first response
      // Defensive: check multiple possible field names across API versions
      if (page === 0 && tweets[0]?.author) {
        const a = tweets[0].author;
        followerCount = a.followers || a.followersCount || a.follower_count || 0;
        followingCount = a.following || a.followingCount || a.friends_count || 0;
      }

      allTweets.push(...tweets);

      // Check for next cursor (at top level of response)
      if (data?.next_cursor) {
        cursor = data.next_cursor;
      } else {
        break;
      }
    }

    return { tweets: allTweets, followerCount, followingCount };
  }

  async getUserProfile(username) {
    return this.request('/user/profile_by_username', { userName: username });
  }

  async getTweetById(tweetId) {
    return this.request('/tweet/detail', { tweet_id: tweetId });
  }

  async getMentions(username, options = {}) {
    return this.searchTweets(`@${username}`, undefined, options);
  }
}

// ---- UNIFIED ADAPTER (routes to correct provider) ----

export class XPlatformAdapter {
  constructor(oauthAccessToken) {
    this.official = new XOfficialClient(oauthAccessToken);
    this.thirdParty = new TwitterAPIioClient();
  }

  // WRITES — always official
  publishTweet(content, replyToId, mediaIds) { return this.official.publishTweet(content, replyToId, mediaIds); }
  publishThread(tweets, mediaIds) { return this.official.publishThread(tweets, mediaIds); }
  publishArticle(title, content) { return this.official.publishArticle(title, content); }
  uploadMedia(imageBuffer, mimeType) { return this.official.uploadMedia(imageBuffer, mimeType); }
  uploadMediaFromUrls(mediaItems) { return this.official.uploadMediaFromUrls(mediaItems); }
  deleteTweet(tweetId) { return this.official.deleteTweet(tweetId); }
  likeTweet(userId, tweetId) { return this.official.likeTweet(userId, tweetId); }

  // READS — third-party with fallback
  //  skipCache: bypass the Redis cache (used by on-demand scans so users see fresh results).
  //  maxPages:  how many pages (~20 tweets each) to fetch; 5 ≈ 100 tweets (default).
  //  sinceId:   high-water mark — stop fetching once we see this tweet id. Keeps breadth
  //             from requiring brute-force deep pagination on every run.
  // NOTE: when sinceId is set we also bypass the cache — caching per query+sinceId keys is
  // not worth it since the value churns on every run anyway.
  async searchTweets(query, maxResults, { skipCache = false, maxPages = 5, sinceId } = {}) {
    const bypass = skipCache || Boolean(sinceId);
    return cachedFetch(
      `x:search:${query}`,
      CACHE_TTL.SEARCH_RESULTS,
      async () => {
        if (READ_PROVIDER === 'third-party') {
          try {
            return await this.thirdParty.searchTweets(query, maxResults, { maxPages, sinceId });
          } catch (e) {
            if (FALLBACK_TO_OFFICIAL) return this.official.request('GET', `/tweets/search/recent?query=${encodeURIComponent(query)}`);
            throw e;
          }
        }
        return this.official.request('GET', `/tweets/search/recent?query=${encodeURIComponent(query)}`);
      },
      { skipCache: bypass }
    );
  }

  async getUserTimeline(username) {
    return cachedFetch(`x:timeline:${username}`, CACHE_TTL.USER_PROFILE, () =>
      READ_PROVIDER === 'third-party' ? this.thirdParty.getUserTimeline(username) : this.official.request('GET', `/users/by/username/${username}/tweets`)
    );
  }

  async getUserProfile(username) {
    return cachedFetch(`x:profile:${username}`, CACHE_TTL.USER_PROFILE, () =>
      READ_PROVIDER === 'third-party' ? this.thirdParty.getUserProfile(username) : this.official.request('GET', `/users/by/username/${username}`)
    );
  }

  async getMentions(username, { skipCache = false, maxPages = 5, sinceId } = {}) {
    const bypass = skipCache || Boolean(sinceId);
    return cachedFetch(
      `x:mentions:${username}`,
      CACHE_TTL.MENTIONS,
      () =>
        READ_PROVIDER === 'third-party'
          ? this.thirdParty.getMentions(username, { maxPages, sinceId })
          : this.official.request('GET', `/users/by/username/${username}/mentions`),
      { skipCache: bypass }
    );
  }

  // OWN ACCOUNT — always official (private analytics)
  getOwnTweetMetrics(tweetId) { return this.official.getOwnTweetMetrics(tweetId); }
  getBatchTweetMetrics(tweetIds) { return this.official.getBatchTweetMetrics(tweetIds); }
  getOwnAccountAnalytics(userId) { return this.official.getOwnAccountAnalytics(userId); }
}
