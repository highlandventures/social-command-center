import { generateInsight, AI_PREAMBLE } from '../ai';

/**
 * Generate an A-F score for a KOL based on their activations and performance metrics.
 *
 * Scoring factors:
 * - Activation frequency: How often the KOL creates brand-related content
 * - Engagement quality: Engagement rates on brand content vs. baseline
 * - Follower correlation: Whether KOL activations correlate with our follower growth
 * - Cost efficiency: Cost per engagement and cost per impression
 *
 * @param {object} kol - KOL profile data from the KOL model
 * @param {Array} activations - KOL activation records from KOLActivation model
 * @param {object} metrics - KOL performance metrics from KOLMetrics model
 * @returns {{
 *   score: 'A'|'B'|'C'|'D'|'F',
 *   numericScore: number,
 *   rationale: string,
 *   recommendations: string[],
 *   factors: {
 *     activationFrequency: { score: number, detail: string },
 *     engagementQuality: { score: number, detail: string },
 *     followerCorrelation: { score: number, detail: string },
 *     costEfficiency: { score: number, detail: string }
 *   }
 * }}
 */
export async function scoreKOL(kol, activations, metrics) {
  const systemPrompt = `${AI_PREAMBLE}
Score this KOL (A-F) on four factors: activationFrequency, engagementQuality, followerCorrelation, costEfficiency.
A=90-100 exceptional, B=75-89 strong, C=60-74 average, D=40-59 below avg, F=0-39 poor.
Schema: {"score":"A-F","numericScore":number,"rationale":"string","recommendations":["string"],"factors":{"activationFrequency":{"score":number,"detail":"string"},"engagementQuality":{"score":number,"detail":"string"},"followerCorrelation":{"score":number,"detail":"string"},"costEfficiency":{"score":number,"detail":"string"}}}`;

  try {
    const context = {
      task: 'Score this KOL on a A-F scale with factor breakdown',
      kol: {
        name: kol.name,
        platform: kol.platform,
        username: kol.username,
        relationshipType: kol.relationshipType,
        compensationMonthly: kol.compensationMonthly,
        baselineFollowers: kol.baselineFollowers,
        baselineEngRate: kol.baselineEngRate,
        active: kol.active,
        createdAt: kol.createdAt,
        bio: kol.bio || null,
        location: kol.location || null,
        verified: kol.verified || false,
        followingCount: kol.followingCount || null,
        accountCreatedAt: kol.accountCreatedAt || null,
      },
      activations: activations?.map((a) => ({
        activationType: a.activationType,
        platform: a.platform,
        content: a.content?.substring(0, 300),
        detectedAt: a.detectedAt,
        detectionMethod: a.detectionMethod,
        metricsAtDetection: a.metricsAtDetection,
        metricsAt24h: a.metricsAt24h,
        metricsAt48h: a.metricsAt48h,
        metricsAt7d: a.metricsAt7d,
      })),
      metrics: metrics
        ? {
            followers: metrics.followers,
            engagementRateBrand: metrics.engagementRateBrand,
            engagementRateBaseline: metrics.engagementRateBaseline,
            activationsCount: metrics.activationsCount,
            totalImpressionsEst: metrics.totalImpressionsEst,
            avgEngagementPerActivation: metrics.avgEngagementPerActivation,
            sentimentPositivePct: metrics.sentimentPositivePct,
            followerGrowthCorrelation: metrics.followerGrowthCorrelation,
            costPerEngagement: metrics.costPerEngagement,
          }
        : null,
    };

    return await generateInsight('kol-scoring/score', context, {
      systemPrompt,
      maxTokens: 2048,
    });
  } catch (error) {
    console.error('Failed to score KOL:', error);
    return {
      score: 'C',
      numericScore: 50,
      rationale: 'Scoring unavailable due to an error. Defaulting to C.',
      recommendations: ['Retry scoring when the AI service is available.'],
      factors: {
        activationFrequency: { score: 50, detail: 'Unable to evaluate.' },
        engagementQuality: { score: 50, detail: 'Unable to evaluate.' },
        followerCorrelation: { score: 50, detail: 'Unable to evaluate.' },
        costEfficiency: { score: 50, detail: 'Unable to evaluate.' },
      },
    };
  }
}
