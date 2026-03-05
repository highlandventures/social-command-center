/**
 * Cron: Poll Social Listening
 * Schedule: Every 10 minutes (* /10 * * * *)
 *
 * For each active ListeningTopic and its queries, searches for new hits,
 * deduplicates, computes heuristic scores and sentiment, and creates
 * ListeningHit records (+ InboxItem for high-scoring hits).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { XPlatformAdapter } from '@/lib/x-adapter';
import { RedditAdapter } from '@/lib/reddit-adapter';

export const dynamic = 'force-dynamic';

// Simple keyword-based sentiment analysis
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

/**
 * Normalize a value into [0, 1] using a simple log-based approach.
 * Prevents extreme outliers from dominating.
 */
function normalize(value, maxExpected = 100000) {
  if (!value || value <= 0) return 0;
  return Math.min(Math.log1p(value) / Math.log1p(maxExpected), 1);
}

/**
 * Compute content relevance: simple ratio of query keywords found in content.
 */
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

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { hitsCreated: 0, topicsProcessed: 0, errors: [] };

  try {
    // Create shared adapters using bearer tokens (for reads, no user OAuth needed)
    const xAdapter = new XPlatformAdapter(process.env.X_BEARER_TOKEN || '');
    const redditAdapter = new RedditAdapter(process.env.REDDIT_SERVICE_TOKEN || '');

    const activeTopics = await prisma.listeningTopic.findMany({
      where: { active: true },
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
              rawHits = response?.tweets || response?.data || [];
            } else if (query.platform === 'REDDIT') {
              const response = await redditAdapter.searchAll(query.queryString);
              const children = response?.data?.children || [];
              rawHits = children.map((c) => c.data);
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

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('poll-listening cron error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
