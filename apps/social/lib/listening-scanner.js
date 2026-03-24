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
import { generateInsight } from '@/lib/ai';
import { processNewSignalsToTasks } from '@/lib/intelligence-engine';

// ── Reddit polling throttle ──────────────────────────────────
// Reddit conversations move slowly; no need to poll every 10 min.
// Default: 12 hours between Reddit scans (~2x/day = ~130 credits/day).
const REDDIT_POLL_INTERVAL_MS = 12 * 60 * 60 * 1000;
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

// ── Topic-adaptive weight profiles ──────────────────────────
// Different topic types prioritize different scoring dimensions.
// KOL topics emphasize follower count; competitor topics emphasize content match.
export const TOPIC_WEIGHT_PROFILES = {
  KOL: {
    contentRelevance: 0.35,
    engagement: 0.20,
    followers: 0.35,
    recency: 0.10,
  },
  COMPETITOR: {
    contentRelevance: 0.55,
    engagement: 0.20,
    followers: 0.10,
    recency: 0.15,
  },
  BRAND: {
    contentRelevance: 0.45,
    engagement: 0.25,
    followers: 0.20,
    recency: 0.10,
  },
};

/**
 * Classify a topic by type based on its name.
 * @param {{ name: string }} topic
 * @returns {'KOL' | 'COMPETITOR' | 'BRAND'}
 */
export function getTopicType(topic) {
  const name = topic.name.toLowerCase();
  if (name.includes('kol')) return 'KOL';
  if (name.includes('competitor')) return 'COMPETITOR';
  return 'BRAND';
}

// ── Financial context-aware sentiment ───────────────────────
// Ambiguous crypto/finance terms that need phrase-level context
// to determine sentiment. Each term maps to context phrases grouped
// by sentiment label.
export const FINANCIAL_AMBIGUOUS_TERMS = {
  'short': { financial: true, contexts: {
    bearish: ['short selling', 'shorting', 'short position', 'short squeeze'],
    neutral: ['in short', 'short term', 'short video', 'short time'],
  }},
  'yield': { financial: true, contexts: {
    positive: ['high yield', 'yield farming', 'yield protocol', 'yield bearing'],
    neutral: ['yield results', 'yield to'],
  }},
  'liquidation': { financial: true, contexts: {
    negative: ['forced liquidation', 'liquidation cascade', 'liquidation event'],
    neutral: ['liquidation preference', 'orderly liquidation'],
  }},
  'dump': { financial: true, contexts: {
    negative: ['token dump', 'price dump', 'dumping tokens'],
    neutral: ['data dump', 'brain dump'],
  }},
  'moon': { financial: true, contexts: {
    positive: ['to the moon', 'mooning', 'moon shot'],
    neutral: ['moon landing', 'full moon'],
  }},
  'rug': { financial: true, contexts: {
    negative: ['rug pull', 'rugged', 'rug pulled'],
    neutral: ['under the rug', 'rug design'],
  }},
};

/**
 * Resolve sentiment for an ambiguous financial/crypto term based on
 * surrounding phrase context. Returns the matching sentiment label
 * or null if the term is unknown or no context phrase matches.
 *
 * @param {string} text - The full text to analyze
 * @param {string} term - The ambiguous term to resolve
 * @returns {string | null} Sentiment label or null
 */
export function resolveFinancialSentiment(text, term) {
  const lower = text.toLowerCase();
  const termConfig = FINANCIAL_AMBIGUOUS_TERMS[term];
  if (!termConfig) return null;

  for (const [sentiment, phrases] of Object.entries(termConfig.contexts)) {
    if (phrases.some(p => lower.includes(p))) return sentiment;
  }
  return null;
}

/**
 * Compute engagement velocity: engagement per hour, with a floor
 * of 0.5 hours for very recent posts to avoid division-by-near-zero.
 *
 * @param {number} engagementCount - Total engagement (likes + retweets + replies)
 * @param {Date} detectedAt - When the post was created
 * @returns {number} Engagement per hour
 */
export function computeEngagementVelocity(engagementCount, detectedAt) {
  if (!engagementCount) return 0;
  const ageHours = Math.max(0.5, (Date.now() - detectedAt.getTime()) / (1000 * 60 * 60));
  return engagementCount / ageHours;
}

// ── Cross-query dedup constants ─────────────────────────────
// TTL for topic-level dedup keys: 7 days (matches recency decay window)
export const TOPIC_DEDUP_TTL_SECONDS = 7 * 24 * 60 * 60; // 604800

/**
 * Generate a Redis key for topic-level deduplication.
 * Prevents the same post from appearing in multiple queries for one topic.
 *
 * @param {string} topicId
 * @param {string} platformPostId
 * @returns {string} Redis key
 */
export function generateTopicDedupKey(topicId, platformPostId) {
  return `listening:dedup:${topicId}:${platformPostId}`;
}

// ── AI Batch Validation ─────────────────────────────────────
// Batch-validate high-scoring listening hits through Claude Haiku.
// Returns array of {index, multiplier, reason} for each hit.
// Multiplier range: 0.5 (likely irrelevant) to 1.5 (highly relevant).
// Graceful fallback: returns 1.0 multiplier for all hits if AI fails.

export async function batchValidateRelevance(hits, topicContext, topicType = 'BRAND') {
  if (!hits || hits.length === 0) return [];

  const postSummaries = hits.map((h, i) => {
    const truncated = (h.content || '').slice(0, 500);
    return `[${i}] Content: ${truncated}\nFollowers: ${h.authorFollowers || 0} | Engagement: ${h.engagementCount || 0}`;
  }).join('\n\n');

  const context = `Topic: ${topicContext}\nTopic Type: ${topicType}\n\nEvaluate these ${hits.length} social media posts for relevance and actionability. Consider the topic type when classifying actions — for KOL topics, activations where the KOL mentions our brand are OPPORTUNITY. For competitor topics, product launches and pricing changes are INTEL.\n\nPosts:\n${postSummaries}\n\nReturn a JSON array of {index, multiplier, actionType, reason}.`;

  try {
    const result = await generateInsight('listening/relevance-validation', context, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 1024,
      systemPrompt: `You are a social listening intelligence assistant. For each post, evaluate TWO things:

1. RELEVANCE: Score as a multiplier from 0.5 (irrelevant/spam) to 1.5 (highly relevant and on-topic). Consider semantic meaning, not just keyword overlap — posts discussing the same concepts with different words should still score high.

2. ACTIONABILITY: Classify what action (if any) this signal requires:
   - RESPOND: Needs a direct reply (someone asking a question, making a complaint, requesting info, or a journalist/analyst inquiry about the brand)
   - INTEL: Competitive intelligence to catalog (competitor launch, pricing change, feature announcement, market shift)
   - OPPORTUNITY: Content or engagement opportunity (trending topic to piggyback, viral post to engage with, partnership signal, positive mention to amplify)
   - CRISIS: Negative sentiment requiring immediate attention (brand attack, factual error going viral, executive controversy, security/legal issue being discussed)
   - FYI: Informational only, no action needed (neutral mention, general industry discussion, background context)

Return a JSON array of {index, multiplier, actionType, reason}. Always respond with valid JSON.`,
    });

    // Ensure we got an array back
    if (Array.isArray(result)) return result;
    // Sometimes AI wraps in an object
    if (result?.results && Array.isArray(result.results)) return result.results;
    // Fallback
    return hits.map((_, i) => ({ index: i, multiplier: 1.0, actionType: 'FYI', reason: 'fallback' }));
  } catch (err) {
    console.warn('batchValidateRelevance failed (graceful fallback):', err.message);
    return hits.map((_, i) => ({ index: i, multiplier: 1.0, actionType: 'FYI', reason: 'fallback' }));
  }
}

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

// ── Batch subreddit metrics from listening hits ──────────────
// After a Reddit scan, aggregate recent ListeningHit data per subreddit
// and write SubredditMetrics snapshots. This eliminates the need for
// poll-subreddit-metrics to re-fetch the same subreddits.

async function batchUpdateSubredditMetrics() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Find monitored subreddits
  const monitoredSubs = await prisma.monitoredSubreddit.findMany({
    where: { active: true },
  });
  if (monitoredSubs.length === 0) return;

  // Get recent Reddit hits from today's scan
  const recentHits = await prisma.listeningHit.findMany({
    where: {
      platform: 'REDDIT',
      detectedAt: { gte: today },
    },
    select: {
      subreddit: true,
      engagementCount: true,
      content: true,
      title: true,
    },
  });

  // Group hits by subreddit
  const hitsBySub = {};
  for (const hit of recentHits) {
    const subName = (hit.subreddit || '').replace(/^r\//, '').toLowerCase();
    if (!subName) continue;
    if (!hitsBySub[subName]) hitsBySub[subName] = [];
    hitsBySub[subName].push(hit);
  }

  let updated = 0;
  for (const sub of monitoredSubs) {
    const subKey = sub.subredditName.toLowerCase();
    const hits = hitsBySub[subKey];
    if (!hits || hits.length === 0) continue;

    const postsCount = hits.length;
    const totalEngagement = hits.reduce((sum, h) => sum + (h.engagementCount || 0), 0);
    const avgUpvotes = postsCount > 0 ? totalEngagement / postsCount : 0;

    // Upsert daily snapshot (mark as sourced from listening scan)
    await prisma.subredditMetrics.upsert({
      where: {
        subredditId_date: { subredditId: sub.id, date: today },
      },
      update: {
        postsCount,
        avgUpvotes: Math.round(avgUpvotes * 100) / 100,
      },
      create: {
        subredditId: sub.id,
        date: today,
        postsCount,
        avgUpvotes: Math.round(avgUpvotes * 100) / 100,
      },
    });

    // Update running averages
    await prisma.monitoredSubreddit.update({
      where: { id: sub.id },
      data: {
        avgDailyPosts: postsCount,
        avgEngagement: Math.round(avgUpvotes * 100) / 100,
      },
    });

    updated++;
  }

  console.log(`[listening-scanner] Batch subreddit metrics: ${updated}/${monitoredSubs.length} updated from listening hits`);
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

export function analyzeSentiment(text) {
  const lower = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;

  // ── Financial context pre-pass ───────────────────────────
  // Check for ambiguous financial terms and resolve them via phrase context
  // BEFORE the keyword loops to prevent double-counting.
  const resolvedTerms = new Set();
  for (const term of Object.keys(FINANCIAL_AMBIGUOUS_TERMS)) {
    if (!lower.includes(term)) continue;
    const sentiment = resolveFinancialSentiment(text, term);
    if (sentiment !== null) {
      resolvedTerms.add(term);
      if (sentiment === 'positive') positiveCount++;
      else if (sentiment === 'negative' || sentiment === 'bearish') negativeCount++;
      // 'neutral' → no change (skip this term entirely)
    }
  }

  for (const kw of POSITIVE_KEYWORDS) {
    if (resolvedTerms.has(kw)) continue; // Already resolved via financial context
    // Use word boundary matching to avoid false positives (e.g., "issue" in "tissue")
    let re;
    try { re = new RegExp(`\\b${kw}\\b`); } catch { re = null; }
    const match = re ? re.exec(lower) : null;
    const idx = match ? match.index : lower.indexOf(kw);
    if ((!re && idx === -1) || (re && !match)) continue;
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
    if (resolvedTerms.has(kw)) continue; // Already resolved via financial context
    let re;
    try { re = new RegExp(`\\b${kw}\\b`); } catch { re = null; }
    const match = re ? re.exec(lower) : null;
    const idx = match ? match.index : lower.indexOf(kw);
    if ((!re && idx === -1) || (re && !match)) continue;
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

export function normalize(value, maxExpected = 100000) {
  if (!value || value <= 0) return 0;
  return Math.min(Math.log1p(value) / Math.log1p(maxExpected), 1);
}

/**
 * Compute a composite author trust score (0-1) based on multiple quality signals.
 * Replaces the naive normalizedFollowers approach.
 *
 * Factors:
 * - Engagement rate (engagements / followers) — high rate = quality audience
 * - Follower count (log-scaled) — raw reach still matters, but diminishing returns
 * - Account age — older accounts are more trustworthy
 * - Verification — verified accounts get a boost
 *
 * @param {Object} params
 * @param {number} params.followers - Follower/karma count
 * @param {number} params.engagementCount - Total engagements on the post
 * @param {number} params.accountAgeDays - Account age in days (0 if unknown)
 * @param {boolean} params.isVerified - Whether the account is verified
 * @param {string} params.platform - 'x' or 'reddit'
 * @returns {number} Trust score 0-1
 */
export function computeAuthorTrust({ followers, engagementCount, accountAgeDays, isVerified, platform }) {
  // Engagement rate: high engagement relative to followers = quality
  const engRate = followers > 0 ? engagementCount / followers : 0;
  // Normalize: 5% engagement rate is excellent
  const engRateScore = Math.min(1, engRate / 0.05);

  // Follower count: log-scaled to reduce impact of mega-accounts
  // ln(1M) ≈ 13.8, ln(1K) ≈ 6.9, ln(100) ≈ 4.6
  const followerScore = followers > 0 ? Math.min(1, Math.log(followers + 1) / Math.log(5000000)) : 0;

  // Account age: penalize very new accounts (<30 days), reward established (>365 days)
  const ageScore = accountAgeDays > 0
    ? Math.min(1, accountAgeDays / 365)
    : 0.5; // Unknown age gets neutral score

  // New account penalty: accounts <30 days old get a hard penalty
  const newAccountPenalty = accountAgeDays > 0 && accountAgeDays < 30 ? 0.3 : 1.0;

  // Verification boost
  const verificationBoost = isVerified ? 1.2 : 1.0;

  // Platform-specific weighting
  const weights = platform === 'reddit'
    ? { engRate: 0.35, followers: 0.15, age: 0.50 }  // Reddit: karma age matters most
    : { engRate: 0.40, followers: 0.30, age: 0.30 };  // X: engagement rate matters most

  const raw = (
    engRateScore * weights.engRate +
    followerScore * weights.followers +
    ageScore * weights.age
  ) * newAccountPenalty * verificationBoost;

  return Math.min(1, Math.max(0, raw));
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

export function computeContentRelevance(content, queryString) {
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
    // Use word boundary matching for generic terms to avoid false positives
    // (e.g., "figure" matching "figuratively"). Tickers ($FIGR) and short
    // brand terms use includes() since they're unambiguous.
    if (termLower.startsWith('$') || termLower.length <= 4) {
      if (lower.includes(termLower)) weightedMatches += weight;
    } else {
      try {
        const re = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (re.test(lower)) weightedMatches += weight;
      } catch {
        if (lower.includes(termLower)) weightedMatches += weight;
      }
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

// ── Audience Question Analysis ─────────────────────────────────

/**
 * Batch AI analysis: extract questions from ListeningHit data,
 * cluster by topic, detect unanswered/recurring, and score opportunities.
 * Results cached in AIInsight with AUDIENCE_QUESTION type.
 */
export async function analyzeAudienceQuestions() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Fetch recent listening hits with topic names + author info
    const hits = await prisma.listeningHit.findMany({
      where: { detectedAt: { gte: thirtyDaysAgo } },
      include: { topic: { select: { name: true } } },
      orderBy: { detectedAt: 'desc' },
      take: 1000,
    });

    if (hits.length === 0) {
      console.log('Audience question analysis: no recent hits to analyze');
      return { questions: 0, clusters: 0 };
    }

    // ── Step 1: Pre-filter hits likely to contain questions ──────
    // Heuristic: contains '?' or interrogative words at start of sentence
    const interrogativePattern = /\?|^(what|how|why|when|where|who|which|can|does|do|is|are|will|should|could|would)\b/im;
    const questionHits = hits.filter((h) => interrogativePattern.test(h.content));

    if (questionHits.length === 0) {
      console.log('Audience question analysis: no question-like hits found');
      return { questions: 0, clusters: 0 };
    }

    // ── Step 2: Pre-compute per-hit metadata ──────────────────
    const hitSummaries = questionHits.slice(0, 500).map((h) => ({
      id: h.id,
      content: h.content.slice(0, 400),
      topicName: h.topic?.name || 'Unknown',
      engagement: h.engagementCount || 0,
      authorReach: h.authorFollowersOrKarma || 0,
      authorHandle: h.authorHandle || null,
      platform: h.platform,
      detectedAt: h.detectedAt?.toISOString(),
    }));

    // Pre-compute aggregate stats for AI context
    const totalEngagement = hitSummaries.reduce((s, h) => s + h.engagement, 0);
    const totalReach = hitSummaries.reduce((s, h) => s + h.authorReach, 0);
    const avgEngagement = hitSummaries.length > 0 ? Math.round(totalEngagement / hitSummaries.length) : 0;
    const platformBreakdown = {};
    for (const h of hitSummaries) {
      platformBreakdown[h.platform] = (platformBreakdown[h.platform] || 0) + 1;
    }

    // Fetch Figure's published posts — extract keywords for "answered" cross-reference
    const posts = await prisma.post.findMany({
      where: { status: 'PUBLISHED', publishedAt: { gte: ninetyDaysAgo } },
      select: { content: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    });

    // Build a keyword set from Figure's posts for deterministic "answered" detection
    const figureKeywords = new Set();
    for (const p of posts) {
      if (!p.content) continue;
      const words = p.content
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3);
      for (const w of words) figureKeywords.add(w);
    }

    // Extract concise topic summaries from Figure's posts for AI context
    const figureTopicSummary = posts.slice(0, 30).map((p) => (p.content || '').slice(0, 200));

    const aiContext = {
      instruction: `You are given ${hitSummaries.length} social listening hits that have been PRE-FILTERED to likely contain questions (they contain "?" or interrogative words). Your job is to:

1. Extract genuine questions (skip rhetorical questions, complaints disguised as questions, and promotional content with question marks).
2. Group similar questions into clusters by topic theme.

Return JSON with:
"questions": array of objects, each with:
  - "text" (string): The core question distilled to 1-2 sentences
  - "sourceHitIds" (string[]): Up to 3 hit IDs that contain this question or very similar ones
  - "topicName" (string): The listening topic name from the hit data
  - "count" (int): How many hits contain this same question/intent

"clusters": array of objects, each with:
  - "label" (string): Short topic label (3-5 words)
  - "description" (string): One sentence explaining what the audience wants to know
  - "questionIndices" (int[]): Indices into the questions array

IMPORTANT:
- Merge near-duplicate questions (same intent, different wording) into one entry with higher count
- Only include questions that a content team could meaningfully answer with a post or thread
- Skip questions that are internal debates ("isn't X better than Y?") unless they reveal a knowledge gap
- For clusters, use specific labels like "Token utility mechanics" not vague ones like "General questions"`,

      preComputedStats: {
        totalQuestionHits: hitSummaries.length,
        totalEngagement,
        totalReach,
        avgEngagementPerHit: avgEngagement,
        platformBreakdown,
        totalHitsScanned: hits.length,
        questionHitRatio: `${Math.round((questionHits.length / hits.length) * 100)}%`,
      },

      hits: hitSummaries,
      figureContentTopics: figureTopicSummary,
    };

    const aiResult = await generateInsight('audience_questions', aiContext, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 2500,
      systemPrompt: 'You are an audience research analyst for a crypto/RWA company. Extract and cluster genuine audience questions from pre-filtered social listening data. Be precise — only include questions that represent real knowledge gaps or content opportunities. Always respond with valid JSON.',
    });

    const rawQuestions = aiResult.questions || [];
    const rawClusters = aiResult.clusters || [];

    // ── Step 3: Deterministic post-processing ─────────────────

    // Build a lookup from hit ID to hit data for enrichment
    const hitById = {};
    for (const h of hitSummaries) hitById[h.id] = h;

    // Enrich questions with deterministic metrics
    const enrichedQuestions = rawQuestions.map((q) => {
      const sourceHits = (q.sourceHitIds || []).map((id) => hitById[id]).filter(Boolean);
      const engagementSum = sourceHits.reduce((s, h) => s + h.engagement, 0);
      const authorReachSum = sourceHits.reduce((s, h) => s + h.authorReach, 0);

      // Deterministic recurring check: 3+ unique authors
      const uniqueAuthors = new Set(sourceHits.map((h) => h.authorHandle).filter(Boolean));
      const isRecurring = (q.count || 0) >= 3 || uniqueAuthors.size >= 3;

      // Deterministic "unanswered" check: keyword overlap with Figure's posts
      const questionWords = (q.text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const overlapCount = questionWords.filter((w) => figureKeywords.has(w)).length;
      const overlapRatio = questionWords.length > 0 ? overlapCount / questionWords.length : 0;
      // If <30% keyword overlap with Figure's published content, likely unanswered
      const isUnanswered = overlapRatio < 0.3;

      return {
        text: q.text,
        sourceHitIds: q.sourceHitIds || [],
        topicName: q.topicName || 'Unknown',
        engagementSum,
        authorReachSum,
        isRecurring,
        isUnanswered,
        count: q.count || 1,
      };
    });

    // Enrich clusters with deterministic opportunity scoring
    const maxVolume = Math.max(1, ...rawClusters.map((c) => {
      const indices = c.questionIndices || [];
      return indices.reduce((s, i) => s + (enrichedQuestions[i]?.count || 0), 0);
    }));
    const maxEngagement = Math.max(1, ...rawClusters.map((c) => {
      const indices = c.questionIndices || [];
      return indices.reduce((s, i) => s + (enrichedQuestions[i]?.engagementSum || 0), 0);
    }));

    const enrichedClusters = rawClusters.map((c) => {
      const indices = c.questionIndices || [];
      const clusterQuestions = indices.map((i) => enrichedQuestions[i]).filter(Boolean);

      const totalVolume = clusterQuestions.reduce((s, q) => s + q.count, 0);
      const totalEngagement = clusterQuestions.reduce((s, q) => s + q.engagementSum, 0);
      const totalReach = clusterQuestions.reduce((s, q) => s + q.authorReachSum, 0);
      const recurringCount = clusterQuestions.filter((q) => q.isRecurring).length;
      const unansweredCount = clusterQuestions.filter((q) => q.isUnanswered).length;

      // Deterministic opportunity score:
      // Volume (25%) + Engagement (25%) + Reach (20%) + Recurring (15%) + Unanswered (15%)
      const volumeScore = Math.min(100, (totalVolume / maxVolume) * 100);
      const engScore = Math.min(100, (totalEngagement / maxEngagement) * 100);
      const reachScore = Math.min(100, Math.log1p(totalReach) / Math.log1p(1000000) * 100);
      const recurringScore = clusterQuestions.length > 0
        ? (recurringCount / clusterQuestions.length) * 100
        : 0;
      const unansweredScore = clusterQuestions.length > 0
        ? (unansweredCount / clusterQuestions.length) * 100
        : 0;

      const opportunityScore = Math.round(
        volumeScore * 0.25 +
        engScore * 0.25 +
        reachScore * 0.20 +
        recurringScore * 0.15 +
        unansweredScore * 0.15
      );

      return {
        label: c.label,
        description: c.description,
        questionIndices: indices,
        totalVolume,
        totalEngagement,
        totalReach,
        recurringCount,
        unansweredCount,
        opportunityScore,
      };
    });

    // Sort clusters by opportunity score descending
    enrichedClusters.sort((a, b) => b.opportunityScore - a.opportunityScore);

    // Dismiss old AUDIENCE_QUESTION insights
    await prisma.aIInsight.updateMany({
      where: { insightType: 'AUDIENCE_QUESTION', dismissed: false },
      data: { dismissed: true },
    });

    // Store new insights as separate records
    await prisma.aIInsight.create({
      data: {
        insightType: 'AUDIENCE_QUESTION',
        content: { type: 'questions', data: enrichedQuestions },
      },
    });

    await prisma.aIInsight.create({
      data: {
        insightType: 'AUDIENCE_QUESTION',
        content: { type: 'clusters', data: enrichedClusters },
      },
    });

    const summary = {
      questions: enrichedQuestions.length,
      clusters: enrichedClusters.length,
      hitsScanned: hits.length,
      questionHitsFound: questionHits.length,
    };

    console.log('Audience question analysis cached:', summary);
    return summary;
  } catch (err) {
    console.error('Audience question analysis failed (non-blocking):', err.message);
    return { questions: 0, clusters: 0, error: err.message };
  }
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
  const results = { hitsCreated: 0, topicsProcessed: 0, errors: [], redditSkipped: false, tasksCreated: 0 };
  const newHits = []; // Track newly created hits for task generation

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
      console.warn('KV read for Reddit poll throttle failed, checking Prisma fallback:', err.message);
      // Fallback: check last successful SociaVault call in APICallLog
      try {
        const lastSociaVaultCall = await prisma.aPICallLog.findFirst({
          where: { provider: 'sociavault', statusCode: { gte: 200, lt: 300 } },
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true },
        });
        if (lastSociaVaultCall) {
          const elapsed = Date.now() - new Date(lastSociaVaultCall.timestamp).getTime();
          if (elapsed < REDDIT_POLL_INTERVAL_MS) {
            shouldPollReddit = false;
            results.redditSkipped = true;
          }
        }
      } catch (prismaErr) {
        console.warn('Prisma fallback for Reddit throttle also failed:', prismaErr.message);
        // Both KV and Prisma unavailable — skip Reddit to be safe (don't burn credits)
        shouldPollReddit = false;
        results.redditSkipped = true;
      }
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
        // ── Topic-adaptive weights (SLST-02) ──
        const topicType = getTopicType(topic);
        const weights = TOPIC_WEIGHT_PROFILES[topicType];

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

            // Per-query performance counters
            let queryHitsCreated = 0;
            let queryActionable = 0;
            let querySpam = 0;
            let queryHeuristicSum = 0;
            const scoredHits = []; // Collect hits for batch AI validation before persisting

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

                // ── Cross-query dedup via Redis (SLST-05) ──
                // Prevents the same post from appearing in multiple queries for one topic.
                // Atomic SET NX: returns null if key already exists, 'OK' if set.
                try {
                  const topicDedupKey = generateTopicDedupKey(topic.id, platformPostId);
                  const alreadyInTopic = await kv.set(topicDedupKey, '1', { ex: TOPIC_DEDUP_TTL_SECONDS, nx: true });
                  if (alreadyInTopic === null) continue;
                } catch (dedupErr) {
                  // Redis unavailable — fall through to Prisma dedup (safe degradation)
                  console.warn('Redis dedup check failed, falling back to Prisma:', dedupErr.message);
                }

                // Dedupe against existing hits (Prisma fallback)
                // Check at topic level (not just query) to catch cross-query dupes
                const existing = await prisma.listeningHit.findFirst({
                  where: {
                    topicId: topic.id,
                    platformPostId: String(platformPostId),
                  },
                });

                if (existing) continue;

                // Filter out negative keywords (word-boundary matching to avoid false negatives)
                const content =
                  hit.text || hit.content || hit.body || hit.selftext || hit.title || '';
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
                  hit.author?.profilePicture ||
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
                  (hit.likeCount || hit.public_metrics?.like_count || hit.ups || 0) +
                  (hit.retweetCount || hit.public_metrics?.retweet_count || 0) +
                  (hit.replyCount || hit.public_metrics?.reply_count || hit.num_comments || 0);
                const rawPermalink = hit.permalink || hit.url || null;
                const sourceUrl = rawPermalink
                  ? rawPermalink.startsWith('http')
                    ? rawPermalink
                    : `https://reddit.com${rawPermalink}`
                  : null;

                // Extract original post timestamp first (needed for recency factor)
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

                // Compute heuristic score
                // Topic-adaptive weights from TOPIC_WEIGHT_PROFILES (SLST-02)
                // Caps raised for crypto space (large accounts & viral posts)
                const authorTrust = computeAuthorTrust({
                  followers: authorFollowers,
                  engagementCount,
                  accountAgeDays: 0,  // Not available from API yet
                  isVerified: false,  // Not available from API yet
                  platform: query.platform.toLowerCase(),
                });
                const normalizedFollowers = authorTrust; // Drop-in replacement — same range (0-1)
                const contentRelevance = computeContentRelevance(
                  content,
                  query.queryString,
                );

                // Content relevance floor: if < 15% of query terms match the content,
                // the post is almost certainly off-topic (API returned a false positive).
                // Skip entirely to avoid polluting the feed.
                if (contentRelevance < 0.15 && !isKolTopic) continue;

                // ── Engagement velocity blending (SLST-04) ──
                // Blend absolute engagement (60%) with velocity (40%) for time-aware scoring
                const velocity = computeEngagementVelocity(engagementCount, detectedAt);
                const blendedEngagement = 0.6 * normalize(engagementCount, 100000) + 0.4 * normalize(velocity, 500);

                // Recency factor: linear decay over 7 days (fresh posts score higher)
                const postAgeHours = Math.max(0, (Date.now() - detectedAt.getTime()) / (1000 * 60 * 60));
                const recencyFactor = Math.max(0, 1 - (postAgeHours / (7 * 24)));

                // ── Topic-adaptive scoring (SLST-02) ──
                const heuristicScore =
                  normalizedFollowers * weights.followers +
                  blendedEngagement * weights.engagement +
                  contentRelevance * weights.contentRelevance +
                  recencyFactor * weights.recency;

                // Sentiment analysis
                const sentiment = analyzeSentiment(content);

                // Determine aiRelevance using topic-aware key terms (works for competitors too)
                const topicTerms = getTopicKeyTerms(topic);
                const termMatches = topicTerms.filter((term) => lower.includes(term)).length;

                // Count HIGH_WEIGHT matches separately — these are brand/ticker names
                // that strongly signal relevance (vs generic terms like "open", "figure")
                const brandMatches = topicTerms.filter((term) =>
                  lower.includes(term) && HIGH_WEIGHT_TERMS.has(term)
                ).length;

                let aiRelevance = 'LOW';
                if (termMatches >= 3 || (brandMatches >= 1 && heuristicScore > 0.5)) {
                  aiRelevance = 'HIGH';
                } else if (termMatches >= 2 || (termMatches >= 1 && heuristicScore > 0.35)) {
                  aiRelevance = 'MEDIUM';
                } else if (heuristicScore < 0.25 || termMatches === 0) {
                  aiRelevance = 'SPAM';
                }

                // ── Collect scored hit for batch processing (SLST-01) ──
                // Instead of creating ListeningHit immediately, collect all scored hits
                // so we can batch-validate MEDIUM+ hits through AI before persisting.
                scoredHits.push({
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
                  aiRelevance,
                  // Keep raw hit data for avatar sync
                  _authorProfileImageUrl: authorProfileImageUrl,
                  _queryPlatform: query.platform,
                });
              } catch (hitError) {
                console.error(
                  `Error processing listening hit for query ${query.id}:`,
                  hitError,
                );
              }
            }

            // ── AI Batch Validation (Phase 15: SGNL-01 + SGNL-03) ──────────────────────
            // Phase 15: Validate ALL hits, not just MEDIUM+. Cost increase ~$0.06-0.13/day.
            // AI validation now serves as the primary relevance signal, not just a multiplier.
            // Process in chunks of 25 to keep API call count reasonable.
            if (scoredHits.length > 0 && process.env.ANTHROPIC_API_KEY) {
              const hitsForValidation = scoredHits; // All hits get AI validation

              if (hitsForValidation.length > 0) {
                try {
                  // Process in chunks of 25
                  for (let chunk = 0; chunk < hitsForValidation.length; chunk += 25) {
                    const batch = hitsForValidation.slice(chunk, chunk + 25);
                    const validations = await batchValidateRelevance(
                      batch.map(h => ({ content: h.content, authorFollowers: h.authorFollowersOrKarma, engagementCount: h.engagementCount })),
                      topic.name,
                      getTopicType(topic),
                    );

                    // Apply multipliers, actionType, and semantic relevance back to scored hits
                    for (const v of validations) {
                      if (v.index >= 0 && v.index < batch.length) {
                        const targetHit = batch[v.index];
                        targetHit.heuristicScore = targetHit.heuristicScore * (v.multiplier || 1.0);
                        targetHit.actionType = v.actionType || 'FYI'; // NEW: actionability classification
                        targetHit.semanticRelevance = v.multiplier; // NEW: store the AI's semantic assessment
                      }
                    }
                  }
                } catch (aiErr) {
                  console.warn('AI batch validation failed (scores unchanged):', aiErr.message);
                }
              }
            }

            // ── Persist scored hits ──────────────────────────────────
            for (const scored of scoredHits) {
              try {
                // Priority tiers (replaces binary actionable)
                let priorityTier = 'LOW';
                if (scored.heuristicScore > 0.75) priorityTier = 'CRITICAL';
                else if (scored.heuristicScore > 0.55) priorityTier = 'HIGH';
                else if (scored.heuristicScore > 0.35) priorityTier = 'MEDIUM';

                // Backward-compatible: still compute isActionable from threshold
                // But RESPOND and CRISIS hits are always actionable regardless of score
                const actionableThreshold = ACTIONABLE_THRESHOLDS[topic.pollingTier] || 0.5;
                const isActionable = scored.heuristicScore > actionableThreshold
                  || scored.actionType === 'RESPOND'
                  || scored.actionType === 'CRISIS';

                // Compute author trust score and engagement rate
                const authorEngagementRate = scored.authorFollowersOrKarma > 0
                  ? scored.engagementCount / scored.authorFollowersOrKarma
                  : null;

                // Create ListeningHit
                const listeningHit = await prisma.listeningHit.create({
                  data: {
                    queryId: scored.queryId,
                    topicId: scored.topicId,
                    platform: scored.platform,
                    platformPostId: scored.platformPostId,
                    authorUsername: scored.authorUsername,
                    authorDisplayName: scored.authorDisplayName,
                    authorProfileImageUrl: scored.authorProfileImageUrl,
                    authorFollowersOrKarma: scored.authorFollowersOrKarma,
                    content: scored.content,
                    sourceUrl: scored.sourceUrl,
                    subreddit: scored.subreddit,
                    parentThreadTitle: scored.parentThreadTitle,
                    detectedAt: scored.detectedAt,
                    engagementCount: scored.engagementCount,
                    heuristicScore: scored.heuristicScore,
                    sentiment: scored.sentiment,
                    isActionable,
                    aiRelevance: scored.aiRelevance,
                    // Phase 15: Signal Intelligence fields
                    actionType: scored.actionType || null,
                    authorTrustScore: computeAuthorTrust({
                      followers: scored.authorFollowersOrKarma || 0,
                      engagementCount: scored.engagementCount || 0,
                      accountAgeDays: 0,
                      isVerified: false,
                      platform: scored.platform.toLowerCase(),
                    }),
                    authorEngagementRate,
                    authorAccountAgeDays: null, // Not available from APIs yet
                    authorIsVerified: false, // Not available from APIs yet
                    semanticRelevance: scored.semanticRelevance || null,
                  },
                });

                // Track for auto-task generation
                newHits.push(listeningHit);

                // If high-scoring, create InboxItem
                if (isActionable) {
                  const inboxItem = await prisma.inboxItem.create({
                    data: {
                      accountId: topic.queries[0]?.accountId || undefined,
                      platform: scored.platform,
                      itemType: 'MENTION',
                      fromUsername: scored.authorUsername,
                      content: scored.content,
                      internalNotes: `Listening hit (score: ${scored.heuristicScore.toFixed(2)}, priority: ${priorityTier}) from topic "${topic.name}"`,
                    },
                  });

                  // Link inbox item back to listening hit
                  await prisma.listeningHit.update({
                    where: { id: listeningHit.id },
                    data: { routedToInboxItemId: inboxItem.id },
                  });
                }

                // Sync KOL avatar if this author matches a tracked KOL
                if (scored._authorProfileImageUrl && scored._queryPlatform === 'X') {
                  try {
                    await prisma.kOL.updateMany({
                      where: {
                        username: scored.authorUsername,
                        platform: 'X',
                        avatarUrl: null,
                      },
                      data: { avatarUrl: scored._authorProfileImageUrl },
                    });
                  } catch (err) {
                    console.warn('Avatar sync failed:', err.message);
                  }
                }

                results.hitsCreated++;
                queryHitsCreated++;
                queryHeuristicSum += scored.heuristicScore;
                if (isActionable) queryActionable++;
                if (scored.aiRelevance === 'SPAM') querySpam++;
              } catch (persistErr) {
                console.error(
                  `Error persisting listening hit for query ${scored.queryId}:`,
                  persistErr,
                );
              }
            }

            // Update per-query performance counters
            if (queryHitsCreated > 0 || queryActionable > 0 || querySpam > 0) {
              try {
                await prisma.listeningQuery.update({
                  where: { id: query.id },
                  data: {
                    totalHits: { increment: queryHitsCreated },
                    actionableHits: { increment: queryActionable },
                    spamHits: { increment: querySpam },
                    avgHeuristic: queryHitsCreated > 0 ? queryHeuristicSum / queryHitsCreated : undefined,
                    lastEvaluatedAt: new Date(),
                  },
                });
              } catch (err) {
                console.warn(`Query ${query.id} metrics update failed:`, err.message);
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

    // ── Batch subreddit metrics from listening data ──────────
    // When the listening scan pulls Reddit posts, extract subreddit metrics
    // (subscribers, post counts, engagement) and write daily snapshots.
    // This piggybacks on existing API calls, saving credits that the
    // separate poll-subreddit-metrics cron would otherwise spend.
    if (redditPolled) {
      try {
        await batchUpdateSubredditMetrics();
      } catch (err) {
        console.warn('Batch subreddit metrics update failed (non-blocking):', err.message);
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

    // ── Audience Question Analysis ─────────────────────────────
    // Run after all scanning is complete (non-blocking)
    try {
      results.audienceQuestions = await analyzeAudienceQuestions();
    } catch (err) {
      console.warn('Audience question analysis failed (non-blocking):', err.message);
      results.audienceQuestions = { questions: 0, clusters: 0, error: err.message };
    }

    // ── Auto-Task Generation ────────────────────────────────────
    // Convert high-priority listening signals into actionable tasks (non-blocking)
    try {
      if (newHits.length > 0) {
        const tasksCreated = await processNewSignalsToTasks(prisma, newHits, activeTopics);
        results.tasksCreated = tasksCreated.length;
        if (tasksCreated.length > 0) {
          console.log(`[Intelligence] Created ${tasksCreated.length} tasks from ${newHits.length} new listening hits`);
        }
      }
    } catch (err) {
      console.warn('Auto-task generation failed (non-blocking):', err.message);
    }

    return results;
  } catch (error) {
    console.error('listening scanner error:', error);
    results.errors.push({ error: error.message });
    return results;
  }
}
