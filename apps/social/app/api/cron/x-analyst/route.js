/**
 * Cron: X Account Analyst + Competitor Deep Dive
 * Schedule: Mon/Wed/Fri 7:00 AM UTC (0 7 * * 1,3,5)
 *
 * Runs after the standard weekly-ai-insights cron (6 AM on Mondays).
 * Three times per week to keep intelligence fresh:
 *   - Monday: Full 7-module report + competitor audit + co-creator context
 *   - Wednesday: Mid-week pulse (performance + competitor + calendar refresh)
 *   - Friday: End-of-week wrap + weekend content recs + competitor moves
 *
 * Generates:
 *   1. X_ANALYST_REPORT — Full 7-module account analysis
 *   2. X_COMPETITOR_AUDIT — Deep-dive competitor intelligence
 *   3. X_COCREATOR_CONTEXT — Compact context block for the co-pilot
 *
 * The co-creator context is automatically picked up by the co-pilot system
 * prompt via intel-context.js.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { generateInsight } from '@/lib/ai';
import { logger } from '@/lib/logger';

const log = logger('cron/x-analyst');

export const dynamic = 'force-dynamic';

// ── Primary accounts to analyze ──
const PRIMARY_ACCOUNTS = [
  { handle: '@Figure', description: 'Figure Technology Solutions — NASDAQ: FIGR, blockchain-native financial services, YLDS, Democratized Prime, OPEN, Figure Connect marketplace' },
  { handle: '@provenancefdn', description: 'Provenance Blockchain Foundation — L1 for financial services, $20B+ RWA TVL, HASH token' },
  { handle: '@HastraFi', description: 'Hastra — DeFi on Solana, PRIME token, RWA Consortium, Chainlink oracles, wYLDS' },
];

// ── Competitor handles (deep-dive audit targets) ──
const COMPETITORS = [
  { handle: '@OndoFinance', category: 'RWA tokenization', notes: 'Largest RWA TVL, BlackRock partnership, OUSG product, Ondo Summit' },
  { handle: '@MapleFi', category: 'Onchain asset management', notes: 'Rebranded from DeFi lending, $4.59B AUM, institutional positioning' },
  { handle: '@centrifuge', category: 'RWA tokenization', notes: 'Centrifuge Prime, MakerDAO integration, real-world credit pools' },
  { handle: '@GoldfinchFi', category: 'RWA credit', notes: 'Emerging market lending, USDC-denominated pools' },
  { handle: '@Securitize', category: 'Tokenized securities', notes: '42% market share tokenized Treasuries, institutional focus, BlackRock BUIDL' },
  { handle: '@coinbase', category: 'Exchange / custody', notes: 'Coinbase Prime custody, Base L2, regulatory narrative leader' },
  { handle: '@circle', category: 'Stablecoin infrastructure', notes: 'USDC issuer, cross-chain transfer protocol, institutional rails' },
  { handle: '@MakerDAO', category: 'DeFi / RWA', notes: 'Rebranded to Sky, Spark Protocol, RWA vaults, DAI/USDS' },
];

// ── Day-of-week run modes ──
function getRunMode() {
  const day = new Date().getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri
  if (day === 1) return 'monday_full';      // Full report + deep audit
  if (day === 3) return 'wednesday_pulse';   // Mid-week refresh
  if (day === 5) return 'friday_wrap';       // End-of-week + weekend recs
  return 'monday_full'; // Fallback for manual triggers
}

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runMode = getRunMode();

  try {
    const now = new Date();
    // Monday looks back 7 days; Wed/Fri look back to last run (~2-3 days)
    const lookbackDays = runMode === 'monday_full' ? 7 : 3;
    const lookbackDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

    log.info('X analyst cron starting', { runMode, lookbackDays });

    // ── 1. Gather internal data ──
    const [recentPosts, recentHits, accounts, lastReport, lastAudit] = await Promise.all([
      prisma.post.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: lookbackDate },
          account: { platform: 'X' },
        },
        include: {
          metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
          account: true,
        },
        orderBy: { publishedAt: 'desc' },
      }),
      prisma.listeningHit.findMany({
        where: {
          detectedAt: { gte: lookbackDate },
          platform: 'X',
        },
        orderBy: { heuristicScore: 'desc' },
        take: 50,
      }),
      prisma.account.findMany({
        where: { platform: 'X', isActive: true },
      }),
      // Get last report for feedback loop (comparing this run to previous)
      prisma.aIInsight.findFirst({
        where: { insightType: 'X_ANALYST_REPORT', dismissed: false },
        orderBy: { generatedAt: 'desc' },
      }),
      // Get last competitor audit for trend comparison
      prisma.aIInsight.findFirst({
        where: { insightType: 'X_COMPETITOR_AUDIT', dismissed: false },
        orderBy: { generatedAt: 'desc' },
      }),
    ]);

    // Compute per-account stats
    const accountStats = accounts.map(acct => {
      const posts = recentPosts.filter(p => p.accountId === acct.id);
      const avgEng = posts.length > 0
        ? posts.reduce((sum, p) => sum + (p.metrics[0]?.engagementRate || 0), 0) / posts.length
        : 0;
      const sortedPosts = [...posts].sort((a, b) => (b.metrics[0]?.engagementRate || 0) - (a.metrics[0]?.engagementRate || 0));
      return {
        handle: acct.handle || acct.username,
        postsThisPeriod: posts.length,
        avgEngagementRate: Math.round(avgEng * 10000) / 100,
        topPost: sortedPosts[0] ? {
          content: sortedPosts[0].content?.slice(0, 200),
          engagement: sortedPosts[0].metrics[0]?.engagementRate || 0,
          impressions: sortedPosts[0].metrics[0]?.impressions || 0,
        } : null,
        worstPost: sortedPosts.length > 1 ? {
          content: sortedPosts[sortedPosts.length - 1].content?.slice(0, 200),
          engagement: sortedPosts[sortedPosts.length - 1].metrics[0]?.engagementRate || 0,
        } : null,
      };
    });

    // Partition listening hits by source
    const competitorHits = recentHits
      .filter(h => h.content)
      .slice(0, 30)
      .map(h => ({
        content: h.content.slice(0, 250),
        author: h.authorUsername,
        sentiment: h.sentiment,
        engagements: h.engagementCount,
        platform: h.platform,
      }));

    const postsForPrompt = recentPosts.slice(0, 15).map(p => ({
      content: p.content?.slice(0, 200),
      handle: p.account?.handle || p.account?.username,
      engagement: p.metrics[0]?.engagementRate || 0,
      impressions: p.metrics[0]?.impressions || 0,
      likes: p.metrics[0]?.likes || 0,
      retweets: p.metrics[0]?.retweets || 0,
      bookmarks: p.metrics[0]?.bookmarks || 0,
      replies: p.metrics[0]?.replies || 0,
      publishedAt: p.publishedAt?.toISOString(),
    }));

    // Extract previous recommendations for feedback loop
    const previousRecs = lastReport?.content?.contentCalendar?.recommendations?.slice(0, 5) || [];

    // ── 2. Generate the 7-module report ──
    const reportContent = await generateInsight(
      'cron/x-analyst-report',
      buildReportPrompt({
        runMode,
        accountStats,
        competitorHits,
        recentPosts: postsForPrompt,
        dateRange: { start: lookbackDate.toISOString(), end: now.toISOString() },
        previousRecs,
      }),
      {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        systemPrompt: REPORT_SYSTEM_PROMPT,
      },
    );

    const reportInsight = await prisma.aIInsight.create({
      data: {
        insightType: 'X_ANALYST_REPORT',
        dataRangeStart: lookbackDate,
        dataRangeEnd: now,
        content: { ...reportContent, runMode },
      },
    });

    // ── 3. Competitor Deep-Dive Audit ──
    const auditContent = await generateInsight(
      'cron/x-competitor-audit',
      buildCompetitorAuditPrompt({
        competitors: COMPETITORS,
        competitorHits,
        previousAudit: lastAudit?.content || null,
        ourAccountStats: accountStats,
        dateRange: { start: lookbackDate.toISOString(), end: now.toISOString() },
        runMode,
      }),
      {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 3000,
        systemPrompt: COMPETITOR_AUDIT_SYSTEM_PROMPT,
      },
    );

    const auditInsight = await prisma.aIInsight.create({
      data: {
        insightType: 'X_COMPETITOR_AUDIT',
        dataRangeStart: lookbackDate,
        dataRangeEnd: now,
        content: { ...auditContent, runMode },
      },
    });

    // ── 4. Generate co-creator context (merges report + audit) ──
    const contextContent = await generateInsight(
      'cron/x-cocreator-context',
      buildContextPrompt(reportContent, auditContent),
      {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 1500,
        systemPrompt: 'Condense the provided X analyst report and competitor audit into a compact context injection block for an AI content co-creator. Return valid JSON with a "context" field (the full text block) and a "generatedAt" field. Keep the "context" field under 1800 characters.',
      },
    );

    await prisma.aIInsight.create({
      data: {
        insightType: 'X_COCREATOR_CONTEXT',
        dataRangeStart: lookbackDate,
        dataRangeEnd: now,
        content: contextContent,
      },
    });

    log.info('X analyst cron complete', {
      runMode,
      reportId: reportInsight.id,
      auditId: auditInsight.id,
      postsAnalyzed: recentPosts.length,
      competitorHitsAnalyzed: competitorHits.length,
    });

    return NextResponse.json({
      ok: true,
      runMode,
      reportInsightId: reportInsight.id,
      auditInsightId: auditInsight.id,
      modulesGenerated: 7,
      competitorsAudited: COMPETITORS.length,
      dataRange: {
        start: lookbackDate.toISOString(),
        end: now.toISOString(),
      },
      postsAnalyzed: recentPosts.length,
    });
  } catch (error) {
    log.error('X analyst cron error', { error, runMode });
    return NextResponse.json(
      { ok: false, error: error.message, runMode },
      { status: 500 },
    );
  }
}

// ═════════════════════════════════════════════════════════════
// SYSTEM PROMPTS
// ═════════════════════════════════════════════════════════════

const REPORT_SYSTEM_PROMPT = `You are the X Account Analyst for Figure Technology Solutions' marketing team (NASDAQ: FIGR). You produce structured intelligence reports 3x/week (Mon full report, Wed mid-week pulse, Fri end-of-week wrap).

CRITICAL RULES:
- Figure has SEC-registered products (YLDS). NEVER imply guaranteed returns.
- NEVER make HASH price predictions for Provenance Blockchain.
- DISTRIBUTION > VANITY. Prioritize impressions, bookmarks, reposts over raw likes.
- BE SPECIFIC. Never say "post more engaging content." Say exactly what format, hook, structure, timing.
- FEEDBACK LOOP: When previous recommendations are provided, assess which were likely implemented and how they performed. Calibrate new recommendations accordingly.
- Return valid JSON matching the schema provided.`;

const COMPETITOR_AUDIT_SYSTEM_PROMPT = `You are a competitive intelligence analyst specializing in X/Twitter strategy for RWA, DeFi, and blockchain financial services brands.

Your job is to produce a deep-dive audit of each competitor's X strategy: what they're posting, what's working, what formats they're using, what narrative territory they own, and what tactics Figure's team should adapt.

RULES:
- Be specific about FORMATS and HOOKS, not just topics. "They posted a thread" is useless. "They posted a 5-part thread with a counterintuitive stat hook that drove 3x their avg bookmarks" is useful.
- Compare each competitor to our accounts (@Figure, @provenancefdn, @HastraFi) — where are they beating us and where are we ahead?
- When a previous audit is provided, note what changed: new tactics, shifted positioning, emerging threats.
- Flag any competitor content that could be adapted for our accounts with specific instructions.
- Return valid JSON matching the schema provided.`;

// ═════════════════════════════════════════════════════════════
// PROMPT BUILDERS
// ═════════════════════════════════════════════════════════════

function buildReportPrompt({ runMode, accountStats, competitorHits, recentPosts, dateRange, previousRecs }) {
  const modeLabel = {
    monday_full: 'FULL WEEKLY REPORT (Monday)',
    wednesday_pulse: 'MID-WEEK PULSE (Wednesday)',
    friday_wrap: 'END-OF-WEEK WRAP (Friday)',
  }[runMode] || 'FULL REPORT';

  const feedbackSection = previousRecs.length > 0
    ? `\n\nFEEDBACK LOOP — Previous recommendations to evaluate:
${JSON.stringify(previousRecs, null, 2)}
Assess which of these were likely implemented (based on recent posts) and how they performed. Note this in the executive summary.`
    : '';

  const weekendNote = runMode === 'friday_wrap'
    ? '\n\nIMPORTANT: This is the Friday wrap. Include 3-4 weekend-specific content recommendations (Saturday/Sunday posting windows, lighter tone, community engagement focus).'
    : '';

  return `RUN MODE: ${modeLabel}
Analyze X (Twitter) data for ${dateRange.start.slice(0, 10)} to ${dateRange.end.slice(0, 10)}.

PRIMARY ACCOUNTS:
${PRIMARY_ACCOUNTS.map(a => `- ${a.handle}: ${a.description}`).join('\n')}

ACCOUNT PERFORMANCE THIS PERIOD:
${JSON.stringify(accountStats, null, 2)}

RECENT POSTS (with metrics):
${JSON.stringify(recentPosts, null, 2)}

COMPETITOR / LISTENING SIGNALS:
${JSON.stringify(competitorHits, null, 2)}

COMPETITOR HANDLES: ${COMPETITORS.map(c => c.handle).join(', ')}
${feedbackSection}${weekendNote}

Return a JSON object with exactly these 7 keys:

{
  "executiveSummary": ["bullet1", "bullet2", ...],
  "accountHealth": {
    "accounts": [
      {
        "handle": "@Figure",
        "healthGrade": "A-F (with +/- modifiers)",
        "followerTrajectory": "string",
        "engagementQuality": "string",
        "impressionTrend": "up|down|stable",
        "priorityActions": ["action1", "action2"]
      }
    ]
  },
  "topPerformers": {
    "posts": [
      {
        "account": "handle",
        "contentSummary": "string",
        "format": "string",
        "hookPattern": "string",
        "whyItWorked": "string",
        "replicableTemplate": "string",
        "estimatedBookmarkRate": "low|moderate|high"
      }
    ]
  },
  "underperformers": {
    "patterns": [
      {
        "pattern": "string",
        "severity": "critical|high|moderate",
        "algorithmPenalty": "string",
        "fix": "string",
        "exampleBad": "string",
        "exampleGood": "string"
      }
    ]
  },
  "competitorIntel": {
    "competitors": [
      {
        "handle": "string",
        "winningTactic": "string",
        "adaptableInsight": "string",
        "threatLevel": "high|moderate|low"
      }
    ],
    "nonCryptoInspiration": [
      {
        "handle": "string",
        "winningTactic": "string",
        "adaptableFor": "which of our accounts"
      }
    ]
  },
  "algorithmSignals": {
    "currentWeights": "string",
    "changesDetected": ["change1", "change2"],
    "formatRanking": ["format1_best", "format2", "format3_worst"],
    "postingRecommendations": "string"
  },
  "contentCalendar": {
    "recommendations": [
      {
        "account": "handle",
        "contentPillar": "string",
        "format": "string",
        "hookOptions": ["hook1", "hook2", "hook3"],
        "bodyOutline": "string",
        "cta": "string",
        "postingWindow": "Day HH:MM TZ",
        "expectedPerformance": "high|moderate|low",
        "complianceNotes": "string"
      }
    ]
  }
}

Generate 8-12 content calendar recommendations spread across all three accounts.`;
}

function buildCompetitorAuditPrompt({ competitors, competitorHits, previousAudit, ourAccountStats, dateRange, runMode }) {
  const previousSection = previousAudit
    ? `\n\nPREVIOUS AUDIT (for trend comparison):
${JSON.stringify(previousAudit, null, 2).slice(0, 2000)}
Note what changed since the last audit: new tactics, shifted positioning, emerging threats.`
    : '\n\nThis is the first competitor audit — establish baselines.';

  return `RUN MODE: ${runMode}
PERIOD: ${dateRange.start.slice(0, 10)} to ${dateRange.end.slice(0, 10)}

COMPETITOR ACCOUNTS TO AUDIT:
${competitors.map(c => `- ${c.handle} (${c.category}): ${c.notes}`).join('\n')}

COMPETITOR SIGNALS FROM OUR LISTENING SYSTEM:
${JSON.stringify(competitorHits, null, 2)}

OUR ACCOUNT PERFORMANCE (for benchmarking):
${JSON.stringify(ourAccountStats, null, 2)}
${previousSection}

Produce a deep-dive competitor audit. Return JSON:

{
  "auditDate": "${dateRange.end.slice(0, 10)}",
  "overallLandscape": "2-3 sentence summary of the competitive landscape this period",
  "competitors": [
    {
      "handle": "@OndoFinance",
      "category": "RWA tokenization",
      "threatLevel": "high|moderate|low",
      "narrativeTerritory": "What positioning/narrative do they own on X?",
      "contentStrategy": {
        "postingFrequency": "estimated posts per day",
        "primaryFormats": ["format1", "format2"],
        "toneAndVoice": "description of their brand voice on X",
        "topTacticThisPeriod": "Most effective specific tactic with detail"
      },
      "topPerformingContent": [
        {
          "description": "What the post was about",
          "format": "thread|single|video|image|poll",
          "hookUsed": "The specific hook pattern",
          "whyItWorked": "Algorithm + audience analysis",
          "estimatedEngagement": "high|moderate|low relative to their baseline"
        }
      ],
      "weaknesses": ["weakness1", "weakness2"],
      "stealableIdeas": [
        {
          "idea": "Specific tactic to adapt",
          "adaptFor": "@Figure or @provenancefdn or @HastraFi",
          "howToAdapt": "Exact instructions for our team",
          "expectedImpact": "high|moderate|low"
        }
      ],
      "vsOurAccounts": "How they compare to us — where they're ahead, where we're ahead",
      "trendSinceLastAudit": "new|unchanged|declining — what shifted"
    }
  ],
  "emergingThreats": [
    {
      "threat": "description",
      "source": "which competitor or trend",
      "recommendedResponse": "what we should do"
    }
  ],
  "narrativeGaps": [
    {
      "gap": "A narrative territory no competitor fully owns yet",
      "opportunity": "How Figure/Provenance/Hastra could claim it",
      "urgency": "high|moderate|low"
    }
  ],
  "tacticsTrending": [
    {
      "tactic": "description",
      "usedBy": ["@handle1", "@handle2"],
      "shouldWeAdopt": true,
      "adaptationNotes": "How to adapt for our accounts"
    }
  ]
}

Be specific and actionable. Every insight must be detailed enough for our content team to execute on immediately.`;
}

function buildContextPrompt(reportContent, auditContent) {
  return `Based on this X analyst report AND competitor audit, generate a compact co-creator context injection block.

REPORT DATA:
${JSON.stringify(reportContent, null, 2)}

COMPETITOR AUDIT:
${JSON.stringify(auditContent, null, 2)}

The context block must include:
1. Current algorithm rules of thumb (engagement weights, format rankings)
2. This period's winning patterns with specific examples
3. Brand voice guardrails per account (@Figure = institutional authority, @provenancefdn = builder-focused, @HastraFi = DeFi-native accessible)
4. Compliance red lines (Figure has SEC-registered products — never imply guaranteed returns, no HASH price predictions)
5. Format preferences ranked by current performance
6. Posting cadence recommendations
7. KEY COMPETITOR MOVES this period — what to counter or adapt (2-3 bullet points)
8. Narrative gaps we should exploit

Return JSON: { "context": "the full text block as a single string", "generatedAt": "ISO date" }

CRITICAL: The "context" field must be under 1800 characters total.`;
}
