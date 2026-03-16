'use client';

const CONFIDENCE_COLORS = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-green-100 text-green-700',
};

export default function PredictionCard({ prediction }) {
  if (!prediction) return null;

  const { engagementRate, impressionsEstimate, confidence, comparisonToAvg } = prediction;
  const confidenceColor = CONFIDENCE_COLORS[confidence] || CONFIDENCE_COLORS.medium;

  return (
    <div className="border-l-2 border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg p-3">
      {/* Row 1: Label + confidence badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-content-primary">Performance Prediction</span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${confidenceColor}`}>
          {confidence || 'medium'} confidence
        </span>
      </div>

      {/* Row 2: Metrics grid */}
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div>
          <p className="text-[10px] text-content-muted">Engagement Rate</p>
          <p className="text-sm font-bold text-content-primary">{engagementRate || 'N/A'}</p>
        </div>
        <div>
          <p className="text-[10px] text-content-muted">Impressions Est.</p>
          <p className="text-sm font-bold text-content-primary">{impressionsEstimate || 'N/A'}</p>
        </div>
      </div>

      {/* Row 3: Comparison to average */}
      {comparisonToAvg && (
        <p className={`text-[10px] font-medium ${
          comparisonToAvg.startsWith('+') ? 'text-green-600' : 'text-red-500'
        }`}>
          {comparisonToAvg}
        </p>
      )}
    </div>
  );
}
