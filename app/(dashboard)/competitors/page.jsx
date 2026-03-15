'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  PieChart, Pie, Cell, AreaChart, Area,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { trpc } from '@/lib/trpc-client';
import {
  COLORS, MetricCard, MetricCardSkeleton, SectionTitle,
  TabButton, Avatar, PlatformBadge, Skeleton, Sparkline, MiniSparkline,
  TrendArrow, DeltaBadge, SentimentDot, ScoreBadge, EmptyState,
  useChartColors,
} from '@/components/ui';

// ── Sub-tab keys ──
const SUB_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sov', label: 'Share of Voice' },
  { key: 'benchmarks', label: 'Benchmarks' },
  { key: 'profiles', label: 'Profiles' },
  { key: 'headToHead', label: 'Head-to-Head' },
  { key: 'feed', label: 'Content Feed' },
  { key: 'amplifiers', label: 'Amplifiers' },
];

const SOV_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// ── Helpers ──
function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtPct(n, decimals = 2) {
  if (n == null) return '—';
  return `${Number(n).toFixed(decimals)}%`;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function CompetitorsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse p-8 text-content-muted">Loading...</div>}>
      <CompetitorsContent />
    </Suspense>
  );
}

function CompetitorsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('overview');

  // Support ?tab=benchmarks deep linking from dashboard
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && SUB_TABS.some((t) => t.key === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-content-primary">Competitors</h2>
          <p className="text-sm text-content-muted mt-0.5">
            Competitive intelligence, benchmarks, and share of voice
          </p>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div className="flex items-center gap-2 mb-6">
        {SUB_TABS.map((tab) => (
          <TabButton
            key={tab.key}
            active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'sov' && <ShareOfVoiceTab />}
      {activeTab === 'benchmarks' && <BenchmarksTab />}
      {activeTab === 'profiles' && <ProfilesTab />}
      {activeTab === 'headToHead' && <HeadToHeadTab />}
      {activeTab === 'feed' && <ContentFeedTab />}
      {activeTab === 'amplifiers' && <AmplifiersTab />}
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================

function OverviewTab() {
  const chartColors = useChartColors();

  const competitorsQ = trpc.competitors.list.useQuery(undefined, { staleTime: 60_000 });
  const activityQ = trpc.competitors.activity.useQuery({}, { staleTime: 60_000 });
  const strategyQ = trpc.competitorIntel.strategyCards.useQuery({}, { staleTime: 5 * 60_000 });
  const benchmarkQ = trpc.benchmarks.summary.useQuery(undefined, { staleTime: 5 * 60_000 });
  const contentGapsQ = trpc.competitorIntel.contentGaps.useQuery({}, { staleTime: 5 * 60_000 });

  const competitors = competitorsQ.data ?? [];
  const activity = activityQ.data ?? [];
  const strategyCards = strategyQ.data?.cards ?? [];
  const benchmark = benchmarkQ.data;
  const contentGaps = contentGapsQ.data?.gaps ?? [];
  const contentStrengths = contentGapsQ.data?.strengths ?? [];

  const isLoading = competitorsQ.isLoading || activityQ.isLoading;

  // Compute aggregate metrics
  const totalCompetitors = competitors.length;
  const avgEngRate = activity.length > 0
    ? activity.reduce((s, c) => s + c.avgEngagementRate, 0) / activity.length
    : 0;
  const sovLeader = activity.length > 0
    ? activity.reduce((best, c) => c.shareOfVoicePct > best.shareOfVoicePct ? c : best, activity[0])
    : null;
  const totalFollowers = activity.reduce((s, c) => s + c.followersX, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <MetricCardSkeleton key={i} />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <EmptyState
        icon="🎯"
        title="No competitors tracked"
        description="Add competitors from the Admin page to start tracking their activity, content, and share of voice."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Competitors Tracked"
          value={totalCompetitors}
        />
        <MetricCard
          label="Avg Engagement Rate"
          value={fmtPct(avgEngRate * 100)}
          benchmark={benchmark ? {
            label: 'Top 10% Crypto',
            value: fmtPct(benchmark.top10PctEngRate),
          } : undefined}
        />
        <MetricCard
          label="SOV Leader"
          value={sovLeader?.name ?? '—'}
          delta={sovLeader ? undefined : undefined}
          deltaLabel={sovLeader ? `${fmtPct(sovLeader.shareOfVoicePct, 1)} SOV` : undefined}
        />
        <MetricCard
          label="Total Competitor Followers"
          value={fmtNum(totalFollowers)}
        />
      </div>

      {/* Competitor ranking table */}
      <div className="bg-surface-card rounded-xl border border-border p-5">
        <SectionTitle subtitle={`${activity.length} competitors ranked by followers`}>
          Competitor Rankings
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-secondary">
                <th className="text-left py-2 px-3 text-content-muted font-medium">#</th>
                <th className="text-left py-2 px-3 text-content-muted font-medium">Competitor</th>
                <th className="text-right py-2 px-3 text-content-muted font-medium">Followers</th>
                <th className="text-right py-2 px-3 text-content-muted font-medium">Eng Rate</th>
                <th className="text-right py-2 px-3 text-content-muted font-medium">Posts/Day</th>
                <th className="text-right py-2 px-3 text-content-muted font-medium">SOV %</th>
                <th className="text-right py-2 px-3 text-content-muted font-medium">Sentiment</th>
                <th className="text-right py-2 px-3 text-content-muted font-medium">Growth</th>
                <th className="text-center py-2 px-3 text-content-muted font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((c, i) => (
                <tr key={c.id} className="border-b border-border-secondary last:border-0 hover:bg-surface-hover transition-colors">
                  <td className="py-3 px-3 text-content-faint">{i + 1}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-content-primary">{c.name}</div>
                      {c.accounts?.[0] && (
                        <span className="text-xs text-content-faint">@{c.accounts[0].username}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-content-primary">{fmtNum(c.followersX)}</td>
                  <td className="py-3 px-3 text-right text-content-secondary">{fmtPct(c.avgEngagementRate * 100)}</td>
                  <td className="py-3 px-3 text-right text-content-secondary">{c.postsPerDay}</td>
                  <td className="py-3 px-3 text-right text-content-secondary">{fmtPct(c.shareOfVoicePct, 1)}</td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <SentimentDot sentiment={c.avgSentimentPositivePct > 60 ? 'positive' : c.avgSentimentPositivePct < 40 ? 'negative' : 'neutral'} />
                      <span className="text-content-secondary">{fmtPct(c.avgSentimentPositivePct, 0)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`text-sm font-medium ${c.followerGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {c.followerGrowth >= 0 ? '+' : ''}{fmtNum(c.followerGrowth)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {c.daily?.length >= 2 && (
                      <MiniSparkline
                        data={c.daily.map((d) => d.followers)}
                        color={c.followerGrowth >= 0 ? COLORS.green : COLORS.red}
                        width={60}
                        height={20}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategy insight cards */}
      {strategyCards.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <SectionTitle subtitle="AI-generated from last 30 days of competitor posts">
            Strategy Insights
          </SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {strategyCards.map((card, i) => (
              <div
                key={i}
                className="border border-border-secondary rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-content-primary">{card.competitorName}</span>
                  <span className="text-xs text-content-faint">{card.postingCadence}</span>
                </div>
                {card.topThemes && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(Array.isArray(card.topThemes) ? card.topThemes : []).slice(0, 3).map((t, j) => (
                      <span
                        key={j}
                        className="px-2 py-0.5 bg-surface-secondary rounded text-xs text-content-secondary"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-content-muted mb-2">
                  <span>Eng: {fmtPct(card.engagementRate * 100, 1)}</span>
                  <span>{fmtNum(card.followerCount)} followers</span>
                </div>
                {card.engagementBenchmark && (
                  <div className="flex gap-2 text-xs mb-2">
                    <span className={card.engagementBenchmark > 0 ? 'text-red-500' : 'text-green-600'}>
                      {card.engagementBenchmark > 0 ? '↑' : '↓'} {Math.abs(card.engagementBenchmark).toFixed(0)}% eng vs us
                    </span>
                    {card.followerBenchmark != null && (
                      <span className={card.followerBenchmark > 0 ? 'text-red-500' : 'text-green-600'}>
                        {card.followerBenchmark > 0 ? '↑' : '↓'} {Math.abs(card.followerBenchmark).toFixed(0)}% followers vs us
                      </span>
                    )}
                  </div>
                )}
                {card.keyInsight && (
                  <p className="text-xs text-content-secondary italic border-t border-border-secondary pt-2 mt-2">
                    {card.keyInsight}
                  </p>
                )}
              </div>
            ))}
          </div>
          {strategyQ.data?.lastUpdated && (
            <p className="text-xs text-content-faint mt-3">
              Last updated: {fmtDate(strategyQ.data.lastUpdated)}
            </p>
          )}
        </div>
      )}

      {/* Content gap analysis */}
      {(contentGaps.length > 0 || contentStrengths.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gaps — themes competitors cover that we don't */}
          {contentGaps.length > 0 && (
            <div className="bg-surface-card rounded-xl border border-border p-5">
              <SectionTitle subtitle="Themes competitors cover that Figure doesn't">
                Content Gaps
              </SectionTitle>
              <div className="space-y-2 mt-3">
                {contentGaps.slice(0, 6).map((gap, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
                  >
                    <span className="text-amber-500 mt-0.5 text-sm">!</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-content-primary">{gap.theme}</span>
                        {gap.avgEngRate != null && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded font-medium">
                            {fmtPct(gap.avgEngRate * 100, 1)} avg eng
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-content-muted mb-1">
                        Used by: {(gap.competitors || []).join(', ')}
                      </p>
                      {gap.recommendation && (
                        <p className="text-xs text-content-secondary italic">{gap.recommendation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {contentGapsQ.data?.lastUpdated && (
                <p className="text-xs text-content-faint mt-3">
                  Last updated: {fmtDate(contentGapsQ.data.lastUpdated)}
                </p>
              )}
            </div>
          )}

          {/* Strengths — themes Figure owns */}
          {contentStrengths.length > 0 && (
            <div className="bg-surface-card rounded-xl border border-border p-5">
              <SectionTitle subtitle="Themes Figure covers that competitors don't">
                Content Strengths
              </SectionTitle>
              <div className="space-y-2 mt-3">
                {contentStrengths.slice(0, 6).map((str, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
                  >
                    <span className="text-green-500 mt-0.5 text-sm">+</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-content-primary">{str.theme}</span>
                        {str.figurePostCount != null && (
                          <span className="text-[10px] text-content-faint">{str.figurePostCount} posts</span>
                        )}
                        {str.avgEngRate != null && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded font-medium">
                            {fmtPct(str.avgEngRate * 100, 1)} avg eng
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SHARE OF VOICE TAB
// ============================================================

function ShareOfVoiceTab() {
  const chartColors = useChartColors();
  const sovQ = trpc.competitors.getSOV.useQuery({}, { staleTime: 60_000 });
  const activityQ = trpc.competitors.activity.useQuery({}, { staleTime: 60_000 });
  const mentionMetricsQ = trpc.listening.mentionMetrics.useQuery(undefined, { staleTime: 30_000 });

  const sovData = sovQ.data?.current ?? [];
  const sovTimeData = sovQ.data?.overTime ?? [];

  if (sovQ.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle subtitle="Your brand's share of the conversation vs. competitors">
        Share of Voice & Analytics
      </SectionTitle>

      {/* Mention metrics summary */}
      {mentionMetricsQ.data && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-surface-card rounded-xl border border-border p-4">
            <p className="text-xs text-content-muted mb-1">Total (30d)</p>
            <p className="text-2xl font-bold text-content-primary">{mentionMetricsQ.data.total30d || 0}</p>
          </div>
          <div className="bg-surface-card rounded-xl border border-border p-4">
            <p className="text-xs text-content-muted mb-1">This Week (7d)</p>
            <p className="text-2xl font-bold text-content-primary">{mentionMetricsQ.data.total7d || 0}</p>
          </div>
          <div className="bg-surface-card rounded-xl border border-border p-4">
            <p className="text-xs text-content-muted mb-1">Positive</p>
            <p className="text-2xl font-bold text-green-600">{mentionMetricsQ.data.bySentiment?.POSITIVE || 0}</p>
          </div>
          <div className="bg-surface-card rounded-xl border border-border p-4">
            <p className="text-xs text-content-muted mb-1">Neutral</p>
            <p className="text-2xl font-bold text-content-secondary">{mentionMetricsQ.data.bySentiment?.NEUTRAL || 0}</p>
          </div>
          <div className="bg-surface-card rounded-xl border border-border p-4">
            <p className="text-xs text-content-muted mb-1">Negative</p>
            <p className="text-2xl font-bold text-red-600">{mentionMetricsQ.data.bySentiment?.NEGATIVE || 0}</p>
          </div>
        </div>
      )}

      {/* Topic breakdown */}
      {mentionMetricsQ.data?.byTopic?.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold text-content-primary mb-3">Mentions by Topic (7d)</h4>
          <div className="space-y-2">
            {mentionMetricsQ.data.byTopic.map((topic) => (
              <div key={topic.topicId} className="flex items-center justify-between py-2 border-b border-border-secondary last:border-0">
                <span className="text-sm text-content-secondary">{topic.topicName}</span>
                <span className="font-semibold text-content-primary">{topic.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily mention trend */}
      {mentionMetricsQ.data?.dailyTrend?.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold text-content-primary mb-3">Daily Mention Trend (14d)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mentionMetricsQ.data.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#93c5fd" name="Mentions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* SOV pie + area charts */}
      {sovData.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No Share of Voice data yet"
          description="Configure competitors to start tracking share of voice."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-surface-card rounded-xl border border-border p-5">
            <h4 className="text-sm font-semibold text-content-primary mb-3">Current SOV</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={sovData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ value }) => `${value}%`}
                >
                  {sovData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {sovData.map((s) => (
                <span key={s.name} className="flex items-center gap-1 text-xs text-content-secondary">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-surface-card rounded-xl border border-border p-5">
            <h4 className="text-sm font-semibold text-content-primary mb-3">SOV Over Time</h4>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={sovTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
                {sovData.map((entry) => (
                  <Area key={entry.name} type="monotone" dataKey={entry.name} stackId="1" stroke={entry.color} fill={entry.color} fillOpacity={0.3} />
                ))}
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Competitor activity table */}
      {activityQ.data?.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold text-content-primary mb-3">Competitor Activity (30d)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Competitor', 'Followers', 'Posts/Day', 'Avg Engagement', 'Mentions', 'Sentiment', 'SOV', 'Follower Growth'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-content-muted uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activityQ.data.map((comp) => (
                  <tr key={comp.id} className="border-b border-border-secondary hover:bg-surface-hover">
                    <td className="py-3 px-3">
                      <div>
                        <span className="font-medium text-content-primary">{comp.name}</span>
                        {comp.accounts?.filter((a) => a.platform === 'X').map((a) => (
                          <span key={a.username} className="text-xs text-content-faint ml-1">@{a.username}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold">{comp.followersX > 0 ? fmtNum(comp.followersX) : '—'}</td>
                    <td className="py-3 px-3">
                      <span className={comp.postsPerDay >= 3 ? 'text-green-600 font-medium' : comp.postsPerDay >= 1 ? 'text-content-primary' : 'text-content-faint'}>
                        {comp.postsPerDay > 0 ? comp.postsPerDay : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {comp.avgEngagementRate > 0 ? (
                        <span className={comp.avgEngagementRate >= 1 ? 'text-green-600 font-medium' : 'text-content-primary'}>
                          {comp.avgEngagementRate.toFixed(2)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-3">{comp.totalMentions > 0 ? comp.totalMentions : '—'}</td>
                    <td className="py-3 px-3">
                      {comp.avgSentimentPositivePct > 0 ? (
                        <span className={comp.avgSentimentPositivePct > 65 ? 'text-green-600' : 'text-amber-600'}>
                          {comp.avgSentimentPositivePct}% pos
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-3 font-semibold">{comp.shareOfVoicePct > 0 ? `${comp.shareOfVoicePct}%` : '—'}</td>
                    <td className="py-3 px-3">
                      {comp.followerGrowth !== 0 ? (
                        <span className={comp.followerGrowth > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>
                          {comp.followerGrowth > 0 ? '+' : ''}{fmtNum(comp.followerGrowth)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// BENCHMARKS TAB
// ============================================================

function GradeChip({ grade }) {
  const colors = {
    'A':  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    'A-': 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'B+': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'B':  'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    'B-': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    'C+': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'C':  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${colors[grade] || colors['C']}`}>
      {grade}
    </span>
  );
}

function BenchmarkBar({ value, median, top10, label, format = 'pct' }) {
  const maxVal = Math.max(value, top10, median) * 1.2 || 1;
  const valPct = (value / maxVal) * 100;
  const medPct = (median / maxVal) * 100;
  const topPct = (top10 / maxVal) * 100;

  const formatted = format === 'pct'
    ? `${value.toFixed(2)}%`
    : format === 'int'
    ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : value.toFixed(1);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-content-muted uppercase tracking-wider">{label}</span>
        <span className="text-xs font-bold text-content-primary">{formatted}</span>
      </div>
      <div className="relative h-2.5 bg-surface-secondary rounded-full overflow-visible">
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all duration-500"
          style={{ width: `${Math.min(valPct, 100)}%` }}
        />
        <div
          className="absolute top-[-2px] h-[calc(100%+4px)] w-[2px] bg-gray-400 dark:bg-gray-500 rounded-full"
          style={{ left: `${Math.min(medPct, 100)}%` }}
          title={`Median: ${format === 'pct' ? median.toFixed(2) + '%' : median.toLocaleString()}`}
        />
        <div
          className="absolute top-[-2px] h-[calc(100%+4px)] w-[2px] bg-green-500 dark:bg-green-400 rounded-full"
          style={{ left: `${Math.min(topPct, 100)}%` }}
          title={`Top 10%: ${format === 'pct' ? top10.toFixed(2) + '%' : top10.toLocaleString()}`}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-content-faint">
          <span className="inline-block w-2 h-[2px] bg-gray-400 mr-0.5 align-middle" /> Median {format === 'pct' ? median.toFixed(2) + '%' : median.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span className="text-[9px] text-green-600 dark:text-green-400">
          <span className="inline-block w-2 h-[2px] bg-green-500 mr-0.5 align-middle" /> Top 10% {format === 'pct' ? top10.toFixed(2) + '%' : top10.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}

function DeltaTag({ value, label }) {
  if (value == null) return null;
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
      }`}
      title={`vs ${label}`}
    >
      {isPositive ? '↑' : '↓'} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

function BenchmarksTab() {
  const dashboardQ = trpc.benchmarks.dashboard.useQuery(undefined, { staleTime: 5 * 60_000 });

  if (dashboardQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const data = dashboardQ.data;

  if (!data || data.status === 'empty') {
    return (
      <EmptyState
        icon="📈"
        title="No benchmark data yet"
        description="Run the data pull script and POST to /api/benchmarks/ingest to populate benchmarks."
      />
    );
  }

  const freshness = data.meta?.generated_at ? new Date(data.meta.generated_at) : null;
  const freshnessLabel = freshness
    ? `Updated ${freshness.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${freshness.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '';
  const stale = freshness && (Date.now() - freshness.getTime()) > 8 * 24 * 60 * 60 * 1000;

  const bm = data.benchmarks || {};
  const accounts = data.yourAccounts || [];
  const comparisons = data.comparisons || [];
  const universe = data.universe || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SectionTitle subtitle={`${data.meta?.universe_size || '—'} top crypto accounts tracked`}>
          Industry Benchmarks
        </SectionTitle>
        <div className="flex items-center gap-2">
          {stale && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded font-medium">
              Stale
            </span>
          )}
          <span className="text-[10px] text-content-faint">{freshnessLabel}</span>
        </div>
      </div>

      {/* Methodology explanation */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5">
        <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">How Benchmarks Work</h4>
        <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1.5">
          <p>Benchmarks are computed from a universe of <strong>{data.meta?.universe_size || '—'} top crypto accounts</strong> on X, refreshed weekly via automated data pull.</p>
          <p>Each metric is compared against the <strong>universe median</strong> (typical performance) and the <strong>top 10% mean</strong> (best-in-class). Your accounts receive letter grades based on percentile ranking.</p>
          <div className="flex gap-4 mt-2">
            <span><strong>A/A-</strong>: Top 10-20%</span>
            <span><strong>B+/B/B-</strong>: 40th-80th percentile</span>
            <span><strong>C+/C</strong>: Below 40th percentile</span>
          </div>
        </div>
      </div>

      {/* Top 10% headline stats */}
      <div className="bg-surface-card rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold text-content-primary mb-4">Universe Top 10% Benchmarks</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-content-primary">
              {bm.engagement_rate_pct?.top_10_pct?.mean?.toFixed(2) ?? '—'}%
            </div>
            <div className="text-xs text-content-muted mt-1">Engagement Rate</div>
            <div className="text-[10px] text-content-faint">Median: {bm.engagement_rate_pct?.full_universe?.p50_median?.toFixed(2) ?? '—'}%</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-content-primary">
              {bm.impressions_per_post?.top_10_pct?.mean?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}
            </div>
            <div className="text-xs text-content-muted mt-1">Impressions / Post</div>
            <div className="text-[10px] text-content-faint">Median: {bm.impressions_per_post?.full_universe?.p50_median?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-content-primary">
              {bm.bookmarks_per_post?.top_10_pct?.mean?.toFixed(1) ?? '—'}
            </div>
            <div className="text-xs text-content-muted mt-1">Bookmarks / Post</div>
            <div className="text-[10px] text-content-faint">Median: {bm.bookmarks_per_post?.full_universe?.p50_median?.toFixed(1) ?? '—'}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-content-primary">
              {bm.distribution_score?.top_10_pct?.mean?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}
            </div>
            <div className="text-xs text-content-muted mt-1">Distribution Score</div>
            <div className="text-[10px] text-content-faint">Median: {bm.distribution_score?.full_universe?.p50_median?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Per-account comparison cards */}
      {accounts.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold text-content-primary mb-4">Your Accounts vs. Benchmarks</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((acct, i) => {
              const comp = comparisons[i] || {};
              return (
                <div key={acct.handle} className="border border-border-secondary rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-semibold text-content-primary">{acct.display_name}</span>
                      <span className="text-xs text-content-faint ml-1.5">{acct.handle}</span>
                    </div>
                    <GradeChip grade={acct.health_grade} />
                  </div>
                  <BenchmarkBar
                    value={acct.engagement_rate_pct ?? 0}
                    median={bm.engagement_rate_pct?.full_universe?.p50_median ?? 0}
                    top10={bm.engagement_rate_pct?.top_10_pct?.mean ?? 0}
                    label="Engagement Rate"
                    format="pct"
                  />
                  <BenchmarkBar
                    value={acct.impressions_per_post ?? 0}
                    median={bm.impressions_per_post?.full_universe?.p50_median ?? 0}
                    top10={bm.impressions_per_post?.top_10_pct?.mean ?? 0}
                    label="Impressions / Post"
                    format="int"
                  />
                  <BenchmarkBar
                    value={acct.bookmarks_per_post ?? 0}
                    median={bm.bookmarks_per_post?.full_universe?.p50_median ?? 0}
                    top10={bm.bookmarks_per_post?.top_10_pct?.mean ?? 0}
                    label="Bookmarks / Post"
                    format="dec"
                  />
                  <div className="flex gap-3 mt-2 pt-2 border-t border-border-secondary">
                    <div className="flex-1 text-center">
                      <div className="text-[10px] text-content-muted">vs Median</div>
                      <DeltaTag value={comp.metrics?.engagement_rate?.vs_median_pct} label="median eng" />
                    </div>
                    <div className="flex-1 text-center">
                      <div className="text-[10px] text-content-muted">vs Top 10%</div>
                      <DeltaTag value={comp.metrics?.engagement_rate?.vs_top_10_pct} label="top 10% eng" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Universe accounts table */}
      {universe.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold text-content-primary mb-1">Benchmark Universe</h4>
          <p className="text-xs text-content-muted mb-4">The {universe.length} crypto accounts used to compute benchmarks</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-secondary">
                  <th className="text-left py-2 px-3 text-content-muted font-medium text-xs">#</th>
                  <th className="text-left py-2 px-3 text-content-muted font-medium text-xs">Account</th>
                  <th className="text-right py-2 px-3 text-content-muted font-medium text-xs">Eng Rate</th>
                  <th className="text-right py-2 px-3 text-content-muted font-medium text-xs">Impressions</th>
                  <th className="text-right py-2 px-3 text-content-muted font-medium text-xs">Bookmarks</th>
                  <th className="text-right py-2 px-3 text-content-muted font-medium text-xs">Dist Score</th>
                  <th className="text-center py-2 px-3 text-content-muted font-medium text-xs">Grade</th>
                </tr>
              </thead>
              <tbody>
                {universe.map((u, i) => (
                  <tr key={u.handle || i} className="border-b border-border-secondary last:border-0 hover:bg-surface-hover">
                    <td className="py-2 px-3 text-content-faint">{i + 1}</td>
                    <td className="py-2 px-3">
                      <span className="font-medium text-content-primary">{u.display_name || u.handle}</span>
                      <span className="text-xs text-content-faint ml-1">{u.handle}</span>
                    </td>
                    <td className="py-2 px-3 text-right text-content-secondary">{u.engagement_rate_pct?.toFixed(2) ?? '—'}%</td>
                    <td className="py-2 px-3 text-right text-content-secondary">{u.impressions_per_post?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}</td>
                    <td className="py-2 px-3 text-right text-content-secondary">{u.bookmarks_per_post?.toFixed(1) ?? '—'}</td>
                    <td className="py-2 px-3 text-right text-content-secondary">{u.distribution_score?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}</td>
                    <td className="py-2 px-3 text-center"><GradeChip grade={u.health_grade} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PROFILES TAB
// ============================================================

function ProfilesTab() {
  const chartColors = useChartColors();
  const competitorsQ = trpc.competitors.list.useQuery(undefined, { staleTime: 60_000 });
  const [selectedId, setSelectedId] = useState(null);

  const competitors = competitorsQ.data ?? [];

  if (competitorsQ.isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (competitors.length === 0) {
    return (
      <EmptyState
        icon="👤"
        title="No competitors tracked"
        description="Add competitors from the Admin page to start viewing profiles."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Competitor selector grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {competitors.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
            className={`text-left p-4 rounded-xl border transition-all ${
              selectedId === c.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                : 'border-border bg-surface-card hover:shadow-sm'
            }`}
          >
            <div className="font-semibold text-content-primary text-sm">{c.name}</div>
            {c.accounts?.[0] && (
              <div className="text-xs text-content-faint mt-0.5">@{c.accounts[0].username}</div>
            )}
            {c.latestMetrics && (
              <div className="text-xs text-content-muted mt-1">
                {fmtNum(c.latestMetrics.followersX)} followers
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Profile detail */}
      {selectedId && <ProfileDetail competitorId={selectedId} />}
    </div>
  );
}

function ProfileDetail({ competitorId }) {
  const chartColors = useChartColors();
  const profileQ = trpc.competitors.profile.useQuery(
    { competitorId, days: 90 },
    { staleTime: 60_000 }
  );

  if (profileQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!profileQ.data) return null;

  const { competitor, metricsTimeSeries, followerGrowthVelocity, topPosts, formatBreakdown, cadenceHeatmap, strategyCard, totalPosts } = profileQ.data;
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxHeatCount = Math.max(...cadenceHeatmap.map((h) => h.count), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-content-primary">{competitor.name}</h3>
            <div className="flex gap-2 mt-1">
              {competitor.accounts.map((a) => (
                <span key={a.id} className="text-xs text-content-faint">
                  <PlatformBadge platform={a.platform} /> @{a.username}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-content-primary">{totalPosts}</div>
              <div className="text-[10px] text-content-muted">Posts (90d)</div>
            </div>
            <div>
              <div className={`text-lg font-bold ${followerGrowthVelocity >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {followerGrowthVelocity >= 0 ? '+' : ''}{fmtNum(followerGrowthVelocity)}
              </div>
              <div className="text-[10px] text-content-muted">Follower Growth</div>
            </div>
          </div>
        </div>
        {strategyCard?.keyInsight && (
          <p className="text-sm text-content-secondary italic mt-3 pt-3 border-t border-border-secondary">
            {strategyCard.keyInsight}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Follower growth chart */}
        {metricsTimeSeries.length > 1 && (
          <div className="bg-surface-card rounded-xl border border-border p-5">
            <h4 className="text-sm font-semibold text-content-primary mb-3">Follower Growth</h4>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={metricsTimeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
                <Area type="monotone" dataKey="followersX" stroke={chartColors.blue} fill={chartColors.fillBlue} name="Followers" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Engagement over time */}
        {metricsTimeSeries.length > 1 && (
          <div className="bg-surface-card rounded-xl border border-border p-5">
            <h4 className="text-sm font-semibold text-content-primary mb-3">Engagement Rate Over Time</h4>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={metricsTimeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }}
                  formatter={(val) => `${(val * 100).toFixed(2)}%`}
                />
                <Area type="monotone" dataKey="avgEngagementRate" stroke={chartColors.green} fill={chartColors.fillGreen} name="Eng Rate" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Format breakdown */}
        {formatBreakdown.length > 0 && (
          <div className="bg-surface-card rounded-xl border border-border p-5">
            <h4 className="text-sm font-semibold text-content-primary mb-3">Content Format Breakdown</h4>
            <div className="space-y-3">
              {formatBreakdown.sort((a, b) => b.count - a.count).map((f) => {
                const pct = totalPosts > 0 ? (f.count / totalPosts) * 100 : 0;
                return (
                  <div key={f.format}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-content-secondary">{f.format}</span>
                      <span className="text-xs text-content-faint">{f.count} posts ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-surface-secondary rounded-full">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] text-content-faint mt-0.5">
                      Avg Eng: {fmtPct(f.avgEng * 100, 2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Posting cadence heatmap */}
        {cadenceHeatmap.length > 0 && (
          <div className="bg-surface-card rounded-xl border border-border p-5">
            <h4 className="text-sm font-semibold text-content-primary mb-3">Posting Cadence (UTC)</h4>
            <div className="overflow-x-auto">
              <div className="grid gap-[2px]" style={{ gridTemplateColumns: `40px repeat(24, 1fr)` }}>
                {/* Hour headers */}
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-[9px] text-content-faint text-center">{h}</div>
                ))}
                {/* Day rows */}
                {DAYS.map((dayName, day) => (
                  <React.Fragment key={day}>
                    <div className="text-[10px] text-content-muted flex items-center">{dayName}</div>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const cell = cadenceHeatmap.find((h) => h.day === day && h.hour === hour);
                      const count = cell?.count || 0;
                      const intensity = count > 0 ? Math.max(0.15, count / maxHeatCount) : 0;
                      return (
                        <div
                          key={hour}
                          className="w-full aspect-square rounded-sm"
                          style={{
                            backgroundColor: count > 0
                              ? `rgba(59, 130, 246, ${intensity})`
                              : 'var(--color-surface-secondary, #f3f4f6)',
                          }}
                          title={`${dayName} ${hour}:00 — ${count} posts`}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top posts */}
      {topPosts.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold text-content-primary mb-3">Top Performing Posts</h4>
          <div className="space-y-3">
            {topPosts.slice(0, 5).map((p) => (
              <div key={p.id} className="border border-border-secondary rounded-lg p-3 hover:shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-content-faint">@{p.authorUsername} · {fmtDate(p.postedAt)}</span>
                  <span className="text-xs font-medium px-2 py-0.5 bg-surface-secondary rounded">{p.contentType}</span>
                </div>
                <p className="text-sm text-content-primary line-clamp-2">{p.content}</p>
                <div className="flex gap-4 mt-2 text-xs text-content-muted">
                  <span>{fmtNum(p.impressions)} imp</span>
                  <span>{fmtNum(p.likes)} likes</span>
                  <span>{fmtNum(p.retweets)} RTs</span>
                  <span>{fmtNum(p.replies)} replies</span>
                  <span className="font-medium text-content-secondary">{fmtPct(p.engagementRate * 100)} eng</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// HEAD-TO-HEAD TAB
// ============================================================

function HeadToHeadTab() {
  const chartColors = useChartColors();
  const [selectedCompetitors, setSelectedCompetitors] = useState([]);
  const competitorsQ = trpc.competitors.list.useQuery(undefined, { staleTime: 60_000 });
  const compareQ = trpc.competitors.compareWithFigure.useQuery({}, { staleTime: 60_000 });

  const competitors = competitorsQ.data ?? [];
  const comparison = compareQ.data;

  const toggleCompetitor = (id) => {
    setSelectedCompetitors((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  if (compareQ.isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (!comparison) {
    return (
      <EmptyState
        icon="⚔️"
        title="No comparison data"
        description="Add competitors and run the poll cron to generate comparison data."
      />
    );
  }

  const figure = comparison.figure;
  const allCompetitors = comparison.competitors;
  const displayed = selectedCompetitors.length > 0
    ? allCompetitors.filter((c) => selectedCompetitors.includes(c.id))
    : allCompetitors;

  // Radar chart data
  const radarMetrics = ['Followers', 'Engagement', 'SOV', 'Sentiment', 'Mentions'];
  const maxFollowers = Math.max(figure.followersX, ...displayed.map((c) => c.followersX)) || 1;
  const maxMentions = Math.max(figure.mentionCount, ...displayed.map((c) => c.mentionCount)) || 1;

  const radarData = radarMetrics.map((metric) => {
    const row = { metric };
    row['Figure'] = metric === 'Followers' ? (figure.followersX / maxFollowers) * 100
      : metric === 'Engagement' ? Math.min(figure.avgEngagementRate || 0, 10) * 10
      : metric === 'SOV' ? figure.shareOfVoicePct
      : metric === 'Sentiment' ? figure.sentimentPositivePct
      : (figure.mentionCount / maxMentions) * 100;

    displayed.forEach((c) => {
      row[c.name] = metric === 'Followers' ? (c.followersX / maxFollowers) * 100
        : metric === 'Engagement' ? Math.min(c.avgEngagementRate || 0, 10) * 10
        : metric === 'SOV' ? c.shareOfVoicePct
        : metric === 'Sentiment' ? c.sentimentPositivePct
        : (c.mentionCount / maxMentions) * 100;
    });
    return row;
  });

  const RADAR_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981'];

  return (
    <div className="space-y-6">
      {/* Competitor selector */}
      <div className="bg-surface-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-content-primary">Select Competitors (up to 3)</h4>
          {selectedCompetitors.length > 0 && (
            <button
              onClick={() => setSelectedCompetitors([])}
              className="text-xs text-content-muted hover:text-content-secondary"
            >
              Clear selection
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {competitors.map((c) => (
            <button
              key={c.id}
              onClick={() => toggleCompetitor(c.id)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                selectedCompetitors.includes(c.id)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                  : 'border-border text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Radar chart */}
      <div className="bg-surface-card rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold text-content-primary mb-3">Competitive Radar</h4>
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={chartColors.grid} />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: chartColors.axisText }} />
            <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
            <Radar name="Figure" dataKey="Figure" stroke={RADAR_COLORS[0]} fill={RADAR_COLORS[0]} fillOpacity={0.15} strokeWidth={2} />
            {displayed.map((c, i) => (
              <Radar key={c.id} name={c.name} dataKey={c.name} stroke={RADAR_COLORS[(i + 1) % RADAR_COLORS.length]} fill={RADAR_COLORS[(i + 1) % RADAR_COLORS.length]} fillOpacity={0.1} strokeWidth={2} />
            ))}
            <Legend />
            <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Comparison table */}
      <div className="bg-surface-card rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold text-content-primary mb-3">Side-by-Side Metrics</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-secondary">
                <th className="text-left py-2 px-3 text-content-muted font-medium">Metric</th>
                <th className="text-right py-2 px-3 text-blue-600 dark:text-blue-400 font-semibold">Figure</th>
                {displayed.map((c) => (
                  <th key={c.id} className="text-right py-2 px-3 text-content-muted font-medium">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-secondary">
                <td className="py-3 px-3 text-content-secondary">Followers (X)</td>
                <td className="py-3 px-3 text-right font-medium text-content-primary">{fmtNum(figure.followersX)}</td>
                {displayed.map((c) => (
                  <td key={c.id} className="py-3 px-3 text-right">
                    <span className="text-content-primary">{fmtNum(c.followersX)}</span>
                    <DeltaIndicator ours={figure.followersX} theirs={c.followersX} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border-secondary">
                <td className="py-3 px-3 text-content-secondary">SOV %</td>
                <td className="py-3 px-3 text-right font-medium text-content-primary">{fmtPct(figure.shareOfVoicePct, 1)}</td>
                {displayed.map((c) => (
                  <td key={c.id} className="py-3 px-3 text-right">
                    <span className="text-content-primary">{fmtPct(c.shareOfVoicePct, 1)}</span>
                    <DeltaIndicator ours={figure.shareOfVoicePct} theirs={c.shareOfVoicePct} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border-secondary">
                <td className="py-3 px-3 text-content-secondary">Mentions ({comparison.meta.days}d)</td>
                <td className="py-3 px-3 text-right font-medium text-content-primary">{fmtNum(figure.mentionCount)}</td>
                {displayed.map((c) => (
                  <td key={c.id} className="py-3 px-3 text-right">
                    <span className="text-content-primary">{fmtNum(c.mentionCount)}</span>
                    <DeltaIndicator ours={figure.mentionCount} theirs={c.mentionCount} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border-secondary">
                <td className="py-3 px-3 text-content-secondary">Sentiment (% Positive)</td>
                <td className="py-3 px-3 text-right font-medium text-content-primary">{fmtPct(figure.sentimentPositivePct, 0)}</td>
                {displayed.map((c) => (
                  <td key={c.id} className="py-3 px-3 text-right">
                    <span className="text-content-primary">{fmtPct(c.sentimentPositivePct, 0)}</span>
                    <DeltaIndicator ours={figure.sentimentPositivePct} theirs={c.sentimentPositivePct} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Shows a small indicator of whether Figure is ahead or behind */
function DeltaIndicator({ ours, theirs }) {
  if (!ours || !theirs) return null;
  const diff = ((theirs - ours) / (ours || 1)) * 100;
  if (Math.abs(diff) < 1) return null;
  const ahead = diff > 0; // competitor is ahead of us
  return (
    <span className={`block text-[10px] font-medium ${ahead ? 'text-red-500' : 'text-green-600'}`}>
      {ahead ? '↑' : '↓'} {Math.abs(diff).toFixed(0)}% vs us
    </span>
  );
}

// ============================================================
// CONTENT FEED TAB
// ============================================================

function ContentFeedTab() {
  const [filterCompetitor, setFilterCompetitor] = useState('');
  const [filterFormat, setFilterFormat] = useState('');
  const [filterDays, setFilterDays] = useState(30);
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'top'

  const competitorsQ = trpc.competitors.list.useQuery(undefined, { staleTime: 60_000 });

  // Use different queries based on sort
  const postsQ = trpc.competitors.posts.useQuery({
    ...(filterCompetitor ? { competitorId: filterCompetitor } : {}),
    ...(filterFormat ? { contentType: filterFormat } : {}),
    days: filterDays,
    limit: 30,
  }, { staleTime: 30_000, enabled: sortBy === 'recent' });

  const topContentQ = trpc.competitors.topContent.useQuery({
    ...(filterCompetitor ? { competitorId: filterCompetitor } : {}),
    ...(filterFormat ? { contentType: filterFormat } : {}),
    days: filterDays,
    limit: 30,
  }, { staleTime: 30_000, enabled: sortBy === 'top' });

  const competitors = competitorsQ.data ?? [];
  const posts = sortBy === 'top' ? (topContentQ.data ?? []) : (postsQ.data?.posts ?? []);
  const isLoadingPosts = sortBy === 'top' ? topContentQ.isLoading : postsQ.isLoading;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface-card text-content-primary font-medium"
        >
          <option value="recent">Most Recent</option>
          <option value="top">Top Performing</option>
        </select>
        <select
          value={filterCompetitor}
          onChange={(e) => setFilterCompetitor(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface-card text-content-primary"
        >
          <option value="">All Competitors</option>
          {competitors.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterFormat}
          onChange={(e) => setFilterFormat(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface-card text-content-primary"
        >
          <option value="">All Formats</option>
          <option value="POST">Post</option>
          <option value="THREAD">Thread</option>
          <option value="ARTICLE">Article</option>
        </select>
        <select
          value={filterDays}
          onChange={(e) => setFilterDays(Number(e.target.value))}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface-card text-content-primary"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
        <span className="text-xs text-content-faint ml-auto">
          {posts.length} posts {sortBy === 'top' && '(by engagement)'}
        </span>
      </div>

      {/* Posts list */}
      {isLoadingPosts ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No posts found"
          description="Try adjusting your filters or check back after the competitor poll cron runs."
        />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="bg-surface-card rounded-xl border border-border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-content-primary text-sm">{p.competitorName}</span>
                  <span className="text-xs text-content-faint">@{p.authorUsername}</span>
                  <PlatformBadge platform={p.platform} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-0.5 bg-surface-secondary rounded">{p.contentType}</span>
                  <span className="text-xs text-content-faint">{fmtDate(p.postedAt)}</span>
                </div>
              </div>
              <p className="text-sm text-content-primary mb-3 line-clamp-3">{p.content}</p>
              <div className="flex gap-4 text-xs text-content-muted">
                <span>{fmtNum(p.impressions)} impressions</span>
                <span>{fmtNum(p.likes)} likes</span>
                <span>{fmtNum(p.retweets)} RTs</span>
                <span>{fmtNum(p.replies)} replies</span>
                {p.quotes > 0 && <span>{fmtNum(p.quotes)} quotes</span>}
                <span className="font-medium text-content-secondary">{fmtPct(p.engagementRate * 100)} eng rate</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// AMPLIFIERS TAB
// ============================================================

function AmplifiersTab() {
  const [filterCompetitor, setFilterCompetitor] = useState('');
  const competitorsQ = trpc.competitors.list.useQuery(undefined, { staleTime: 60_000 });
  const amplifiersQ = trpc.competitors.amplifiers.useQuery({
    ...(filterCompetitor ? { competitorId: filterCompetitor } : {}),
    limit: 50,
  }, { staleTime: 60_000 });

  const competitors = competitorsQ.data ?? [];
  const data = amplifiersQ.data;
  const amplifiers = data?.amplifiers ?? [];
  const sharedAmplifiers = data?.sharedAmplifiers ?? [];
  const knownKOLs = data?.knownKOLs ?? [];
  const kolUsernames = new Set(knownKOLs.map((k) => k.username));

  if (amplifiersQ.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  if (amplifiers.length === 0) {
    return (
      <EmptyState
        icon="📡"
        title="No amplifier data yet"
        description="Amplifier data is collected during the daily competitor poll cron. Check back after it runs."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          value={filterCompetitor}
          onChange={(e) => setFilterCompetitor(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface-card text-content-primary"
        >
          <option value="">All Competitors</option>
          {competitors.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className="text-xs text-content-faint ml-auto">{amplifiers.length} amplifiers found</span>
      </div>

      {/* Shared amplifiers highlight */}
      {sharedAmplifiers.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-5">
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3">
            Shared Amplifiers ({sharedAmplifiers.length})
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
            These accounts amplify multiple competitors — potential industry influencers or bots.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sharedAmplifiers.slice(0, 6).map((sa) => (
              <div key={sa.username} className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-content-primary">@{sa.username}</span>
                  {kolUsernames.has(sa.username) && <ScoreBadge score={knownKOLs.find((k) => k.username === sa.username)?.aiScore} />}
                </div>
                <div className="text-right">
                  <div className="text-xs text-content-muted">{sa.totalInteractions} interactions</div>
                  <div className="text-[10px] text-content-faint">{sa.competitors.join(', ')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Known KOLs among amplifiers */}
      {knownKOLs.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
          <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-2">
            Known KOLs Amplifying Competitors ({knownKOLs.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {knownKOLs.map((k) => (
              <span key={k.username} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-900 rounded-lg border border-purple-200 dark:border-purple-800 text-sm">
                <ScoreBadge score={k.aiScore} />
                <span className="text-content-primary font-medium">@{k.username}</span>
                <span className="text-content-faint text-xs">{k.kolName}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Amplifier list */}
      <div className="bg-surface-card rounded-xl border border-border p-5">
        <SectionTitle subtitle="Ranked by interaction count">Top Amplifiers</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-secondary">
                <th className="text-left py-2 px-3 text-content-muted font-medium">#</th>
                <th className="text-left py-2 px-3 text-content-muted font-medium">Account</th>
                <th className="text-left py-2 px-3 text-content-muted font-medium">Competitor</th>
                <th className="text-right py-2 px-3 text-content-muted font-medium">Followers</th>
                <th className="text-right py-2 px-3 text-content-muted font-medium">Interactions</th>
                <th className="text-left py-2 px-3 text-content-muted font-medium">Types</th>
                <th className="text-right py-2 px-3 text-content-muted font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {amplifiers.map((a, i) => (
                <tr key={a.id} className="border-b border-border-secondary last:border-0 hover:bg-surface-hover">
                  <td className="py-3 px-3 text-content-faint">{i + 1}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      {a.avatarUrl && (
                        <img src={a.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                      )}
                      <div>
                        <span className="font-medium text-content-primary">@{a.username}</span>
                        {kolUsernames.has(a.username) && (
                          <span className="ml-1.5"><ScoreBadge score={knownKOLs.find((k) => k.username === a.username)?.aiScore} /></span>
                        )}
                        {a.displayName && (
                          <span className="block text-xs text-content-faint">{a.displayName}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-content-secondary">{a.competitorName}</td>
                  <td className="py-3 px-3 text-right text-content-secondary">{fmtNum(a.followersCount)}</td>
                  <td className="py-3 px-3 text-right font-medium text-content-primary">{a.interactionCount}</td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1">
                      {a.amplificationType.split(',').map((t) => (
                        <span key={t} className="px-1.5 py-0.5 bg-surface-secondary rounded text-[10px] text-content-muted">{t.trim()}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-xs text-content-faint">{timeAgo(a.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
