'use client';

import { KPICard, DeltaArrow, SectionTitle } from '@/components/ui';

// ============================================================
// REPORT VIEWER — Rich display for enriched reports
// Handles both new (enriched) and old format reports
// ============================================================

export default function ReportViewer({ report }) {
  const content = report.content || {};
  const isEnriched = !!content.kpis; // Detect new vs old format

  if (!isEnriched) {
    return <OldFormatViewer content={content} title={report.title} />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* KPI Stats Row (RCNT-01) */}
      {content.kpis?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {content.kpis.map((kpi, i) => (
            <KPICard key={i} {...kpi} />
          ))}
        </div>
      )}

      {/* Executive Summary (RCNT-02) */}
      {content.executiveSummary && (
        <section>
          <SectionTitle>Executive Summary</SectionTitle>
          <div className="bg-white dark:bg-surface-card rounded-lg border border-border p-4 text-sm leading-relaxed text-gray-700 dark:text-content-secondary whitespace-pre-line">
            {content.executiveSummary}
          </div>
        </section>
      )}

      {/* Inline Charts (RCNT-04) */}
      {content.charts?.length > 0 && (
        <section>
          <SectionTitle>Charts</SectionTitle>
          <div className="space-y-4">
            {content.charts.map((chart) => (
              <div key={chart.id} className="bg-white dark:bg-surface-card rounded-lg border border-border p-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-content-primary mb-3">{chart.label}</h4>
                {chart.imageUrl ? (
                  <img src={chart.imageUrl} alt={chart.label} className="w-full rounded" />
                ) : (
                  <div className="h-48 bg-gray-50 dark:bg-surface-page rounded flex items-center justify-center text-gray-400 dark:text-content-faint text-sm">
                    Chart unavailable
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sentiment Themes (RCNT-05, RCNT-06) */}
      {content.sentimentThemes && <SentimentThemesSection themes={content.sentimentThemes} />}

      {/* Top Content */}
      {content.topContent?.length > 0 && (
        <section>
          <SectionTitle>Top Content</SectionTitle>
          <div className="space-y-2">
            {content.topContent.map((item, i) => (
              <div key={i} className="bg-white dark:bg-surface-card rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-content-primary">{item.title || item.postId}</p>
                {item.whyItWorked && <p className="text-xs text-gray-500 dark:text-content-muted mt-1">{item.whyItWorked}</p>}
                <div className="flex gap-3 mt-1 text-xs text-gray-400 dark:text-content-faint">
                  {item.impressions != null && <span>{item.impressions.toLocaleString()} impressions</span>}
                  {item.engagementRate != null && <span>{item.engagementRate}% engagement</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {content.recommendations?.length > 0 && (
        <section>
          <SectionTitle>Recommendations</SectionTitle>
          <div className="space-y-2">
            {content.recommendations.map((rec, i) => (
              <div key={i} className="bg-white dark:bg-surface-card rounded-lg border border-border p-3 flex items-start gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 flex-shrink-0 ${
                  rec.priority === 'HIGH' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : rec.priority === 'MEDIUM' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  : 'bg-gray-100 dark:bg-surface-secondary text-gray-600 dark:text-content-secondary'
                }`}>{rec.priority}</span>
                <div>
                  <p className="text-sm text-gray-900 dark:text-content-primary">{rec.recommendation}</p>
                  {rec.expectedImpact && <p className="text-xs text-gray-500 dark:text-content-muted mt-0.5">Impact: {rec.expectedImpact}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Coverage Period + Benchmark Period (RCNT-03) */}
      {content.coveragePeriod && (
        <div className="text-xs text-gray-400 dark:text-content-faint pt-4 border-t border-border">
          Coverage: {content.coveragePeriod.start} to {content.coveragePeriod.end}
          {content.benchmarkPeriod && (
            <span> | Compared to: {content.benchmarkPeriod.start} to {content.benchmarkPeriod.end}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SENTIMENT THEMES SECTION — Positive, negative, emerging
// ============================================================

function SentimentThemesSection({ themes }) {
  if (!themes) return null;

  const { positive = [], negative = [], emerging = [] } = themes;

  if (positive.length === 0 && negative.length === 0 && emerging.length === 0) return null;

  return (
    <section>
      <SectionTitle>Sentiment Themes</SectionTitle>
      <div className="space-y-3">
        {/* Positive themes */}
        {positive.map((t, i) => (
          <div key={`pos-${i}`} className="bg-white dark:bg-surface-card rounded-lg border border-border p-3 border-l-4 border-l-green-500">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-content-primary">{t.theme}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded font-medium">{t.volume} mentions</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-content-muted mt-1">{t.detail}</p>
          </div>
        ))}

        {/* Negative themes */}
        {negative.map((t, i) => (
          <div key={`neg-${i}`} className="bg-white dark:bg-surface-card rounded-lg border border-border p-3 border-l-4 border-l-red-500">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-content-primary">{t.theme}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded font-medium">{t.volume} mentions</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-content-muted mt-1">{t.detail}</p>
          </div>
        ))}

        {/* Emerging topics */}
        {emerging.map((t, i) => (
          <div key={`em-${i}`} className="bg-white dark:bg-surface-card rounded-lg border border-border p-3 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-content-primary">{t.topic}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded font-medium">Emerging</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-content-muted mt-1">{t.signals}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// OLD FORMAT VIEWER — Backward compatibility for pre-enriched reports
// Renders { executiveSummary, keyMetrics, topContent, recommendations, outlook }
// ============================================================

function OldFormatViewer({ content, title }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Executive Summary / Summary */}
      {(content.executiveSummary || content.summary) && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-content-primary uppercase tracking-wider mb-2 border-b border-border pb-1">Executive Summary</h3>
          <p className="text-sm text-gray-600 dark:text-content-secondary leading-relaxed whitespace-pre-line">
            {content.executiveSummary || content.summary}
          </p>
        </div>
      )}

      {/* Key Metrics (old format: object of key-value pairs) */}
      {content.keyMetrics && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-content-primary uppercase tracking-wider mb-2 border-b border-border pb-1">Key Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(content.keyMetrics).map(([key, val]) => (
              <div key={key} className="p-3 bg-gray-50 dark:bg-surface-page rounded-lg">
                <p className="text-xs text-gray-500 dark:text-content-muted capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-content-primary">{typeof val === 'number' ? val.toLocaleString() : val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Content */}
      {content.topContent?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-content-primary uppercase tracking-wider mb-2 border-b border-border pb-1">Top Performing Content</h3>
          <div className="space-y-2">
            {content.topContent.map((item, i) => (
              <div key={i} className="p-3 bg-gray-50 dark:bg-surface-page rounded-lg">
                <p className="text-sm font-medium text-gray-900 dark:text-content-primary">{item.title || item.postId}</p>
                {item.whyItWorked && <p className="text-xs text-gray-500 dark:text-content-muted mt-1">{item.whyItWorked}</p>}
                <div className="flex gap-3 mt-1 text-xs text-gray-400 dark:text-content-faint">
                  {item.impressions != null && <span>{item.impressions.toLocaleString()} imp</span>}
                  {item.engagementRate != null && <span>{item.engagementRate}% eng</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {content.recommendations?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-content-primary uppercase tracking-wider mb-2 border-b border-border pb-1">Recommendations</h3>
          <div className="space-y-2">
            {content.recommendations.map((rec, i) => (
              <div key={i} className="p-3 bg-gray-50 dark:bg-surface-page rounded-lg flex items-start gap-2">
                {rec.priority && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 ${
                    rec.priority === 'HIGH' ? 'bg-red-50 dark:bg-red-900/30 text-red-600' : rec.priority === 'MEDIUM' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600' : 'bg-gray-100 dark:bg-surface-secondary text-gray-600'
                  }`}>{rec.priority}</span>
                )}
                <div>
                  <p className="text-sm text-gray-900 dark:text-content-primary">{rec.recommendation || rec}</p>
                  {rec.expectedImpact && <p className="text-xs text-gray-500 dark:text-content-muted mt-0.5">Impact: {rec.expectedImpact}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outlook */}
      {content.outlook && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-1">Week Ahead Outlook</h3>
          <p className="text-sm text-blue-800 dark:text-blue-400">{content.outlook}</p>
        </div>
      )}
    </div>
  );
}
