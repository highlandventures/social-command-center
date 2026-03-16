import { generateInsight, AI_PREAMBLE } from '../ai';

// ── Factor weights (tune these over time) ──────────────────
const WEIGHTS = {
  activationFrequency: 0.20,
  engagementQuality: 0.30,
  followerCorrelation: 0.25,
  costEfficiency: 0.25,
};

// ── Time-decay: exponential decay with 60-day half-life ─────
function timeDecayWeight(daysAgo) {
  return Math.exp(-daysAgo / 60);
}

function daysBetween(date1, date2) {
  return Math.max(0, (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
}

function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Compute a deterministic baseline score from KOL data.
 * Each factor produces a 0-100 sub-score, combined via WEIGHTS.
 */
export function computeBaselineScore(kol, activations, metrics) {
  const now = new Date();

  // ── Factor 1: Activation Frequency (time-weighted) ────────
  let activationScore = 0;
  if (activations?.length > 0) {
    const monthsActive = Math.max(1, daysBetween(new Date(kol.createdAt), now) / 30);
    // Time-weighted activation count: recent activations matter more
    const weightedCount = activations.reduce((sum, a) => {
      const daysAgo = daysBetween(new Date(a.detectedAt), now);
      return sum + timeDecayWeight(daysAgo);
    }, 0);
    const weightedPerMonth = weightedCount / monthsActive;
    // 4+/month = 100, scales linearly
    activationScore = Math.min(100, weightedPerMonth * 25);
  }

  // ── Factor 2: Engagement Quality ──────────────────────────
  let engagementScore = 50; // neutral default
  const brandEng = metrics?.engagementRateBrand || 0;
  const baselineEng = metrics?.engagementRateBaseline || kol.baselineEngRate || 0;
  if (brandEng > 0 && baselineEng > 0) {
    const multiplier = brandEng / baselineEng;
    // 2x baseline = 100, 1x = 50, 0.5x = 25
    engagementScore = Math.min(100, Math.max(0, multiplier * 50));
  } else if (brandEng > 0) {
    // No baseline comparison — score based on absolute engagement
    // >5% = excellent, 2% = good, <0.5% = poor
    engagementScore = Math.min(100, Math.max(0, brandEng * 20));
  }

  // ── Factor 3: Follower Growth Correlation ─────────────────
  let correlationScore = 50; // neutral default
  const correlation = metrics?.followerGrowthCorrelation;
  if (correlation != null) {
    // Map -1..1 → 0..100
    correlationScore = Math.max(0, Math.min(100, (correlation + 1) * 50));
  }

  // ── Factor 4: Cost Efficiency ─────────────────────────────
  let costScore = 100; // default: unpaid = perfect
  const compensation = kol.compensationMonthly || 0;
  if (compensation > 0) {
    const cpe = metrics?.costPerEngagement || 0;
    if (cpe > 0) {
      // $0.50 CPE = 90, $2 CPE = 60, $5 CPE = 0
      costScore = Math.max(0, Math.min(100, 100 - (cpe * 20)));
    } else {
      // Paid but no engagement data yet — penalize slightly
      costScore = 40;
    }
  }

  // ── Weighted composite ────────────────────────────────────
  const numericScore = Math.round(
    activationScore * WEIGHTS.activationFrequency +
    engagementScore * WEIGHTS.engagementQuality +
    correlationScore * WEIGHTS.followerCorrelation +
    costScore * WEIGHTS.costEfficiency
  );

  return {
    numericScore: Math.max(0, Math.min(100, numericScore)),
    grade: scoreToGrade(numericScore),
    factors: {
      activationFrequency: { score: Math.round(activationScore), weight: WEIGHTS.activationFrequency },
      engagementQuality: { score: Math.round(engagementScore), weight: WEIGHTS.engagementQuality },
      followerCorrelation: { score: Math.round(correlationScore), weight: WEIGHTS.followerCorrelation },
      costEfficiency: { score: Math.round(costScore), weight: WEIGHTS.costEfficiency },
    },
  };
}

/**
 * Hybrid KOL scoring: deterministic baseline + AI adjustment (+/-10).
 *
 * The formula provides a consistent baseline. The AI reviews qualitative
 * factors (content quality, audience alignment, narrative fit) and can
 * nudge the score up or down by at most 10 points. Both scores are
 * returned so we can track AI adjustments and refine weights over time.
 *
 * @param {object} kol - KOL profile data
 * @param {Array} activations - KOL activation records
 * @param {object} metrics - KOL performance metrics
 * @returns {Promise<{
 *   score: string, numericScore: number, baselineScore: number,
 *   aiAdjustment: number, rationale: string, recommendations: string[],
 *   factors: object
 * }>}
 */
export async function scoreKOL(kol, activations, metrics) {
  // Step 1: Compute deterministic baseline
  const baseline = computeBaselineScore(kol, activations, metrics);

  // Step 2: Ask AI for qualitative adjustment + rationale
  const systemPrompt = `${AI_PREAMBLE}
You are reviewing a KOL scoring result. A formula computed a baseline score of ${baseline.numericScore}/100 (grade: ${baseline.grade}).

Factor breakdown:
- Activation Frequency: ${baseline.factors.activationFrequency.score}/100 (weight: ${baseline.factors.activationFrequency.weight})
- Engagement Quality: ${baseline.factors.engagementQuality.score}/100 (weight: ${baseline.factors.engagementQuality.weight})
- Follower Correlation: ${baseline.factors.followerCorrelation.score}/100 (weight: ${baseline.factors.followerCorrelation.weight})
- Cost Efficiency: ${baseline.factors.costEfficiency.score}/100 (weight: ${baseline.factors.costEfficiency.weight})

Review the KOL's qualitative data (content quality, audience alignment, narrative fit, relationship context) and provide:
1. An adjustment of -10 to +10 points (0 if the formula result seems right)
2. A rationale explaining both the formula result and your adjustment
3. 2-4 actionable recommendations
4. A brief detail string for each factor

Respond with JSON: {"adjustment":number,"rationale":"string","recommendations":["string"],"factorDetails":{"activationFrequency":"string","engagementQuality":"string","followerCorrelation":"string","costEfficiency":"string"}}`;

  try {
    const context = {
      task: 'Review KOL baseline score and provide qualitative adjustment',
      baselineScore: baseline.numericScore,
      baselineGrade: baseline.grade,
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
      recentActivations: activations?.slice(0, 20).map((a) => ({
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

    const aiResult = await generateInsight('kol-scoring/review', context, {
      systemPrompt,
      maxTokens: 1024,
    });

    // Clamp AI adjustment to +/-10
    const adjustment = Math.max(-10, Math.min(10, aiResult?.adjustment || 0));
    const finalScore = Math.max(0, Math.min(100, baseline.numericScore + adjustment));

    return {
      score: scoreToGrade(finalScore),
      numericScore: finalScore,
      baselineScore: baseline.numericScore,
      aiAdjustment: adjustment,
      rationale: aiResult?.rationale || `Baseline score: ${baseline.numericScore}. No AI adjustment.`,
      recommendations: aiResult?.recommendations || [],
      factors: {
        activationFrequency: {
          score: baseline.factors.activationFrequency.score,
          detail: aiResult?.factorDetails?.activationFrequency || `Score: ${baseline.factors.activationFrequency.score}/100`,
        },
        engagementQuality: {
          score: baseline.factors.engagementQuality.score,
          detail: aiResult?.factorDetails?.engagementQuality || `Score: ${baseline.factors.engagementQuality.score}/100`,
        },
        followerCorrelation: {
          score: baseline.factors.followerCorrelation.score,
          detail: aiResult?.factorDetails?.followerCorrelation || `Score: ${baseline.factors.followerCorrelation.score}/100`,
        },
        costEfficiency: {
          score: baseline.factors.costEfficiency.score,
          detail: aiResult?.factorDetails?.costEfficiency || `Score: ${baseline.factors.costEfficiency.score}/100`,
        },
      },
    };
  } catch (error) {
    console.error('AI review failed, using baseline only:', error);
    // Fallback: return baseline score without AI adjustment
    return {
      score: baseline.grade,
      numericScore: baseline.numericScore,
      baselineScore: baseline.numericScore,
      aiAdjustment: 0,
      rationale: `Formula-based score (AI review unavailable): ${baseline.numericScore}/100.`,
      recommendations: ['Retry AI review when the service is available.'],
      error: true,
      factors: {
        activationFrequency: { score: baseline.factors.activationFrequency.score, detail: 'AI review unavailable.' },
        engagementQuality: { score: baseline.factors.engagementQuality.score, detail: 'AI review unavailable.' },
        followerCorrelation: { score: baseline.factors.followerCorrelation.score, detail: 'AI review unavailable.' },
        costEfficiency: { score: baseline.factors.costEfficiency.score, detail: 'AI review unavailable.' },
      },
    };
  }
}
