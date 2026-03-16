import { generateInsight, AI_PREAMBLE } from '../ai';

/**
 * Generate a structured weekly social media performance report.
 *
 * @param {object} data - { posts, metrics, mentions, listeningHits, period }
 * @returns {{ executiveSummary: string, keyMetrics: object, topContent: Array, audienceInsights: Array, recommendations: Array, outlook: string }}
 */
export async function generateWeeklyReport(data) {
  const systemPrompt = `${AI_PREAMBLE}
Generate a weekly performance report.
Schema: {"executiveSummary":"string","keyMetrics":{"totalImpressions":number,"totalEngagements":number,"avgEngagementRate":number,"followerGrowth":number,"topPlatform":"X|REDDIT","weekOverWeekChange":"string"},"topContent":[{"postId":"string","title":"string","impressions":number,"engagementRate":number,"whyItWorked":"string"}],"audienceInsights":[{"insight":"string","evidence":"string","actionability":"HIGH|MEDIUM|LOW"}],"recommendations":[{"recommendation":"string","priority":"HIGH|MEDIUM|LOW","expectedImpact":"string","effort":"LOW|MEDIUM|HIGH"}],"outlook":"string"}`;

  try {
    const context = {
      task: 'Generate a weekly social media performance report',
      period: data.period,
      posts: data.posts?.map((p) => ({
        id: p.id,
        content: p.content?.substring(0, 300),
        contentType: p.contentType,
        platform: p.platform,
        publishedAt: p.publishedAt,
        engagementRate: p.metrics?.engagementRate,
        impressions: p.metrics?.impressions,
        engagements: p.metrics?.engagements,
      })),
      accountMetrics: data.metrics,
      mentions: data.mentions?.map((m) => ({
        content: m.content?.substring(0, 200),
        mentionType: m.mentionType,
        platform: m.platform,
        sentiment: m.sentiment,
      })),
      listeningHits: data.listeningHits?.map((h) => ({
        content: h.content?.substring(0, 200),
        sentiment: h.sentiment,
        engagementCount: h.engagementCount,
        platform: h.platform,
      })),
    };

    return await generateInsight('reports/weekly', context, {
      systemPrompt,
      maxTokens: 3000,
    });
  } catch (error) {
    console.error('Failed to generate weekly report:', error);
    return {
      executiveSummary: 'Report generation failed. Please try again.',
      keyMetrics: {},
      topContent: [],
      audienceInsights: [],
      recommendations: [],
      outlook: 'Unable to generate outlook.',
    };
  }
}

/**
 * Generate a competitive intelligence analysis report.
 *
 * @param {object} ourData - Our account metrics and post data
 * @param {object} competitorData - Competitor metrics and activity data
 * @returns {{ overview: string, strengths: Array, threats: Array, opportunities: Array, shareOfVoice: object, recommendations: Array }}
 */
export async function generateCompetitiveAnalysis(ourData, competitorData) {
  const systemPrompt = `${AI_PREAMBLE}
Generate a competitive analysis report.
Schema: {"overview":"string","strengths":[{"area":"string","detail":"string","evidence":"string"}],"threats":[{"competitor":"string","threat":"string","severity":"HIGH|MEDIUM|LOW","detail":"string"}],"opportunities":[{"opportunity":"string","rationale":"string","effort":"LOW|MEDIUM|HIGH","potentialImpact":"string"}],"shareOfVoice":{"ourShare":number,"competitors":[{"name":"string","share":number}],"trend":"string"},"recommendations":[{"recommendation":"string","priority":"HIGH|MEDIUM|LOW","timeframe":"string"}]}`;

  try {
    const context = {
      task: 'Generate competitive intelligence analysis',
      ourPerformance: {
        followers: ourData.followers,
        engagementRate: ourData.engagementRate,
        postsCount: ourData.postsCount,
        mentionCount: ourData.mentionCount,
        sentimentBreakdown: ourData.sentimentBreakdown,
        topContent: ourData.topContent?.map((p) => ({
          content: p.content?.substring(0, 200),
          engagementRate: p.engagementRate,
        })),
      },
      competitors: competitorData?.map((c) => ({
        name: c.name,
        followersX: c.metrics?.followersX,
        followersReddit: c.metrics?.followersReddit,
        postsCount: c.metrics?.postsCount,
        avgEngagementRate: c.metrics?.avgEngagementRate,
        mentionCount: c.metrics?.mentionCount,
        sentimentPositivePct: c.metrics?.sentimentPositivePct,
        shareOfVoicePct: c.metrics?.shareOfVoicePct,
      })),
    };

    return await generateInsight('reports/competitive-analysis', context, {
      systemPrompt,
      maxTokens: 3000,
    });
  } catch (error) {
    console.error('Failed to generate competitive analysis:', error);
    return {
      overview: 'Competitive analysis generation failed. Please try again.',
      strengths: [],
      threats: [],
      opportunities: [],
      shareOfVoice: { ourShare: 0, competitors: [], trend: 'Unknown' },
      recommendations: [],
    };
  }
}

/**
 * Generate a KOL (Key Opinion Leader) scorecard with A-F grade and rationale.
 *
 * @param {object} kol - KOL profile data
 * @param {Array} activations - KOL activation records
 * @param {object} metrics - KOL performance metrics
 * @returns {{ score: string, rationale: string, highlights: Array, concerns: Array, recommendations: Array, costEfficiency: object }}
 */
export async function generateKOLScorecard(kol, activations, metrics) {
  const systemPrompt = `${AI_PREAMBLE}
Generate a KOL performance scorecard (A-F grade).
Schema: {"score":"A-F","rationale":"string","highlights":[{"highlight":"string","impact":"string"}],"concerns":[{"concern":"string","severity":"HIGH|MEDIUM|LOW","suggestion":"string"}],"recommendations":[{"recommendation":"string","priority":"HIGH|MEDIUM|LOW","expectedOutcome":"string"}],"costEfficiency":{"costPerEngagement":number|null,"costPerImpression":number|null,"rating":"EXCELLENT|GOOD|FAIR|POOR","benchmarkComparison":"string"}}`;

  try {
    const context = {
      task: 'Generate a KOL performance scorecard',
      kol: {
        name: kol.name,
        platform: kol.platform,
        username: kol.username,
        relationshipType: kol.relationshipType,
        compensationMonthly: kol.compensationMonthly,
        baselineFollowers: kol.baselineFollowers,
        baselineEngRate: kol.baselineEngRate,
      },
      activations: activations?.map((a) => ({
        activationType: a.activationType,
        content: a.content?.substring(0, 300),
        detectedAt: a.detectedAt,
        metricsAtDetection: a.metricsAtDetection,
        metricsAt24h: a.metricsAt24h,
        metricsAt7d: a.metricsAt7d,
      })),
      metrics: {
        followers: metrics?.followers,
        engagementRateBrand: metrics?.engagementRateBrand,
        engagementRateBaseline: metrics?.engagementRateBaseline,
        activationsCount: metrics?.activationsCount,
        totalImpressionsEst: metrics?.totalImpressionsEst,
        avgEngagementPerActivation: metrics?.avgEngagementPerActivation,
        sentimentPositivePct: metrics?.sentimentPositivePct,
        followerGrowthCorrelation: metrics?.followerGrowthCorrelation,
        costPerEngagement: metrics?.costPerEngagement,
      },
    };

    return await generateInsight('reports/kol-scorecard', context, {
      systemPrompt,
      maxTokens: 2048,
    });
  } catch (error) {
    console.error('Failed to generate KOL scorecard:', error);
    return {
      score: 'C',
      rationale: 'Scorecard generation failed. Please try again.',
      highlights: [],
      concerns: [],
      recommendations: [],
      costEfficiency: {
        costPerEngagement: null,
        costPerImpression: null,
        rating: 'FAIR',
        benchmarkComparison: 'Unable to compute.',
      },
    };
  }
}

/**
 * Generate a weekly social listening landscape summary.
 *
 * @param {Array} hits - Recent listening hits
 * @param {Array} topics - Active listening topics
 * @returns {{ topThemes: Array, sentimentOverview: object, emergingTopics: Array, actionableInsights: Array, competitorActivity: Array }}
 */
export async function generateListeningSummary(hits, topics) {
  const systemPrompt = `${AI_PREAMBLE}
Generate a social listening landscape summary.
Schema: {"topThemes":[{"theme":"string","volume":number,"sentiment":"POSITIVE|NEGATIVE|NEUTRAL|MIXED","trend":"RISING|STABLE|DECLINING"}],"sentimentOverview":{"positivePct":number,"neutralPct":number,"negativePct":number,"overallTrend":"IMPROVING|STABLE|DECLINING","summary":"string"},"emergingTopics":[{"topic":"string","signals":"string","potentialImpact":"HIGH|MEDIUM|LOW","recommendedAction":"string"}],"actionableInsights":[{"insight":"string","urgency":"HIGH|MEDIUM|LOW","suggestedAction":"string","relatedHits":number}],"competitorActivity":[{"competitor":"string","activity":"string","sentiment":"POSITIVE|NEGATIVE|NEUTRAL","implication":"string"}]}`;

  try {
    const context = {
      task: 'Generate a weekly social listening landscape summary',
      totalHits: hits.length,
      topics: topics?.map((t) => ({
        name: t.name,
        description: t.description,
      })),
      hits: hits?.map((h) => ({
        content: h.content?.substring(0, 300),
        platform: h.platform,
        sentiment: h.sentiment,
        engagementCount: h.engagementCount,
        heuristicScore: h.heuristicScore,
        aiRelevance: h.aiRelevance,
        isActionable: h.isActionable,
        subreddit: h.subreddit,
        authorFollowers: h.authorFollowersOrKarma,
        detectedAt: h.detectedAt,
      })),
    };

    return await generateInsight('reports/listening-summary', context, {
      systemPrompt,
      maxTokens: 3000,
    });
  } catch (error) {
    console.error('Failed to generate listening summary:', error);
    return {
      topThemes: [],
      sentimentOverview: {
        positivePct: 0,
        neutralPct: 0,
        negativePct: 0,
        overallTrend: 'STABLE',
        summary: 'Summary generation failed. Please try again.',
      },
      emergingTopics: [],
      actionableInsights: [],
      competitorActivity: [],
    };
  }
}

/**
 * Generate an enriched executive summary with sentiment themes and recommendations.
 * Used by the report engine for new enriched report format.
 *
 * @param {object} aggregatedContext - Pre-aggregated context from report engine
 * @returns {Promise<{ executiveSummary: string, sentimentThemes: object, recommendations: Array, topContent: Array }>}
 */
export async function generateEnrichedSummary(aggregatedContext) {
  const systemPrompt = `${AI_PREAMBLE}
Analyze the provided social media performance data and respond with valid JSON matching this schema:
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

  try {
    return await generateInsight('reports/enriched', aggregatedContext, {
      systemPrompt,
      maxTokens: 3000,
    });
  } catch (error) {
    console.error('Failed to generate enriched summary:', error);
    return {
      executiveSummary: 'Enriched summary generation failed. Please try again.',
      sentimentThemes: null,
      recommendations: [],
      topContent: [],
    };
  }
}
