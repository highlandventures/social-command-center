import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const analyticsRouter = router({
  /**
   * analytics.dashboard
   * Aggregate metrics: total followers, impressions, engagement rate, WoW deltas.
   */
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get latest account metrics for all accounts
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const latestMetrics = await Promise.all(
      accounts.map((a) =>
        prisma.accountMetrics.findFirst({
          where: { accountId: a.id },
          orderBy: { date: 'desc' },
        })
      )
    );

    const totalFollowers = latestMetrics.reduce((sum, m) => sum + (m?.followers ?? 0), 0);
    const totalFollowing = latestMetrics.reduce((sum, m) => sum + (m?.following ?? 0), 0);

    // This week's post metrics
    const thisWeekMetrics = await prisma.postMetrics.aggregate({
      where: { fetchedAt: { gte: oneWeekAgo } },
      _sum: { impressions: true, engagements: true, likes: true, retweets: true, replies: true },
      _avg: { engagementRate: true },
    });

    // Last week's post metrics (for WoW delta)
    const lastWeekMetrics = await prisma.postMetrics.aggregate({
      where: { fetchedAt: { gte: twoWeeksAgo, lt: oneWeekAgo } },
      _sum: { impressions: true, engagements: true },
      _avg: { engagementRate: true },
    });

    const thisImpressions = thisWeekMetrics._sum?.impressions ?? 0;
    const lastImpressions = lastWeekMetrics._sum?.impressions ?? 0;
    const thisEngRate = thisWeekMetrics._avg?.engagementRate ?? 0;
    const lastEngRate = lastWeekMetrics._avg?.engagementRate ?? 0;

    const impressionsDelta = lastImpressions > 0
      ? ((thisImpressions - lastImpressions) / lastImpressions) * 100
      : 0;
    const engagementRateDelta = lastEngRate > 0
      ? ((thisEngRate - lastEngRate) / lastEngRate) * 100
      : 0;

    return {
      totalFollowers,
      totalFollowing,
      impressions: thisImpressions,
      impressionsDelta,
      engagements: thisWeekMetrics._sum?.engagements ?? 0,
      engagementRate: thisEngRate,
      engagementRateDelta,
      likes: thisWeekMetrics._sum?.likes ?? 0,
      retweets: thisWeekMetrics._sum?.retweets ?? 0,
      replies: thisWeekMetrics._sum?.replies ?? 0,
    };
  }),

  /**
   * analytics.accountBreakdown
   * Per-account metrics summary.
   */
  accountBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;

    const accounts = await prisma.account.findMany({
      where: { isActive: true },
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
          where: { accountId: account.id },
          orderBy: { date: 'desc' },
        });

        const postMetrics = await prisma.postMetrics.aggregate({
          where: { accountId: account.id },
          _sum: { impressions: true, engagements: true },
          _avg: { engagementRate: true },
          _count: true,
        });

        return {
          ...account,
          followers: latestMetric?.followers ?? 0,
          following: latestMetric?.following ?? 0,
          totalPosts: latestMetric?.totalPosts ?? 0,
          impressions: postMetrics._sum?.impressions ?? 0,
          engagements: postMetrics._sum?.engagements ?? 0,
          engagementRate: postMetrics._avg?.engagementRate ?? 0,
        };
      })
    );

    return breakdown;
  }),

  /**
   * analytics.engagementTrend
   * Daily engagement rate time series from PostMetrics over the last N days.
   */
  engagementTrend: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }).default({}))
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const metrics = await prisma.postMetrics.findMany({
        where: { fetchedAt: { gte: since } },
        select: { fetchedAt: true, engagementRate: true, impressions: true, engagements: true },
        orderBy: { fetchedAt: 'asc' },
      });

      // Group by date
      const byDate = {};
      for (const m of metrics) {
        const dateKey = m.fetchedAt.toISOString().slice(0, 10);
        if (!byDate[dateKey]) {
          byDate[dateKey] = { rates: [], impressions: 0, engagements: 0 };
        }
        byDate[dateKey].rates.push(m.engagementRate);
        byDate[dateKey].impressions += m.impressions;
        byDate[dateKey].engagements += m.engagements;
      }

      return Object.entries(byDate).map(([date, data]) => ({
        date,
        engagementRate: data.rates.reduce((a, b) => a + b, 0) / data.rates.length,
        impressions: data.impressions,
        engagements: data.engagements,
      }));
    }),

  /**
   * analytics.followerGrowth
   * Daily follower count time series from AccountMetrics over the last N days.
   */
  followerGrowth: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }).default({}))
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const metrics = await prisma.accountMetrics.findMany({
        where: { date: { gte: since } },
        select: { date: true, accountId: true, followers: true },
        orderBy: { date: 'asc' },
      });

      // Group by date, sum across accounts
      const byDate = {};
      for (const m of metrics) {
        const dateKey = m.date.toISOString().slice(0, 10);
        if (!byDate[dateKey]) byDate[dateKey] = 0;
        byDate[dateKey] += m.followers;
      }

      return Object.entries(byDate).map(([date, followers]) => ({
        date,
        followers,
      }));
    }),

  /**
   * analytics.heatmap
   * Engagement by day-of-week and hour, computed from PostMetrics + Post publishedAt.
   */
  heatmap: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;

    const posts = await prisma.post.findMany({
      where: { status: 'PUBLISHED', publishedAt: { not: null } },
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
      Array.from({ length: 24 }, () => ({ count: 0, totalEngagement: 0 }))
    );

    for (const post of posts) {
      if (!post.publishedAt) continue;
      const day = post.publishedAt.getUTCDay(); // 0=Sun
      const hour = post.publishedAt.getUTCHours();
      const latestMetric = post.metrics[0];

      grid[day][hour].count += 1;
      grid[day][hour].totalEngagement += latestMetric?.engagements ?? 0;
    }

    // Flatten to array
    const result = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const cell = grid[day][hour];
        result.push({
          day: dayNames[day],
          dayIndex: day,
          hour,
          postCount: cell.count,
          avgEngagement: cell.count > 0 ? cell.totalEngagement / cell.count : 0,
        });
      }
    }

    return result;
  }),

  /**
   * analytics.brandSentiment
   * Aggregate sentiment distribution from ListeningHit data.
   */
  brandSentiment: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;

    const [positive, neutral, negative, total] = await Promise.all([
      prisma.listeningHit.count({ where: { sentiment: 'POSITIVE', dismissed: false } }),
      prisma.listeningHit.count({ where: { sentiment: 'NEUTRAL', dismissed: false } }),
      prisma.listeningHit.count({ where: { sentiment: 'NEGATIVE', dismissed: false } }),
      prisma.listeningHit.count({ where: { dismissed: false } }),
    ]);

    return {
      positive,
      neutral,
      negative,
      total,
      positivePct: total > 0 ? (positive / total) * 100 : 0,
      neutralPct: total > 0 ? (neutral / total) * 100 : 0,
      negativePct: total > 0 ? (negative / total) * 100 : 0,
    };
  }),
});
