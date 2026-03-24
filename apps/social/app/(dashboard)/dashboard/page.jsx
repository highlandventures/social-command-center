'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, ScatterChart, Scatter,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { trpc } from '@/lib/trpc-client';
import {
  COLORS, PlatformBadge, TrendArrow, DeltaBadge,
  MetricCard, MetricCardSkeleton, SectionTitle,
  Avatar, Sparkline, Skeleton, useChartColors,
} from '@/components/ui';
import { useSelectedAccount } from '@/lib/account-context';

// ── Fallback / empty data shapes ────────────────────────────
const EMPTY_ENGAGEMENT = [];
const EMPTY_FOLLOWER = { series: [], accounts: [] };
const EMPTY_ACCOUNTS = [];
const EMPTY_SENTIMENT_OVER_TIME = [];
const EMPTY_SENTIMENT_BY_PLATFORM = [];
const EMPTY_SENTIMENT_DRIVERS = [];
const EMPTY_SENTIMENT_ALERTS = [];
const EMPTY_POST_SCATTER = [];
const EMPTY_POST_TABLE = [];
const EMPTY_HEATMAP = [];

// Helper: format date as YYYY-MM-DD
function toDateStr(d) { return d.toISOString().slice(0, 10); }

// Dynamic XAxis interval based on range
function chartInterval(range, startDate, endDate) {
  if (range === 'custom' && startDate && endDate) {
    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (24*60*60*1000));
    if (days <= 14) return 1;
    if (days <= 60) return 4;
    if (days <= 180) return 10;
    return 20;
  }
  const map = { '7d': 1, '30d': 4, '90d': 10, '365d': 30 };
  return map[range] || 6;
}

// Dynamic range label for display
function rangeLabel(range, startDate, endDate) {
  if (range === 'custom' && startDate && endDate) {
    return `${startDate} – ${endDate}`;
  }
  const map = { '7d': '7 days', '30d': '30 days', '90d': '90 days', '365d': '1 year' };
  return map[range] || '30 days';
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState('30d');
  const [detailAccount, setDetailAccount] = useState(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState(() => toDateStr(new Date(Date.now() - 30*24*60*60*1000)));
  const [customEnd, setCustomEnd] = useState(() => toDateStr(new Date()));
  const { selectedAccount } = useSelectedAccount();
  const chartColors = useChartColors();

  // Build query input with optional account filter
  const queryInput = useMemo(() => {
    const q = { range: dateRange };
    if (selectedAccount) q.accountId = selectedAccount;
    if (dateRange === 'custom') {
      q.startDate = customStart;
      q.endDate = customEnd;
    }
    return q;
  }, [dateRange, selectedAccount, customStart, customEnd]);

  // When drilling into a specific account, override the accountId filter
  const detailQueryInput = useMemo(() => {
    if (!detailAccount) return queryInput;
    return { ...queryInput, accountId: detailAccount };
  }, [queryInput, detailAccount]);

  const xInterval = chartInterval(dateRange, customStart, customEnd);

  // ── tRPC queries ──────────────────────────────────────────
  const dashboardQ = trpc.analytics.dashboard.useQuery(
    queryInput,
    { staleTime: 30_000, keepPreviousData: true }
  );

  const accountBreakdownQ = trpc.analytics.accountBreakdown.useQuery(
    queryInput,
    { staleTime: 30_000, keepPreviousData: true }
  );

  const engagementTrendQ = trpc.analytics.engagementTrend.useQuery(
    detailQueryInput,
    { staleTime: 30_000, keepPreviousData: true }
  );

  const followerGrowthQ = trpc.analytics.followerGrowth.useQuery(
    detailQueryInput,
    { staleTime: 30_000, keepPreviousData: true }
  );

  const sentimentQ = trpc.analytics.brandSentiment.useQuery(
    queryInput,
    { staleTime: 30_000, keepPreviousData: true }
  );

  const heatmapQ = trpc.analytics.heatmap.useQuery(
    detailQueryInput,
    { staleTime: 60_000, keepPreviousData: true }
  );

  const postPerfQ = trpc.analytics.postPerformance.useQuery(
    detailQueryInput,
    { staleTime: 30_000, keepPreviousData: true }
  );

  const subredditMetricsQ = trpc.listening.subredditMetrics.useQuery(
    undefined,
    { staleTime: 60_000 }
  );

  // ── Benchmark summary (top 10% crypto accounts) ───
  const benchmarkQ = trpc.benchmarks.summary.useQuery(
    undefined,
    { staleTime: 300_000 }
  );

  // ── AI Analysis ───
  const aiAnalysisMutation = trpc.ai.analyzePerformance.useMutation();
  const [aiAnalysis, setAiAnalysis] = useState(null);

  // ── Derived data (with fallbacks so charts never crash) ───
  const dashboard = dashboardQ.data ?? {};
  const accounts = accountBreakdownQ.data ?? EMPTY_ACCOUNTS;
  const engagementData = engagementTrendQ.data ?? EMPTY_ENGAGEMENT;
  const followerRaw = followerGrowthQ.data ?? EMPTY_FOLLOWER;
  // Support both old (array) and new ({ series, accounts }) response shapes
  const followerData = Array.isArray(followerRaw) ? followerRaw : followerRaw.series;
  const followerAccounts = Array.isArray(followerRaw) ? [] : (followerRaw.accounts || []);

  const brandSentimentOverTime = sentimentQ.data?.overTime ?? EMPTY_SENTIMENT_OVER_TIME;
  const brandSentimentByPlatform = sentimentQ.data?.byPlatform ?? EMPTY_SENTIMENT_BY_PLATFORM;
  const brandSentimentDrivers = sentimentQ.data?.drivers ?? EMPTY_SENTIMENT_DRIVERS;
  const sentimentAlerts = sentimentQ.data?.alerts ?? EMPTY_SENTIMENT_ALERTS;
  const postScatterData = postPerfQ.data ?? EMPTY_POST_SCATTER;
  const postPerformanceTable = postPerfQ.data ?? EMPTY_POST_TABLE;
  const heatmapData = heatmapQ.data ?? EMPTY_HEATMAP;

  // Benchmark reference values (top 10% crypto accounts)
  // Fallback defaults from initial 17-account universe pull (2026-03-14)
  // These auto-update when the weekly Python pipeline pushes fresh data to Redis
  const BENCHMARK_DEFAULTS = {
    engRate: 3.5,
    medianEngRate: 1.8,
    impressions: 45000,
    medianImpressions: 12000,
    bookmarks: 28,
    medianBookmarks: 9,
    distScore: 850,
    medianDistScore: 320,
    universeSize: 17,
    generatedAt: '2026-03-14T00:00:00Z',
  };

  const bm = useMemo(() => {
    const d = benchmarkQ.data;
    return {
      engRate: d?.top10PctEngRate ?? BENCHMARK_DEFAULTS.engRate,
      medianEngRate: d?.medianEngRate ?? BENCHMARK_DEFAULTS.medianEngRate,
      impressions: d?.top10PctImpressions ?? BENCHMARK_DEFAULTS.impressions,
      medianImpressions: d?.medianImpressions ?? BENCHMARK_DEFAULTS.medianImpressions,
      bookmarks: d?.top10PctBookmarks ?? BENCHMARK_DEFAULTS.bookmarks,
      medianBookmarks: d?.medianBookmarks ?? BENCHMARK_DEFAULTS.medianBookmarks,
      distScore: d?.top10PctDistScore ?? BENCHMARK_DEFAULTS.distScore,
      medianDistScore: d?.medianDistScore ?? BENCHMARK_DEFAULTS.medianDistScore,
      universeSize: d?.universeSize ?? BENCHMARK_DEFAULTS.universeSize,
      generatedAt: d?.generatedAt ?? BENCHMARK_DEFAULTS.generatedAt,
    };
  }, [benchmarkQ.data]);

  const totals = useMemo(() => {
    return {
      impressions: dashboard.impressions ?? accounts.reduce((s, a) => s + (a.impressions ?? 0), 0),
      engRate: dashboard.engagementRate
        ? +dashboard.engagementRate.toFixed(1)
        : accounts.length
          ? +(accounts.reduce((s, a) => s + (a.engagementRate ?? 0), 0) / accounts.length).toFixed(1)
          : 0,
      followers: dashboard.totalFollowers ?? accounts.reduce((s, a) => s + (a.followers ?? 0), 0),
      posts: accounts.reduce((s, a) => s + (a.totalPosts ?? 0), 0),
      mentions: dashboard.mentions ?? 0,
    };
  }, [dashboard, accounts]);

  const isLoading = dashboardQ.isLoading || accountBreakdownQ.isLoading;
  const hasError = dashboardQ.isError || accountBreakdownQ.isError;

  // Dynamic delta label based on selected date range
  const deltaLabel = dateRange === '7d' ? 'WoW' : dateRange === '30d' ? 'MoM' : dateRange === '90d' ? 'QoQ' : 'PoP';

  const lastSentimentScore = brandSentimentOverTime.length
    ? brandSentimentOverTime[brandSentimentOverTime.length - 1].score
    : '--';

  // ── Account detail drill-down ────────────────────────────
  if (detailAccount) {
    const acct = accounts.find((a) => a.id === detailAccount);
    if (!acct) {
      setDetailAccount(null);
      return null;
    }

    return (
      <div>
        <button
          onClick={() => setDetailAccount(null)}
          className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
        >
          ← Back to overview
        </button>
        <div className="flex items-center gap-3 mb-6">
          <Avatar initials={(acct.username || '??').slice(0, 2).toUpperCase()} platform={acct.platform} size="lg" />
          <div>
            <h2 className="text-xl font-bold text-content-primary">@{acct.username}</h2>
            <PlatformBadge platform={acct.platform} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <MetricCard label="Impressions" value={(acct.impressions ?? 0).toLocaleString()} />
          <MetricCard label="Eng. Rate" value={`${(acct.engagementRate ?? 0).toFixed(1)}%`} />
          <MetricCard label="Followers" value={(acct.followers ?? 0).toLocaleString()} />
          <MetricCard label="Total Posts" value={acct.totalPosts ?? 0} />
          <MetricCard label="Engagements" value={acct.engagements ?? 0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-card rounded-xl border border-border p-5">
            <SectionTitle>Engagement Over Time</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={xInterval} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
                <Line type="monotone" dataKey="engagementRate" stroke={COLORS.blue} strokeWidth={2} dot={false} name="Eng. Rate %" />
                <Line type="monotone" dataKey="engagements" stroke={COLORS.green} strokeWidth={2} dot={false} name="Engagements" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-surface-card rounded-xl border border-border p-5">
            <SectionTitle>Follower Growth</SectionTitle>
            {followerData.length === 0 ? (
              <div className="h-[240px] flex flex-col items-center justify-center text-content-faint">
                <span className="text-3xl mb-2">{'\uD83D\uDCC8'}</span>
                <p className="text-sm font-medium text-content-muted">No follower data yet</p>
                <p className="text-xs text-content-faint mt-1">Snapshots are captured every 15 min and at 2 AM UTC daily</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={followerData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={xInterval} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
                  <Line type="monotone" dataKey="followers" stroke={chartColors.green} strokeWidth={2} name="Total" dot={false} />
                  {followerAccounts.map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={['#60a5fa', '#f59e0b', '#a78bfa', '#f472b6'][i % 4]} strokeWidth={1.5} strokeDasharray="4 2" name={`@${name}`} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-surface-card rounded-xl border border-border p-5">
            <SectionTitle subtitle="Each dot = one post. Size = total engagements.">Post Performance Map</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="impressions" name="Impressions" tick={{ fontSize: 11 }} />
                <YAxis dataKey="engagementRate" name="Eng. Rate %" tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-surface-card border border-border rounded-lg p-3 shadow-lg max-w-xs">
                        <p className="text-xs text-content-muted mb-1">{d.type}</p>
                        <p className="text-sm font-medium text-content-primary mb-2">{d.content}</p>
                        <div className="flex gap-3 text-xs text-content-secondary">
                          <span>{(d.impressions ?? 0).toLocaleString()} imp</span>
                          <span>{d.engRate}% eng</span>
                          <span>{d.engagements} total</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter data={postScatterData} fill={COLORS.blue} fillOpacity={0.7}>
                  {postScatterData.map((entry, i) => (
                    <Cell
                      key={i}
                      r={Math.max(4, Math.sqrt(entry.engagements ?? 1) / 2)}
                      fill={
                        entry.type === 'thread'
                          ? COLORS.blue
                          : entry.type === 'reddit'
                          ? COLORS.amber
                          : COLORS.indigo
                      }
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-4 text-xs text-content-muted">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Thread</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />Post</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Reddit</span>
              </div>
              <button
                onClick={() => {
                  aiAnalysisMutation.mutate({ range: range === '365d' ? '90d' : range === 'custom' ? '30d' : range }, {
                    onSuccess: (data) => setAiAnalysis(data),
                  });
                }}
                disabled={aiAnalysisMutation.isPending}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-bold">AI</span>
                {aiAnalysisMutation.isPending ? 'Analyzing...' : 'Analyze Performance'}
              </button>
            </div>

            {aiAnalysis && (
              <div className="mt-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">AI</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-900 mb-3">Performance Analysis</p>
                    {aiAnalysis.patterns?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-blue-800 mb-1">Patterns Found</p>
                        {aiAnalysis.patterns.map((p, i) => (
                          <div key={i} className="text-xs text-blue-700 mb-1 flex items-start gap-1.5">
                            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.impact === 'HIGH' ? 'bg-green-500' : p.impact === 'MEDIUM' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                            <span>{p.pattern}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {aiAnalysis.recommendations?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-blue-800 mb-1">Recommendations</p>
                        {aiAnalysis.recommendations.map((r, i) => (
                          <div key={i} className="text-xs text-blue-700 mb-1 flex items-start gap-1.5">
                            <span className={`mt-0.5 px-1 rounded text-[9px] font-bold ${r.priority === 'HIGH' ? 'bg-red-100 text-red-700' : r.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-surface-secondary text-content-secondary'}`}>{r.priority}</span>
                            <span>{r.recommendation}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setAiAnalysis(null)} className="mt-2 text-[10px] text-blue-500 hover:text-blue-700">Dismiss</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface-card rounded-xl border border-border p-5">
            <SectionTitle subtitle="Day x Hour — colored by avg engagement rate">Best Posting Times</SectionTitle>
            <div className="overflow-x-auto">
              <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(18, 1fr)' }}>
                <div />
                {Array.from({ length: 17 }, (_, i) => (
                  <div key={i} className="text-center text-[10px] text-content-faint">{i + 6}</div>
                ))}
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <>
                    <div key={day} className="text-[10px] text-content-muted flex items-center">{day}</div>
                    {heatmapData
                      .filter((d) => d.day === day)
                      .map((cell, j) => {
                        const intensity = Math.min(1, ((cell.engRate ?? 0) - 1) / 7);
                        return (
                          <div
                            key={j}
                            className="aspect-square rounded-sm"
                            style={{ backgroundColor: `rgba(59, 130, 246, ${0.1 + intensity * 0.8})` }}
                            title={`${cell.day} ${cell.hour}:00 — ${cell.engRate}%`}
                          />
                        );
                      })}
                  </>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-content-muted">
              <span>Low</span>
              <div className="flex gap-0.5">
                {[0.15, 0.3, 0.5, 0.7, 0.9].map((o, i) => (
                  <div key={i} className="w-4 h-3 rounded-sm" style={{ backgroundColor: `rgba(59, 130, 246, ${o})` }} />
                ))}
              </div>
              <span>High</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-card rounded-xl border border-border p-5">
          <SectionTitle>Post Performance Table</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Post', 'Platform', 'Type', 'Published', 'Impressions', 'Engagements', 'Eng. Rate', 'Clicks', 'CTR'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-content-muted uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {postPerformanceTable.map((post, i) => (
                  <tr key={i} className="border-b border-border-secondary hover:bg-surface-hover">
                    <td className="py-3 px-3 max-w-xs truncate font-medium text-content-primary">{post.content}</td>
                    <td className="py-3 px-3"><PlatformBadge platform={post.platform} /></td>
                    <td className="py-3 px-3 text-content-secondary">{post.type}</td>
                    <td className="py-3 px-3 text-content-muted">{post.published}</td>
                    <td className="py-3 px-3 font-medium">{(post.impressions ?? 0).toLocaleString()}</td>
                    <td className="py-3 px-3 font-medium">{post.engagements}</td>
                    <td className="py-3 px-3">
                      <span className={`font-medium ${(post.engRate ?? 0) > 5 ? 'text-green-600' : 'text-content-primary'}`}>{post.engRate}%</span>
                    </td>
                    <td className="py-3 px-3">{post.clicks}</td>
                    <td className="py-3 px-3">{post.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Main overview ─────────────────────────────────────────
  return (
    <div>
      {/* Date range selector */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {['7d', '30d', '90d', '365d'].map((r) => (
          <button
            key={r}
            onClick={() => { setDateRange(r); setShowCustomPicker(false); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
              dateRange === r
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
            }`}
          >
            {r === '7d' ? 'Last 7 days' : r === '30d' ? 'Last 30 days' : r === '90d' ? 'Last 90 days' : 'Last year'}
          </button>
        ))}
        <button
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
            dateRange === 'custom'
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
          }`}
        >
          {dateRange === 'custom' ? rangeLabel('custom', customStart, customEnd) : 'Custom'}
        </button>
        {showCustomPicker && (
          <div className="flex items-center gap-2 ml-2 bg-surface-card border border-border rounded-lg px-3 py-1.5 shadow-sm">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <span className="text-xs text-content-faint">to</span>
            <input
              type="date"
              value={customEnd}
              max={toDateStr(new Date())}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <button
              onClick={() => { setDateRange('custom'); setShowCustomPicker(false); }}
              disabled={!customStart || !customEnd || customStart > customEnd}
              className="px-2.5 py-1 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Error banner */}
      {hasError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          Failed to load dashboard data. {dashboardQ.error?.message || accountBreakdownQ.error?.message || 'Please try again.'}
        </div>
      )}

      {/* Aggregate summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
          {Array.from({ length: 5 }).map((_, i) => <MetricCardSkeleton key={i} />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-surface-card rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-12 mb-8 text-center">
          <div className="text-4xl mb-3">{'\uD83D\uDCE1'}</div>
          <h3 className="text-lg font-semibold text-content-primary mb-1">No accounts connected</h3>
          <p className="text-sm text-content-muted mb-4">
            Connect your X or Reddit account from the Admin tab to start tracking analytics.
          </p>
          <a
            href="/admin"
            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
          >
            Go to Admin Settings
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <MetricCard
            label="Total Impressions"
            value={totals.impressions > 1000 ? `${(totals.impressions / 1000).toFixed(1)}K` : totals.impressions}
            delta={dashboard.impressionsDelta != null ? +dashboard.impressionsDelta.toFixed(0) : undefined}
            deltaLabel={deltaLabel}
            benchmark={{
              label: 'Top 10% /post',
              value: bm.impressions > 1000 ? `${(bm.impressions / 1000).toFixed(1)}K` : Math.round(bm.impressions).toLocaleString(),
              delta: totals.posts > 0 && bm.impressions ? +((totals.impressions / totals.posts - bm.impressions) / bm.impressions * 100).toFixed(0) : undefined,
            }}
          />
          <MetricCard
            label="Avg Eng. Rate"
            value={`${totals.engRate}%`}
            delta={dashboard.engagementRateDelta != null ? +dashboard.engagementRateDelta.toFixed(0) : undefined}
            deltaLabel={deltaLabel}
            benchmark={{
              label: 'Top 10% avg',
              value: `${bm.engRate.toFixed(1)}%`,
              delta: bm.engRate ? +((totals.engRate - bm.engRate) / bm.engRate * 100).toFixed(0) : undefined,
            }}
          />
          <MetricCard
            label="Total Followers"
            value={totals.followers.toLocaleString()}
            delta={dashboard.followersDelta != null ? +dashboard.followersDelta.toFixed(1) : undefined}
            deltaLabel={deltaLabel}
          />
          <MetricCard
            label="Engagements"
            value={(dashboard.engagements ?? 0).toLocaleString()}
            delta={dashboard.engagementsDelta != null ? +dashboard.engagementsDelta.toFixed(0) : undefined}
            deltaLabel={deltaLabel}
            benchmark={{
              label: 'Top 10% Dist. Score',
              value: Math.round(bm.distScore).toLocaleString(),
            }}
          />
          <MetricCard
            label="Posts Tracked"
            value={totals.posts}
          />
        </div>
      )}

      {/* Per-account breakdown */}
      <div className="bg-surface-card rounded-xl border border-border p-5 mb-8">
        <SectionTitle subtitle="Click any row to drill into detailed analytics">Per-Account Breakdown</SectionTitle>
        {accountBreakdownQ.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Account', 'Platform', 'Followers', 'Impressions', 'Eng. Rate', 'Posts'].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium text-content-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct) => (
                <tr
                  key={acct.id}
                  onClick={() => setDetailAccount(acct.id)}
                  className="border-b border-border-secondary hover:bg-surface-hover cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={(acct.username || '??').slice(0, 2).toUpperCase()} src={acct.avatarUrl} platform={acct.platform} size="sm" />
                      <span className="font-medium text-content-primary">@{acct.username}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3"><PlatformBadge platform={acct.platform} /></td>
                  <td className="py-3 px-3 font-medium">{(acct.followers ?? 0).toLocaleString()}</td>
                  <td className="py-3 px-3">
                    <span>{(acct.impressions ?? 0).toLocaleString()}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-medium">{(acct.engagementRate ?? 0).toFixed(1)}%</span>
                  </td>
                  <td className="py-3 px-3">{acct.totalPosts ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reddit Communities */}
      {(subredditMetricsQ.data?.length > 0) && (
        <div className="bg-surface-card rounded-xl border border-border p-5 mb-8">
          <SectionTitle subtitle="Subscriber counts, posts, and engagement for tracked subreddits">Reddit Communities</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {subredditMetricsQ.data.map((sub) => {
              const latest = sub.history?.length > 0 ? sub.history[sub.history.length - 1] : null;
              const prev = sub.history?.length > 1 ? sub.history[sub.history.length - 2] : null;
              const subGrowth = latest && prev && prev.subscribers > 0
                ? latest.subscribers - prev.subscribers
                : null;
              return (
                <div key={sub.id} className="border border-border-secondary rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.066 9.645c.183.996.07 2.003-.104 2.95a5.32 5.32 0 01-.48 1.502c.036.206.055.42.055.636 0 3.096-3.578 5.607-7.987 5.607-4.41 0-7.987-2.511-7.987-5.607 0-.187.015-.373.043-.556a5.32 5.32 0 01-.602-1.813c-.218-.948-.333-1.958-.15-2.955a2.27 2.27 0 011.9-1.882c.573-.088 1.168.09 1.63.472 1.497-.978 3.41-1.576 5.455-1.665l1.077-4.77a.37.37 0 01.444-.276l3.39.717a1.573 1.573 0 013.117.287c0 .867-.705 1.572-1.572 1.572-.866 0-1.571-.705-1.571-1.572 0-.156.023-.308.065-.452l-3.013-.636-.964 4.262c1.964.117 3.795.72 5.235 1.673.46-.38 1.053-.556 1.623-.47a2.27 2.27 0 011.898 1.882z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-content-primary text-sm">r/{sub.name}</h4>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-content-muted text-xs">Subscribers</p>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-lg text-content-primary">
                          {sub.latestSubscribers != null ? sub.latestSubscribers.toLocaleString() : '—'}
                        </p>
                        {subGrowth != null && subGrowth !== 0 && (
                          <span className={`text-xs font-medium ${subGrowth > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {subGrowth > 0 ? '+' : ''}{subGrowth.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-content-muted text-xs">Posts (today)</p>
                      <p className="font-bold text-lg text-content-primary">{latest?.posts ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-content-muted text-xs">Avg Upvotes</p>
                      <p className="font-medium text-content-primary">{latest?.avgUpvotes != null ? latest.avgUpvotes.toFixed(1) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-content-muted text-xs">Avg Comments</p>
                      <p className="font-medium text-content-primary">{latest?.avgComments != null ? latest.avgComments.toFixed(1) : '—'}</p>
                    </div>
                  </div>
                  {latest?.topPostTitle && (
                    <div className="mt-3 pt-3 border-t border-border-secondary">
                      <p className="text-[10px] text-content-muted uppercase tracking-wider mb-1">Top Post</p>
                      <p className="text-xs text-content-secondary line-clamp-2">{latest.topPostTitle}</p>
                      <span className="text-[10px] text-content-faint">{latest.topPostScore} upvotes</span>
                    </div>
                  )}
                  {sub.history?.length > 1 && (
                    <div className="mt-3">
                      <Sparkline
                        data={sub.history.map((h) => h.subscribers)}
                        color="#f97316"
                        height={32}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Brand Sentiment */}
      <div className="bg-surface-card rounded-xl border border-border p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle subtitle="AI-powered sentiment analysis across all mentions, replies, and conversations">Brand Sentiment</SectionTitle>
          <div className="flex items-center gap-3">
            {sentimentAlerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  alert.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700' : 'bg-green-50 dark:bg-green-900/30 text-green-700'
                }`}
              >
                <span>{alert.severity === 'warning' ? '\u26A0' : '\u2713'}</span>
                <span className="max-w-[200px] truncate">{alert.message}</span>
                <span className="text-content-faint ml-1">{alert.time}</span>
              </div>
            ))}
          </div>
        </div>

        {sentimentQ.isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48 lg:col-span-2" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sentiment Score + Gauge */}
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-content-primary">{lastSentimentScore}</div>
                  <div className="text-xs text-content-muted mt-0.5">Overall Score</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <TrendArrow direction="up" />
                    <span className="text-xs text-green-600 font-medium">
                      +{sentimentQ.data?.scoreDelta ?? 2.8} vs last period
                    </span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {[
                    { label: 'Positive', pct: sentimentQ.data?.breakdown?.positive ?? 62, color: 'bg-green-500' },
                    { label: 'Neutral', pct: sentimentQ.data?.breakdown?.neutral ?? 26, color: 'bg-gray-400' },
                    { label: 'Negative', pct: sentimentQ.data?.breakdown?.negative ?? 12, color: 'bg-red-500' },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-content-muted w-12">{s.label}</span>
                      <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-content-secondary w-8 text-right">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-platform breakdown */}
              <div className="border-t border-border-secondary pt-3 space-y-2">
                <div className="text-xs font-medium text-content-muted uppercase tracking-wider">By Platform</div>
                {brandSentimentByPlatform.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <PlatformBadge platform={p.platform} />
                      <span className="text-sm font-medium">{p.score}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-600">{p.positive}% pos</span>
                      <span className="text-content-faint">{p.neutral}% neu</span>
                      <span className="text-red-500">{p.negative}% neg</span>
                      <span className={`font-medium ${p.change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {p.change > 0 ? '↑' : '↓'} {Math.abs(p.change)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sentiment over time chart */}
            <div className="lg:col-span-2">
              <div className="text-xs font-medium text-content-muted uppercase tracking-wider mb-2">Sentiment Trend ({rangeLabel(dateRange, customStart, customEnd)})</div>
              {brandSentimentOverTime.length < 2 ? (
                <div className="h-[200px] flex flex-col items-center justify-center text-content-faint">
                  <p className="text-sm font-medium text-content-muted">Collecting sentiment data...</p>
                  <p className="text-xs text-content-faint mt-1">Trend charts appear once 2+ data points are available.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={brandSentimentOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={xInterval} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
                    <Area type="monotone" dataKey="positive" stackId="1" stroke={chartColors.green} fill={chartColors.fillGreen} name="Positive %" />
                    <Area type="monotone" dataKey="neutral" stackId="1" stroke={chartColors.gray} fill={chartColors.fillGray} name="Neutral %" />
                    <Area type="monotone" dataKey="negative" stackId="1" stroke={chartColors.red} fill={chartColors.fillRed} name="Negative %" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* Sentiment Drivers */}
        <div className="mt-4 border-t border-border-secondary pt-4">
          <div className="text-xs font-medium text-content-muted uppercase tracking-wider mb-3">Sentiment Drivers — Trending Phrases</div>
          {brandSentimentDrivers.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-content-muted">Not enough conversation data to detect themes yet.</p>
              <p className="text-xs text-content-faint mt-1">Drivers appear when recurring phrases are found across 3+ listening hits.</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {brandSentimentDrivers.map((d) => (
              <div key={d.theme} className="p-3 rounded-lg border border-border-secondary bg-surface-page hover:bg-surface-card transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-content-primary">{d.theme}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      d.impact === 'high'
                        ? 'bg-red-50 dark:bg-red-900/30 text-red-600'
                        : d.impact === 'medium'
                        ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'
                        : 'bg-surface-secondary text-content-muted'
                    }`}
                  >
                    {d.impact} impact
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`text-lg font-bold ${d.sentiment >= 70 ? 'text-green-600' : d.sentiment >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                    {d.sentiment}
                  </div>
                  <TrendArrow direction={d.trend} />
                </div>
                <div className="text-[10px] text-content-muted">
                  <span className="font-medium text-content-secondary">&quot;{d.topKeyword}&quot;</span> &middot; {d.volume} mentions
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Quick trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <SectionTitle>Engagement Trend (All Accounts)</SectionTitle>
          {engagementTrendQ.isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : engagementData.length < 2 ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-content-faint">
              <p className="text-sm font-medium text-content-muted">Collecting engagement data...</p>
              <p className="text-xs text-content-faint mt-1">Charts appear once 2+ data points are available.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={xInterval} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
                <Line type="monotone" dataKey="engagementRate" stroke={COLORS.blue} strokeWidth={2} dot={false} name="Eng. Rate %" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <SectionTitle>Follower Growth (Per Account)</SectionTitle>
          {followerGrowthQ.isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : followerData.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-content-faint">
              <span className="text-3xl mb-2">{'\uD83D\uDCC8'}</span>
              <p className="text-sm font-medium text-content-muted">No follower data yet</p>
              <p className="text-xs text-content-faint mt-1">Snapshots are captured every 15 min and at 2 AM UTC daily</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={followerData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={xInterval} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
                {followerAccounts.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={['#60a5fa', '#f59e0b', '#a78bfa', '#f472b6'][i % 4]} strokeWidth={2} name={`@${name}`} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
