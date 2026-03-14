/**
 * Shared listening scan logic.
 * Used by both the poll-listening cron and the on-demand tRPC trigger.
 *
 * Searches X and Reddit for new hits matching active ListeningQueries,
 * deduplicates, computes heuristic scores and sentiment, and creates
 * ListeningHit records (+ InboxItem for high-scoring hits).
 */

import { prisma } from '@/lib/db';
import { XPlatformAdapter } from '@/lib/x-adapter';
import { searchReddit, searchSubreddit } from '@/lib/sociavault';

// ── Reddit search via SociaVault (1 credit/request) ──────
// Falls back to PullPush if SOCIAVAULT_API_KEY is not set.

async function searchRedditForQuery(query) {
  const subreddits = query.subreddits || [];
  const queryString = query.queryString;

  // If SociaVault key is available, use it
  if (process.env.SOCIAVAULT_API_KEY) {
    let allHits = [];

    if (subreddits.length > 0) {
      // Search each specified subreddit (1 credit per subreddit)
      for (const sub of subreddits) {
        const hits = await searchSubreddit(sub, queryString);
        allHits.push(...hits);
        // Small delay to be respectful
        await new Promise((r) => setTimeout(r, 200));
      }
    } else {
      // Global Reddit search (1 credit)
      allHits = await searchReddit(queryString);
    }

    return allHits;
  }

  // Fallback: PullPush (free, no API key, but less reliable)
  return searchRedditViaPullPush(queryString, subreddits[0] || null);
}

// ── PullPush fallback (free, no API key required) ────────

async function searchRedditViaPullPush(query, subreddit = null) {
  const params = new URLSearchParams({
    q: query,
    size: '100',
    sort: 'desc',
    sort_type: 'score',
    after: '7d',
  });
  if (subreddit) params.set('subreddit', subreddit);

  const [subsRes, commentsRes] = await Promise.all([
    fetch(`https://api.pullpush.io/reddit/search/submission/?${params}`).then((r) => r.json()).catch(() => ({ data: [] })),
    fetch(`https://api.pullpush.io/reddit/search/comment/?${params}`).then((r) => r.json()).catch(() => ({ data: [] })),
  ]);

  const submissions = (subsRes?.data || []).map((s) => ({
    id: s.id,
    author: s.author,
    content: s.title + (s.selftext ? `\n${s.selftext}` : ''),
    subreddit: s.subreddit ? `r/${s.subreddit}` : null,
    permalink: s.permalink ? `https://reddit.com${s.permalink}` : null,
    ups: s.score || 0,
    num_comments: s.num_comments || 0,
    created_utc: s.created_utc,
    link_karma: s.score || 0,
  }));

  const comments = (commentsRes?.data || []).map((c) => ({
    id: c.id,
    author: c.author,
    content: c.body || '',
    subreddit: c.subreddit ? `r/${c.subreddit}` : null,
    permalink: c.permalink ? `https://reddit.com${c.permalink}` : null,
    parent_title: c.link_title || null,
    ups: c.score || 0,
    num_comments: 0,
    created_utc: c.created_utc,
    link_karma: c.score || 0,
  }));

  return [...submissions, ...comments];
}

// ── Sentiment Analysis ────────────────────────────────────────

const POSITIVE_KEYWORDS = [
  'great', 'amazing', 'awesome', 'love', 'excellent', 'fantastic',
  'incredible', 'wonderful', 'brilliant', 'impressive', 'best',
  'happy', 'bullish', 'rocket', 'moon', 'gem', 'undervalued',
  'promising', 'innovative', 'solid', 'strong', 'perfect',
];

const NEGATIVE_KEYWORDS = [
  'terrible', 'awful', 'horrible', 'hate', 'worst', 'scam',
  'rug', 'dump', 'crash', 'bearish', 'overvalued', 'dead',
  'broken', 'disappointing', 'poor', 'bad', 'useless', 'avoid',
  'fraud', 'fake', 'sucks', 'fail', 'failed', 'bug', 'buggy',
];

function analyzeSentiment(text) {
  const lower = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;

  for (const kw of POSITIVE_KEYWORDS) {
    if (lower.includes(kw)) positiveCount++;
  }
  for (const kw of NEGATIVE_KEYWORDS) {
    if (lower.includes(kw)) negativeCount++;
  }

  if (positiveCount > negativeCount) return 'POSITIVE';
  if (negativeCount > positiveCount) return 'NEGATIVE';
  return 'NEUTRAL';
}

// ── Scoring helpers ───────────────────────────────────────────

function normalize(value, maxExpected = 100000) {
  if (!value || value <= 0) return 0;
  return Math.min(Math.log1p(value) / Math.log1p(maxExpected), 1);
}

function computeContentRelevance(content, queryString) {
  const words = queryString
    .replace(/['"()]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['and', 'or', 'not', 'from'].includes(w.toLowerCase()));

  if (words.length === 0) return 0.5;

  const lower = content.toLowerCase();
  const matches = words.filter((w) => lower.includes(w.toLowerCase()));
  return matches.length / words.length;
}

// ── Main scan function ────────────────────────────────────────

/**
 * Scan active listening topics for new hits.
 *
 * @param {Object} options
 * @param {string[]} [options.topicIds] - Specific topic IDs to scan (omit for all active)
 * @returns {Object} Results summary { hitsCreated, topicsProcessed, errors }
 */
export async function scanListeningTopics({ topicIds } = {}) {
  const results = { hitsCreated: 0, topicsProcessed: 0, errors: [] };

  try {
    // Create shared X adapter (uses TWITTERAPI_IO_API_KEY for reads internally)
    const xAdapter = new XPlatformAdapter('');

    const where = { active: true };
    if (topicIds && topicIds.length > 0) {
      where.id = { in: topicIds };
    }

    const activeTopics = await prisma.listeningTopic.findMany({
      where,
      include: {
        queries: {
          where: { active: true },
        },
      },
    });

    for (const topic of activeTopics) {
      try {
        for (const query of topic.queries) {
          try {
            let rawHits = [];

            if (query.platform === 'X') {
              const response = await xAdapter.searchTweets(query.queryString);
              rawHits = response?.data?.tweets || response?.tweets || [];
            } else if (query.platform === 'REDDIT') {
              // Use SociaVault (paid) with PullPush fallback
              rawHits = await searchRedditForQuery(query);
            }

            for (const hit of rawHits) {
              try {
                const platformPostId =
                  hit.id || hit.id_str || hit.name || null;

                if (!platformPostId) continue;

                // Dedupe against existing hits
                const existing = await prisma.listeningHit.findFirst({
                  where: {
                    queryId: query.id,
                    platformPostId: String(platformPostId),
                  },
                });

                if (existing) continue;

                // Filter out negative keywords
                const content =
                  hit.text || hit.body || hit.selftext || hit.title || '';
                const lower = content.toLowerCase();
                const hasNegativeKeyword = query.negativeKeywords.some((nk) =>
                  lower.includes(nk.toLowerCase()),
                );
                if (hasNegativeKeyword) continue;

                // Extract fields
                const authorUsername =
                  hit.author?.userName ||
                  hit.author?.username ||
                  hit.author ||
                  hit.user?.screen_name ||
                  'unknown';
                const authorDisplayName =
                  hit.author?.name ||
                  hit.author?.displayName ||
                  hit.author_fullname ||
                  null;
                const authorFollowers =
                  hit.author?.followers ||
                  hit.author?.public_metrics?.followers_count ||
                  hit.link_karma ||
                  0;
                const engagementCount =
                  (hit.public_metrics?.like_count || hit.ups || 0) +
                  (hit.public_metrics?.retweet_count || 0) +
                  (hit.public_metrics?.reply_count || hit.num_comments || 0);
                const sourceUrl =
                  hit.url || hit.permalink
                    ? hit.permalink?.startsWith('http')
                      ? hit.permalink
                      : `https://reddit.com${hit.permalink}`
                    : null;

                // Compute heuristic score
                const normalizedFollowers = normalize(authorFollowers, 1000000);
                const normalizedEngagement = normalize(engagementCount, 10000);
                const contentRelevance = computeContentRelevance(
                  content,
                  query.queryString,
                );
                const heuristicScore =
                  normalizedFollowers * 0.4 +
                  normalizedEngagement * 0.4 +
                  contentRelevance * 0.2;

                // Sentiment analysis
                const sentiment = analyzeSentiment(content);

                // Determine if actionable
                const isActionable = heuristicScore > 0.7;

                // Create ListeningHit
                const listeningHit = await prisma.listeningHit.create({
                  data: {
                    queryId: query.id,
                    topicId: topic.id,
                    platform: query.platform,
                    platformPostId: String(platformPostId),
                    authorUsername: String(authorUsername),
                    authorDisplayName,
                    authorFollowersOrKarma: authorFollowers,
                    content: String(content),
                    sourceUrl,
                    subreddit: hit.subreddit || hit.subreddit_name_prefixed || null,
                    parentThreadTitle: hit.link_title || hit.parent_title || null,
                    engagementCount,
                    heuristicScore,
                    sentiment,
                    isActionable,
                  },
                });

                // If high-scoring, create InboxItem
                if (isActionable) {
                  const inboxItem = await prisma.inboxItem.create({
                    data: {
                      accountId: topic.queries[0]?.accountId || undefined,
                      platform: query.platform,
                      itemType: 'MENTION',
                      fromUsername: String(authorUsername),
                      content: String(content),
                      internalNotes: `Listening hit (score: ${heuristicScore.toFixed(2)}) from topic "${topic.name}"`,
                    },
                  });

                  // Link inbox item back to listening hit
                  await prisma.listeningHit.update({
                    where: { id: listeningHit.id },
                    data: { routedToInboxItemId: inboxItem.id },
                  });
                }

                results.hitsCreated++;
              } catch (hitError) {
                console.error(
                  `Error processing listening hit for query ${query.id}:`,
                  hitError,
                );
              }
            }
          } catch (queryError) {
            console.error(
              `Error executing query ${query.id}:`,
              queryError,
            );
            results.errors.push({
              queryId: query.id,
              error: queryError.message,
            });
          }
        }

        results.topicsProcessed++;
      } catch (topicError) {
        console.error(
          `Error processing topic ${topic.id}:`,
          topicError,
        );
        results.errors.push({
          topicId: topic.id,
          error: topicError.message,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('listening scanner error:', error);
    results.errors.push({ error: error.message });
    return results;
  }
}
