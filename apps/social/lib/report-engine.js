import { prisma } from './db';
import { generateInsight } from './ai';
import {
  renderCharts,
  buildEngagementTrendSpec,
  buildContentTypeSpec,
  buildSentimentDistSpec,
} from './chart-renderer';
import { validateReportContent, EMPTY_REPORT_CONTENT } from './report-content-schema';

// -------------------------------------------------------
// Enriched report system prompt
// -------------------------------------------------------

const ENRICHED_REPORT_PROMPT = `You are a social media analyst for Figure Technology Solutions (Nasdaq: FIGR), a blockchain-native capital marketplace. Analyze the provided channel-segmented KPI data, top posts, and listening insights. Respond with valid JSON matching this schema:
{
  "executiveSummary": ["bullet1 with specific number", "bullet2", "bullet3", "bullet4"],
  "channelPerformance": {
    "owned": { "impressions": number, "engagementRate": number, "deltaWoW": number|null, "topPost": "string", "narrative": "1-2 sentence so-what" },
    "partner": { "impressions": number, "engagementRate": number, "deltaWoW": number|null, "topPost": "string", "narrative": "1-2 sentence so-what" },
    "external": { "impressions": number, "engagementRate": number, "deltaWoW": number|null, "narrative": "1-2 sentence so-what" }
  },
  "sentimentDeepDives": [{ "thread": "string", "sentiment": "POSITIVE|NEGATIVE|MIXED", "keyTakeaways": ["string"], "source": "string" }],
  "opportunities": [{ "opportunity": "string", "priority": "HIGH|MEDIUM|LOW", "expectedImpact": "string" }],
  "topContent": [{ "title": "string", "engagementRate": number, "impressions": number, "whyItWorked": "string" }]
}

STYLE RULES:
- Executive summary: 3-5 bullet points. Each bullet = one key insight with a specific metric. Never paragraphs.
- Frame recommendations as "Opportunities" — forward-looking, not corrective.
- When owned channel impressions decline WoW, frame as partner-first strategy working (impressions shifting to Hastra/external is intentional).
- For WoW swings >50%, add contextual note (e.g., "prior week included viral @FabianoSolana RT").
- Channel narratives: explain the story, not just the numbers.
- sentimentDeepDives: extract specific criticisms or praise from notable threads. Max 2-3 threads.
- $YLDS is an SEC-registered yield-bearing stablecoin, never a "cryptocurrency".
- OPEN = On-Chain Public Equity Network (all caps). Democratized Prime (capitalize both).
Focus on actionable insights for a leadership audience.`;

// -------------------------------------------------------
// KPI Calculation
// -------------------------------------------------------

/**
 * Segment posts by channel type based on the account's accountType field.
 * Owned = Figure's own accounts, Partner = Hastra and partner accounts,
 * External = KOL mentions and earned media.
 */
function segmentPostsByChannel(posts) {
  const owned = [];
  const partner = [];
  const external = [];

  for (const p of posts) {
    const type = p.account?.accountType || p.accountType;
    if (type === 'PARTNER') partner.push(p);
    else if (type === 'EXTERNAL' || type === 'KOL') external.push(p);
    else owned.push(p); // default to owned
  }

  return { owned, partner, external };
}

/**
 * Calculate impressions and engagement rate for a set of posts.
 */
function calcChannelMetrics(posts) {
  const withMetrics = posts.filter((p) => p.metrics?.[0]);
  const impressions = withMetrics.reduce((sum, p) => sum + (p.metrics[0]?.impressions || 0), 0);
  const engRate =
    withMetrics.length > 0
      ? withMetrics.reduce((sum, p) => sum + (p.metrics[0]?.engagementRate || 0), 0) /
        withMetrics.length
      : 0;

  // Top post by engagement rate
  const sorted = [...withMetrics].sort(
    (a, b) => (b.metrics[0]?.engagementRate || 0) - (a.metrics[0]?.engagementRate || 0)
  );
  const topPost = sorted[0] || null;

  return {
    impressions,
    engagementRate: parseFloat(engRate.toFixed(2)),
    postCount: posts.length,
    topPost: topPost?.content?.substring(0, 80) || 'N/A',
    topPostEngRate: topPost ? topPost.metrics[0]?.engagementRate : null,
  };
}

/**
 * Calculate channel-segmented KPIs from posts, account metrics, and listening hits.
 *
 * Returns both the flat topline KPIs (for backward compat) and a channelBreakdown
 * object with owned/partner/external metrics.
 *
 * @param {Array} posts - Posts with nested metrics[0] and account info
 * @param {Array} accountMetrics - AccountMetrics records sorted by date
 * @param {Array} listeningHits - ListeningHit records with sentiment
 * @returns {{ kpis: Array<{ label, value, format, subValue? }>, channelBreakdown: object }}
 */
export function calculateKPIs(posts, accountMetrics, listeningHits) {
  const postsWithMetrics = posts.filter((p) => p.metrics?.[0]);

  // --- Channel Segmentation ---
  const channels = segmentPostsByChannel(posts);
  const ownedMetrics = calcChannelMetrics(channels.owned);
  const partnerMetrics = calcChannelMetrics(channels.partner);
  const externalMetrics = calcChannelMetrics(channels.external);

  // --- Aggregate Impressions ---
  const totalImpressions = ownedMetrics.impressions + partnerMetrics.impressions + externalMetrics.impressions;

  // --- Aggregate Engagement Rate (impression-weighted) ---
  // Phase 17-03 fix: previously a simple mean of per-post rates, which gave
  // a zero-impression post equal weight to a 10K-impression post. Now we
  // use sum(engagements) / sum(impressions) * 100 — the only honest aggregate.
  const totalEngagements = postsWithMetrics.reduce(
    (sum, p) => sum + (p.metrics[0]?.engagements || 0),
    0,
  );
  const avgEngRate =
    totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;

  // --- Follower Growth (sum of per-account deltas) ---
  const byAccount = {};
  for (const am of accountMetrics) {
    const aid = am.accountId;
    if (!byAccount[aid]) byAccount[aid] = [];
    byAccount[aid].push(am);
  }
  let followerDelta = 0;
  for (const records of Object.values(byAccount)) {
    const sorted = records.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sorted.length >= 2) {
      followerDelta += (sorted[sorted.length - 1].followers || 0) - (sorted[0].followers || 0);
    }
  }

  // --- Top Post by engagement rate (across all channels) ---
  const sortedByEng = [...postsWithMetrics].sort(
    (a, b) => (b.metrics[0]?.engagementRate || 0) - (a.metrics[0]?.engagementRate || 0)
  );
  const topPost = sortedByEng[0] || null;

  // --- Sentiment score ---
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  listeningHits.forEach((h) => {
    const key = h.sentiment?.toLowerCase();
    if (key && sentimentCounts[key] !== undefined) {
      sentimentCounts[key]++;
    }
  });
  const totalSentiment = Object.values(sentimentCounts).reduce((a, b) => a + b, 0);
  const sentimentScore =
    totalSentiment > 0 ? Math.round((sentimentCounts.positive / totalSentiment) * 100) : null;

  // --- Profile Visits (from account metrics, if available) ---
  const profileVisits = accountMetrics.reduce(
    (sum, am) => sum + (am.profileVisits || 0),
    0
  );

  const kpis = [
    { label: 'Impressions', value: totalImpressions, format: 'number' },
    { label: 'Engagement Rate', value: parseFloat(avgEngRate.toFixed(2)), format: 'percent' },
    { label: 'Follower Growth', value: followerDelta, format: 'delta' },
    {
      label: 'Top Post',
      value: topPost?.content?.substring(0, 80) || 'N/A',
      format: 'text',
      subValue: topPost ? `${topPost.metrics[0]?.engagementRate?.toFixed(1)}% eng` : null,
    },
    { label: 'Sentiment', value: sentimentScore, format: 'percent' },
    { label: 'Profile Visits', value: profileVisits, format: 'number' },
  ];

  const channelBreakdown = {
    owned: ownedMetrics,
    partner: partnerMetrics,
    external: externalMetrics,
  };

  return { kpis, channelBreakdown };
}

// -------------------------------------------------------
// Delta Calculation
// -------------------------------------------------------

/**
 * Compute the percentage change between current and previous values.
 * Returns { value, direction } where direction is 'up' | 'down' | 'flat'.
 * Changes within 1% are considered 'flat'.
 *
 * @param {number} current
 * @param {number|null} previous
 * @returns {{ value: number|null, direction: 'up'|'down'|'flat' }}
 */
export function calculateDelta(current, previous) {
  if (previous === 0 || previous == null) {
    return { value: null, direction: 'flat' };
  }
  const pctChange = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = parseFloat(pctChange.toFixed(1));
  return {
    value: rounded,
    direction: pctChange > 1 ? 'up' : pctChange < -1 ? 'down' : 'flat',
  };
}

// -------------------------------------------------------
// Previous Period
// -------------------------------------------------------

/**
 * Compute the equivalent prior period by subtracting the duration.
 *
 * @param {Date} dateStart
 * @param {Date} dateEnd
 * @returns {{ start: Date, end: Date }}
 */
export function getPreviousPeriod(dateStart, dateEnd) {
  const duration = dateEnd.getTime() - dateStart.getTime();
  return {
    start: new Date(dateStart.getTime() - duration),
    end: new Date(dateStart.getTime()),
  };
}

// -------------------------------------------------------
// AI Context Builder
// -------------------------------------------------------

/**
 * Build a pre-aggregated context object for the AI prompt.
 * Limits data to prevent token bloat: top 5 posts, summarized metrics,
 * bounded listening hits, and content strings truncated to 200 chars.
 */
function buildAIContext(kpis, channelBreakdown, posts, listeningHits) {
  // Channel-segmented top posts (top 3 per channel)
  const channels = segmentPostsByChannel(posts);

  function topPostsForChannel(channelPosts, limit = 3) {
    return channelPosts
      .filter((p) => p.metrics?.[0])
      .sort((a, b) => (b.metrics[0]?.engagementRate || 0) - (a.metrics[0]?.engagementRate || 0))
      .slice(0, limit)
      .map((p) => ({
        content: p.content?.substring(0, 200),
        contentType: p.contentType,
        platform: p.platform,
        engagementRate: p.metrics[0]?.engagementRate,
        impressions: p.metrics[0]?.impressions,
      }));
  }

  // Aggregate listening hit sentiment counts
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  listeningHits.forEach((h) => {
    const key = h.sentiment?.toLowerCase();
    if (key && sentimentCounts[key] !== undefined) {
      sentimentCounts[key]++;
    }
  });

  // Take top 20 listening hits for theme extraction, include thread context
  const topHits = [...listeningHits]
    .sort((a, b) => (b.engagementCount || 0) - (a.engagementCount || 0))
    .slice(0, 20)
    .map((h) => ({
      content: h.content?.substring(0, 200),
      sentiment: h.sentiment,
      platform: h.platform,
      threadId: h.threadId || null,
      authorHandle: h.authorHandle || null,
      engagementCount: h.engagementCount || 0,
    }));

  const context = {
    kpiSummary: kpis,
    channelBreakdown,
    topPostsByChannel: {
      owned: topPostsForChannel(channels.owned),
      partner: topPostsForChannel(channels.partner),
      external: topPostsForChannel(channels.external),
    },
    sentimentCounts,
    listeningHits: topHits,
    totalListeningHits: listeningHits.length,
  };

  // Guard: if context is too large, reduce further
  const contextStr = JSON.stringify(context);
  if (contextStr.length > 50000) {
    context.topPostsByChannel.owned = context.topPostsByChannel.owned.slice(0, 2);
    context.topPostsByChannel.partner = context.topPostsByChannel.partner.slice(0, 2);
    context.topPostsByChannel.external = context.topPostsByChannel.external.slice(0, 2);
    context.listeningHits = context.listeningHits.slice(0, 10);
  }

  return context;
}

// -------------------------------------------------------
// Chart Data Helpers
// -------------------------------------------------------

/**
 * Build daily engagement data from posts for the engagement trend chart.
 */
function buildDailyEngagementData(posts) {
  const byDate = {};
  posts.forEach((p) => {
    if (!p.metrics?.[0] || !p.publishedAt) return;
    const dateKey =
      typeof p.publishedAt === 'string'
        ? p.publishedAt.slice(0, 10)
        : p.publishedAt.toISOString().slice(0, 10);
    if (!byDate[dateKey]) byDate[dateKey] = { rates: [], count: 0 };
    byDate[dateKey].rates.push(p.metrics[0].engagementRate || 0);
    byDate[dateKey].count++;
  });

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      engagementRate: parseFloat(
        (data.rates.reduce((a, b) => a + b, 0) / data.rates.length).toFixed(2)
      ),
    }));
}

/**
 * Build content type count data for the content type chart.
 */
function buildContentTypeCounts(posts) {
  const counts = {};
  posts.forEach((p) => {
    const type = p.contentType || 'UNKNOWN';
    counts[type] = (counts[type] || 0) + 1;
  });
  return Object.entries(counts).map(([type, count]) => ({ type, count }));
}

/**
 * Build sentiment counts for the sentiment distribution chart.
 */
function buildSentimentCounts(listeningHits) {
  const counts = { positive: 0, negative: 0, neutral: 0 };
  listeningHits.forEach((h) => {
    const key = h.sentiment?.toLowerCase();
    if (key && counts[key] !== undefined) {
      counts[key]++;
    }
  });
  return counts;
}

// -------------------------------------------------------
// Main Orchestrator
// -------------------------------------------------------

/**
 * Generate a fully enriched report with KPIs, deltas, AI narrative, charts,
 * and sentiment themes.
 *
 * @param {{ reportType: string, dateStart: Date, dateEnd: Date, benchmarkPeriod?: { start: Date, end: Date }|null }} params
 * @returns {Promise<object>} Canonical enriched report content
 */
export async function generateEnrichedReport({ reportType, dateStart, dateEnd, benchmarkPeriod }) {
  // 1. Fetch data for the coverage period (include account for channel segmentation)
  const [posts, accountMetrics, listeningHits] = await Promise.all([
    prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: dateStart, lte: dateEnd },
      },
      include: {
        metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
        account: { select: { accountType: true, displayName: true } },
      },
    }),
    prisma.accountMetrics.findMany({
      where: { date: { gte: dateStart, lte: dateEnd } },
      orderBy: { date: 'asc' },
    }),
    prisma.listeningHit.findMany({
      where: { detectedAt: { gte: dateStart, lte: dateEnd } },
    }),
  ]);

  // 2. Calculate KPIs (now returns { kpis, channelBreakdown })
  const { kpis, channelBreakdown } = calculateKPIs(posts, accountMetrics, listeningHits);

  // 3. Calculate deltas if benchmark period provided (topline + per-channel)
  let prevChannelBreakdown = null;
  if (benchmarkPeriod) {
    const [prevPosts, prevAccountMetrics, prevListeningHits] = await Promise.all([
      prisma.post.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: benchmarkPeriod.start, lte: benchmarkPeriod.end },
        },
        include: {
          metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
          account: { select: { accountType: true } },
        },
      }),
      prisma.accountMetrics.findMany({
        where: { date: { gte: benchmarkPeriod.start, lte: benchmarkPeriod.end } },
        orderBy: { date: 'asc' },
      }),
      prisma.listeningHit.findMany({
        where: { detectedAt: { gte: benchmarkPeriod.start, lte: benchmarkPeriod.end } },
      }),
    ]);

    const prev = calculateKPIs(prevPosts, prevAccountMetrics, prevListeningHits);
    prevChannelBreakdown = prev.channelBreakdown;

    // Merge deltas into topline KPIs (only for numeric KPIs)
    for (let i = 0; i < kpis.length; i++) {
      if (kpis[i].format === 'number' || kpis[i].format === 'percent' || kpis[i].format === 'delta') {
        const delta = calculateDelta(
          typeof kpis[i].value === 'number' ? kpis[i].value : 0,
          typeof prev.kpis[i]?.value === 'number' ? prev.kpis[i].value : 0
        );
        kpis[i].delta = delta.value;
        kpis[i].direction = delta.direction;
        kpis[i].period = reportType === 'WEEKLY_PERFORMANCE' ? 'WoW' : 'MoM';
      }
    }

    // Merge deltas into channel breakdown
    for (const channel of ['owned', 'partner', 'external']) {
      if (channelBreakdown[channel] && prevChannelBreakdown[channel]) {
        const impDelta = calculateDelta(
          channelBreakdown[channel].impressions,
          prevChannelBreakdown[channel].impressions
        );
        channelBreakdown[channel].deltaWoW = impDelta.value;
        channelBreakdown[channel].deltaDirection = impDelta.direction;
      }
    }
  }

  // 4. Generate AI executive summary with channel-segmented context
  const aiContext = buildAIContext(kpis, channelBreakdown, posts, listeningHits);
  const aiContent = await generateInsight('reports/enriched', aiContext, {
    systemPrompt: ENRICHED_REPORT_PROMPT,
    maxTokens: 3000,
  });

  // 5. Build chart specs and render
  const dailyEngagement = buildDailyEngagementData(posts);
  const contentTypeCounts = buildContentTypeCounts(posts);
  const sentimentCounts = buildSentimentCounts(listeningHits);

  const chartSpecs = [
    buildEngagementTrendSpec(dailyEngagement),
    buildContentTypeSpec(contentTypeCounts),
    buildSentimentDistSpec(sentimentCounts),
  ];

  const chartResults = await renderCharts(chartSpecs);

  // Merge chart specs with rendered URLs
  const charts = chartSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    type: spec.config?.type || 'line',
    data: spec.config?.data || { labels: [], datasets: [] },
    imageUrl: chartResults[i]?.imageUrl || null,
  }));

  // 6. Assemble canonical content (new format with channel segmentation)
  const content = {
    kpis,
    channelBreakdown,
    executiveSummary: aiContent?.executiveSummary || ['Report generation completed.'],
    channelPerformance: aiContent?.channelPerformance || null,
    sentimentDeepDives: aiContent?.sentimentDeepDives || [],
    charts,
    opportunities: aiContent?.opportunities || [],
    topContent: aiContent?.topContent || [],
    coveragePeriod: {
      start: dateStart instanceof Date ? dateStart.toISOString() : String(dateStart),
      end: dateEnd instanceof Date ? dateEnd.toISOString() : String(dateEnd),
    },
    benchmarkPeriod: benchmarkPeriod
      ? {
          start: benchmarkPeriod.start instanceof Date ? benchmarkPeriod.start.toISOString() : String(benchmarkPeriod.start),
          end: benchmarkPeriod.end instanceof Date ? benchmarkPeriod.end.toISOString() : String(benchmarkPeriod.end),
        }
      : null,
  };

  // 7. Validate (warn on issues but still return partial report)
  const validation = validateReportContent(content);
  if (!validation.success) {
    console.warn('Report content validation issues:', validation.error?.issues);
  }

  return content;
}
