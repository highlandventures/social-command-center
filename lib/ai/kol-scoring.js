import { generateInsight } from '../ai';

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
  const systemPrompt = `You are a KOL (Key Opinion Leader) scoring engine for a social media management platform.
Evaluate the KOL's performance and assign a letter grade (A-F) based on four key factors:

1. Activation Frequency — How consistently does this KOL create brand-related content? Consider total activations, recency, and regularity.
2. Engagement Quality — How well does the KOL's brand content perform vs. their baseline engagement rate? Are engagements meaningful (comments, shares) vs. passive (likes)?
3. Follower Correlation — Is there evidence that the KOL's activations correlate with our follower growth or brand metric improvements?
4. Cost Efficiency — For paid partners, how does the cost per engagement and cost per impression compare to benchmarks? For organic advocates, how much value do they provide without compensation?

Scoring guide:
- A (90-100): Exceptional performer, clear ROI, highly recommend increasing investment
- B (75-89): Strong performer, good ROI, maintain or slightly increase investment
- C (60-74): Average performer, acceptable ROI, monitor closely
- D (40-59): Below average, questionable ROI, consider restructuring the relationship
- F (0-39): Poor performer, negative or no ROI, recommend disengaging

Always respond with valid JSON matching this exact schema:
{
  "score": "A" | "B" | "C" | "D" | "F",
  "numericScore": number between 0 and 100,
  "rationale": "string - 2-3 sentence overall assessment",
  "recommendations": ["string - specific actionable recommendation"],
  "factors": {
    "activationFrequency": { "score": number between 0 and 100, "detail": "string explaining the sub-score" },
    "engagementQuality": { "score": number between 0 and 100, "detail": "string explaining the sub-score" },
    "followerCorrelation": { "score": number between 0 and 100, "detail": "string explaining the sub-score" },
    "costEfficiency": { "score": number between 0 and 100, "detail": "string explaining the sub-score" }
  }
}`;

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
