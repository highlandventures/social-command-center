import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { generateInsight } from '../ai';

// ── Shared input & helpers ────────────────────────────────────

const rangeInput = z
  .object({
    range: z
      .enum(['7d', '30d', '90d', '365d', 'custom'])
      .default('30d'),
    accountId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .default({});

function rangeToDays(range, startDate, endDate) {
  if (range === 'custom' && startDate && endDate) {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }
  const map = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
  return map[range] || 30;
}

function rangeToDate(range, startDate) {
  if (range === 'custom' && startDate) {
    return new Date(startDate + 'T00:00:00Z');
  }
  return new Date(Date.now() - rangeToDays(range) * 24 * 60 * 60 * 1000);
}

function rangeToEndDate(range, endDate) {
  if (range === 'custom' && endDate) {
    return new Date(endDate + 'T23:59:59.999Z');
  }
  return new Date();
}

// ── Pure helper functions (exported for testability) ──────────

/**
 * Compute percentile value from a sorted array of numbers.
 * Uses linear interpolation for non-integer indices.
 */
export function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/**
 * Assign posts to top / average / poor tiers based on engagement rate percentiles.
 * Top: >= 75th percentile, Average: 25th-75th, Poor: < 25th
 */
export function computeTiers(posts) {
  if (posts.length === 0) {
    return { top: [], average: [], poor: [] };
  }

  const rates = posts.map((p) => p.engagementRate).sort((a, b) => a - b);
  const p75 = percentile(rates, 75);
  const p25 = percentile(rates, 25);

  const top = [];
  const average = [];
  const poor = [];

  for (const post of posts) {
    if (post.engagementRate >= p75) {
      top.push(post);
    } else if (post.engagementRate >= p25) {
      average.push(post);
    } else {
      poor.push(post);
    }
  }

  return { top, average, poor };
}

/**
 * Group posts by contentType and compute average engagement rate per format.
 */
export function computeFormatPatterns(posts) {
  if (posts.length === 0) return [];

  const groups = {};
  for (const post of posts) {
    const format = post.contentType || 'POST';
    if (!groups[format]) {
      groups[format] = { totalEngRate: 0, totalImpressions: 0, count: 0 };
    }
    groups[format].totalEngRate += post.engagementRate;
    groups[format].totalImpressions += post.impressions;
    groups[format].count += 1;
  }

  return Object.entries(groups).map(([format, data]) => ({
    format,
    postCount: data.count,
    avgEngRate: data.count > 0 ? +(data.totalEngRate / data.count).toFixed(2) : 0,
    avgImpressions: data.count > 0 ? Math.round(data.totalImpressions / data.count) : 0,
  }));
}

/**
 * Group posts by day-of-week and hour (UTC), compute avg engagement rate per slot.
 * Returns top posting windows sorted by engagement rate.
 */
export function computeTimePatterns(posts) {
  if (posts.length === 0) return [];

  const slots = {};
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (const post of posts) {
    if (!post.publishedAt) continue;
    const date = new Date(post.publishedAt);
    const day = dayNames[date.getUTCDay()];
    const hour = date.getUTCHours();
    const key = `${day}-${hour}`;

    if (!slots[key]) {
      slots[key] = { day, hour, totalEngRate: 0, count: 0 };
    }
    slots[key].totalEngRate += post.engagementRate;
    slots[key].count += 1;
  }

  return Object.values(slots)
    .map((slot) => ({
      day: slot.day,
      hour: slot.hour,
      avgEngRate: slot.count > 0 ? +(slot.totalEngRate / slot.count).toFixed(2) : 0,
      postCount: slot.count,
    }))
    .sort((a, b) => b.avgEngRate - a.avgEngRate);
}

/**
 * Extract common 2-3 word phrases from top-tier posts as rough topic signals.
 */
export function computeTopicSignals(posts) {
  if (posts.length === 0) return [];

  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
    'should', 'may', 'might', 'can', 'could', 'and', 'but', 'or', 'nor',
    'not', 'so', 'yet', 'for', 'with', 'from', 'into', 'about', 'that',
    'this', 'these', 'those', 'it', 'its', 'of', 'in', 'on', 'at', 'to',
    'by', 'as', 'if', 'than', 'then', 'just', 'very', 'also', 'more',
    'most', 'all', 'any', 'each', 'our', 'your', 'their', 'what', 'which',
    'who', 'how', 'when', 'where', 'https', 'http', 'co', 'rt', 'via', 'amp',
    'we', 'you', 'they', 'he', 'she', 'my', 'his', 'her', 'us', 'them',
  ]);

  const phraseMap = {};

  for (const post of posts) {
    if (!post.content) continue;
    const cleaned = post.content
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/@\w+/g, '')
      .replace(/[^a-z0-9\s$%]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const words = cleaned.split(' ').filter((w) => w.length > 2 && !stopwords.has(w));

    // Extract bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (!phraseMap[bigram]) {
        phraseMap[bigram] = { totalEngRate: 0, count: 0 };
      }
      phraseMap[bigram].totalEngRate += post.engagementRate;
      phraseMap[bigram].count += 1;
    }

    // Extract trigrams
    for (let i = 0; i < words.length - 2; i++) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (!phraseMap[trigram]) {
        phraseMap[trigram] = { totalEngRate: 0, count: 0 };
      }
      phraseMap[trigram].totalEngRate += post.engagementRate;
      phraseMap[trigram].count += 1;
    }
  }

  return Object.entries(phraseMap)
    .filter(([, data]) => data.count >= 2)
    .map(([phrase, data]) => ({
      phrase,
      occurrences: data.count,
      avgEngRate: data.count > 0 ? +(data.totalEngRate / data.count).toFixed(2) : 0,
    }))
    .sort((a, b) => b.occurrences - a.occurrences || b.avgEngRate - a.avgEngRate)
    .slice(0, 20);
}

// ── Helper: fetch published posts with latest metrics ─────────

async function fetchPostsWithMetrics(prisma, input) {
  const since = rangeToDate(input.range, input.startDate);
  const until = rangeToEndDate(input.range, input.endDate);

  const postWhere = {
    status: 'PUBLISHED',
    publishedAt: { gte: since, lte: until },
  };
  if (input.accountId) postWhere.accountId = input.accountId;

  const posts = await prisma.post.findMany({
    where: postWhere,
    select: {
      id: true,
      content: true,
      contentType: true,
      platform: true,
      publishedAt: true,
      account: { select: { username: true } },
      metrics: {
        orderBy: { fetchedAt: 'desc' },
        take: 1,
        select: {
          impressions: true,
          engagements: true,
          engagementRate: true,
          likes: true,
          retweets: true,
          replies: true,
        },
      },
    },
    orderBy: { publishedAt: 'desc' },
  });

  return {
    posts: posts.map((post) => {
      const m = post.metrics[0] || {};
      const impressions = m.impressions || 0;
      const engagements = m.engagements || 0;
      const engagementRate = impressions > 0
        ? +((engagements / impressions) * 100).toFixed(2)
        : 0;

      return {
        id: post.id,
        content: post.content || '',
        contentType: post.contentType || 'POST',
        platform: post.platform,
        publishedAt: post.publishedAt,
        username: post.account?.username || '',
        impressions,
        engagements,
        engagementRate,
        likes: m.likes || 0,
        retweets: m.retweets || 0,
        replies: m.replies || 0,
      };
    }),
    since,
    until,
  };
}

// ── Router ────────────────────────────────────────────────────

export const performanceIntelRouter = router({
  /**
   * performanceIntel.tieredPosts
   * Returns published posts grouped into top / average / poor tiers
   * based on engagement rate percentiles.
   */
  tieredPosts: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { posts, since, until } = await fetchPostsWithMetrics(prisma, input);

      const tiers = computeTiers(posts);

      // Format posts for response (truncate content)
      const formatPost = (p) => ({
        id: p.id,
        content: p.content.slice(0, 120),
        contentType: p.contentType,
        platform: p.platform,
        publishedAt: p.publishedAt,
        username: p.username,
        metrics: {
          impressions: p.impressions,
          engagements: p.engagements,
          engagementRate: p.engagementRate,
          likes: p.likes,
          retweets: p.retweets,
          replies: p.replies,
        },
      });

      return {
        tiers: {
          top: tiers.top.map(formatPost),
          average: tiers.average.map(formatPost),
          poor: tiers.poor.map(formatPost),
        },
        totalPosts: posts.length,
        dateRange: {
          since: since.toISOString(),
          until: until.toISOString(),
        },
      };
    }),

  /**
   * performanceIntel.patternAnalysis
   * Computes format, time, and topic patterns from published post data.
   * Pure data computation -- no AI calls.
   */
  patternAnalysis: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { posts } = await fetchPostsWithMetrics(prisma, input);

      const formatPatterns = computeFormatPatterns(posts);
      const timePatterns = computeTimePatterns(posts);

      // Topic signals from top-tier posts
      const tiers = computeTiers(posts);
      const topicSignals = computeTopicSignals(tiers.top);

      return {
        formatPatterns,
        timePatterns: timePatterns.slice(0, 10),
        topicSignals,
      };
    }),

  /**
   * performanceIntel.sparklineData
   * Returns PostMetrics time series for a single post (for sparkline rendering).
   */
  sparklineData: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const metrics = await prisma.postMetrics.findMany({
        where: { postId: input.postId },
        orderBy: { fetchedAt: 'asc' },
        select: {
          fetchedAt: true,
          impressions: true,
          engagements: true,
          engagementRate: true,
        },
      });

      return {
        postId: input.postId,
        series: metrics.map((m) => ({
          timestamp: m.fetchedAt.toISOString(),
          impressions: m.impressions,
          engagements: m.engagements,
          engagementRate: m.engagementRate,
        })),
      };
    }),

  /**
   * performanceIntel.sparklineBatch
   * Returns PostMetrics time series for multiple posts (max 50).
   */
  sparklineBatch: protectedProcedure
    .input(z.object({ postIds: z.array(z.string()).max(50) }))
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const result = {};

      // Fetch all metrics for the given post IDs in one query
      const allMetrics = await prisma.postMetrics.findMany({
        where: { postId: { in: input.postIds } },
        orderBy: { fetchedAt: 'asc' },
        select: {
          postId: true,
          fetchedAt: true,
          impressions: true,
          engagements: true,
          engagementRate: true,
        },
      });

      // Initialize all post IDs with empty arrays
      for (const postId of input.postIds) {
        result[postId] = [];
      }

      // Group by post ID
      for (const m of allMetrics) {
        if (!result[m.postId]) result[m.postId] = [];
        result[m.postId].push({
          timestamp: m.fetchedAt.toISOString(),
          impressions: m.impressions,
          engagements: m.engagements,
          engagementRate: m.engagementRate,
        });
      }

      return result;
    }),

  /**
   * performanceIntel.insightCards
   * Returns AI-generated insight cards summarizing performance patterns.
   * Caches results for 24 hours via AIInsight table.
   */
  insightCards: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;

      // Check for existing non-dismissed insights from last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await prisma.aIInsight.findMany({
        where: {
          insightType: 'PERFORMANCE_PATTERN',
          dismissed: false,
          generatedAt: { gte: oneDayAgo },
        },
        orderBy: { generatedAt: 'desc' },
      });

      if (existing.length > 0) {
        return existing.map((insight) => insight.content);
      }

      // Fetch post data for context
      const { posts } = await fetchPostsWithMetrics(prisma, input);

      if (posts.length === 0) {
        return [];
      }

      // Build context for AI
      const topPosts = [...posts]
        .sort((a, b) => b.engagementRate - a.engagementRate)
        .slice(0, 10);

      const formatPatterns = computeFormatPatterns(posts);
      const timePatterns = computeTimePatterns(posts).slice(0, 5);

      const context = {
        instruction: 'Analyze performance patterns and return a JSON array of 3-5 insight cards. Each card should have: title (string), body (string with specific data), metric (string, the key number), category (one of: format, timing, topic).',
        topPosts: topPosts.map((p) => ({
          content: p.content.slice(0, 100),
          contentType: p.contentType,
          platform: p.platform,
          engagementRate: p.engagementRate,
          impressions: p.impressions,
          engagements: p.engagements,
        })),
        formatStats: formatPatterns,
        bestPostingWindows: timePatterns,
        totalPostsAnalyzed: posts.length,
      };

      const cards = await generateInsight('performance_patterns', context, {
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 1024,
        systemPrompt: 'You are a social media performance analyst. Analyze the provided data and generate insight cards highlighting actionable patterns. Always respond with a valid JSON array of objects with keys: title, body, metric, category.',
      });

      // Normalize: ensure cards is an array
      const cardArray = Array.isArray(cards) ? cards : (cards?.cards || cards?.insights || [cards]);

      // Persist each card as an AIInsight row
      for (const card of cardArray) {
        if (card && card.title) {
          await prisma.aIInsight.create({
            data: {
              insightType: 'PERFORMANCE_PATTERN',
              content: card,
            },
          });
        }
      }

      return cardArray.filter((c) => c && c.title);
    }),
});
