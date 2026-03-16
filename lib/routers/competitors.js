import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../trpc';

/**
 * Compute a composite threat score (0-100) for a competitor.
 * Higher = more competitive threat to Figure.
 *
 * Factors:
 * - Scale (30%): follower count relative to Figure
 * - Engagement (25%): engagement rate vs 2% industry average
 * - Momentum (25%): follower growth rate + posting cadence
 * - Share of Voice (20%): their SOV percentage
 */
export function computeThreatScore(competitor, figureFollowers = 1) {
  const { followersX = 0, avgEngagementRate = 0, postsPerDay = 0, followerGrowth = 0, shareOfVoicePct = 0 } = competitor;

  // Scale: follower ratio (capped at 100 when competitor has 2x Figure's followers)
  const scaleScore = Math.min(100, (followersX / Math.max(figureFollowers, 1)) * 50);

  // Engagement: vs 2% industry average benchmark (crypto/fintech)
  const engScore = Math.min(100, (avgEngagementRate / 0.02) * 50);

  // Momentum: growth rate + posting cadence
  const growthRate = followersX > 0 ? (followerGrowth / followersX) * 100 : 0;
  const momentumScore = Math.min(100, Math.max(0, growthRate * 10 + postsPerDay * 8));

  // Share of Voice: 25% SOV = perfect score
  const sovScore = Math.min(100, shareOfVoicePct * 4);

  return Math.round(
    scaleScore * 0.30 +
    engScore * 0.25 +
    momentumScore * 0.25 +
    sovScore * 0.20
  );
}

export const competitorsRouter = router({
  /**
   * competitors.list
   * List all competitors with their latest CompetitorMetrics snapshot.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const competitors = await ctx.prisma.competitor.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        accounts: true,
        keywords: true,
        metrics: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    return competitors.map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      accounts: c.accounts,
      keywords: c.keywords.map((k) => k.keyword),
      latestMetrics: c.metrics[0] ?? null,
    }));
  }),

  /**
   * competitors.create
   * Admin-only: create a new competitor with accounts and keywords.
   */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        accounts: z.array(
          z.object({
            platform: z.enum(['X', 'REDDIT']),
            username: z.string().min(1),
            platformUserId: z.string().optional(),
          })
        ).default([]),
        keywords: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma, user } = ctx;
      const { name, accounts, keywords } = input;

      return prisma.competitor.create({
        data: {
          name,
          createdById: user.id,
          accounts: {
            create: accounts,
          },
          keywords: {
            create: keywords.map((keyword) => ({ keyword })),
          },
        },
        include: { accounts: true, keywords: true },
      });
    }),

  /**
   * competitors.getSOV
   * Share of voice computed from ListeningHit counts per topic.
   * Returns { current: [...], overTime: [...] } for the listening page UI.
   * The first brand-related topic (containing "Figure" or "Brand") is treated as
   * the own-brand bucket; every other active topic is a competitor/market bucket.
   */
  getSOV: protectedProcedure
    .input(
      z.object({
        weeks: z.number().min(1).max(52).default(12),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { weeks } = input;
      const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

      // Get all active listening topics, excluding KOL topics (SOV = owned channels vs competitors only)
      const topics = await prisma.listeningTopic.findMany({
        where: { active: true, NOT: { name: { startsWith: 'KOL:' } } },
        select: { id: true, name: true },
      });

      if (topics.length === 0) return { current: [], overTime: [] };

      // Count hits per topic in range + sentiment breakdown
      const hitCounts = await prisma.listeningHit.groupBy({
        by: ['topicId'],
        where: { detectedAt: { gte: since } },
        _count: true,
      });
      const sentimentCounts = await prisma.listeningHit.groupBy({
        by: ['topicId', 'sentiment'],
        where: { detectedAt: { gte: since } },
        _count: true,
      });

      // Build per-topic stats
      const topicMap = {};
      for (const t of topics) {
        topicMap[t.id] = { name: t.name, mentions: 0, positive: 0, negative: 0, neutral: 0 };
      }
      for (const h of hitCounts) {
        if (topicMap[h.topicId]) topicMap[h.topicId].mentions = h._count;
      }
      for (const s of sentimentCounts) {
        if (topicMap[s.topicId]) {
          const key = s.sentiment.toLowerCase(); // POSITIVE → positive
          topicMap[s.topicId][key] = (topicMap[s.topicId][key] || 0) + s._count;
        }
      }

      const totalMentions = Object.values(topicMap).reduce((s, t) => s + t.mentions, 0);
      const SOV_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

      // Build current SOV array (sorted by mentions desc)
      const current = Object.values(topicMap)
        .filter((t) => t.mentions > 0)
        .sort((a, b) => b.mentions - a.mentions)
        .map((t, i) => {
          const total = t.positive + t.neutral + t.negative;
          return {
            name: t.name,
            value: totalMentions > 0 ? parseFloat(((t.mentions / totalMentions) * 100).toFixed(2)) : 0,
            mentions: t.mentions,
            sentiment: total > 0 ? Math.round((t.positive / total) * 100) : null,
            avgEng: null, // Would need PostMetrics linkage
            growth: null,
            color: SOV_COLORS[i % SOV_COLORS.length],
          };
        });

      // Build overTime series (weekly buckets)
      const topicNames = current.map((c) => c.name);
      const topicIdsByName = {};
      for (const t of topics) {
        topicIdsByName[t.name] = t.id;
      }

      // Get all hits in range with dates
      const hitsForTime = await prisma.listeningHit.findMany({
        where: { detectedAt: { gte: since } },
        select: { topicId: true, detectedAt: true },
        orderBy: { detectedAt: 'asc' },
        take: 10000, // Guard against unbounded fetches
      });

      // Group into weekly buckets
      const weekBuckets = {};
      for (const h of hitsForTime) {
        const d = h.detectedAt;
        // Week start (Monday)
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(d.getFullYear(), d.getMonth(), diff);
        const weekKey = weekStart.toISOString().slice(0, 10);

        if (!weekBuckets[weekKey]) {
          weekBuckets[weekKey] = { week: weekKey };
          for (const name of topicNames) weekBuckets[weekKey][name] = 0;
        }

        const topicName = topics.find((t) => t.id === h.topicId)?.name;
        if (topicName && weekBuckets[weekKey][topicName] !== undefined) {
          weekBuckets[weekKey][topicName]++;
        }
      }

      const overTime = Object.values(weekBuckets).sort((a, b) => a.week.localeCompare(b.week));

      return { current, overTime };
    }),

  /**
   * competitors.compare
   * Side-by-side metrics comparison for all competitors.
   */
  compare: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;

    const competitors = await prisma.competitor.findMany({
      include: {
        accounts: true,
        metrics: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    return competitors.map((c) => {
      const m = c.metrics[0];
      return {
        id: c.id,
        name: c.name,
        accounts: c.accounts,
        followersX: m?.followersX ?? 0,
        followersReddit: m?.followersReddit ?? 0,
        karmaReddit: m?.karmaReddit ?? 0,
        postsCount: m?.postsCount ?? 0,
        avgEngagementRate: m?.avgEngagementRate ?? 0,
        mentionCount: m?.mentionCount ?? 0,
        sentimentPositivePct: m?.sentimentPositivePct ?? 0,
        shareOfVoicePct: m?.shareOfVoicePct ?? 0,
      };
    });
  }),

  /**
   * competitors.compareWithFigure
   * Full comparison grid: all competitors + Figure side-by-side.
   * Returns follower counts, engagement rates, mention counts,
   * sentiment, and share of voice for each entity.
   */
  compareWithFigure: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(30),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { days } = input;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // ── Figure metrics ──
      const figureAccounts = await prisma.account.findMany({
        where: { isActive: true, platform: 'X' },
      });
      const figureMetrics = await prisma.accountMetrics.findMany({
        where: {
          accountId: { in: figureAccounts.map((a) => a.id) },
          date: { gte: since },
        },
        orderBy: { date: 'desc' },
      });

      const latestFigureFollowers = figureMetrics.length > 0
        ? figureMetrics.reduce((sum, m) => sum + (m.followers || 0), 0)
        : 0;

      // Find Figure's brand topic — try exact name first, then fall back to pattern match
      const figureTopic = await prisma.listeningTopic.findFirst({
        where: { OR: [
          { name: 'Figure Brand & Products' },
          { name: { contains: 'Figure', mode: 'insensitive' } },
        ]},
        select: { id: true },
      });
      const figureTopicFilter = figureTopic ? { topicId: figureTopic.id } : { topicId: 'none' };

      const figureMentionCount = await prisma.listeningHit.count({
        where: {
          ...figureTopicFilter,
          detectedAt: { gte: since },
        },
      });

      const figureSentiment = await prisma.listeningHit.groupBy({
        by: ['sentiment'],
        where: {
          ...figureTopicFilter,
          detectedAt: { gte: since },
        },
        _count: true,
      });
      const figPosCount = figureSentiment.find((s) => s.sentiment === 'POSITIVE')?._count || 0;
      const figTotalSent = figureSentiment.reduce((sum, s) => sum + s._count, 0);

      // ── Competitor metrics ──
      const competitors = await prisma.competitor.findMany({
        include: {
          accounts: true,
          metrics: {
            where: { date: { gte: since } },
            orderBy: { date: 'desc' },
          },
        },
      });

      // ── Aggregate share of voice ──
      let totalMentions = figureMentionCount;
      const compResults = competitors.map((c) => {
        const latestM = c.metrics[0];
        const totalMention = c.metrics.reduce((sum, m) => sum + m.mentionCount, 0);
        totalMentions += totalMention;

        return {
          id: c.id,
          name: c.name,
          accounts: c.accounts,
          followersX: latestM?.followersX ?? 0,
          postsCount: latestM?.postsCount ?? 0,
          avgEngagementRate: latestM?.avgEngagementRate ?? 0,
          mentionCount: totalMention,
          sentimentPositivePct: latestM?.sentimentPositivePct ?? 0,
          // SOV computed below
          shareOfVoicePct: 0,
        };
      });

      // Compute SOV percentages
      const figureSOV = totalMentions > 0 ? (figureMentionCount / totalMentions) * 100 : 0;
      for (const c of compResults) {
        c.shareOfVoicePct = totalMentions > 0
          ? parseFloat(((c.mentionCount / totalMentions) * 100).toFixed(2))
          : 0;
      }

      return {
        figure: {
          name: 'Figure',
          followersX: latestFigureFollowers,
          mentionCount: figureMentionCount,
          sentimentPositivePct: figTotalSent > 0 ? parseFloat(((figPosCount / figTotalSent) * 100).toFixed(2)) : 0,
          shareOfVoicePct: parseFloat(figureSOV.toFixed(2)),
        },
        competitors: compResults,
        meta: {
          days,
          totalMentions,
          generatedAt: new Date().toISOString(),
        },
      };
    }),

  /**
   * competitors.sovTimeSeries
   * Share of voice time series: Figure + all competitors over time.
   * Returns daily data points for charting.
   */
  sovTimeSeries: protectedProcedure
    .input(
      z.object({
        days: z.number().min(7).max(90).default(30),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { days } = input;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // All competitor metrics in date range
      const compMetrics = await prisma.competitorMetrics.findMany({
        where: { date: { gte: since } },
        orderBy: { date: 'asc' },
        include: {
          competitor: { select: { id: true, name: true } },
        },
      });

      // Group by date
      const byDate = {};
      for (const m of compMetrics) {
        const dateKey = m.date.toISOString().slice(0, 10);
        if (!byDate[dateKey]) byDate[dateKey] = { date: dateKey };
        byDate[dateKey][m.competitor.name] = {
          followers: m.followersX,
          mentions: m.mentionCount,
          engagement: m.avgEngagementRate,
          sentiment: m.sentimentPositivePct,
          sov: m.shareOfVoicePct,
        };
      }

      // Add Figure data points per date (from AccountMetrics)
      const figureAccounts = await prisma.account.findMany({
        where: { isActive: true, platform: 'X' },
      });
      const figMetrics = await prisma.accountMetrics.findMany({
        where: {
          accountId: { in: figureAccounts.map((a) => a.id) },
          date: { gte: since },
        },
        orderBy: { date: 'asc' },
      });

      for (const m of figMetrics) {
        const dateKey = m.date.toISOString().slice(0, 10);
        if (!byDate[dateKey]) byDate[dateKey] = { date: dateKey };
        if (!byDate[dateKey]['Figure']) {
          byDate[dateKey]['Figure'] = { followers: 0, mentions: 0, engagement: 0, sentiment: 0, sov: 0 };
        }
        byDate[dateKey]['Figure'].followers += m.followers || 0;
      }

      return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    }),

  /**
   * competitors.delete
   * Remove a competitor and all associated data.
   */
  /**
   * competitors.activity
   * Competitor posting cadence + engagement stats for SOV tab.
   * Returns per-competitor summary with recent metrics trend.
   */
  activity: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(30),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { days } = input;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const competitors = await prisma.competitor.findMany({
        include: {
          accounts: true,
          metrics: {
            where: { date: { gte: since } },
            orderBy: { date: 'desc' },
          },
        },
      });

      // Get Figure's follower count for threat score comparison
      const figureAccount = await prisma.socialAccount.findFirst({
        where: { platform: 'X' },
        orderBy: { followerCount: 'desc' },
        select: { followerCount: true },
      });
      const figureFollowers = figureAccount?.followerCount || 1;

      return competitors.map((c) => {
        const metrics = c.metrics;
        const latest = metrics[0];
        const daysWithData = metrics.length;

        // Aggregate over the period
        const totalPosts = metrics.reduce((sum, m) => sum + m.postsCount, 0);
        const totalMentions = metrics.reduce((sum, m) => sum + m.mentionCount, 0);
        const avgEngagement = daysWithData > 0
          ? metrics.reduce((sum, m) => sum + m.avgEngagementRate, 0) / daysWithData
          : 0;
        const avgSentiment = daysWithData > 0
          ? metrics.reduce((sum, m) => sum + m.sentimentPositivePct, 0) / daysWithData
          : 0;

        // Posts per day cadence
        const postsPerDay = daysWithData > 0 ? totalPosts / daysWithData : 0;

        // Follower trend (first vs latest)
        const oldest = metrics[metrics.length - 1];
        const followerGrowth = oldest && latest
          ? latest.followersX - oldest.followersX
          : 0;

        const activityData = {
          id: c.id,
          name: c.name,
          accounts: c.accounts.map((a) => ({ platform: a.platform, username: a.username })),
          followersX: latest?.followersX ?? 0,
          postsPerDay: parseFloat(postsPerDay.toFixed(1)),
          totalPosts,
          avgEngagementRate: parseFloat(avgEngagement.toFixed(4)),
          totalMentions,
          avgSentimentPositivePct: parseFloat(avgSentiment.toFixed(1)),
          shareOfVoicePct: latest?.shareOfVoicePct ?? 0,
          followerGrowth,
          daysTracked: daysWithData,
          // Daily breakdown for sparklines
          daily: metrics.map((m) => ({
            date: m.date.toISOString().slice(0, 10),
            posts: m.postsCount,
            engagement: m.avgEngagementRate,
            mentions: m.mentionCount,
            followers: m.followersX,
          })).reverse(), // chronological order
        };

        activityData.threatScore = computeThreatScore(activityData, figureFollowers);
        return activityData;
      }).sort((a, b) => b.threatScore - a.threatScore);
    }),

  /**
   * competitors.posts
   * Paginated competitor posts with filters.
   */
  posts: protectedProcedure
    .input(
      z.object({
        competitorId: z.string().optional(),
        contentType: z.enum(['POST', 'THREAD', 'ARTICLE']).optional(),
        days: z.number().min(1).max(365).default(30),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { competitorId, contentType, days, cursor, limit } = input;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const where = {
        postedAt: { gte: since },
        ...(competitorId ? { competitorId } : {}),
        ...(contentType ? { contentType } : {}),
      };

      const posts = await prisma.competitorPost.findMany({
        where,
        orderBy: { postedAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          competitor: { select: { id: true, name: true } },
        },
      });

      let nextCursor = undefined;
      if (posts.length > limit) {
        const next = posts.pop();
        nextCursor = next.id;
      }

      return {
        posts: posts.map((p) => ({
          id: p.id,
          competitorId: p.competitorId,
          competitorName: p.competitor.name,
          platform: p.platform,
          contentType: p.contentType,
          content: p.content,
          authorUsername: p.authorUsername,
          postedAt: p.postedAt,
          likes: p.likes,
          retweets: p.retweets,
          replies: p.replies,
          quotes: p.quotes,
          impressions: p.impressions,
          engagementRate: p.engagementRate,
        })),
        nextCursor,
      };
    }),

  /**
   * competitors.profile
   * Deep profile data for a single competitor.
   */
  profile: protectedProcedure
    .input(
      z.object({
        competitorId: z.string(),
        days: z.number().min(1).max(365).default(90),
      })
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { competitorId, days } = input;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const competitor = await prisma.competitor.findUnique({
        where: { id: competitorId },
        include: {
          accounts: true,
          keywords: true,
        },
      });

      if (!competitor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Competitor not found.' });
      }

      // Metrics time series
      const metricsTimeSeries = await prisma.competitorMetrics.findMany({
        where: { competitorId, date: { gte: since } },
        orderBy: { date: 'asc' },
      });

      // Follower growth velocity
      const firstMetric = metricsTimeSeries[0];
      const lastMetric = metricsTimeSeries[metricsTimeSeries.length - 1];
      const followerGrowthVelocity = firstMetric && lastMetric
        ? lastMetric.followersX - firstMetric.followersX
        : 0;

      // Posts in range
      const posts = await prisma.competitorPost.findMany({
        where: { competitorId, postedAt: { gte: since } },
        orderBy: { engagementRate: 'desc' },
      });

      // Top posts
      const topPosts = posts.slice(0, 10).map((p) => ({
        id: p.id,
        content: p.content,
        contentType: p.contentType,
        authorUsername: p.authorUsername,
        postedAt: p.postedAt,
        likes: p.likes,
        retweets: p.retweets,
        replies: p.replies,
        impressions: p.impressions,
        engagementRate: p.engagementRate,
      }));

      // Format breakdown
      const formatCounts = {};
      const formatEngSum = {};
      for (const p of posts) {
        const fmt = p.contentType || 'POST';
        formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;
        formatEngSum[fmt] = (formatEngSum[fmt] || 0) + (p.engagementRate || 0);
      }
      const formatBreakdown = Object.entries(formatCounts).map(([format, count]) => ({
        format,
        count,
        avgEng: count > 0 ? formatEngSum[format] / count : 0,
      }));

      // Cadence heatmap (day of week x hour)
      const heatmap = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          heatmap.push({ day, hour, count: 0 });
        }
      }
      for (const p of posts) {
        const dt = new Date(p.postedAt);
        const day = dt.getUTCDay();
        const hour = dt.getUTCHours();
        const idx = day * 24 + hour;
        heatmap[idx].count++;
      }

      // Strategy card from cached insights
      const strategyInsight = await prisma.aIInsight.findFirst({
        where: {
          insightType: 'COMPETITOR_STRATEGY',
          dismissed: false,
        },
        orderBy: { generatedAt: 'desc' },
      });
      const strategyCards = strategyInsight?.content?.type === 'strategyCards'
        ? strategyInsight.content.data
        : [];
      const strategyCard = strategyCards.find(
        (c) => c.competitorName?.toLowerCase() === competitor.name.toLowerCase()
      ) || null;

      return {
        competitor: {
          id: competitor.id,
          name: competitor.name,
          accounts: competitor.accounts,
          keywords: competitor.keywords.map((k) => k.keyword),
        },
        metricsTimeSeries: metricsTimeSeries.map((m) => ({
          date: m.date.toISOString().slice(0, 10),
          followersX: m.followersX,
          postsCount: m.postsCount,
          avgEngagementRate: m.avgEngagementRate,
          mentionCount: m.mentionCount,
          sentimentPositivePct: m.sentimentPositivePct,
          shareOfVoicePct: m.shareOfVoicePct,
        })),
        followerGrowthVelocity,
        topPosts,
        formatBreakdown,
        cadenceHeatmap: heatmap.filter((h) => h.count > 0),
        strategyCard,
        totalPosts: posts.length,
      };
    }),

  /**
   * competitors.amplifiers
   * Top amplifiers for competitors — accounts that retweet, quote, or mention competitors.
   */
  amplifiers: protectedProcedure
    .input(
      z.object({
        competitorId: z.string().optional(),
        minInteractions: z.number().default(1),
        limit: z.number().min(1).max(100).default(50),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { competitorId, minInteractions, limit } = input;

      const amplifiers = await prisma.competitorAmplifier.findMany({
        where: {
          ...(competitorId ? { competitorId } : {}),
          interactionCount: { gte: minInteractions },
        },
        orderBy: { interactionCount: 'desc' },
        take: limit,
        include: {
          competitor: { select: { id: true, name: true } },
        },
      });

      // Find shared amplifiers (appear for multiple competitors)
      const byUsername = {};
      for (const a of amplifiers) {
        if (!byUsername[a.username]) {
          byUsername[a.username] = { username: a.username, competitors: [], totalInteractions: 0, followersCount: a.followersCount, avatarUrl: a.avatarUrl, displayName: a.displayName };
        }
        byUsername[a.username].competitors.push(a.competitor.name);
        byUsername[a.username].totalInteractions += a.interactionCount;
      }
      const sharedAmplifiers = Object.values(byUsername)
        .filter((a) => a.competitors.length > 1)
        .sort((a, b) => b.totalInteractions - a.totalInteractions);

      // Cross-reference with KOL table
      const amplifierUsernames = [...new Set(amplifiers.map((a) => a.username))];
      const knownKOLs = amplifierUsernames.length > 0
        ? await prisma.kOL.findMany({
            where: { username: { in: amplifierUsernames } },
            select: { id: true, username: true, name: true, aiScore: true },
          })
        : [];

      return {
        amplifiers: amplifiers.map((a) => ({
          id: a.id,
          competitorId: a.competitorId,
          competitorName: a.competitor.name,
          platform: a.platform,
          username: a.username,
          displayName: a.displayName,
          avatarUrl: a.avatarUrl,
          followersCount: a.followersCount,
          amplificationType: a.amplificationType,
          interactionCount: a.interactionCount,
          engagementContribution: a.engagementContribution,
          firstSeenAt: a.firstSeenAt,
          lastSeenAt: a.lastSeenAt,
        })),
        sharedAmplifiers,
        knownKOLs: knownKOLs.map((k) => ({
          username: k.username,
          kolId: k.id,
          kolName: k.name,
          aiScore: k.aiScore,
        })),
      };
    }),

  /**
   * competitors.topContent
   * Top performing competitor posts ranked by engagement rate.
   */
  topContent: protectedProcedure
    .input(
      z.object({
        competitorId: z.string().optional(),
        contentType: z.enum(['POST', 'THREAD', 'ARTICLE']).optional(),
        days: z.number().min(1).max(365).default(30),
        limit: z.number().min(1).max(50).default(20),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { competitorId, contentType, days, limit } = input;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const posts = await prisma.competitorPost.findMany({
        where: {
          postedAt: { gte: since },
          ...(competitorId ? { competitorId } : {}),
          ...(contentType ? { contentType } : {}),
        },
        orderBy: { engagementRate: 'desc' },
        take: limit,
        include: {
          competitor: { select: { id: true, name: true } },
        },
      });

      return posts.map((p) => ({
        id: p.id,
        competitorId: p.competitorId,
        competitorName: p.competitor.name,
        platform: p.platform,
        contentType: p.contentType,
        content: p.content,
        authorUsername: p.authorUsername,
        postedAt: p.postedAt,
        likes: p.likes,
        retweets: p.retweets,
        replies: p.replies,
        quotes: p.quotes,
        impressions: p.impressions,
        engagementRate: p.engagementRate,
      }));
    }),

  delete: adminProcedure
    .input(z.object({ competitorId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.competitor.findUnique({
        where: { id: input.competitorId },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Competitor not found.' });
      }

      return ctx.prisma.competitor.delete({
        where: { id: input.competitorId },
      });
    }),
});
