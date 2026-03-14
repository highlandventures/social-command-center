/**
 * Shared listening scan logic.
 * Used by both the poll-listening cron and the on-demand tRPC trigger.
 *
 * Searches X and Reddit for new hits matching active ListeningQueries,
 * deduplicates, computes heuristic scores and sentiment, and creates
 * ListeningHit records (+ InboxItem for high-scoring hits).
 */

import { prisma } from '@/lib/db';
import { kv } from '@/lib/redis';
import { XPlatformAdapter } from '@/lib/x-adapter';
import { searchReddit, searchSubreddit, getSubredditPosts } from '@/lib/sociavault';
import { analyzeSentimentBatch } from '@/lib/ai/sentiment';

// ── Reddit polling throttle ──────────────────────────────────
// Reddit conversations move slowly; no need to poll every 10 min.
// Default: 8 hours between Reddit scans (~3x/day = ~195 credits/day).
const REDDIT_POLL_INTERVAL_MS = 8 * 60 * 60 * 1000;
const REDDIT_LAST_SCAN_KEY = 'listening:reddit:lastScanAt';

// ── Figure ecosystem terms for KOL relevance gate ──
// HIGH_CONFIDENCE terms are unambiguous Figure references (used for KOL gate).
// ALL_ECOSYSTEM_TERMS includes broader terms for general relevance scoring.
const HIGH_CONFIDENCE_TERMS = [
  'figure', 'figr', '$figr', 'provenance blockchain', 'provenance', '$hash',
  'ylds', '$ylds', 'figure markets', 'figure lending', 'figure connect',
  'figure securities', 'figure ats', 'figure prime', '$prime', 'intellidebt',
  'heloc', 'mcagney', 'mike cagney', 'agora data',
  'figure pay', 'fgrd', 'open network', 'figure technology', 'figure certificate',
];

const ECOSYSTEM_TERMS = [
  ...HIGH_CONFIDENCE_TERMS,
  'hastra', 'hastrafi', 'democratized prime', 'figure dart',
  'rwa consortium', 'blockchain stock', 'provenance hash',
  'figure certificate company', 'on-chain public equity', 'provwasm',
  'dart digital asset',
];

// ── Actionable thresholds by polling tier ──
const ACTIONABLE_THRESHOLDS = {
  HOT: 0.4,
  WARM: 0.5,
  COOL: 0.6,
  SCHEDULED: 0.6,
};

// ── Reddit search via SociaVault (1 credit/request) ──────
// COST OPTIMIZATION: Use global search (1 credit) for keyword queries instead
// of searching each subreddit individually (N credits). Brand/product terms like
// "$FIGR", "Securitize", etc. are specific enough that global search works fine.
// Only use per-subreddit calls for monitor-all (no keywords) queries.

async function searchRedditForQuery(query) {
  const subreddits = query.subreddits || [];
  const queryString = (query.queryString || '').trim();
  const isMonitorAll = !queryString; // Empty query = pull all posts from subreddits

  // If SociaVault key is available, use it
  if (process.env.SOCIAVAULT_API_KEY) {
    let allHits = [];

    if (isMonitorAll && subreddits.length > 0) {
      // Full subreddit monitoring — pull ALL recent posts (no keyword filter)
      // Used for Figure-owned subreddits where every post is relevant
      // COST: 1 credit per subreddit
      for (const sub of subreddits) {
        const hits = await getSubredditPosts(sub, { sort: 'new', timeframe: 'week' });
        allHits.push(...hits);
        await new Promise((r) => setTimeout(r, 200));
      }
    } else if (queryString) {
      // Keyword search — use 1 global search instead of N per-subreddit searches
      // Brand terms ($FIGR, "Securitize", etc.) are specific enough that global
      // search finds relevant hits from ANY subreddit — no need to restrict.
      // COST: 1 credit total (vs N credits for per-subreddit search)
      allHits = await searchReddit(queryString);
    }

    // Post-fetch subreddit filtering: if the query specifies target subreddits,
    // keep only hits from those subreddits. Global search is cheaper (1 credit)
    // but may return hits from irrelevant subreddits.
    if (subreddits.length > 0 && allHits.length > 0) {
      const allowedSubs = new Set(subreddits.map((s) => s.toLowerCase()));
      allHits = allHits.filter((hit) => {
        const hitSub = (hit.subreddit || '').replace(/^r\//, '').toLowerCase();
        return !hitSub || allowedSubs.has(hitSub);
      });
    }

    return allHits;
  }

  // No Reddit API configured — log warning and return empty
  console.warn('[Listening Scanner] No SOCIAVAULT_API_KEY set — skipping Reddit query:', queryString || '(monitor all)');
  return [];
}

// ── Sentiment Analysis ────────────────────────────────────────

const POSITIVE_KEYWORDS = [
  'great', 'amazing', 'awesome', 'love', 'excellent', 'fantastic',
  'incredible', 'wonderful', 'brilliant', 'impressive', 'best',
  'happy', 'bullish', 'rocket', 'moon', 'gem', 'undervalued',
  'promising', 'innovative', 'solid', 'strong', 'perfect',
  'outperform', 'upgrade', 'breakout', 'accumulate', 'upside',
  'catalyst', 'opportunity', 'growth', 'rally', 'surge',
];

const NEGATIVE_KEYWORDS = [
  'terrible', 'awful', 'horrible', 'hate', 'worst', 'scam',
  'rug', 'dump', 'crash', 'bearish', 'overvalued', 'dead',
  'broken', 'disappointing', 'poor', 'bad', 'useless', 'avoid',
  'fraud', 'fake', 'sucks', 'fail', 'failed', 'bug', 'buggy',
  'downgrade', 'sell', 'short', 'downside', 'risk', 'concern',
  'dilution', 'lawsuit', 'SEC enforcement', 'ponzi', 'warning',
];

const NEGATION_WORDS = ['not', 'no', 'never', "don't", "doesn't", "isn't", "won't", "can't", "wasn't", "neither", "nor"];

function analyzeSentiment(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;

  for (const kw of POSITIVE_KEYWORDS) {
    const idx = lower.indexOf(kw);
    if (idx === -1) continue;
    // Check for negation within preceding 3 words
    const before = lower.slice(Math.max(0, idx - 30), idx);
    const beforeWords = before.trim().split(/\s+/).slice(-3);
    const negated = beforeWords.some((w) => NEGATION_WORDS.includes(w));
    if (negated) {
      negativeCount++;
    } else {
      positiveCount++;
    }
  }
  for (const kw of NEGATIVE_KEYWORDS) {
    const idx = lower.indexOf(kw);
    if (idx === -1) continue;
    const before = lower.slice(Math.max(0, idx - 30), idx);
    const beforeWords = before.trim().split(/\s+/).slice(-3);
    const negated = beforeWords.some((w) => NEGATION_WORDS.includes(w));
    if (negated) {
      positiveCount++;
    } else {
      negativeCount++;
    }
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

// Stop words that survive length > 2 filter but aren't meaningful for relevance
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'will', 'with',
  'that', 'this', 'from', 'they', 'were', 'what', 'when', 'your', 'which',
  'their', 'about', 'would', 'there', 'could', 'other', 'into', 'more',
  'also', 'than', 'some', 'very', 'just', 'like', 'over',
]);

// Brand names and tickers get 3x weight; product names get 2x; generic qualifiers get 1x
const HIGH_WEIGHT_TERMS = new Set([
  'figure', 'figr', '$figr', 'securitize', 'ondo', 'superstate', 'centrifuge',
  'tokeny', 'goldfinch', 'tradable', 'provenance', '$hash', '$ylds', '$ondo',
  '$cfg', '$gfi', '$prime', 'buidl', 'acred', 'mcagney', 'hastra', 'hastrafi',
]);
const MID_WEIGHT_TERMS = new Set([
  'heloc', 'intellidebt', 'ousg', 'usdy', 'ustb', 'uscc', 'tinlake', 'fgrd',
  'dart', 'ylds', 'democratized', 'opening bell', 'flux finance',
]);

function computeContentRelevance(content, queryString) {
  // Strip X search operators and syntax before extracting matchable terms
  const cleaned = queryString
    .replace(/from:\w+/gi, '')           // Remove from:username
    .replace(/to:\w+/gi, '')             // Remove to:username
    .replace(/\b(OR|AND|NOT)\b/gi, '')   // Remove boolean operators
    .replace(/lang:\w+/gi, '')           // Remove lang:en
    .replace(/min_faves:\d+/gi, '')      // Remove min_faves:N
    .replace(/min_retweets:\d+/gi, '')   // Remove min_retweets:N
    .replace(/-\w+/g, '')               // Remove negation terms like -giveaway
    .replace(/['"()@]/g, '')             // Remove quotes, parens, @
    .trim();

  const terms = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));

  if (terms.length === 0) return 0.5;

  const lower = content.toLowerCase();
  let weightedMatches = 0;
  let totalWeight = 0;

  for (const term of terms) {
    const termLower = term.toLowerCase();
    const weight = HIGH_WEIGHT_TERMS.has(termLower) ? 3
      : MID_WEIGHT_TERMS.has(termLower) ? 2
      : 1;
    totalWeight += weight;
    if (lower.includes(termLower)) {
      weightedMatches += weight;
    }
  }

  return totalWeight > 0 ? weightedMatches / totalWeight : 0.5;
}

/**
 * Extract key terms from a topic name and its queries for relevance classification.
 * Works for both Figure ecosystem topics AND competitor topics.
 */
function getTopicKeyTerms(topic) {
  const name = topic.name.toLowerCase();

  // Figure ecosystem topics use the global ECOSYSTEM_TERMS
  if (name.includes('figure') || name.includes('kol')) {
    return ECOSYSTEM_TERMS;
  }

  // Competitor topics — extract brand and product terms from the topic name and queries
  const terms = [];
  // Extract competitor name from "Competitor: Securitize" format
  const compMatch = name.match(/competitor:\s*(.+)/);
  if (compMatch) {
    terms.push(compMatch[1].trim().toLowerCase());
  }

  // Also extract quoted terms from all query strings for this topic
  for (const query of (topic.queries || [])) {
    const qs = query.queryString || '';
    const quoted = qs.match(/"([^"]+)"/g);
    if (quoted) {
      for (const q of quoted) {
        const clean = q.replace(/"/g, '').toLowerCase();
        if (clean.length > 2 && !STOP_WORDS.has(clean)) {
          terms.push(clean);
        }
      }
    }
    // Extract $TICKER patterns
    const tickers = qs.match(/\$[A-Z]+/gi);
    if (tickers) {
      terms.push(...tickers.map((t) => t.toLowerCase()));
    }
  }

  return [...new Set(terms)];
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
  const results = { hitsCreated: 0, topicsProcessed: 0, errors: [], redditSkipped: false };

  try {
    // Create shared X adapter (uses TWITTERAPI_IO_API_KEY for reads internally)
    const xAdapter = new XPlatformAdapter('');

    // ── Reddit throttle: only poll Reddit every 8 hours ──
    let shouldPollReddit = true;
    try {
      const lastRedditScan = await kv.get(REDDIT_LAST_SCAN_KEY);
      if (lastRedditScan) {
        const elapsed = Date.now() - Number(lastRedditScan);
        if (elapsed < REDDIT_POLL_INTERVAL_MS) {
          shouldPollReddit = false;
          results.redditSkipped = true;
        }
      }
    } catch (err) {
      console.warn('KV read for Reddit poll throttle failed:', err.message);
      // If KV is unreachable, poll Reddit anyway to be safe
    }

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

    let redditPolled = false;

    for (const topic of activeTopics) {
      try {
        for (const query of topic.queries) {
          try {
            let rawHits = [];

            if (query.platform === 'X') {
              const response = await xAdapter.searchTweets(query.queryString);
              rawHits = response?.data?.tweets || response?.tweets || [];
            } else if (query.platform === 'REDDIT') {
              if (!shouldPollReddit) continue; // Throttled — skip until next window
              // SociaVault: keyword search or full subreddit monitoring
              rawHits = await searchRedditForQuery(query);
              redditPolled = true;
            }

            for (const hit of rawHits) {
              try {
                // Reddit engagement gate: drop zero/negative-score posts to filter bot/spam noise.
                // X queries use min_faves:2 in the query string; Reddit has no equivalent
                // operator, so we filter post-fetch. Threshold of 1 is conservative —
                // Reddit posts start at 1 (self-upvote), so this only drops truly
                // downvoted or zero-engagement content.
                if (query.platform === 'REDDIT') {
                  const ups = hit.ups || hit.score || hit.upvotes || 0;
                  if (ups < 1) continue;
                }

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

                // Filter out negative keywords (word-boundary matching to avoid false negatives)
                const content =
                  hit.text || hit.body || hit.selftext || hit.title || '';
                const lower = content.toLowerCase();
                const hasNegativeKeyword = query.negativeKeywords.some((nk) => {
                  try {
                    return new RegExp(`\\b${nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(content);
                  } catch {
                    return lower.includes(nk.toLowerCase());
                  }
                });
                if (hasNegativeKeyword) continue;

                // ── Relevance gate for KOL topics ──
                // KOL queries use (from:user) AND (ecosystem terms) but TwitterAPI.io
                // doesn't always enforce the AND. Verify content actually mentions Figure.
                // Require at least 1 HIGH_CONFIDENCE term or 2+ general ecosystem terms.
                const isKolTopic = topic.name.toLowerCase().includes('kol');
                if (isKolTopic) {
                  const hasHighConfidence = HIGH_CONFIDENCE_TERMS.some((term) =>
                    lower.includes(term)
                  );
                  if (!hasHighConfidence) {
                    // Fallback: accept if 2+ general ecosystem terms match
                    const ecosystemMatchCount = ECOSYSTEM_TERMS.filter((term) =>
                      lower.includes(term)
                    ).length;
                    if (ecosystemMatchCount < 2) continue;
                  }
                }

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
                const authorProfileImageUrl =
                  hit.author?.profile_image_url ||
                  hit.author?.profileImageUrl ||
                  hit.author?.avatar ||
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
                // Weights: 60% content relevance, 25% engagement, 15% followers
                // (heavily prioritize topical accuracy; reduces whale bias)
                const normalizedFollowers = normalize(authorFollowers, 1000000);
                const normalizedEngagement = normalize(engagementCount, 10000);
                const contentRelevance = computeContentRelevance(
                  content,
                  query.queryString,
                );
                const heuristicScore =
                  normalizedFollowers * 0.15 +
                  normalizedEngagement * 0.25 +
                  contentRelevance * 0.6;

                // Sentiment analysis
                const sentiment = analyzeSentiment(content);

                // Determine if actionable — threshold varies by topic polling tier
                const actionableThreshold = ACTIONABLE_THRESHOLDS[topic.pollingTier] || 0.5;
                const isActionable = heuristicScore > actionableThreshold;

                // Determine aiRelevance using topic-aware key terms (works for competitors too)
                const topicTerms = getTopicKeyTerms(topic);
                const termMatches = topicTerms.filter((term) => lower.includes(term)).length;
                let aiRelevance = 'LOW';
                if (termMatches >= 3 || (termMatches >= 1 && heuristicScore > 0.6)) {
                  aiRelevance = 'HIGH';
                } else if (termMatches >= 1 || heuristicScore > 0.4) {
                  aiRelevance = 'MEDIUM';
                } else if (heuristicScore < 0.2) {
                  aiRelevance = 'SPAM';
                }

                // Extract original post timestamp (prefer original creation date over scan time)
                let detectedAt = new Date();
                if (hit.created_at || hit.createdAt) {
                  // X API: ISO string like "2026-03-10T14:30:00.000Z"
                  detectedAt = new Date(hit.created_at || hit.createdAt);
                } else if (hit.created_utc) {
                  // Reddit/SociaVault: Unix epoch (seconds if < 1e12, millis otherwise)
                  const ts = Number(hit.created_utc);
                  detectedAt = new Date(ts < 1e12 ? ts * 1000 : ts);
                } else if (hit.timestamp) {
                  detectedAt = new Date(hit.timestamp);
                }
                // Guard against invalid dates — fall back to now
                if (isNaN(detectedAt.getTime())) detectedAt = new Date();

                // Create ListeningHit
                const listeningHit = await prisma.listeningHit.create({
                  data: {
                    queryId: query.id,
                    topicId: topic.id,
                    platform: query.platform,
                    platformPostId: String(platformPostId),
                    authorUsername: String(authorUsername),
                    authorDisplayName,
                    authorProfileImageUrl,
                    authorFollowersOrKarma: authorFollowers,
                    content: String(content),
                    sourceUrl,
                    subreddit: hit.subreddit || hit.subreddit_name_prefixed || null,
                    parentThreadTitle: hit.link_title || hit.parent_title || null,
                    detectedAt,
                    engagementCount,
                    heuristicScore,
                    sentiment,
                    isActionable,
                    aiRelevance,
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

                // Sync KOL avatar if this author matches a tracked KOL
                if (authorProfileImageUrl && query.platform === 'X') {
                  try {
                    await prisma.kOL.updateMany({
                      where: {
                        username: String(authorUsername),
                        platform: 'X',
                        avatarUrl: null,
                      },
                      data: { avatarUrl: authorProfileImageUrl },
                    });
                  } catch (err) {
                    console.warn('Avatar sync failed:', err.message);
                  }
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

    // ── AI Sentiment Upgrade ─────────────────────────────────
    // If ANTHROPIC_API_KEY is set and we created new hits, batch-analyze
    // sentiment with Claude for more accurate results.
    if (process.env.ANTHROPIC_API_KEY && results.hitsCreated > 0) {
      try {
        const recentHits = await prisma.listeningHit.findMany({
          where: { detectedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
          orderBy: { detectedAt: 'desc' },
          take: 30,
        });

        // Process in batches of 10
        for (let i = 0; i < recentHits.length; i += 10) {
          const batch = recentHits.slice(i, i + 10);
          const texts = batch.map((h) => h.content || '');
          const aiResults = await analyzeSentimentBatch(texts);

          for (let j = 0; j < batch.length; j++) {
            if (aiResults[j]?.sentiment) {
              await prisma.listeningHit.update({
                where: { id: batch[j].id },
                data: { sentiment: aiResults[j].sentiment },
              });
            }
          }
        }
        results.aiSentimentUpgraded = recentHits.length;
      } catch (err) {
        console.warn('AI sentiment batch upgrade failed (falling back to keyword):', err.message);
      }
    }

    // Record Reddit scan timestamp so next cycle skips it
    if (redditPolled) {
      try {
        await kv.set(REDDIT_LAST_SCAN_KEY, String(Date.now()), { ex: REDDIT_POLL_INTERVAL_MS / 1000 });
      } catch (err) {
        console.warn('KV write for Reddit poll timestamp failed:', err.message);
      }
    }

    return results;
  } catch (error) {
    console.error('listening scanner error:', error);
    results.errors.push({ error: error.message });
    return results;
  }
}
