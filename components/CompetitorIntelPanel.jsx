'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Skeleton } from '@/components/ui';

// ── Strategy Cards Section (By Competitor tab) ──────────────

function StrategyCardsSection() {
  const { data, isLoading, error } = trpc.competitorIntel.strategyCards.useQuery(
    { days: 30 },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Strategy Cards</h4>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider mb-2">Strategy Cards</h4>
        <p className="text-[10px] text-red-500">Failed to load strategy cards.</p>
      </div>
    );
  }

  const cards = data?.cards || [];

  if (cards.length === 0) {
    return (
      <div>
        <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider mb-2">Strategy Cards</h4>
        <div className="p-3 bg-surface-secondary rounded-lg border border-border-secondary">
          <p className="text-[10px] text-content-faint text-center">No competitor data yet -- run the daily cron to populate.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Strategy Cards</h4>
        {data?.lastUpdated && (
          <span className="text-[9px] text-content-faint">
            {new Date(data.lastUpdated).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {cards.map((card, i) => {
          const engBenchmarkPositive = card.engagementBenchmark?.toLowerCase().includes('lower') ||
            card.engagementBenchmark?.toLowerCase().includes('behind');
          const followerBenchmarkPositive = card.followerBenchmark?.toLowerCase().includes('fewer') ||
            card.followerBenchmark?.toLowerCase().includes('smaller') ||
            card.followerBenchmark?.toLowerCase().includes('behind');

          return (
            <div
              key={i}
              className="p-2.5 rounded-lg border border-border-secondary border-l-[3px] border-l-cyan-500 bg-cyan-50/30 dark:bg-cyan-950/30"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-content-primary">{card.competitorName}</span>
                <span className="text-[10px] font-bold text-content-secondary">
                  {typeof card.followerCount === 'number'
                    ? card.followerCount >= 1000
                      ? `${(card.followerCount / 1000).toFixed(1)}K`
                      : card.followerCount
                    : card.followerCount} followers
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-1.5">
                <div className="text-[10px] text-content-secondary">
                  <span className="text-content-faint">Cadence:</span> {card.postingCadence}
                </div>
                <div className="text-[10px] text-content-secondary">
                  <span className="text-content-faint">Eng rate:</span>{' '}
                  <span className="font-medium">{card.engagementRate}</span>
                </div>
                <div className="text-[10px] text-content-secondary">
                  <span className="text-content-faint">Format:</span> {card.formatMix}
                </div>
              </div>

              {/* Benchmarks vs Figure */}
              <div className="flex gap-2 mb-1.5">
                {card.engagementBenchmark && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    engBenchmarkPositive
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  }`}>
                    {card.engagementBenchmark}
                  </span>
                )}
                {card.followerBenchmark && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    followerBenchmarkPositive
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  }`}>
                    {card.followerBenchmark}
                  </span>
                )}
              </div>

              {/* 14-day trend indicators */}
              {card.trend && (
                <div className="flex gap-2 mb-1.5">
                  {card.trend.followerGrowth14d && card.trend.followerGrowth14d !== 'No prior data' && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      parseFloat(card.trend.followerGrowth14d) > 0
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                        : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                    }`}>
                      Followers {parseFloat(card.trend.followerGrowth14d) > 0 ? '+' : ''}{card.trend.followerGrowth14d} (14d)
                    </span>
                  )}
                  {card.trend.cadenceTrend && card.trend.cadenceTrend !== 'Steady' && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      card.trend.cadenceTrend === 'Accelerating'
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                        : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                    }`}>
                      {card.trend.cadenceTrend}
                    </span>
                  )}
                </div>
              )}

              {/* Top themes */}
              {card.topThemes && card.topThemes.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {card.topThemes.map((theme, j) => (
                    <span key={j} className="text-[9px] px-1.5 py-0.5 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 rounded-full">
                      {theme}
                    </span>
                  ))}
                </div>
              )}

              {card.keyInsight && (
                <p className="text-[10px] text-content-muted leading-snug mt-1">{card.keyInsight}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Themes Section (Landscape tab) ──────────────────────────

function ThemesSection() {
  const { data, isLoading, error } = trpc.competitorIntel.themes.useQuery(
    { days: 30 },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-2 mb-3">
        <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Themes</h4>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-3">
        <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider mb-2">Themes</h4>
        <p className="text-[10px] text-red-500">Failed to load themes.</p>
      </div>
    );
  }

  const themes = (data?.themes || []).slice(0, 10);

  if (themes.length === 0) {
    return (
      <div className="mb-3">
        <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider mb-2">Themes</h4>
        <div className="p-3 bg-surface-secondary rounded-lg border border-border-secondary">
          <p className="text-[10px] text-content-faint text-center">No competitor data yet -- run the daily cron to populate.</p>
        </div>
      </div>
    );
  }

  const maxOccurrences = Math.max(...themes.map(t => t.occurrences || 0), 1);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Themes</h4>
        {data?.lastUpdated && (
          <span className="text-[9px] text-content-faint">
            {new Date(data.lastUpdated).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {themes.map((theme, i) => {
          const barWidth = ((theme.occurrences || 0) / maxOccurrences) * 100;
          return (
            <div
              key={i}
              className="p-1.5 rounded-md border border-border-secondary border-l-[3px] border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/30"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-semibold text-content-primary">{theme.phrase}</span>
                <span className="text-[10px] font-bold text-content-secondary">
                  {typeof theme.avgEngRate === 'number' ? `${theme.avgEngRate.toFixed(2)}%` : theme.avgEngRate}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 dark:bg-emerald-500 rounded-full"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="text-[9px] text-content-faint flex-shrink-0">{theme.occurrences}x</span>
              </div>
              {theme.competitors && theme.competitors.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {theme.competitors.map((c, j) => (
                    <span key={j} className="text-[8px] text-content-faint">{c}{j < theme.competitors.length - 1 ? ',' : ''}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Format Breakdown Section (Landscape tab) ────────────────

function FormatBreakdownSection() {
  const { data, isLoading, error } = trpc.competitorIntel.formatAnalysis.useQuery(
    { days: 30 },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Format Breakdown</h4>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider mb-2">Format Breakdown</h4>
        <p className="text-[10px] text-red-500">Failed to load format analysis.</p>
      </div>
    );
  }

  const formats = data?.formats || [];

  if (formats.length === 0) {
    return (
      <div>
        <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider mb-2">Format Breakdown</h4>
        <div className="p-3 bg-surface-secondary rounded-lg border border-border-secondary">
          <p className="text-[10px] text-content-faint text-center">No format data available.</p>
        </div>
      </div>
    );
  }

  const maxEngRate = Math.max(...formats.map(f => f.avgEngRate || 0));

  return (
    <div>
      <h4 className="text-[10px] font-semibold text-content-muted uppercase tracking-wider mb-2">Format Breakdown</h4>
      <div className="space-y-1.5">
        {formats.map((fmt, i) => {
          const isTop = fmt.avgEngRate === maxEngRate && formats.length > 1;
          return (
            <div
              key={i}
              className={`p-2 rounded-lg border border-border-secondary border-l-[3px] border-l-orange-500 ${
                isTop ? 'bg-orange-50/50 dark:bg-orange-950/50 ring-1 ring-orange-200 dark:ring-orange-800' : 'bg-orange-50/30 dark:bg-orange-950/30'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-content-primary">{fmt.format}</span>
                  {isTop && (
                    <span className="text-[8px] px-1 py-0.5 bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 rounded font-medium">TOP</span>
                  )}
                </div>
                <span className="text-[10px] font-bold text-content-secondary">
                  {typeof fmt.avgEngRate === 'number' ? `${fmt.avgEngRate.toFixed(2)}%` : fmt.avgEngRate}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-content-faint">{fmt.postCount} posts</span>
                <span className="text-[9px] text-content-faint">Top: {fmt.topCompetitor}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────

export default function CompetitorIntelPanel() {
  const [activeTab, setActiveTab] = useState('competitors');

  return (
    <div className="space-y-1" style={{ scrollbarWidth: 'thin' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-5 h-5 rounded-full bg-orange-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
          CI
        </div>
        <span className="text-[10px] font-semibold text-content-secondary">Competitor Intel -- last 30 days</span>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0.5 bg-surface-secondary rounded-md p-0.5 mb-3">
        <button
          onClick={() => setActiveTab('competitors')}
          className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
            activeTab === 'competitors' ? 'bg-surface-card shadow-sm text-content-primary' : 'text-content-muted'
          }`}
        >
          By Competitor
        </button>
        <button
          onClick={() => setActiveTab('landscape')}
          className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
            activeTab === 'landscape' ? 'bg-surface-card shadow-sm text-content-primary' : 'text-content-muted'
          }`}
        >
          Landscape
        </button>
      </div>

      {activeTab === 'competitors' ? (
        <StrategyCardsSection />
      ) : (
        <>
          <ThemesSection />
          <FormatBreakdownSection />
        </>
      )}
    </div>
  );
}
