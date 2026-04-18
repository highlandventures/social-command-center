import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { generateInsight } from '../ai';
import { analyzeSentimentBatch } from '../ai/sentiment';
import { syncQueriesFromOntology, syncAllOntologies } from '../listening/ontology-sync';
import { planQueriesForEntity } from '../listening/query-planner';
import { classifyGap } from '../listening/gap-classifier';
import { invalidateAlgoTermsCache } from '../listening-scanner';

export const listeningRouter = router({
  topics: router({
    /**
     * listening.topics.list
     * List all ListeningTopics with query counts and hit counts.
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const topics = await ctx.prisma.listeningTopic.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              queries: true,
              hits: true,
            },
          },
          queries: {
            select: {
              id: true,
              platform: true,
              queryString: true,
              active: true,
              negativeKeywords: true,
              subreddits: true,
            },
          },
        },
      });

      return topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        active: topic.active,
        pollingTier: topic.pollingTier,
        pollingTierOverride: topic.pollingTierOverride,
        createdAt: topic.createdAt,
        queryCount: topic._count.queries,
        hitCount: topic._count.hits,
        queries: topic.queries,
      }));
    }),

    /**
     * listening.topics.create
     * Create a new listening topic with initial queries.
     */
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          queries: z.array(
            z.object({
              platform: z.enum(['X', 'REDDIT']),
              queryString: z.string().min(1),
              negativeKeywords: z.array(z.string()).default([]),
              subreddits: z.array(z.string()).default([]),
            })
          ).default([]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { prisma, user } = ctx;
        const { name, description, queries } = input;

        return prisma.listeningTopic.create({
          data: {
            name,
            description,
            createdById: user.id,
            queries: {
              create: queries,
            },
          },
          include: { queries: true },
        });
      }),

    /**
     * listening.topics.update
     * Update a listening topic's name, description, or active status.
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          data: z.object({
            name: z.string().min(1).optional(),
            description: z.string().nullish(),
            active: z.boolean().optional(),
            pollingTier: z.enum(['HOT', 'WARM', 'COOL', 'SCHEDULED']).optional(),
            pollingTierOverride: z.enum(['HOT', 'WARM', 'COOL', 'SCHEDULED']).nullish(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, data } = input;
        const existing = await ctx.prisma.listeningTopic.findUnique({ where: { id } });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Topic not found.' });
        }

        return ctx.prisma.listeningTopic.update({ where: { id }, data });
      }),

    /**
     * listening.topics.delete
     * Delete a listening topic and all its queries and hits.
     */
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await ctx.prisma.listeningTopic.findUnique({ where: { id: input.id } });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Topic not found.' });
        }

        return ctx.prisma.listeningTopic.delete({ where: { id: input.id } });
      }),
  }),

  hits: router({
    /**
     * listening.hits.list
     * Paginated list of ListeningHits with optional filters.
     * topicId is optional — omit to get hits across all topics.
     */
    list: protectedProcedure
      .input(
        z.object({
          topicId: z.string().optional(),
          topicIds: z.array(z.string()).optional(),
          platform: z.enum(['X', 'REDDIT']).optional(),
          sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
          relevance: z.enum(['HIGH', 'MEDIUM', 'LOW', 'SPAM']).optional(),
          actionType: z.enum(['RESPOND', 'INTEL', 'OPPORTUNITY', 'CRISIS', 'FYI']).optional(),
          timeRange: z.enum(['24h', '7d', '30d', '90d', 'all']).optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().nullish(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        const { prisma } = ctx;
        const { topicId, topicIds, platform, sentiment, relevance, actionType, timeRange, limit = 50, cursor } = input || {};

        const where = { dismissed: false };
        // Multi-select brand filter: topicIds takes precedence over topicId
        if (topicIds?.length > 0) {
          where.topicId = { in: topicIds };
        } else if (topicId) {
          where.topicId = topicId;
        }
        if (platform) where.platform = platform;
        if (sentiment) where.sentiment = sentiment;
        if (relevance) where.aiRelevance = relevance;
        if (actionType) where.actionType = actionType;
        // Time range filter
        if (timeRange && timeRange !== 'all') {
          const ms = { '24h': 24 * 3600000, '7d': 7 * 86400000, '30d': 30 * 86400000, '90d': 90 * 86400000 };
          where.detectedAt = { gte: new Date(Date.now() - ms[timeRange]) };
        }

        const hits = await prisma.listeningHit.findMany({
          where,
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          orderBy: { detectedAt: 'desc' },
          include: {
            query: {
              select: { id: true, queryString: true, platform: true },
            },
            topic: {
              select: { id: true, name: true },
            },
          },
        });

        let nextCursor = undefined;
        if (hits.length > limit) {
          const next = hits.pop();
          nextCursor = next.id;
        }

        return {
          items: hits.map((h) => ({
            id: h.id,
            platform: h.platform === 'X' ? 'x' : 'reddit',
            author: h.authorUsername,
            authorDisplay: h.authorDisplayName,
            authorProfileImageUrl: h.authorProfileImageUrl || null,
            followers: h.authorFollowersOrKarma || 0,
            content: h.content,
            sourceUrl: h.sourceUrl,
            subreddit: h.subreddit,
            engagements: h.engagementCount,
            heuristic: h.heuristicScore?.toFixed(2) || '0.00',
            relevance: h.isActionable ? 'HIGH' : h.heuristicScore > 0.4 ? 'MEDIUM' : 'LOW',
            sentiment: h.sentiment || 'NEUTRAL',
            time: h.detectedAt,
            topicName: h.topic?.name,
            queryString: h.query?.queryString,
            actionType: h.actionType || 'FYI',
            authorTrustScore: h.authorTrustScore || null,
            semanticRelevance: h.semanticRelevance || null,
          })),
          nextCursor,
        };
      }),

    /**
     * listening.hits.dismiss
     * Dismiss a listening hit.
     */
    dismiss: protectedProcedure
      .input(z.object({
        id: z.string(),
        reason: z.enum(['irrelevant', 'spam', 'duplicate', 'off_topic']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const hit = await ctx.prisma.listeningHit.findUnique({ where: { id: input.id } });
        if (!hit) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Hit not found.' });
        }

        await ctx.prisma.listeningHit.update({
          where: { id: input.id },
          data: {
            dismissed: true,
            dismissedBy: ctx.user.id,
            dismissReason: input.reason || null,
          },
        });

        // Increment query's dismissed counter for feedback tracking
        if (hit.queryId) {
          await ctx.prisma.listeningQuery.update({
            where: { id: hit.queryId },
            data: { dismissedHits: { increment: 1 } },
          });
        }

        return { success: true };
      }),
  }),

  /**
   * listening.toplineMetrics
   * Aggregated counts (total, sentiment, platform, actionType) respecting
   * the same filters used by hits.list so the numbers match the feed.
   */
  toplineMetrics: protectedProcedure
    .input(
      z.object({
        topicId: z.string().optional(),
        topicIds: z.array(z.string()).optional(),
        platform: z.enum(['X', 'REDDIT']).optional(),
        relevance: z.enum(['HIGH', 'MEDIUM', 'LOW', 'SPAM']).optional(),
        actionType: z.enum(['RESPOND', 'INTEL', 'OPPORTUNITY', 'CRISIS', 'FYI']).optional(),
        timeRange: z.enum(['24h', '7d', '30d', '90d', 'all']).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { topicId, topicIds, platform, relevance, actionType, timeRange } = input || {};

      const where = { dismissed: false };
      if (topicIds?.length > 0) {
        where.topicId = { in: topicIds };
      } else if (topicId) {
        where.topicId = topicId;
      }
      if (platform) where.platform = platform;
      if (relevance) where.aiRelevance = relevance;
      if (actionType) where.actionType = actionType;
      if (timeRange && timeRange !== 'all') {
        const ms = { '24h': 24 * 3600000, '7d': 7 * 86400000, '30d': 30 * 86400000, '90d': 90 * 86400000 };
        where.detectedAt = { gte: new Date(Date.now() - ms[timeRange]) };
      }

      const [total, bySentiment, byPlatform, byAction] = await Promise.all([
        ctx.prisma.listeningHit.count({ where }),
        ctx.prisma.listeningHit.groupBy({ by: ['sentiment'], where, _count: true }),
        ctx.prisma.listeningHit.groupBy({ by: ['platform'], where, _count: true }),
        ctx.prisma.listeningHit.groupBy({ by: ['actionType'], where, _count: true }),
      ]);

      const sentiment = Object.fromEntries(bySentiment.map((s) => [s.sentiment || 'NEUTRAL', s._count]));
      const platforms = Object.fromEntries(byPlatform.map((p) => [p.platform, p._count]));
      const actions = Object.fromEntries(byAction.map((a) => [a.actionType || 'FYI', a._count]));

      const positive = sentiment.POSITIVE || 0;
      const negative = sentiment.NEGATIVE || 0;
      const neutral = sentiment.NEUTRAL || 0;
      const sentimentTotal = positive + negative + neutral;
      const positivePct = sentimentTotal > 0 ? Math.round((positive / sentimentTotal) * 100) : 0;
      const negativePct = sentimentTotal > 0 ? Math.round((negative / sentimentTotal) * 100) : 0;

      return {
        total,
        sentiment: { positive, negative, neutral, positivePct, negativePct },
        platforms,
        actions,
        actionable: (actions.RESPOND || 0) + (actions.CRISIS || 0) + (actions.OPPORTUNITY || 0),
      };
    }),

  /**
   * listening.mentionMetrics
   * Get volume metrics and sentiment breakdown for the last 7 and 30 days.
   */
  mentionMetrics: protectedProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Exclude KOL topics from SOV metrics (SOV = owned channels vs competitors only)
    const kolTopics = await ctx.prisma.listeningTopic.findMany({
      where: { name: { startsWith: 'KOL:' } },
      select: { id: true },
    });
    const kolTopicIds = kolTopics.map((t) => t.id);
    const excludeKol = kolTopicIds.length > 0 ? { topicId: { notIn: kolTopicIds } } : {};

    // Total counts
    const [total30d, total7d] = await Promise.all([
      ctx.prisma.listeningHit.count({ where: { detectedAt: { gte: thirtyDaysAgo }, dismissed: false, ...excludeKol } }),
      ctx.prisma.listeningHit.count({ where: { detectedAt: { gte: sevenDaysAgo }, dismissed: false, ...excludeKol } }),
    ]);

    // Per-topic breakdown (last 7 days)
    const topicCounts = await ctx.prisma.listeningHit.groupBy({
      by: ['topicId'],
      where: { detectedAt: { gte: sevenDaysAgo }, dismissed: false, ...excludeKol },
      _count: true,
    });

    // Get topic names
    const topics = await ctx.prisma.listeningTopic.findMany({
      where: { id: { in: topicCounts.map((t) => t.topicId) } },
      select: { id: true, name: true },
    });

    const topicMap = Object.fromEntries(topics.map((t) => [t.id, t.name]));

    // Sentiment breakdown (last 7 days)
    const sentimentCounts = await ctx.prisma.listeningHit.groupBy({
      by: ['sentiment'],
      where: { detectedAt: { gte: sevenDaysAgo }, dismissed: false, ...excludeKol },
      _count: true,
    });

    // Platform breakdown (last 7 days)
    const platformCounts = await ctx.prisma.listeningHit.groupBy({
      by: ['platform'],
      where: { detectedAt: { gte: sevenDaysAgo }, dismissed: false, ...excludeKol },
      _count: true,
    });

    // Daily trend (last 14 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const dailyHits = await ctx.prisma.listeningHit.findMany({
      where: { detectedAt: { gte: fourteenDaysAgo }, dismissed: false, ...excludeKol },
      select: { detectedAt: true },
    });

    // Group by day
    const dayMap = {};
    dailyHits.forEach((h) => {
      const day = h.detectedAt.toISOString().slice(0, 10);
      dayMap[day] = (dayMap[day] || 0) + 1;
    });

    const dailyTrend = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      total30d,
      total7d,
      byTopic: topicCounts.map((t) => ({
        topicId: t.topicId,
        topicName: topicMap[t.topicId] || 'Unknown',
        count: t._count,
      })).sort((a, b) => b.count - a.count),
      bySentiment: Object.fromEntries(sentimentCounts.map((s) => [s.sentiment || 'NEUTRAL', s._count])),
      byPlatform: Object.fromEntries(platformCounts.map((p) => [p.platform, p._count])),
      dailyTrend,
    };
  }),

  /**
   * listening.queryPerformance
   * Per-query health metrics for continuous query improvement.
   * Surfaces actionable rate, noise rate, and health grade per query.
   */
  queryPerformance: protectedProcedure
    .input(z.object({ topicId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where = { active: true };
      if (input?.topicId) where.topicId = input.topicId;

      const queries = await ctx.prisma.listeningQuery.findMany({
        where,
        include: { topic: { select: { name: true } } },
        orderBy: { totalHits: 'desc' },
      });

      return queries.map((q) => {
        const noiseCount = (q.spamHits || 0) + (q.dismissedHits || 0);
        const total = q.totalHits || 0;
        const noiseRate = total > 0 ? noiseCount / total : 0;

        let health = 'INSUFFICIENT_DATA';
        if (total >= 10) {
          health = noiseRate > 0.5 ? 'POOR' : noiseRate > 0.25 ? 'FAIR' : 'GOOD';
        }

        return {
          id: q.id,
          topicName: q.topic?.name,
          platform: q.platform,
          queryString: q.queryString,
          totalHits: total,
          actionableHits: q.actionableHits || 0,
          spamHits: q.spamHits || 0,
          dismissedHits: q.dismissedHits || 0,
          avgHeuristic: q.avgHeuristic,
          actionableRate: total > 0 ? ((q.actionableHits || 0) / total * 100).toFixed(1) : null,
          noiseRate: total > 0 ? (noiseRate * 100).toFixed(1) : null,
          health,
          lastEvaluatedAt: q.lastEvaluatedAt,
        };
      });
    }),

  /**
   * listening.extractThemes
   * Extract recurring themes from recent listening hits.
   */
  extractThemes: protectedProcedure.mutation(async ({ ctx }) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentHits = await ctx.prisma.listeningHit.findMany({
      where: { detectedAt: { gte: sevenDaysAgo }, dismissed: false },
      select: { content: true },
      orderBy: { heuristicScore: 'desc' },
      take: 100,
    });

    if (recentHits.length < 5) {
      return { themes: [], message: 'Not enough data for theme extraction (need at least 5 hits).' };
    }

    // Use the existing extractThemes function from sentiment module
    const { extractThemes } = await import('@/lib/ai/sentiment');
    const texts = recentHits.map((h) => h.content).filter(Boolean);
    const result = await extractThemes(texts);
    return result;
  }),

  /**
   * listening.triggerScan
   * On-demand trigger to scan specific topics (or all active topics).
   * Calls the same shared logic as the cron job.
   */
  triggerScan: protectedProcedure
    .input(
      z.object({
        topicId: z.string().optional(),
      }).optional()
    )
    .mutation(async ({ input }) => {
      try {
        // Dynamic import to avoid circular dependency issues
        const { scanListeningTopics } = await import('@/lib/listening-scanner');
        const topicIds = input?.topicId ? [input.topicId] : undefined;
        // On-demand scan → bypass the Redis cache so the user sees truly fresh hits
        // (the X search result is otherwise cached for 10 min and would mask new posts).
        return scanListeningTopics({ topicIds, force: true });
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Listening scan failed: ${err.message}`,
        });
      }
    }),

  /**
   * listening.generateQueries
   * Takes a natural language prompt and generates boolean search queries
   * for X and Reddit using AI. Can also refine existing queries.
   */
  generateQueries: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        existingQueries: z
          .array(
            z.object({
              platform: z.enum(['X', 'REDDIT']),
              queryString: z.string(),
            })
          )
          .optional(),
        refinement: z.string().optional(),
        conversationHistory: z
          .array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { prompt, existingQueries, refinement, conversationHistory } = input;

      let userMessage;
      if (existingQueries && refinement) {
        userMessage = `I have these existing listening queries:
${existingQueries.map((q) => `- [${q.platform}] ${q.queryString}`).join('\n')}

The user wants to refine them: "${refinement}"

Please return updated queries as JSON.`;
      } else {
        // Build context from conversation history if available
        let historyContext = '';
        if (conversationHistory?.length > 0) {
          historyContext = `\n\nPrevious conversation:\n${conversationHistory.map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')}\n\nUser's latest input:`;
        }

        userMessage = `Generate social listening search queries for this monitoring request:
${historyContext}
"${prompt}"

Think carefully about:
1. What specific conversations, keywords, and phrases would signal relevant content
2. What synonyms and related terms to include (e.g., "AI agents" also covers "autonomous agents", "agentic AI")
3. What to exclude to avoid noise (crypto spam, giveaways, irrelevant subreddits)
4. Which X advanced operators and Reddit subreddits would yield the best results

If the prompt is too vague to create effective queries, include a "clarifyingQuestions" array in your response asking 2-3 focused questions to improve query quality. Otherwise, generate 3-5 optimized queries.

Return as JSON.`;
      }

      const result = await generateInsight('generate-listening-queries', userMessage, {
        model: 'claude-sonnet-4-20250514',
        systemPrompt: `You are an expert social listening strategist who builds precise search queries for X/Twitter and Reddit. You work for the social media command center at Figure Technology Solutions (Nasdaq: FIGR), a leading company in the RWA (real-world asset) tokenization / blockchain / fintech space. Your job is to translate natural language monitoring requests into optimized boolean search queries that capture relevant conversations while minimizing noise.

## Company Context — Figure Technology Solutions
Figure (FIGR) is a financial technology company that leverages blockchain (Provenance Blockchain) to transform financial services. Key entities to know:

**Core Products & Tokens:**
- Figure Markets — digital asset marketplace and trading platform
- Figure Lending — consumer lending (HELOC, personal loans, student loan refinancing)
- Figure Connect — institutional marketplace for private funds
- Figure Securities — SEC-registered ATS (Alternative Trading System)
- Provenance Blockchain — the Layer 1 blockchain built by Figure (ticker: $HASH)
- $FIGR — Figure's Nasdaq-listed stock ticker
- $YLDS — Figure's SEC-registered yield-bearing stablecoin
- DART — Digital Asset Registration Technology (Figure's loan origination system on blockchain)
- IntelliDebt — Figure's AI-powered debt analytics platform

**Leadership:**
- Mike Cagney (CEO & co-founder) — @mcagney on X
- Michael Tannenbaum (CEO) — @mbtannenbaum on X
- Figure is publicly traded on Nasdaq (FIGR)

**Key Competitors (RWA tokenization space):**
- Securitize ($DS) — tokenization platform, BlackRock BUIDL fund partner
- Ondo Finance ($ONDO) — USDY yield token, institutional DeFi
- Centrifuge ($CFG) — Tinlake protocol, MakerDAO RWA vaults
- Superstate ($USTB) — Robert Leshner's tokenized treasury fund
- Tokeny Solutions — ERC-3643 / T-REX protocol, enterprise tokenization
- Goldfinch ($GFI) — Warbler Labs, decentralized credit protocol
- Tradable — tokenized fund administration

## Your approach:
1. UNDERSTAND the user's intent — what conversations, topics, or signals do they care about?
2. IDENTIFY key terms, synonyms, related phrases, and industry jargon relevant to Figure's ecosystem
3. BUILD platform-specific queries that leverage each platform's search capabilities
4. EXCLUDE noise — spam, giveaways, unrelated content, bot activity, and false positives from ambiguous terms
5. CREATE multiple focused queries (3-5) rather than one giant catch-all
6. VALIDATE each query — ask yourself "could this query match content completely unrelated to the monitoring intent?" If yes, add disambiguation terms or negative keywords

## Industry-Specific Noise to Always Exclude:
When building queries for Figure or RWA topics, always consider excluding these common noise patterns:
- Crypto spam: -giveaway -airdrop -whitelist -"free mint" -"DM me"
- Bot activity: -bot -"follow back" -"follow for follow"
- Unrelated "figure" matches: -"figure skating" -"figure out" -"action figure" (when monitoring the Figure brand)
- Unrelated "hash" matches: -hashtag -"hash rate" -"hash function" (when monitoring $HASH/Provenance)
- Generic "prime" matches: always use "Figure Prime" or "$PRIME" instead of standalone "prime"

## Quality Thresholds:
- For brand monitoring queries, include min_faves:3 to filter zero-engagement bot posts
- For competitor monitoring, include min_faves:2 for baseline quality
- For KOL tracking, use (from:username) with compound conditions requiring at least one Figure/RWA-specific term
- For broad industry queries, include min_retweets:1 to surface content with traction

## X/Twitter query syntax:
- Quoted phrases for exact matches: "Figure Markets" "provenance blockchain"
- OR for alternatives: ("$FIGR" OR "Figure Markets" OR "Figure Technology")
- Grouping with parentheses: ("Figure" OR "FIGR") AND ("tokenization" OR "RWA" OR "blockchain")
- -keyword to exclude: -giveaway -airdrop -"figure skating" -"figure out"
- from: and to: operators for specific accounts
- min_faves: and min_retweets: for quality filtering
- lang:en for English only
- Keep each query under 512 characters
- Prefer 3-5 focused queries over 1 sprawling query
- Always pair ambiguous brand terms with product/industry context to prevent false positives
- Consider both the brand/company name AND their specific products/tokens/tickers

## Reddit query syntax (via SociaVault API):
- Quoted phrases for exact match: "Figure Markets"
- AND / OR boolean operators supported
- NOT is NOT supported — use negativeKeywords array for exclusion (applied post-fetch)
- Parenthetical grouping: ("term1" OR "term2") AND "term3"
- Keep queries simpler than X — Reddit search is less sophisticated
- Global search covers all of Reddit (1 credit); subreddits field filters results post-fetch
- Include relevant subreddit suggestions (3-8 specific subreddits)
- Key subreddits for Figure/RWA: r/cryptocurrency, r/defi, r/ethfinance, r/RWA, r/CryptoMarkets, r/stocks, r/wallstreetbets, r/fintech, r/SecurityToken
- Always add negativeKeywords for Reddit queries — this is the ONLY way to exclude noise (Reddit has no -keyword operator)
- Ambiguous terms MUST be qualified with AND context (Reddit has no min_faves equivalent)

## Response format:
ALWAYS respond with valid JSON only — no markdown fencing, no text before or after. Use this format:
{
  "topicName": "concise descriptive name",
  "description": "1-2 sentence description of what this monitors and why",
  "queries": [
    {
      "platform": "X",
      "queryString": "the boolean search query",
      "negativeKeywords": ["spam", "giveaway"],
      "subreddits": [],
      "rationale": "explains what this query catches and why it's structured this way",
      "falsePositiveRisk": "low|medium|high — brief note on what irrelevant content might match"
    },
    {
      "platform": "REDDIT",
      "queryString": "the search query",
      "negativeKeywords": [],
      "subreddits": ["specific_relevant_sub"],
      "rationale": "explains the query strategy for Reddit",
      "falsePositiveRisk": "low|medium|high — brief note on potential noise"
    }
  ]
}

If the request is too vague, return queries AND clarifying questions:
{
  "topicName": "suggested name",
  "description": "based on current understanding",
  "queries": [ ...initial best-effort queries... ],
  "clarifyingQuestions": [
    "Are you looking for conversations about Figure specifically, or the broader RWA industry?",
    "Should we track competitor mentions alongside, or focus solely on Figure's brand?"
  ]
}`,
        maxTokens: 2048,
      });

      return result;
    }),

  /**
   * listening.refineTopicQueries
   * Chat with AI to refine queries for an existing topic.
   * Takes a topicId and a refinement prompt, returns updated queries.
   * Optionally saves the changes directly (if save=true).
   */
  refineTopicQueries: protectedProcedure
    .input(
      z.object({
        topicId: z.string(),
        refinement: z.string().min(1),
        save: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { topicId, refinement, save } = input;

      // Fetch existing topic with queries
      const topic = await prisma.listeningTopic.findUnique({
        where: { id: topicId },
        include: { queries: true },
      });
      if (!topic) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Topic not found.' });
      }

      const existingQueries = topic.queries.map((q) => ({
        platform: q.platform,
        queryString: q.queryString,
        negativeKeywords: q.negativeKeywords || [],
        subreddits: q.subreddits || [],
        totalHits: q.totalHits || 0,
        actionableHits: q.actionableHits || 0,
        spamHits: q.spamHits || 0,
        dismissedHits: q.dismissedHits || 0,
      }));

      // Build performance context for queries that have data
      const perfLines = existingQueries
        .filter((q) => q.totalHits > 0)
        .map((q) => {
          const noiseCount = q.spamHits + q.dismissedHits;
          const noisePct = ((noiseCount / q.totalHits) * 100).toFixed(0);
          return `  [${q.platform}] ${q.queryString} → ${q.totalHits} hits, ${q.actionableHits} actionable, ${noiseCount} noise (${noisePct}% noise)`;
        });
      const perfContext = perfLines.length > 0
        ? `\n\nQuery Performance Data (use this to prioritize which queries need improvement):\n${perfLines.join('\n')}`
        : '';

      const userMessage = `I have an existing listening topic called "${topic.name}" with these queries:
${existingQueries.map((q) => `- [${q.platform}] ${q.queryString}${q.negativeKeywords.length ? ` (excludes: ${q.negativeKeywords.join(', ')})` : ''}${q.subreddits.length ? ` (subreddits: ${q.subreddits.join(', ')})` : ''}`).join('\n')}${perfContext}

The user wants to refine them: "${refinement}"

Please return the full updated set of queries as JSON. Keep queries that are still good, modify ones that need changes, and add new ones if requested.`;

      const result = await generateInsight('refine-topic-queries', userMessage, {
        model: 'claude-sonnet-4-20250514',
        systemPrompt: `You are a social listening query expert working for Figure Technology Solutions (Nasdaq: FIGR) in the RWA tokenization / blockchain / fintech space. You're refining existing queries for a monitoring topic.

## Company Context — Figure Technology Solutions
Figure (FIGR) products: Figure Markets (trading platform), Figure Lending (HELOC, personal loans), Figure Connect (institutional marketplace), Figure Securities (ATS), Provenance Blockchain ($HASH), $YLDS (yield-bearing stablecoin), DART (loan origination), IntelliDebt (AI debt analytics). CEO: Mike Cagney. Publicly traded: Nasdaq FIGR.

Key competitors: Securitize ($DS, BlackRock BUIDL), Ondo Finance ($ONDO, USDY), Centrifuge ($CFG, Tinlake), Superstate ($USTB), Tokeny (ERC-3643), Goldfinch ($GFI), Tradable.

## X/Twitter query syntax:
- Quoted phrases for exact matches: "Figure Markets" "provenance blockchain"
- OR for alternatives: ("$FIGR" OR "Figure Markets")
- Grouping with parentheses for compound conditions
- -keyword to exclude: -spam -giveaway -"figure skating" -"figure out"
- from: and to: operators for specific accounts
- min_faves: for quality filtering (use min_faves:3 for brand, min_faves:2 for competitors)
- lang:en for English only
- Keep each query under 512 characters
- Prefer focused queries over sprawling ones
- Always pair ambiguous terms with industry context to prevent false positives

## Reddit query syntax (via SociaVault API):
- Quoted phrases for exact match: "Figure Markets"
- AND / OR boolean operators supported
- NOT is NOT supported — use negativeKeywords array for exclusion (applied post-fetch)
- Parenthetical grouping: ("term1" OR "term2") AND "term3"
- Keep queries simpler than X — Reddit search is less sophisticated
- Global search covers all of Reddit (1 credit); subreddits field filters results post-fetch
- Include relevant subreddit suggestions (3-8 specific subreddits): r/cryptocurrency, r/defi, r/ethfinance, r/RWA, r/CryptoMarkets, r/stocks, r/fintech, r/SecurityToken
- Always add negativeKeywords for Reddit queries — this is the ONLY way to exclude noise
- Ambiguous terms MUST be qualified with AND context (Reddit has no min_faves equivalent)

## Noise Prevention:
- Always exclude: -giveaway -airdrop -whitelist -"free mint" -"DM me" -bot
- For Figure brand: -"figure skating" -"figure out" -"action figure"
- For $HASH: -hashtag -"hash rate" -"hash function"
- Never use standalone "prime", "hash", "dart" — always pair with "Figure" or use ticker format

## Important:
- Always return the COMPLETE set of queries (not just changes)
- Preserve queries that are still good, modify ones that need changes
- Add new queries if the refinement implies gaps
- Consider product names, token tickers, and common misspellings
- For each query, assess false positive risk — could this match unrelated content?
- For KOL queries, require compound conditions with at least one high-confidence Figure term

ALWAYS respond with valid JSON only — no markdown fencing, no text before or after:
{
  "topicName": "topic name (keep original unless user asks to change)",
  "description": "updated description",
  "queries": [
    {
      "platform": "X",
      "queryString": "the boolean search query",
      "negativeKeywords": ["spam", "giveaway"],
      "subreddits": [],
      "rationale": "why this query is useful or what changed",
      "falsePositiveRisk": "low|medium|high — brief assessment"
    }
  ]
}`,
        maxTokens: 2048,
      });

      // Validate AI returned expected shape
      if (!result || !Array.isArray(result.queries)) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'AI returned unexpected response format. Please try again.',
        });
      }

      // If save=true, update the topic's queries in the database
      if (save && result.queries) {
        try {
          // Delete existing queries and recreate
          await prisma.listeningQuery.deleteMany({ where: { topicId } });
          await prisma.listeningQuery.createMany({
            data: result.queries.map((q) => ({
              topicId,
              platform: q.platform,
              queryString: q.queryString,
              negativeKeywords: q.negativeKeywords || [],
              subreddits: q.subreddits || [],
              generatedBy: 'ai',
            })),
          });

          // Optionally update topic name/description if provided
          if (result.topicName || result.description) {
            await prisma.listeningTopic.update({
              where: { id: topicId },
              data: {
                ...(result.topicName ? { name: result.topicName } : {}),
                ...(result.description ? { description: result.description } : {}),
              },
            });
          }
        } catch (err) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to save refined queries: ${err.message}`,
          });
        }
      }

      return { ...result, saved: save };
    }),

  /**
   * listening.subredditMetrics
   * Get tracked subreddit stats with daily metrics history.
   */
  subredditMetrics: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(30),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setUTCHours(0, 0, 0, 0);

      const subreddits = await ctx.prisma.monitoredSubreddit.findMany({
        where: { active: true },
        include: {
          metrics: {
            where: { date: { gte: since } },
            orderBy: { date: 'asc' },
          },
          topic: {
            select: { name: true },
          },
        },
      });

      return subreddits.map((sub) => ({
        id: sub.id,
        name: sub.subredditName,
        topicName: sub.topic.name,
        avgDailyPosts: sub.avgDailyPosts,
        avgEngagement: sub.avgEngagement,
        latestSubscribers: sub.metrics.length > 0
          ? sub.metrics[sub.metrics.length - 1].subscribers
          : null,
        subscriberGrowth: sub.metrics.length >= 2
          ? sub.metrics[sub.metrics.length - 1].subscribers - sub.metrics[0].subscribers
          : null,
        history: sub.metrics.map((m) => ({
          date: m.date,
          subscribers: m.subscribers,
          posts: m.postsCount,
          comments: m.commentsCount,
          avgUpvotes: m.avgUpvotes,
          avgComments: m.avgComments,
          topPostScore: m.topPostScore,
          topPostTitle: m.topPostTitle,
        })),
      }));
    }),

  /**
   * listening.reanalyzeSentiment
   * Re-analyzes sentiment for recent listening hits using Claude AI.
   */
  reanalyzeSentiment: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).default({})
    )
    .mutation(async ({ ctx, input }) => {
      const hits = await ctx.prisma.listeningHit.findMany({
        orderBy: { detectedAt: 'desc' },
        take: input.limit,
      });

      if (hits.length === 0) return { updated: 0, total: 0 };

      let updated = 0;
      let errors = 0;
      // Process in batches of 10
      for (let i = 0; i < hits.length; i += 10) {
        const batch = hits.slice(i, i + 10);
        const texts = batch.map((h) => h.content || '');
        let results;
        try {
          results = await analyzeSentimentBatch(texts);
        } catch (err) {
          console.error(`[reanalyzeSentiment] Batch ${i / 10 + 1} failed:`, err.message);
          errors++;
          continue; // Skip failed batch, process the rest
        }

        for (let j = 0; j < batch.length; j++) {
          if (results[j]?.sentiment && results[j].sentiment !== batch[j].sentiment) {
            await ctx.prisma.listeningHit.update({
              where: { id: batch[j].id },
              data: { sentiment: results[j].sentiment },
            });
            updated++;
          }
        }
      }

      return { updated, total: hits.length, errors };
    }),

  /**
   * listening.suggestRefinements
   * Analyzes queries with high noise rates and suggests improvements.
   * Samples spam/dismissed hits to understand what noise looks like,
   * then asks AI how to tighten the queries.
   */
  suggestRefinements: protectedProcedure
    .input(z.object({ topicId: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      // Find queries with > 30% noise rate
      const queryWhere = { active: true, totalHits: { gt: 5 } };
      if (input?.topicId) {
        queryWhere.topicId = input.topicId;
      }

      const noisyQueries = await prisma.listeningQuery.findMany({
        where: queryWhere,
        include: { topic: { select: { name: true } } },
      });

      const queriesNeedingHelp = noisyQueries.filter((q) => {
        const noiseCount = (q.spamHits || 0) + (q.dismissedHits || 0);
        return q.totalHits > 0 && (noiseCount / q.totalHits) > 0.3;
      });

      if (queriesNeedingHelp.length === 0) {
        return { suggestions: [], message: 'All queries have acceptable noise levels (< 30%).' };
      }

      // Sample noise hits for each query
      const suggestions = [];
      for (const q of queriesNeedingHelp.slice(0, 5)) { // Cap at 5 queries per call
        const noiseHits = await prisma.listeningHit.findMany({
          where: {
            queryId: q.id,
            OR: [
              { aiRelevance: 'SPAM' },
              { dismissed: true },
              { heuristicScore: { lt: 0.3 } },
            ],
          },
          select: { content: true },
          orderBy: { detectedAt: 'desc' },
          take: 10,
        });

        if (noiseHits.length < 3) continue;

        const noiseSamples = noiseHits
          .map((h) => (h.content || '').slice(0, 200))
          .join('\n---\n');

        const noiseRate = Math.round(((q.spamHits + q.dismissedHits) / q.totalHits) * 100);

        const result = await generateInsight('listening/suggest-refinement', {
          topic: q.topic.name,
          platform: q.platform,
          currentQuery: q.queryString,
          negativeKeywords: q.negativeKeywords || [],
          noiseRate: `${noiseRate}%`,
          noiseSamples,
        }, {
          model: 'claude-haiku-4-5-20251001',
          maxTokens: 512,
          systemPrompt: `You are a search query optimization expert. Analyze why a social listening query is capturing noise, and suggest a tighter query.

Return JSON: {"diagnosis": "brief explanation of why noise is getting through", "suggestedQuery": "improved query string", "suggestedNegativeKeywords": ["word1", "word2"], "confidence": "HIGH|MEDIUM|LOW"}

Rules for X/Twitter queries: use quoted phrases, OR/AND, -exclusions, min_faves:, lang:en
Rules for Reddit queries: simpler boolean, use negativeKeywords for exclusion (no - operator)`,
        });

        suggestions.push({
          queryId: q.id,
          topicName: q.topic.name,
          platform: q.platform,
          currentQuery: q.queryString,
          noiseRate: `${noiseRate}%`,
          totalHits: q.totalHits,
          ...(result || {}),
        });
      }

      return { suggestions };
    }),

  // ────────────────────────────────────────────────────────────────
  // Brand Ontology — entity CRUD + planner sync
  // ────────────────────────────────────────────────────────────────
  entities: router({
    list: protectedProcedure
      .input(z.object({ topicId: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return ctx.prisma.brandEntity.findMany({
          where: input?.topicId ? { topicId: input.topicId } : {},
          orderBy: [{ topicId: 'asc' }, { kind: 'asc' }, { canonicalName: 'asc' }],
          include: { topic: { select: { id: true, name: true } } },
        });
      }),

    preview: protectedProcedure
      .input(
        z.object({
          kind: z.enum(['BRAND', 'PRODUCT', 'PERSON', 'SUBSIDIARY', 'TOKEN']),
          canonicalName: z.string().min(1),
          aliases: z.array(z.string()).default([]),
          tickers: z.array(z.string()).default([]),
          xHandles: z.array(z.string()).default([]),
          redditUsers: z.array(z.string()).default([]),
          hashtags: z.array(z.string()).default([]),
          isAmbiguous: z.boolean().default(false),
          qualifiers: z.array(z.string()).default([]),
          negativeTerms: z.array(z.string()).default([]),
          minFaves: z.number().int().positive().nullable().default(null),
          enabled: z.boolean().default(true),
        })
      )
      .query(async ({ input }) => {
        // Dry-run: returns the query list the planner would emit for this entity
        // without touching the DB. Used by the admin UI to show a live preview.
        return planQueriesForEntity(input);
      }),

    upsert: protectedProcedure
      .input(
        z.object({
          id: z.string().optional(),
          topicId: z.string(),
          kind: z.enum(['BRAND', 'PRODUCT', 'PERSON', 'SUBSIDIARY', 'TOKEN']),
          canonicalName: z.string().min(1),
          aliases: z.array(z.string()).default([]),
          tickers: z.array(z.string()).default([]),
          xHandles: z.array(z.string()).default([]),
          redditUsers: z.array(z.string()).default([]),
          hashtags: z.array(z.string()).default([]),
          isAmbiguous: z.boolean().default(false),
          qualifiers: z.array(z.string()).default([]),
          negativeTerms: z.array(z.string()).default([]),
          minFaves: z.number().int().positive().nullable().default(null),
          enabled: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const saved = id
          ? await ctx.prisma.brandEntity.update({ where: { id }, data })
          : await ctx.prisma.brandEntity.create({ data });
        // Auto-reconcile the topic so edits take effect immediately.
        const syncResult = await syncQueriesFromOntology(saved.topicId);
        return { entity: saved, sync: syncResult };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const entity = await ctx.prisma.brandEntity.findUniqueOrThrow({ where: { id: input.id } });
        await ctx.prisma.brandEntity.delete({ where: { id: input.id } });
        const syncResult = await syncQueriesFromOntology(entity.topicId);
        return { deleted: input.id, sync: syncResult };
      }),
  }),

  syncQueries: protectedProcedure
    .input(z.object({ topicId: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      if (input?.topicId) return { topics: [await syncQueriesFromOntology(input.topicId)] };
      return { topics: await syncAllOntologies() };
    }),

  // ────────────────────────────────────────────────────────────────
  // Diagnose: "why wasn't post X captured?" — self-service triage tool.
  // Given a tweet URL or raw content, walks the decision tree and reports what
  // happened (or would happen) at each step: query match, negative keyword, dedup,
  // strict relevance gate, storage. Mutation (not query) because every call is
  // persisted to DiagnoseLog — the growing "things we missed" dataset that feeds
  // back into the ontology.
  // ────────────────────────────────────────────────────────────────
  diagnose: protectedProcedure
    .input(
      z.object({
        // One of url / tweetId / content must be supplied.
        url: z.string().url().optional(),
        tweetId: z.string().optional(),
        content: z.string().optional(),
        // Author handle helps match from:/@ operators in queries.
        authorUsername: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Persist every diagnose call so the gaps don't evaporate. The log row is the
      // feedback loop — see the "Ontology gaps this week" admin tile.
      const recordLog = async (result) => {
        try {
          const log = await ctx.prisma.diagnoseLog.create({
            data: {
              createdById: ctx.user?.id || null,
              url: input.url || null,
              tweetId: input.tweetId || null,
              content: input.content || null,
              authorUsername: input.authorUsername || null,
              outcome: result.outcome,
              matchedCount: Array.isArray(result.matched) ? result.matched.length : 0,
              blockedCount: Array.isArray(result.blockers) ? result.blockers.length : 0,
              resultJson: result,
            },
          });
          return log.id;
        } catch (err) {
          // Logging must never break the diagnose flow; swallow silently.
          console.warn('diagnoseLog write failed:', err?.message);
          return null;
        }
      };

      // Extract tweet id from URL if supplied.
      let tweetId = input.tweetId;
      if (!tweetId && input.url) {
        const m = input.url.match(/status\/(\d+)/);
        if (m) tweetId = m[1];
      }

      // Step 1: Is it already in the DB (ListeningHit or Mention)?
      const existingHit = tweetId
        ? await ctx.prisma.listeningHit.findFirst({
            where: { platformPostId: String(tweetId) },
            include: { query: { include: { sourceEntity: true } }, topic: { select: { name: true } } },
          })
        : null;

      const existingMention = tweetId
        ? await ctx.prisma.mention.findFirst({
            where: { platformMentionId: String(tweetId) },
            include: { account: { select: { username: true } } },
          })
        : null;

      if (existingHit) {
        const result = {
          outcome: 'CAPTURED_AS_HIT',
          detail: `Already stored as a ListeningHit on topic "${existingHit.topic?.name}" via query template "${existingHit.query?.sourceTemplate || 'hand-written'}".`,
          hit: existingHit,
        };
        return { ...result, logId: await recordLog(result) };
      }
      if (existingMention) {
        const result = {
          outcome: 'CAPTURED_AS_MENTION',
          detail: `Already stored as a Mention against @${existingMention.account?.username}.`,
          mention: existingMention,
        };
        return { ...result, logId: await recordLog(result) };
      }

      // Step 2: Which active queries would theoretically match?
      // We use a cheap heuristic — substring match of key tokens from the query on
      // the content. The real pipeline AND-s query operators, but this surfaces
      // "which queries reference things in the tweet" which is what users want to
      // understand anyway.
      if (!input.content && !tweetId) {
        const result = {
          outcome: 'INSUFFICIENT_INPUT',
          detail: 'Paste a tweet URL, platform id, or the tweet text to diagnose.',
        };
        return { ...result, logId: await recordLog(result) };
      }

      const content = (input.content || '').toLowerCase();
      const author = (input.authorUsername || '').replace(/^@/, '').toLowerCase();

      const activeQueries = await ctx.prisma.listeningQuery.findMany({
        where: { active: true },
        include: {
          sourceEntity: { select: { canonicalName: true, kind: true } },
          topic: { select: { name: true, strictRelevance: true } },
        },
      });

      const matched = [];
      for (const q of activeQueries) {
        const qs = q.queryString.toLowerCase();
        // Extract tokens that might appear in content: words, quoted phrases, @handles, $tickers, #hashtags.
        const tokens = new Set();
        const quoted = qs.match(/"([^"]+)"/g) || [];
        for (const t of quoted) tokens.add(t.replace(/"/g, ''));
        const handles = qs.match(/@[a-z0-9_]+/g) || [];
        for (const h of handles) tokens.add(h);
        const tickers = qs.match(/\$[a-z0-9_]+/gi) || [];
        for (const t of tickers) tokens.add(t.toLowerCase());
        const fromOps = qs.match(/from:([a-z0-9_]+)/g) || [];
        for (const f of fromOps) tokens.add(f);

        let matchedToken = null;
        for (const t of tokens) {
          // `from:X` matches when the author is X
          if (t.startsWith('from:')) {
            if (author && author === t.slice(5)) { matchedToken = t; break; }
            continue;
          }
          if (content.includes(t)) { matchedToken = t; break; }
        }
        if (matchedToken) {
          matched.push({
            queryId: q.id,
            topic: q.topic?.name,
            template: q.sourceTemplate || 'hand-written',
            entity: q.sourceEntity?.canonicalName,
            matchedToken,
            queryString: q.queryString,
          });
        }
      }

      // Step 3: would negative keywords drop it?
      const blockers = [];
      for (const q of matched) {
        const negs = (q.queryString.match(/-"([^"]+)"|-(\S+)/g) || []).map((n) =>
          n.replace(/^-"?|"?$/g, '').toLowerCase()
        );
        const blocked = negs.find((n) => n && content.includes(n));
        if (blocked) blockers.push({ ...q, blockedBy: blocked });
      }

      // Step 4: would the strict relevance gate (topic.strictRelevance) drop it?
      // We can't know for sure without running the scanner, but we can flag topics
      // whose gate would activate against this content.
      // Simplified: if any matched query is on a strict-relevance topic and content
      // has <1 high-confidence hit, warn.
      const { HIGH_CONFIDENCE_TERMS } = await import('../listening-scanner.js').catch(() => ({}));
      const hcTerms = HIGH_CONFIDENCE_TERMS || [];
      const hcHits = hcTerms.filter((t) => content.includes(String(t).toLowerCase())).length;

      if (matched.length === 0) {
        // Classify the gap so the UI can offer the cheapest fix first:
        //  - EXTEND_ENTITY: add token to an existing entity's alias/handle
        //  - CREATE_ENTITY: only when no close match exists
        // Fetch the minimum entity projection needed for fuzzy matching.
        const allEntities = await ctx.prisma.brandEntity.findMany({
          where: { enabled: true },
          select: {
            id: true, kind: true, canonicalName: true,
            aliases: true, xHandles: true, tickers: true, hashtags: true,
            topicId: true,
          },
        });
        const classification = classifyGap(
          { content: input.content, authorUsername: input.authorUsername },
          allEntities
        );

        const result = {
          outcome: 'NO_QUERY_MATCH',
          detail: classification.mode === 'EXTEND_ENTITY'
            ? `No active query matched, but this looks like an extension of an existing entity — add the token to it instead of creating a new row.`
            : 'No active listening query references tokens present in this content/author, and no existing entity is a close match. Add a new BrandEntity.',
          suggestedFix: classification.mode === 'EXTEND_ENTITY'
            ? `Add "${classification.token}" to ${classification.entity.canonicalName}'s ${classification.field}`
            : 'Create a new BrandEntity for this pattern.',
          classification,
          checkedQueries: activeQueries.length,
        };
        return { ...result, logId: await recordLog(result) };
      }

      const result = {
        outcome: blockers.length ? 'BLOCKED_BY_NEGATIVE' : 'WOULD_BE_CAPTURED',
        detail: blockers.length
          ? `Matched ${matched.length} query(s), but ${blockers.length} of them have a negative keyword that excludes this content.`
          : `${matched.length} query(s) would match this content. If it's not in the feed yet, it may be outside the fetched window (since_id advancing past it) or awaiting the next cron run.`,
        matched,
        blockers,
        relevanceGate: { highConfidenceTokenHits: hcHits, hcTermsChecked: hcTerms.length },
      };
      return { ...result, logId: await recordLog(result) };
    }),

  // ────────────────────────────────────────────────────────────────
  // Diagnose-log list + resolve. Powers the "Ontology gaps this week" tile
  // and the "mark as fixed" action once a user has closed a gap by editing
  // the BrandEntity ontology.
  // ────────────────────────────────────────────────────────────────
  diagnoseLogs: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [byOutcome, unresolvedGaps] = await Promise.all([
        ctx.prisma.diagnoseLog.groupBy({
          by: ['outcome'],
          where: { createdAt: { gte: weekAgo } },
          _count: { _all: true },
        }),
        ctx.prisma.diagnoseLog.count({
          where: {
            createdAt: { gte: weekAgo },
            outcome: { in: ['NO_QUERY_MATCH', 'BLOCKED_BY_NEGATIVE'] },
            resolvedAt: null,
          },
        }),
      ]);
      const counts = Object.fromEntries(byOutcome.map((b) => [b.outcome, b._count._all]));
      return { weekAgo, counts, unresolvedGaps };
    }),

    list: protectedProcedure
      .input(
        z
          .object({
            outcome: z.string().optional(),
            onlyUnresolved: z.boolean().default(false),
            limit: z.number().int().min(1).max(200).default(50),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const where = {};
        if (input?.outcome) where.outcome = input.outcome;
        if (input?.onlyUnresolved) where.resolvedAt = null;
        return ctx.prisma.diagnoseLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input?.limit ?? 50,
        });
      }),

    resolve: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          entityId: z.string().optional(),
          note: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.diagnoseLog.update({
          where: { id: input.id },
          data: {
            resolvedEntityId: input.entityId || null,
            resolvedAt: new Date(),
            resolutionNote: input.note || null,
          },
        });
      }),

    /**
     * Patterns aggregator — groups unresolved NO_QUERY_MATCH logs by recurring
     * tokens so operators can fix N gaps at once instead of one-at-a-time.
     * A "pattern" = a token (handle, ticker, hashtag, proper-noun phrase) that
     * appears in ≥2 unresolved logs in the lookback window.
     */
    patterns: protectedProcedure
      .input(
        z
          .object({
            windowDays: z.number().int().min(1).max(60).default(14),
            minFrequency: z.number().int().min(2).max(20).default(2),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const { windowDays = 14, minFrequency = 2 } = input || {};
        const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
        const logs = await ctx.prisma.diagnoseLog.findMany({
          where: {
            createdAt: { gte: since },
            outcome: 'NO_QUERY_MATCH',
            resolvedAt: null,
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });

        // Tokenize each log's content + author into candidate tokens, then
        // bucket by token. Uses the same extraction shape as the classifier.
        const tokenToLogs = new Map();
        for (const log of logs) {
          const tokens = new Set();
          const text = String(log.content || '');
          const low = text.toLowerCase();
          const author = String(log.authorUsername || '').replace(/^@/, '').toLowerCase();
          if (author) tokens.add(`@${author}`);
          for (const h of low.match(/@[a-z0-9_]+/g) || []) tokens.add(h);
          for (const t of low.match(/\$[a-z0-9_]+/gi) || []) tokens.add(t.toLowerCase());
          for (const h of low.match(/#[a-z0-9_]+/g) || []) tokens.add(h.toLowerCase());
          for (const m of text.match(/\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\b/g) || []) {
            if (m.length > 3) tokens.add(m.toLowerCase());
          }
          for (const tok of tokens) {
            if (!tokenToLogs.has(tok)) tokenToLogs.set(tok, []);
            tokenToLogs.get(tok).push(log);
          }
        }

        const patterns = [];
        for (const [token, hits] of tokenToLogs.entries()) {
          if (hits.length < minFrequency) continue;
          patterns.push({
            token,
            frequency: hits.length,
            sampleLogIds: hits.slice(0, 5).map((l) => l.id),
            samples: hits.slice(0, 3).map((l) => ({
              id: l.id,
              content: l.content?.slice(0, 160) || null,
              author: l.authorUsername,
              url: l.url,
              createdAt: l.createdAt,
            })),
          });
        }
        patterns.sort((a, b) => b.frequency - a.frequency);
        return { windowDays, totalUnresolved: logs.length, patterns };
      }),
  }),

  // ────────────────────────────────────────────────────────────────
  // Algo terms — HIGH_CONFIDENCE / ECOSYSTEM lists, DB-driven so the
  // admin UI can promote a token without a code deploy.
  // ────────────────────────────────────────────────────────────────
  algoTerms: router({
    list: protectedProcedure
      .input(
        z
          .object({
            kind: z.enum(['HIGH_CONFIDENCE', 'ECOSYSTEM']).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return ctx.prisma.globalAlgoTerm.findMany({
          where: input?.kind ? { kind: input.kind } : {},
          orderBy: [{ kind: 'asc' }, { term: 'asc' }],
        });
      }),

    promote: protectedProcedure
      .input(
        z.object({
          term: z.string().min(1),
          kind: z.enum(['HIGH_CONFIDENCE', 'ECOSYSTEM']).default('HIGH_CONFIDENCE'),
          note: z.string().optional(),
          addedFromLogId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const term = input.term.toLowerCase().trim();
        if (!term) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Empty term' });
        const row = await ctx.prisma.globalAlgoTerm.upsert({
          where: { term_kind: { term, kind: input.kind } },
          create: {
            term,
            kind: input.kind,
            note: input.note || null,
            addedFromLogId: input.addedFromLogId || null,
            createdById: ctx.user?.id || null,
            enabled: true,
          },
          update: { enabled: true, note: input.note || undefined },
        });
        // Bust the scanner's in-memory term cache so the next scan picks it up.
        invalidateAlgoTermsCache();

        // Close every unresolved NO_QUERY_MATCH log whose content or author
        // mentions the promoted term. This is the whole point of the patterns
        // panel: one promote closes N gaps, not just the one that triggered it.
        let closedCount = 0;
        try {
          const stripped = term.replace(/^[@#$]/, '');
          const updated = await ctx.prisma.diagnoseLog.updateMany({
            where: {
              resolvedAt: null,
              outcome: 'NO_QUERY_MATCH',
              OR: [
                { content: { contains: stripped, mode: 'insensitive' } },
                { authorUsername: { contains: stripped, mode: 'insensitive' } },
              ],
            },
            data: {
              resolvedAt: new Date(),
              resolvedEntityId: null,
              resolutionNote: `Promoted "${term}" to ${input.kind}`,
            },
          });
          closedCount = updated.count;
        } catch {
          // Non-fatal — the term row was still created.
        }
        return { ...row, logsClosed: closedCount };
      }),

    setEnabled: protectedProcedure
      .input(z.object({ id: z.string(), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const row = await ctx.prisma.globalAlgoTerm.update({
          where: { id: input.id },
          data: { enabled: input.enabled },
        });
        invalidateAlgoTermsCache();
        return row;
      }),
  }),
});
