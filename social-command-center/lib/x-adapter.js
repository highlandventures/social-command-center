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

    // Track rate limits in Redis
    const remaining = res.headers.get('x-rate-limit-remaining');
    const reset = res.headers.get('x-rate-limit-reset');
    if (remaining && reset) {
      await kv.set(`ratelimit:x:${path}`, { remaining: parseInt(remaining), reset: parseInt(reset) }, { ex: 900 });
    }

    // Log API call for cost tracking
    await prisma.aPICallLog.create({
      data: {
        provider: 'x_official',
        endpoint: path,
        method,
        statusCode: res.status,
        responseTime: Date.now() - start,
        estimatedCost: method === 'POST' ? 0.01 : 0.003, // Rough estimate
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(`X API ${res.status}: ${JSON.stringify(error)}`);
    }

    return res.json();
  }

  // --- WRITES ---
  async publishTweet(content, replyToId = null) {
    const body = { text: content };
    if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };
    return this.request('POST', '/tweets', body);
  }

  async publishThread(tweets) {
    const published = [];
    let replyToId = null;
    for (const tweet of tweets) {
      const result = await this.publishTweet(tweet, replyToId);
      published.push(result);
      replyToId = result.data.id;
    }
    return published;
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

  async getOwnAccountAnalytics(userId) {
    return this.request('GET', `/users/${userId}?user.fields=public_metrics,description,profile_image_url`);
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
        estimatedCost: 0.00015, // $0.15 per 1K requests
      },
    });

    if (!res.ok) throw new Error(`TwitterAPI.io ${res.status}`);
    return res.json();
  }

  async searchTweets(query, maxResults = 20) {
    return this.request('/tweet/advanced_search', { query, queryType: 'Latest', cursor: '' });
  }

  async getUserTimeline(username, maxResults = 20) {
    return this.request('/user/last_tweets', { userName: username });
  }

  async getUserProfile(username) {
    return this.request('/user/profile_by_username', { userName: username });
  }

  async getTweetById(tweetId) {
    return this.request('/tweet/detail', { tweet_id: tweetId });
  }

  async getMentions(username) {
    return this.searchTweets(`@${username}`);
  }
}

// ---- UNIFIED ADAPTER (routes to correct provider) ----

export class XPlatformAdapter {
  constructor(oauthAccessToken) {
    this.official = new XOfficialClient(oauthAccessToken);
    this.thirdParty = new TwitterAPIioClient();
  }

  // WRITES — always official
  publishTweet(content, replyToId) { return this.official.publishTweet(content, replyToId); }
  publishThread(tweets) { return this.official.publishThread(tweets); }
  publishArticle(title, content) { return this.official.publishArticle(title, content); }
  deleteTweet(tweetId) { return this.official.deleteTweet(tweetId); }
  likeTweet(userId, tweetId) { return this.official.likeTweet(userId, tweetId); }

  // READS — third-party with fallback
  async searchTweets(query, maxResults) {
    return cachedFetch(`x:search:${query}`, CACHE_TTL.SEARCH_RESULTS, async () => {
      if (READ_PROVIDER === 'third-party') {
        try {
          return await this.thirdParty.searchTweets(query, maxResults);
        } catch (e) {
          if (FALLBACK_TO_OFFICIAL) return this.official.request('GET', `/tweets/search/recent?query=${encodeURIComponent(query)}`);
          throw e;
        }
      }
      return this.official.request('GET', `/tweets/search/recent?query=${encodeURIComponent(query)}`);
    });
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

  async getMentions(username) {
    return cachedFetch(`x:mentions:${username}`, CACHE_TTL.MENTIONS, () =>
      READ_PROVIDER === 'third-party' ? this.thirdParty.getMentions(username) : this.official.request('GET', `/users/by/username/${username}/mentions`)
    );
  }

  // OWN ACCOUNT — always official (private analytics)
  getOwnTweetMetrics(tweetId) { return this.official.getOwnTweetMetrics(tweetId); }
  getOwnAccountAnalytics(userId) { return this.official.getOwnAccountAnalytics(userId); }
}
