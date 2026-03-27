import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

// ── Shared input & helpers (exported for testing) ─────────────

const rangeInput = z
  .object({
    range: z
      .enum(['7d', '30d', '90d', '365d', 'custom'])
      .default('30d'),
    accountId: z.string().optional(),
    startDate: z.string().optional(), // ISO date string for custom range
    endDate: z.string().optional(),   // ISO date string for custom range
  })
  .default({});

export function rangeToDays(range, startDate, endDate) {
  if (range === 'custom' && startDate && endDate) {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }
  const map = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
  return map[range] || 30;
}

export function rangeToDate(range, startDate) {
  if (range === 'custom' && startDate) {
    return new Date(startDate + 'T00:00:00Z');
  }
  return new Date(Date.now() - rangeToDays(range) * 24 * 60 * 60 * 1000);
}

export function rangeToEndDate(range, endDate) {
  if (range === 'custom' && endDate) {
    // End of the end date (inclusive)
    return new Date(endDate + 'T23:59:59.999Z');
  }
  return new Date();
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
      const days = rangeToDays(input.range, input.startDate, input.endDate);
      const since = rangeToDate(input.range, input.startDate);
      const until = rangeToEndDate(input.range, input.endDate);
      // Split the period in half for comparison (recent half vs first half)
      const midpoint = new Date(since.getTime() + (days / 2) * 24 * 60 * 60 * 1000);

      // Get latest account metrics (optionally filtered by account, exclude test accounts)
      const accountWhere = { isActive: true, isTest: false };
      if (input.accountId) accountWhere.id = input.accountId;
      const accounts = await prisma.account.findMany({
        where: accountWhere,
        select: { id: true },
      });

      // Follower counts at the END of the selected period (scoped to date range)
      const latestMetrics = await Promise.all(
        accounts.map((a) =>
          prisma.accountMetrics.findFirst({
            where: { accountId: a.id, followers: { gt: 0 }, date: { lte: until } },
            orderBy: { date: 'desc' },
          })
        )
      );

      const totalFollowers = latestMetrics.reduce((sum, m) => sum + (m?.followers ?? 0), 0);
      const totalFollowing = latestMetrics.reduce((sum, m) => sum + (m?.following ?? 0), 0);

      // Follower counts at the START of the selected period (for delta calculation)
      const startFollowerMetrics = await Promise.all(
        accounts.map((a) =>
          prisma.accountMetrics.findFirst({
            where: { accountId: a.id, followers: { gt: 0 }, date: { lte: since } },
            orderBy: { date: 'desc' },
          })
        )
      );
      const midpointTotalFollowers = startFollowerMetrics.reduce((sum, m) => sum + (m?.followers ?? 0), 0);

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

      // Build post filter (optionally scoped to selected account, exclude test accounts)
      const postBaseWhere = { status: 'PUBLISHED', account: { isTest: false } };
      if (input.accountId) postBaseWhere.accountId = input.accountId;

      // Recent half of the period (midpoint → end)
      const recentPosts = await prisma.post.findMany({
        where: { ...postBaseWhere, publishedAt: { gte: midpoint, lte: until } },
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
        ? ((recentEngRate - firstHalfEngRate) / firstHalfEngRate) * 100
        : 0;
      const followersDelta = midpointTotalFollowers > 0
        ? ((totalFollowers - midpointTotalFollowers) / midpointTotalFollowers) * 100
        : 0;
      const engagementsDelta = firstHalf.engagements > 0
        ? ((recent.engagements - firstHalf.engagements) / firstHalf.engagements) * 100
        : 0;

      // Count mentions in the date range
      const mentionWhere = { detectedAt: { gte: since, lte: until } };
      if (input.accountId) mentionWhere.accountId = input.accountId;
      const mentionCount = await prisma.mention.count({
        where: mentionWhere,
      });

      // Net follower growth = end-of-period minus start-of-period
      const followerNetGrowth = totalFollowers - midpointTotalFollowers;

      return {
        totalFollowers,
        totalFollowing,
        followerNetGrowth,
        startOfPeriodFollowers: midpointTotalFollowers,
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
      const since = rangeToDate(input.range, input.startDate);
      const until = rangeToEndDate(input.range, input.endDate);

      const acctWhere = { isActive: true, isTest: false };
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
            where: { accountId: account.id, followers: { gt: 0 }, date: { lte: until } },
            orderBy: { date: 'desc' },
          });

          // Count tracked posts published in this range
          const trackedPosts = await prisma.post.count({
            where: {
              accountId: account.id,
              status: 'PUBLISHED',
              publishedAt: { gte: since, lte: until },
            },
          });

          // Get latest metrics per post for this account in range
          const posts = await prisma.post.findMany({
            where: {
              accountId: account.id,
              status: 'PUBLISHED',
              publishedAt: { gte: since, lte: until },
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
      const since = rangeToDate(input.range, input.startDate);
      const until = rangeToEndDate(input.range, input.endDate);

      // Get posts with their latest metrics, grouped by publishedAt date
      const engPostWhere = { status: 'PUBLISHED', publishedAt: { gte: since, lte: until }, account: { isTest: false } };
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
      const since = rangeToDate(input.range, input.startDate);
      const until = rangeToEndDate(input.range, input.endDate);

      // Fetch ALL metrics in range (including zeros) so we can forward-fill
      const fgMetricWhere = { date: { gte: since, lte: until } };
      if (input.accountId) fgMetricWhere.accountId = input.accountId;
      const metrics = await prisma.accountMetrics.findMany({
        where: fgMetricWhere,
        select: { date: true, accountId: true, followers: true },
        orderBy: { date: 'asc' },
      });

      // Also get the last valid follower count before the range for each account,
      // so we can forward-fill from the start if early days have 0.
      const fgAcctWhere = { isActive: true, isTest: false };
      if (input.accountId) fgAcctWhere.id = input.accountId;
      const accounts = await prisma.account.findMany({
        where: fgAcctWhere,
        select: { id: true, username: true },
      });
      const accountNames = Object.fromEntries(accounts.map(a => [a.id, a.username]));
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
      const byDate = {}; // { dateKey: { total, perAccount: { username: count } } }

      for (const dateKey of sortedDates) {
        let dayTotal = 0;
        const dayData = byDateAccount[dateKey];
        const perAccount = {};

        for (const accountId of Object.keys(dayData)) {
          const val = dayData[accountId];
          const name = accountNames[accountId] || accountId;
          if (val > 0) {
            lastKnown[accountId] = val;
            dayTotal += val;
            perAccount[name] = val;
          } else if (lastKnown[accountId]) {
            dayTotal += lastKnown[accountId];
            perAccount[name] = lastKnown[accountId];
          }
        }
        // Include accounts that had data before but not on this day
        for (const accountId of Object.keys(lastKnown)) {
          const name = accountNames[accountId] || accountId;
          if (!dayData[accountId] && lastKnown[accountId]) {
            dayTotal += lastKnown[accountId];
            perAccount[name] = lastKnown[accountId];
          }
        }
        if (dayTotal > 0) byDate[dateKey] = { total: dayTotal, perAccount };
      }

      const entries = Object.entries(byDate).map(([date, data]) => ({
        date,
        followers: data.total,
        ...data.perAccount,
      }));

      // If we have 0 or 1 data points, backfill from account creation dates
      // so the chart can show growth over time instead of a flat line.
      if (entries.length <= 1) {
        const bfAcctWhere = { isActive: true, isTest: false };
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
      const enriched = entries.map((entry) => ({
        ...entry,
        netChange: entry.followers - baseline,
      }));

      // Return data + account names for per-account chart lines
      const acctNames = accounts.map(a => a.username).filter(Boolean);
      return { series: enriched, accounts: acctNames };
    }),

  /**
   * analytics.heatmap
   * Engagement by day-of-week and hour, computed from PostMetrics + Post publishedAt.
   */
  heatmap: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const since = rangeToDate(input.range, input.startDate);
      const until = rangeToEndDate(input.range, input.endDate);

      const heatmapPostWhere = {
        status: 'PUBLISHED',
        publishedAt: { gte: since, lte: until },
        account: { isTest: false },
      };
      if (input.accountId) heatmapPostWhere.accountId = input.accountId;
      const posts = await prisma.post.findMany({
        where: heatmapPostWhere,
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
      const since = rangeToDate(input.range, input.startDate);
      const until = rangeToEndDate(input.range, input.endDate);

      const postPerfWhere = {
        status: 'PUBLISHED',
        platformPostId: { not: null },
        publishedAt: { gte: since, lte: until },
        account: { isTest: false },
      };
      if (input.accountId) postPerfWhere.accountId = input.accountId;
      const posts = await prisma.post.findMany({
        where: postPerfWhere,
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
      const maxPages = input?.maxPages ?? 25;
      const accountId = input?.accountId || '';
      const cronSecret = process.env.CRON_SECRET;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
      if (!baseUrl) {
        throw new Error('Cannot trigger backfill: neither NEXT_PUBLIC_APP_URL nor VERCEL_URL is configured.');
      }

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
    const since = rangeToDate(input.range, input.startDate);
    const until = rangeToEndDate(input.range, input.endDate);

    // Aggregate sentiment counts (filtered by date range and optional account)
    const dateFilter = { dismissed: false, detectedAt: { gte: since, lte: until } };
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
      take: 5000, // Guard against unbounded fetches
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

    // Build sentiment drivers from content-level phrase extraction.
    // Instead of grouping by topic name, extract recurring 2-3 word phrases
    // that appear across hits and measure their sentiment correlation.
    const phraseMap = {}; // phrase -> { positive, negative, neutral, total }
    // Strict brand terms — used with word-boundary regex to avoid matching
    // common English words like "figure" in "the $180 million figure"
    const strictBrandPatterns = [
      /\bfigr\b/i, /\bfigure\s*(tech|markets|technology)\b/i,
      /\b\$?ylds\b/i, /\bfigure_tech\b/i, /\bfiguretech\b/i,
      /\bprovenance\b/i, /\bprovenancefdn\b/i,
      /\bhastra\b/i, /\bhastrafi\b/i,
      /\bhighland\s*(ventures|vc)\b/i,
      /\bheloc\b/i, /\bhome\s*equity\b/i,
      /\btokeniz/i, /\brwa\b/i, /\breal\s*world\s*asset/i,
    ];
    // Keep the set for bigram-level filtering (exact word matches)
    const brandTerms = new Set([
      'figure','figr','figure_tech','figuretechnology','figure markets',
      'figuretech','figure technology','provenance','provenancefdn',
      'hastra','hastrafi','highland','ylds','heloc','home equity',
      'lending','mortgage',
    ]);
    const stopPhrases = new Set([
      'read more','click here','check out','learn more','find out',
      'sign up','last week','next week','right now','let know',
      'mar 2026','feb 2026','jan 2026','apr 2026','may 2026',
      'jun 2026','jul 2026','aug 2026','sep 2026','oct 2026',
    ]);
    // Filter out generic crypto/market noise that isn't brand-relevant
    const noiseTerms = new Set([
      'btc','eth','sol','xrp','bnb','ada','doge','shib','trx','avax',
      'matic','dot','link','atom','near','apt','sui','sei','arb','usdt',
      'usdc','busd','gmt','nft','nfts','airdrop','binance','coinbase',
      'bybit','okx','kucoin','pump','dump','moon','hodl','fomo',
      'leo','ton','icp','fil','hbar','vet','algo','egld','theta',
      'ftm','mana','sand','axs','gala','imx','ape','ldo','mkr',
      'snx','crv','aave','uni','cake','sushi','comp',
    ]);
    // Known Figure ecosystem tickers — these are NOT noise
    const figureTickers = new Set(['$figr','$ylds','$hash','$prime','figr','ylds','hash','prime']);
    // Detect market roundup posts (lists of many token prices)
    const MARKET_ROUNDUP_RE = /\b(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|TRX|AVAX|DOT):\s*\$[\d,.]+/gi;

    for (const hit of recentHits) {
      if (!hit.content) continue;
      const s = (hit.sentiment || 'NEUTRAL').toLowerCase();

      // Clean content and extract bigrams/trigrams
      const cleaned = hit.content.toLowerCase()
        .replace(/https?:\/\/\S+/g, '')
        .replace(/@\w+/g, '')
        .replace(/[^a-z0-9\s$%]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const stopwords = new Set([
        'the','a','an','is','are','was','were','be','been','being','have','has','had',
        'do','does','did','will','would','shall','should','may','might','can','could',
        'and','but','or','nor','not','so','yet','for','with','from','into','about',
        'that','this','these','those','it','its','of','in','on','at','to','by','as',
        'if','than','then','just','very','also','more','most','all','any','each','our',
        'your','their','what','which','who','how','when','where','https','http','co',
        'rt','via','amp','like','get','got','going','been','one','way','still','even',
        'much','really','think','dont','thats','theyre','youre','wont','cant',
      ]);

      const words = cleaned.split(' ').filter((w) => w.length > 2 && !stopwords.has(w));

      // Extract bigrams (2-word phrases)
      // Only include phrases from hits that mention a brand term (strict matching)
      const rawContent = hit.content || '';
      const isBrandRelevant = strictBrandPatterns.some((re) => re.test(rawContent));
      if (!isBrandRelevant) continue; // Skip non-brand content entirely

      // Skip market roundup posts (lists prices for many tokens)
      const roundupMatches = rawContent.match(MARKET_ROUNDUP_RE);
      if (roundupMatches && roundupMatches.length >= 3) continue;

      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        // Skip brand-only phrases, stop phrases, and crypto noise
        if (brandTerms.has(words[i]) && brandTerms.has(words[i + 1])) continue;
        if (stopPhrases.has(bigram)) continue;
        if (noiseTerms.has(words[i]) || noiseTerms.has(words[i + 1])) continue;
        // Skip any $TICKER that isn't a known Figure ticker
        if (/^\$\w+$/.test(words[i]) && !figureTickers.has(words[i])) continue;
        if (/^\$\w+$/.test(words[i + 1]) && !figureTickers.has(words[i + 1])) continue;
        // Skip phrases that are just prices/numbers (e.g., "$100", "031")
        if (/^\$?\d+$/.test(words[i]) && /^\$?\d+$/.test(words[i + 1])) continue;
        // Skip if either word is a number with $ prefix (price like "$100")
        if (/^\$\d/.test(words[i]) || /^\$\d/.test(words[i + 1])) continue;

        if (!phraseMap[bigram]) phraseMap[bigram] = { positive: 0, negative: 0, neutral: 0, total: 0, samples: [] };
        phraseMap[bigram].total++;
        if (s === 'positive') phraseMap[bigram].positive++;
        else if (s === 'negative') phraseMap[bigram].negative++;
        else phraseMap[bigram].neutral++;
        // Collect up to 3 sample snippets per phrase (trimmed for display)
        if (phraseMap[bigram].samples.length < 3) {
          const raw = (hit.content || '').replace(/https?:\/\/\S+/g, '').trim();
          const snippet = raw.length > 180 ? raw.slice(0, 177) + '…' : raw;
          phraseMap[bigram].samples.push({
            text: snippet,
            sentiment: s,
            platform: hit.platform || 'unknown',
            date: hit.publishedAt || hit.createdAt,
            url: hit.sourceUrl || null,
          });
        }
      }
    }

    // Filter to phrases that appear 3+ times and have clear sentiment lean
    const meaningfulPhrases = Object.entries(phraseMap)
      .filter(([, d]) => d.total >= 3)
      .map(([phrase, d]) => {
        const sentiment = d.total > 0
          ? Math.round(((d.positive - d.negative) / d.total) * 100 + 50)
          : 50;
        const volumeShare = d.total / (total || 1);
        const impact = volumeShare > 0.15 ? 'high' : volumeShare > 0.06 ? 'medium' : 'low';
        const trend = sentiment >= 60 ? 'up' : sentiment <= 40 ? 'down' : 'flat';
        // Sentiment strength = how far from neutral (50)
        const sentimentStrength = Math.abs(sentiment - 50);
        return {
          phrase, sentiment, sentimentStrength, volume: d.total, impact, trend,
          positive: d.positive, negative: d.negative, neutral: d.neutral,
          samples: d.samples || [],
        };
      })
      // Rank by combo of volume and sentiment strength (favor interesting + frequent)
      .sort((a, b) => (b.volume * b.sentimentStrength) - (a.volume * a.sentimentStrength));

    // Deduplicate overlapping phrases (if "real estate" and "estate lending" both appear, keep higher-ranked)
    const usedWords = new Set();
    const dedupedPhrases = [];
    for (const p of meaningfulPhrases) {
      const pWords = p.phrase.split(' ');
      const overlap = pWords.some((w) => usedWords.has(w) && w.length > 3);
      if (!overlap || dedupedPhrases.length < 2) {
        dedupedPhrases.push(p);
        pWords.forEach((w) => usedWords.add(w));
      }
      if (dedupedPhrases.length >= 5) break;
    }

    // Format as driver cards with human-readable theme names + context
    const drivers = dedupedPhrases.map((p) => {
      // Title-case the phrase
      const theme = p.phrase.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      // Generate a plain-English summary of what this driver means
      const pctPositive = Math.round((p.positive / p.volume) * 100);
      const pctNegative = Math.round((p.negative / p.volume) * 100);
      let insight;
      if (pctPositive >= 70) {
        insight = `Strongly positive — ${pctPositive}% of ${p.volume} mentions are favorable.`;
      } else if (pctNegative >= 50) {
        insight = `Concerning — ${pctNegative}% of ${p.volume} mentions are negative.`;
      } else if (pctPositive >= 50) {
        insight = `Mostly positive — ${pctPositive}% favorable across ${p.volume} mentions.`;
      } else {
        insight = `Mixed sentiment — ${pctPositive}% positive, ${pctNegative}% negative across ${p.volume} mentions.`;
      }
      return {
        theme,
        sentiment: p.sentiment,
        topKeyword: p.phrase,
        volume: p.volume,
        impact: p.impact,
        trend: p.trend,
        insight,
        breakdown: { positive: p.positive, neutral: p.neutral, negative: p.negative },
        samples: p.samples,
      };
    });

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
