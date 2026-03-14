import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { generateInsight } from '../ai';

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
          sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
          relevance: z.enum(['HIGH', 'MEDIUM', 'LOW', 'SPAM']).optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().nullish(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        const { prisma } = ctx;
        const { topicId, sentiment, relevance, limit = 50, cursor } = input || {};

        const where = { dismissed: false };
        if (topicId) where.topicId = topicId;
        if (sentiment) where.sentiment = sentiment;
        if (relevance) where.aiRelevance = relevance;

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
          })),
          nextCursor,
        };
      }),

    /**
     * listening.hits.dismiss
     * Dismiss a listening hit.
     */
    dismiss: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const hit = await ctx.prisma.listeningHit.findUnique({ where: { id: input.id } });
        if (!hit) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Hit not found.' });
        }

        return ctx.prisma.listeningHit.update({
          where: { id: input.id },
          data: { dismissed: true, dismissedBy: ctx.user.id },
        });
      }),
  }),

  /**
   * listening.mentionMetrics
   * Get volume metrics and sentiment breakdown for the last 7 and 30 days.
   */
  mentionMetrics: protectedProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Total counts
    const [total30d, total7d] = await Promise.all([
      ctx.prisma.listeningHit.count({ where: { detectedAt: { gte: thirtyDaysAgo }, dismissed: false } }),
      ctx.prisma.listeningHit.count({ where: { detectedAt: { gte: sevenDaysAgo }, dismissed: false } }),
    ]);

    // Per-topic breakdown (last 7 days)
    const topicCounts = await ctx.prisma.listeningHit.groupBy({
      by: ['topicId'],
      where: { detectedAt: { gte: sevenDaysAgo }, dismissed: false },
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
      where: { detectedAt: { gte: sevenDaysAgo }, dismissed: false },
      _count: true,
    });

    // Platform breakdown (last 7 days)
    const platformCounts = await ctx.prisma.listeningHit.groupBy({
      by: ['platform'],
      where: { detectedAt: { gte: sevenDaysAgo }, dismissed: false },
      _count: true,
    });

    // Daily trend (last 14 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const dailyHits = await ctx.prisma.listeningHit.findMany({
      where: { detectedAt: { gte: fourteenDaysAgo }, dismissed: false },
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
      // Dynamic import to avoid circular dependency issues
      const { scanListeningTopics } = await import('@/lib/listening-scanner');
      const topicIds = input?.topicId ? [input.topicId] : undefined;
      return scanListeningTopics({ topicIds });
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
- Mike Cagney (CEO & co-founder) — @mcaborhood on X
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

## Reddit query syntax (via PullPush API):
- Basic boolean: "Figure Markets" AND "tokenization"
- Quoted phrases: "provenance blockchain"
- AND / OR supported, NOT is not
- Include relevant subreddit suggestions (be specific and relevant)
- Key subreddits for Figure/RWA: r/cryptocurrency, r/defi, r/ethfinance, r/RWA, r/CryptoMarkets, r/stocks, r/wallstreetbets, r/fintech, r/SecurityToken
- Reddit search is less sophisticated — prefer simpler, broader terms
- Always suggest 3-5 specific subreddits

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
      }));

      const userMessage = `I have an existing listening topic called "${topic.name}" with these queries:
${existingQueries.map((q) => `- [${q.platform}] ${q.queryString}${q.negativeKeywords.length ? ` (excludes: ${q.negativeKeywords.join(', ')})` : ''}${q.subreddits.length ? ` (subreddits: ${q.subreddits.join(', ')})` : ''}`).join('\n')}

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

## Reddit query syntax (via PullPush API):
- Simpler syntax, supports AND / OR
- Include relevant subreddit suggestions: r/cryptocurrency, r/defi, r/ethfinance, r/RWA, r/CryptoMarkets, r/stocks, r/fintech, r/SecurityToken
- Use quoted phrases for exact matches

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

      // If save=true, update the topic's queries in the database
      if (save && result.queries) {
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
      }

      return { ...result, saved: save };
    }),
});
