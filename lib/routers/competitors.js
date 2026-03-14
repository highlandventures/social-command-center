import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../trpc';

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

      // Get all active listening topics
      const topics = await prisma.listeningTopic.findMany({
        where: { active: true },
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
            value: totalMentions > 0 ? parseFloat(((t.mentions / totalMentions) * 100).toFixed(1)) : 0,
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

      const figureMentionCount = await prisma.listeningHit.count({
        where: {
          topic: { name: 'Figure Brand & Products' },
          detectedAt: { gte: since },
        },
      });

      const figureSentiment = await prisma.listeningHit.groupBy({
        by: ['sentiment'],
        where: {
          topic: { name: 'Figure Brand & Products' },
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
