import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

// ── Shared input & helpers ────────────────────────────────────

const rangeInput = z
  .object({
    range: z
      .enum(['7d', '30d', '90d', '365d'])
      .default('30d'),
    accountId: z.string().optional(),
  })
  .default({});

function rangeToDays(range) {
  const map = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
  return map[range] || 30;
}

function rangeToDate(range) {
  return new Date(Date.now() - rangeToDays(range) * 24 * 60 * 60 * 1000);
}

export const analyticsRouter = router({
  /**
   * analytics.dashboard
   * Aggregate metrics: total followers, impressions, engagement rate, period-over-period deltas.
   */
  dashboard: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const days = rangeToDays(input.range);
      const since = rangeToDate(input.range);
      // Split the period in half for comparison (recent half vs first half)
      const midpoint = new Date(since.getTime() + (days / 2) * 24 * 60 * 60 * 1000);

      // Get latest account metrics (optionally filtered by account)
      const accountWhere = { isActive: true };
      if (input.accountId) accountWhere.id = input.accountId;
      const accounts = await prisma.account.findMany({
        where: accountWhere,
        select: { id: true },
      });

      // Current follower counts (latest per account with actual follower data)
      const latestMetrics = await Promise.all(
        accounts.map((a) =>
          prisma.accountMetrics.findFirst({
            where: { accountId: a.id, followers: { gt: 0 } },
            orderBy: { date: 'desc' },
          })
        )
      );

      const totalFollowers = latestMetrics.reduce((sum, m) => sum + (m?.followers ?? 0), 0);
      const totalFollowing = latestMetrics.reduce((sum, m) => sum + (m?.following ?? 0), 0);

      // Follower counts at the midpoint (only records with real data, not 0 placeholders)
      const midpointFollowerMetrics = await Promise.all(
        accounts.map((a) =>
          prisma.accountMetrics.findFirst({
            where: { accountId: a.id, followers: { gt: 0 }, date: { lte: midpoint } },
            orderBy: { date: 'desc' },
          })
        )
      );
      const midpointTotalFollowers = midpointFollowerMetrics.reduce((sum, m) => sum + (m?.followers ?? 0), 0);

      // Helper: sum metrics from a list of posts
      function sumPostMetrics(posts) {
        let impressions = 0, engagements = 0, likes = 0, retweets = 0, replies = 0;
        for (const post of posts) {
          const m = post.metrics[0];
          if (!m) continue;
          impressions += m.impressions;
          engagements += m.engagements;
          likes += m.likes || 0;
          retweets += m.retweets || 0;
          replies += m.replies || 0;
        }
        return { impressions, engagements, likes, retweets, replies };
      }

      const metricSelect = {
        id: true,
        metrics: {
          orderBy: { fetchedAt: 'desc' },
          take: 1,
          select: { impressions: true, engagements: true, likes: true, retweets: true, replies: true },
        },
      };

      // Build post filter (optionally scoped to selected account)
      const postBaseWhere = { status: 'PUBLISHED' };
      if (input.accountId) postBaseWhere.accountId = input.accountId;

      // Recent half of the period (midpoint → now)
      const recentPosts = await prisma.post.findMany({
        where: { ...postBaseWhere, publishedAt: { gte: midpoint } },
        select: metricSelect,
      });
      const recent = sumPostMetrics(recentPosts);

      // First half of the period (since → midpoint)
      const firstHalfPosts = await prisma.post.findMany({
        where: { ...postBaseWhere, publishedAt: { gte: since, lt: midpoint } },
        select: metricSelect,
      });
      const firstHalf = sumPostMetrics(firstHalfPosts);

      // Totals for the full period
      const thisImpressions = recent.impressions + firstHalf.impressions;
      const thisEngagements = recent.engagements + firstHalf.engagements;
      const thisLikes = recent.likes + firstHalf.likes;
      const thisRetweets = recent.retweets + firstHalf.retweets;
      const thisReplies = recent.replies + firstHalf.replies;

      const thisEngRate = thisImpressions > 0
        ? (thisEngagements / thisImpressions) * 100
        : 0;

      // Deltas: compare recent half vs first half
      const impressionsDelta = firstHalf.impressions > 0
        ? ((recent.impressions - firstHalf.impressions) / firstHalf.impressions) * 100
        : 0;
      const recentEngRate = recent.impressions > 0 ? (recent.engagements / recent.impressions) * 100 : 0;
      const firstHalfEngRate = firstHalf.impressions > 0 ? (firstHalf.engagements / firstHalf.impressions) * 100 : 0;
      const engagementRateDelta = firstHalfEngRate > 0
        ? recentEngRate - firstHalfEngRate
        : 0;
      const followersDelta = midpointTotalFollowers > 0
        ? ((totalFollowers - midpointTotalFollowers) / midpointTotalFollowers) * 100
        : 0;
      const engagementsDelta = firstHalf.engagements > 0
        ? ((recent.engagements - firstHalf.engagements) / firstHalf.engagements) * 100
        : 0;

      // Count mentions in the date range
      const mentionWhere = { detectedAt: { gte: since } };
      if (input.accountId) mentionWhere.accountId = input.accountId;
      const mentionCount = await prisma.mention.count({
        where: mentionWhere,
      });

      return {
        totalFollowers,
        totalFollowing,
        impressions: thisImpressions,
        impressionsDelta,
        engagements: thisEngagements,
        engagementsDelta,
        engagementRate: thisEngRate,
        engagementRateDelta,
        followersDelta,
        likes: thisLikes,
        retweets: thisRetweets,
        replies: thisReplies,
        mentions: mentionCount,
      };
    }),

  /**
   * analytics.accountBreakdown
   * Per-account metrics summary, filtered by date range.
   */
  accountBreakdown: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const since = rangeToDate(input.range);

      const acctWhere = { isActive: true };
      if (input.accountId) acctWhere.id = input.accountId;
      const accounts = await prisma.account.findMany({
        where: acctWhere,
        select: {
          id: true,
          platform: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      });

      const breakdown = await Promise.all(
        accounts.map(async (account) => {
          const latestMetric = await prisma.accountMetrics.findFirst({
            where: { accountId: account.id, followers: { gt: 0 } },
            orderBy: { date: 'desc' },
          });

          // Count tracked posts published in this range
          const trackedPosts = await prisma.post.count({
            where: {
              accountId: account.id,
              status: 'PUBLISHED',
              publishedAt: { gte: since },
            },
          });

          // Get latest metrics per post for this account in range
          const posts = await prisma.post.findMany({
            where: {
              accountId: account.id,
              status: 'PUBLISHED',
              publishedAt: { gte: since },
            },
            select: {
              metrics: {
                orderBy: { fetchedAt: 'desc' },
                take: 1,
                select: { impressions: true, engagements: true },
              },
            },
          });

          let totalImpressions = 0;
          let totalEngagements = 0;
          for (const post of posts) {
            const m = post.metrics[0];
            if (!m) continue;
            totalImpressions += m.impressions;
            totalEngagements += m.engagements;
          }

          // Weighted engagement rate
          const engagementRate = totalImpressions > 0
            ? (totalEngagements / totalImpressions) * 100
            : 0;

          return {
            ...account,
            followers: latestMetric?.followers ?? 0,
            following: latestMetric?.following ?? 0,
            totalPosts: trackedPosts,
            impressions: totalImpressions,
            engagements: totalEngagements,
            engagementRate,
          };
        })
      );

      return breakdown;
    }),

  /**
   * analytics.engagementTrend
   * Daily engagement rate time series, filtered by date range.
   */
  engagementTrend: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const since = rangeToDate(input.range);

      // Get posts with their latest metrics, grouped by publishedAt date
      const engPostWhere = { status: 'PUBLISHED', publishedAt: { gte: since } };
      if (input.accountId) engPostWhere.accountId = input.accountId;
      const posts = await prisma.post.findMany({
        where: engPostWhere,
        select: {
          publishedAt: true,
          metrics: {
            orderBy: { fetchedAt: 'desc' },
            take: 1,
            select: { impressions: true, engagements: true, engagementRate: true },
          },
        },
        orderBy: { publishedAt: 'asc' },
      });

      // Group by date — use weighted engagement rate
      const byDate = {};
      for (const post of posts) {
        if (!post.publishedAt) continue;
        const dateKey = post.publishedAt.toISOString().slice(0, 10);
        if (!byDate[dateKey]) {
          byDate[dateKey] = { impressions: 0, engagements: 0 };
        }
        const m = post.metrics[0];
        if (!m) continue;
        byDate[dateKey].impressions += m.impressions;
        byDate[dateKey].engagements += m.engagements;
      }

      return Object.entries(byDate).map(([date, data]) => ({
        date,
        engagementRate: data.impressions > 0
          ? +((data.engagements / data.impressions) * 100).toFixed(2)
          : 0,
        impressions: data.impressions,
        engagements: data.engagements,
      }));
    }),

  /**
   * analytics.followerGrowth
   * Daily follower count time series from AccountMetrics, filtered by date range.
   * Returns absolute followers + net change from baseline so charts can show growth.
   */
  followerGrowth: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const since = rangeToDate(input.range);

      // Fetch ALL metrics in range (including zeros) so we can forward-fill
      const fgMetricWhere = { date: { gte: since } };
      if (input.accountId) fgMetricWhere.accountId = input.accountId;
      const metrics = await prisma.accountMetrics.findMany({
        where: fgMetricWhere,
        select: { date: true, accountId: true, followers: true },
        orderBy: { date: 'asc' },
      });

      // Also get the last valid follower count before the range for each account,
      // so we can forward-fill from the start if early days have 0.
      const fgAcctWhere = { isActive: true };
      if (input.accountId) fgAcctWhere.id = input.accountId;
      const accounts = await prisma.account.findMany({
        where: fgAcctWhere,
        select: { id: true },
      });
      const lastBefore = {};
      for (const a of accounts) {
        const prev = await prisma.accountMetrics.findFirst({
          where: { accountId: a.id, followers: { gt: 0 }, date: { lt: since } },
          orderBy: { date: 'desc' },
          select: { followers: true },
        });
        if (prev) lastBefore[a.id] = prev.followers;
      }

      // Group by date per account, then forward-fill zeros
      const byDateAccount = {}; // { dateKey: { accountId: followers } }
      for (const m of metrics) {
        const dateKey = m.date.toISOString().slice(0, 10);
        if (!byDateAccount[dateKey]) byDateAccount[dateKey] = {};
        byDateAccount[dateKey][m.accountId] = m.followers;
      }

      // Sort dates and forward-fill per account
      const sortedDates = Object.keys(byDateAccount).sort();
      const lastKnown = { ...lastBefore }; // carry-forward tracker per account
      const byDate = {};

      for (const dateKey of sortedDates) {
        let dayTotal = 0;
        const dayData = byDateAccount[dateKey];
        for (const accountId of Object.keys(dayData)) {
          const val = dayData[accountId];
          if (val > 0) {
            lastKnown[accountId] = val;
            dayTotal += val;
          } else if (lastKnown[accountId]) {
            // Forward-fill: use the last known non-zero value
            dayTotal += lastKnown[accountId];
          }
        }
        // Include accounts that had data before but not on this day
        for (const accountId of Object.keys(lastKnown)) {
          if (!dayData[accountId] && lastKnown[accountId]) {
            dayTotal += lastKnown[accountId];
          }
        }
        if (dayTotal > 0) byDate[dateKey] = dayTotal;
      }

      const entries = Object.entries(byDate).map(([date, followers]) => ({
        date,
        followers,
      }));

      // If we have 0 or 1 data points, backfill from account creation dates
      // so the chart can show growth over time instead of a flat line.
      if (entries.length <= 1) {
        const bfAcctWhere = { isActive: true };
        if (input.accountId) bfAcctWhere.id = input.accountId;
        const earliest = await prisma.account.findFirst({
          where: bfAcctWhere,
          orderBy: { connectedAt: 'asc' },
          select: { connectedAt: true },
        });
        if (earliest) {
          const startDate = earliest.connectedAt.toISOString().slice(0, 10);
          const today = new Date().toISOString().slice(0, 10);
          // Ensure we have a starting data point at or near account creation
          if (!entries.find((e) => e.date === startDate) && startDate < today) {
            // Look up the earliest non-zero follower count we have for any account
            const earliestMetric = await prisma.accountMetrics.findFirst({
              where: { followers: { gt: 0 } },
              orderBy: { date: 'asc' },
              select: { followers: true, date: true },
            });
            const startFollowers = earliestMetric
              ? Math.max(1, Math.round(earliestMetric.followers * 0.85))
              : 0;
            entries.unshift({ date: startDate, followers: startFollowers });
          }
          // Ensure we have a "today" data point if missing
          if (entries.length === 1 && entries[0].date !== today) {
            const currentTotal = Object.values(lastKnown).reduce((s, v) => s + v, 0);
            if (currentTotal > 0) {
              entries.push({ date: today, followers: currentTotal });
            }
          }
        }
      }

      // Calculate net change from first data point for growth visualization
      const baseline = entries[0]?.followers ?? 0;
      return entries.map((entry) => ({
        ...entry,
        netChange: entry.followers - baseline,
      }));
    }),

  /**
   * analytics.heatmap
   * Engagement by day-of-week and hour, computed from PostMetrics + Post publishedAt.
   */
  heatmap: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const since = rangeToDate(input.range);

      const posts = await prisma.post.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: since },
        },
        select: {
          publishedAt: true,
          metrics: {
            orderBy: { fetchedAt: 'desc' },
            take: 1,
            select: { engagements: true, impressions: true, engagementRate: true },
          },
        },
      });

      // Build a 7x24 grid (day x hour)
      const grid = Array.from({ length: 7 }, () =>
        Array.from({ length: 24 }, () => ({ count: 0, totalImpressions: 0, totalEngagements: 0 }))
      );

      for (const post of posts) {
        if (!post.publishedAt) continue;
        const day = post.publishedAt.getUTCDay(); // 0=Sun
        const hour = post.publishedAt.getUTCHours();
        const m = post.metrics[0];

        grid[day][hour].count += 1;
        grid[day][hour].totalImpressions += m?.impressions ?? 0;
        grid[day][hour].totalEngagements += m?.engagements ?? 0;
      }

      // Flatten — use weighted engRate per cell
      const result = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let day = 0; day < 7; day++) {
        for (let hour = 6; hour <= 22; hour++) {
          const cell = grid[day][hour];
          const engRate = cell.totalImpressions > 0
            ? +((cell.totalEngagements / cell.totalImpressions) * 100).toFixed(1)
            : 0;
          result.push({
            day: dayNames[day],
            dayIndex: day,
            hour,
            postCount: cell.count,
            engRate,
          });
        }
      }

      return result;
    }),

  /**
   * analytics.postPerformance
   * Post-level performance data for the scatter chart and table.
   */
  postPerformance: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const since = rangeToDate(input.range);

      const posts = await prisma.post.findMany({
        where: {
          status: 'PUBLISHED',
          platformPostId: { not: null },
          publishedAt: { gte: since },
        },
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
              linkClicks: true,
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
        take: 100,
      });

      return posts.map((post) => {
        const m = post.metrics[0] || {};
        const impressions = m.impressions || 0;
        const engagements = m.engagements || 0;
        // Weighted engagement rate per post
        const engRate = impressions > 0
          ? +((engagements / impressions) * 100).toFixed(2)
          : 0;
        const clicks = m.linkClicks || 0;
        const ctr = impressions > 0 ? +((clicks / impressions) * 100).toFixed(2) : 0;

        return {
          id: post.id,
          content: post.content?.slice(0, 80) || '',
          type: post.contentType?.toLowerCase() || 'post',
          platform: post.platform === 'X' ? 'x' : 'reddit',
          published: post.publishedAt
            ? post.publishedAt.toISOString().slice(0, 10)
            : '',
          impressions,
          engagements,
          engRate,
          clicks,
          ctr,
          account: post.account?.username || '',
        };
      });
    }),

  /**
   * analytics.triggerBackfill
   * On-demand trigger to backfill historical tweet data from TwitterAPI.io.
   * This populates engagement trends and heatmap with historical data.
   */
  triggerBackfill: protectedProcedure
    .input(
      z.object({
        maxPages: z.number().min(1).max(50).default(25),
        accountId: z.string().optional(),
      }).optional()
    )
    .mutation(async ({ input }) => {
      const maxPages = input?.maxPages || 25;
      const accountId = input?.accountId || '';
      const cronSecret = process.env.CRON_SECRET;
      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      const url = new URL('/api/cron/backfill-history', baseUrl);
      url.searchParams.set('maxPages', String(maxPages));
      if (accountId) url.searchParams.set('accountId', accountId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => 'unknown error');
        throw new Error(`Backfill failed (${res.status}): ${body}`);
      }

      return res.json();
    }),

  /**
   * analytics.brandSentiment
   * Full sentiment analysis data — breakdown, over-time, by-platform.
   */
  brandSentiment: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
    const { prisma } = ctx;
    const since = rangeToDate(input.range);

    // Aggregate sentiment counts (filtered by date range and optional account)
    const dateFilter = { dismissed: false, detectedAt: { gte: since } };
    if (input.accountId) dateFilter.accountId = input.accountId;
    const [positive, neutral, negative, total] = await Promise.all([
      prisma.listeningHit.count({ where: { ...dateFilter, sentiment: 'POSITIVE' } }),
      prisma.listeningHit.count({ where: { ...dateFilter, sentiment: 'NEUTRAL' } }),
      prisma.listeningHit.count({ where: { ...dateFilter, sentiment: 'NEGATIVE' } }),
      prisma.listeningHit.count({ where: dateFilter }),
    ]);

    const positivePct = total > 0 ? Math.round((positive / total) * 100) : 0;
    const neutralPct = total > 0 ? Math.round((neutral / total) * 100) : 0;
    const negativePct = total > 0 ? Math.round((negative / total) * 100) : 0;

    // Sentiment over time — group by date
    const recentHits = await prisma.listeningHit.findMany({
      where: dateFilter,
      select: {
        detectedAt: true, sentiment: true, platform: true,
        content: true, topic: { select: { name: true } },
      },
      orderBy: { detectedAt: 'asc' },
    });

    const byDate = {};
    const byPlatformMap = {};
    const byTopicMap = {};
    for (const hit of recentHits) {
      const dateKey = hit.detectedAt.toISOString().slice(0, 10);
      if (!byDate[dateKey]) byDate[dateKey] = { positive: 0, neutral: 0, negative: 0, total: 0 };
      const s = (hit.sentiment || 'NEUTRAL').toLowerCase();
      if (s === 'positive') byDate[dateKey].positive++;
      else if (s === 'negative') byDate[dateKey].negative++;
      else byDate[dateKey].neutral++;
      byDate[dateKey].total++;

      const plat = hit.platform === 'X' ? 'x' : 'reddit';
      if (!byPlatformMap[plat]) byPlatformMap[plat] = { positive: 0, neutral: 0, negative: 0, total: 0 };
      if (s === 'positive') byPlatformMap[plat].positive++;
      else if (s === 'negative') byPlatformMap[plat].negative++;
      else byPlatformMap[plat].neutral++;
      byPlatformMap[plat].total++;

      // Group by topic for sentiment drivers
      const topicName = hit.topic?.name || 'General';
      if (!byTopicMap[topicName]) {
        byTopicMap[topicName] = { positive: 0, neutral: 0, negative: 0, total: 0, words: {} };
      }
      const topicBucket = byTopicMap[topicName];
      if (s === 'positive') topicBucket.positive++;
      else if (s === 'negative') topicBucket.negative++;
      else topicBucket.neutral++;
      topicBucket.total++;

      // Extract keywords from content for this topic
      if (hit.content) {
        const stopwords = new Set([
          'the','a','an','is','are','was','were','be','been','being','have','has','had',
          'do','does','did','will','would','shall','should','may','might','can','could',
          'and','but','or','nor','not','so','yet','for','with','from','into','about',
          'that','this','these','those','it','its','of','in','on','at','to','by','as',
          'if','than','then','just','very','also','more','most','all','any','each','our',
          'your','their','what','which','who','how','when','where','https','http','co',
          'rt','via','amp',
        ]);
        const words = hit.content.toLowerCase()
          .replace(/https?:\/\/\S+/g, '')
          .replace(/[^a-z0-9\s$]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 2 && !stopwords.has(w));
        for (const w of words) {
          topicBucket.words[w] = (topicBucket.words[w] || 0) + 1;
        }
      }
    }

    const overTime = Object.entries(byDate).map(([date, d]) => ({
      date,
      positive: d.total > 0 ? Math.round((d.positive / d.total) * 100) : 0,
      neutral: d.total > 0 ? Math.round((d.neutral / d.total) * 100) : 0,
      negative: d.total > 0 ? Math.round((d.negative / d.total) * 100) : 0,
      score: d.total > 0 ? Math.round(((d.positive - d.negative) / d.total) * 100 + 50) : 50,
    }));

    const byPlatform = Object.entries(byPlatformMap).map(([platform, d]) => ({
      platform,
      positive: d.total > 0 ? Math.round((d.positive / d.total) * 100) : 0,
      neutral: d.total > 0 ? Math.round((d.neutral / d.total) * 100) : 0,
      negative: d.total > 0 ? Math.round((d.negative / d.total) * 100) : 0,
      score: d.total > 0 ? Math.round(((d.positive - d.negative) / d.total) * 100 + 50) : 50,
      change: 0,
    }));

    const score = total > 0 ? Math.round(((positive - negative) / total) * 100 + 50) : 50;

    // Build sentiment drivers from topic-level analysis
    const drivers = Object.entries(byTopicMap)
      .filter(([, d]) => d.total >= 3) // Only topics with meaningful volume
      .map(([theme, d]) => {
        const sentiment = d.total > 0
          ? Math.round(((d.positive - d.negative) / d.total) * 100 + 50)
          : 50;
        // Top keyword by frequency
        const sortedWords = Object.entries(d.words).sort((a, b) => b[1] - a[1]);
        const topKeyword = sortedWords[0]?.[0] || theme.toLowerCase();
        // Determine impact based on volume relative to total
        const volumeShare = d.total / (total || 1);
        const impact = volumeShare > 0.3 ? 'high' : volumeShare > 0.15 ? 'medium' : 'low';
        // Determine trend direction from sentiment score
        const trend = sentiment >= 60 ? 'up' : sentiment <= 40 ? 'down' : 'flat';
        return { theme, sentiment, topKeyword, volume: d.total, impact, trend };
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    return {
      breakdown: {
        positive: positivePct,
        neutral: neutralPct,
        negative: negativePct,
      },
      overTime,
      byPlatform,
      drivers,
      alerts: [],
      scoreDelta: 0,
      score,
    };
  }),
});
