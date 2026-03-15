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

const ENRICHED_REPORT_PROMPT = `You are a social media analyst. Analyze the provided KPI data, top posts, and listening insights. Respond with valid JSON matching this schema:
{
  "executiveSummary": "2-3 paragraph summary covering: what happened this period, what is notable, and what to do next",
  "sentimentThemes": {
    "positive": [{ "theme": "string", "detail": "string", "volume": number }],
    "negative": [{ "theme": "string", "detail": "string", "volume": number }],
    "emerging": [{ "topic": "string", "signals": "string" }]
  },
  "recommendations": [{ "recommendation": "string", "priority": "HIGH|MEDIUM|LOW", "expectedImpact": "string" }],
  "topContent": [{ "title": "string", "engagementRate": number, "impressions": number, "whyItWorked": "string" }]
}
Focus on actionable insights. Keep sentimentThemes arrays to 3-5 items max each.`;

// -------------------------------------------------------
// KPI Calculation
// -------------------------------------------------------

/**
 * Calculate 5 topline KPIs from posts, account metrics, and listening hits.
 *
 * @param {Array} posts - Posts with nested metrics[0]
 * @param {Array} accountMetrics - AccountMetrics records sorted by date
 * @param {Array} listeningHits - ListeningHit records with sentiment
 * @returns {Array<{ label, value, format, subValue? }>}
 */
export function calculateKPIs(posts, accountMetrics, listeningHits) {
  const postsWithMetrics = posts.filter((p) => p.metrics?.[0]);

  // Impressions
  const totalImpressions = postsWithMetrics.reduce(
    (sum, p) => sum + (p.metrics[0]?.impressions || 0),
    0
  );

  // Average Engagement Rate
  const avgEngRate =
    postsWithMetrics.length > 0
      ? postsWithMetrics.reduce((sum, p) => sum + (p.metrics[0]?.engagementRate || 0), 0) /
        postsWithMetrics.length
      : 0;

  // Follower Growth (delta between earliest and latest AccountMetrics)
  const sortedAM = [...accountMetrics].sort((a, b) => new Date(a.date) - new Date(b.date));
  const followerDelta =
    sortedAM.length >= 2
      ? (sortedAM[sortedAM.length - 1].followers || 0) - (sortedAM[0].followers || 0)
      : 0;

  // Top Post by engagement rate
  const sortedByEng = [...postsWithMetrics].sort(
    (a, b) => (b.metrics[0]?.engagementRate || 0) - (a.metrics[0]?.engagementRate || 0)
  );
  const topPost = sortedByEng[0] || null;

  // Sentiment score (% positive of total listening hits)
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

  return [
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
  ];
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
function buildAIContext(kpis, posts, listeningHits) {
  // Sort posts by engagement rate, take top 5
  const postsWithMetrics = posts.filter((p) => p.metrics?.[0]);
  const topPosts = [...postsWithMetrics]
    .sort((a, b) => (b.metrics[0]?.engagementRate || 0) - (a.metrics[0]?.engagementRate || 0))
    .slice(0, 5)
    .map((p) => ({
      content: p.content?.substring(0, 200),
      contentType: p.contentType,
      platform: p.platform,
      engagementRate: p.metrics[0]?.engagementRate,
      impressions: p.metrics[0]?.impressions,
    }));

  // Aggregate listening hit sentiment counts
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  listeningHits.forEach((h) => {
    const key = h.sentiment?.toLowerCase();
    if (key && sentimentCounts[key] !== undefined) {
      sentimentCounts[key]++;
    }
  });

  // Take limited listening hits for theme extraction (top 20 by engagement)
  const topHits = [...listeningHits]
    .sort((a, b) => (b.engagementCount || 0) - (a.engagementCount || 0))
    .slice(0, 20)
    .map((h) => ({
      content: h.content?.substring(0, 200),
      sentiment: h.sentiment,
      platform: h.platform,
    }));

  const context = {
    kpiSummary: kpis,
    topPosts,
    sentimentCounts,
    listeningHits: topHits,
    totalListeningHits: listeningHits.length,
  };

  // Guard: if context is too large, reduce further
  const contextStr = JSON.stringify(context);
  if (contextStr.length > 50000) {
    context.topPosts = context.topPosts.slice(0, 3);
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
  // 1. Fetch data for the coverage period
  const [posts, accountMetrics, listeningHits] = await Promise.all([
    prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: dateStart, lte: dateEnd },
      },
      include: { metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 } },
    }),
    prisma.accountMetrics.findMany({
      where: { date: { gte: dateStart, lte: dateEnd } },
      orderBy: { date: 'asc' },
    }),
    prisma.listeningHit.findMany({
      where: { detectedAt: { gte: dateStart, lte: dateEnd } },
    }),
  ]);

  // 2. Calculate KPIs
  const kpis = calculateKPIs(posts, accountMetrics, listeningHits);

  // 3. Calculate deltas if benchmark period provided
  if (benchmarkPeriod) {
    const [prevPosts, prevAccountMetrics, prevListeningHits] = await Promise.all([
      prisma.post.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: benchmarkPeriod.start, lte: benchmarkPeriod.end },
        },
        include: { metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 } },
      }),
      prisma.accountMetrics.findMany({
        where: { date: { gte: benchmarkPeriod.start, lte: benchmarkPeriod.end } },
        orderBy: { date: 'asc' },
      }),
      prisma.listeningHit.findMany({
        where: { detectedAt: { gte: benchmarkPeriod.start, lte: benchmarkPeriod.end } },
      }),
    ]);

    const prevKpis = calculateKPIs(prevPosts, prevAccountMetrics, prevListeningHits);

    // Merge deltas into KPIs (only for numeric KPIs)
    for (let i = 0; i < kpis.length; i++) {
      if (kpis[i].format === 'number' || kpis[i].format === 'percent' || kpis[i].format === 'delta') {
        const delta = calculateDelta(
          typeof kpis[i].value === 'number' ? kpis[i].value : 0,
          typeof prevKpis[i].value === 'number' ? prevKpis[i].value : 0
        );
        kpis[i].delta = delta.value;
        kpis[i].direction = delta.direction;
        kpis[i].period = reportType === 'WEEKLY_PERFORMANCE' ? 'WoW' : 'MoM';
      }
    }
  }

  // 4. Generate AI executive summary with pre-aggregated context
  const aiContext = buildAIContext(kpis, posts, listeningHits);
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

  // 6. Assemble canonical content
  const content = {
    kpis,
    executiveSummary: aiContent?.executiveSummary || 'Report generation completed.',
    sentimentThemes: aiContent?.sentimentThemes || null,
    charts,
    recommendations: aiContent?.recommendations || [],
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

  // 7. Validate
  validateReportContent(content);

  return content;
}
