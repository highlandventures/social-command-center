/**
 * Formats raw prediction data into a score card object
 * for inline display in the co-pilot chat.
 */
export function formatPredictionCard(predictionResult, accountContext) {
  if (!predictionResult) return null;

  const engagementRate = predictionResult.engagementRate != null
    ? `${(predictionResult.engagementRate * 100).toFixed(1)}%`
    : 'N/A';

  const impressionsEstimate = predictionResult.impressions != null
    ? formatNumber(predictionResult.impressions)
    : 'N/A';

  const confidence = predictionResult.confidence || 'medium';

  let comparisonToAvg = null;
  if (accountContext?.avgEngagementRate != null && predictionResult.engagementRate != null) {
    const diff = (predictionResult.engagementRate - accountContext.avgEngagementRate) * 100;
    const sign = diff >= 0 ? '+' : '';
    comparisonToAvg = `${sign}${diff.toFixed(1)}% vs avg`;
  }

  return {
    engagementRate,
    impressionsEstimate,
    confidence,
    comparisonToAvg,
  };
}

function formatNumber(num) {
  if (num >= 1_000_000) return `~${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `~${(num / 1_000).toFixed(0)}K`;
  return `~${num}`;
}
