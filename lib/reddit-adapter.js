/**
 * Reddit Platform Adapter
 *
 * All reads and writes go through the official Reddit API (OAuth 2.0).
 * Commercial access required — apply at https://www.reddit.com/wiki/api
 *
 * See spec §2.2 for cost details ($0.24 per 1K calls).
 */

import { kv, CACHE_TTL, cachedFetch } from './redis';
import { prisma } from './db';
import { API_COSTS } from './api-costs';

export class RedditAdapter {
  constructor(accessToken) {
    this.baseUrl = 'https://oauth.reddit.com';
    this.accessToken = accessToken;
    this.userAgent = process.env.REDDIT_USER_AGENT || 'social-command-center/1.0';
  }

  async request(method, path, body) {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'User-Agent': this.userAgent,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Track rate limits
    const remaining = res.headers.get('X-Ratelimit-Remaining');
    const reset = res.headers.get('X-Ratelimit-Reset');
    if (remaining && reset) {
      await kv.set(`ratelimit:reddit`, { remaining: parseFloat(remaining), reset: parseFloat(reset) }, { ex: 600 });
    }

    // Log for cost tracking
    await prisma.aPICallLog.create({
      data: {
        provider: 'reddit',
        endpoint: path,
        method,
        statusCode: res.status,
        responseTime: Date.now() - start,
        estimatedCost: API_COSTS.REDDIT_OAUTH,
      },
    });

    if (!res.ok) {
      const error = await res.text().catch(() => '');
      throw new Error(`Reddit API ${res.status}: ${error}`);
    }

    return res.json();
  }

  // --- WRITES ---
  async submitPost(subreddit, title, text, kind = 'self') {
    return this.request('POST', '/api/submit', {
      sr: subreddit,
      kind,
      title,
      text,
      api_type: 'json',
    });
  }

  async submitLink(subreddit, title, url) {
    return this.request('POST', '/api/submit', {
      sr: subreddit,
      kind: 'link',
      title,
      url,
      api_type: 'json',
    });
  }

  async comment(parentFullname, text) {
    return this.request('POST', '/api/comment', {
      thing_id: parentFullname,
      text,
      api_type: 'json',
    });
  }

  async deletePost(fullname) {
    return this.request('POST', '/api/del', { id: fullname });
  }

  // --- READS ---
  async getSubredditPosts(subreddit, sort = 'new', limit = 25) {
    return cachedFetch(`reddit:sub:${subreddit}:${sort}`, CACHE_TTL.SEARCH_RESULTS, () =>
      this.request('GET', `/r/${subreddit}/${sort}?limit=${limit}`)
    );
  }

  async searchSubreddit(subreddit, query, sort = 'relevance') {
    return cachedFetch(`reddit:search:${subreddit}:${query}`, CACHE_TTL.SEARCH_RESULTS, () =>
      this.request('GET', `/r/${subreddit}/search?q=${encodeURIComponent(query)}&sort=${sort}&restrict_sr=1&limit=25`)
    );
  }

  async searchAll(query, sort = 'relevance') {
    return cachedFetch(`reddit:search:all:${query}`, CACHE_TTL.SEARCH_RESULTS, () =>
      this.request('GET', `/search?q=${encodeURIComponent(query)}&sort=${sort}&limit=25`)
    );
  }

  async getUserProfile(username) {
    return cachedFetch(`reddit:user:${username}`, CACHE_TTL.USER_PROFILE, () =>
      this.request('GET', `/user/${username}/about`)
    );
  }

  async getUserPosts(username, sort = 'new', limit = 25) {
    return this.request('GET', `/user/${username}/submitted?sort=${sort}&limit=${limit}`);
  }

  async getPostComments(subreddit, postId) {
    return this.request('GET', `/r/${subreddit}/comments/${postId}`);
  }

  async getMentions() {
    return cachedFetch('reddit:mentions', CACHE_TTL.MENTIONS, () =>
      this.request('GET', '/message/mentions?limit=25')
    );
  }

  async getInbox() {
    return this.request('GET', '/message/inbox?limit=25');
  }

  async getKarma() {
    return this.request('GET', '/api/v1/me/karma');
  }
}
