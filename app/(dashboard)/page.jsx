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
  Avatar, Sparkline, Skeleton,
} from '@/components/ui';

// ── Fallback / empty data shapes ────────────────────────────
const EMPTY_ENGAGEMENT = [];
const EMPTY_FOLLOWER = [];
const EMPTY_ACCOUNTS = [];
const EMPTY_SENTIMENT_OVER_TIME = [];
const EMPTY_SENTIMENT_BY_PLATFORM = [];
const EMPTY_SENTIMENT_DRIVERS = [];
const EMPTY_SENTIMENT_ALERTS = [];
const EMPTY_POST_SCATTER = [];
const EMPTY_POST_TABLE = [];
const EMPTY_HEATMAP = [];

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState('30d');
  const [detailAccount, setDetailAccount] = useState(null);

  // ── tRPC queries ──────────────────────────────────────────
  const dashboardQ = trpc.analytics.dashboard.useQuery(
    { range: dateRange },
    { staleTime: 30_000 }
  );

  const accountBreakdownQ = trpc.analytics.accountBreakdown.useQuery(
    { range: dateRange },
    { staleTime: 30_000 }
  );

  const engagementTrendQ = trpc.analytics.engagementTrend.useQuery(
    { range: dateRange },
    { staleTime: 30_000 }
  );

  const followerGrowthQ = trpc.analytics.followerGrowth.useQuery(
    { range: dateRange },
    { staleTime: 30_000 }
  );

  const sentimentQ = trpc.analytics.brandSentiment.useQuery(
    undefined,
    { staleTime: 30_000 }
  );

  const heatmapQ = trpc.analytics.heatmap.useQuery(
    { range: dateRange },
    { staleTime: 60_000 }
  );

  const postPerfQ = trpc.analytics.postPerformance.useQuery(
    { range: dateRange },
    { staleTime: 30_000 }
  );

  // ── Derived data (with fallbacks so charts never crash) ───
  const dashboard = dashboardQ.data ?? {};
  const accounts = accountBreakdownQ.data ?? EMPTY_ACCOUNTS;
  const engagementData = engagementTrendQ.data ?? EMPTY_ENGAGEMENT;
  const followerData = followerGrowthQ.data ?? EMPTY_FOLLOWER;

  const brandSentimentOverTime = sentimentQ.data?.overTime ?? EMPTY_SENTIMENT_OVER_TIME;
  const brandSentimentByPlatform = sentimentQ.data?.byPlatform ?? EMPTY_SENTIMENT_BY_PLATFORM;
  const brandSentimentDrivers = sentimentQ.data?.drivers ?? EMPTY_SENTIMENT_DRIVERS;
  const sentimentAlerts = sentimentQ.data?.alerts ?? EMPTY_SENTIMENT_ALERTS;
  const postScatterData = postPerfQ.data ?? EMPTY_POST_SCATTER;
  const postPerformanceTable = postPerfQ.data ?? EMPTY_POST_TABLE;
  const heatmapData = heatmapQ.data ?? EMPTY_HEATMAP;

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

  // Dynamic delta label based on selected date range
  const deltaLabel = dateRange === '7d' ? 'WoW' : dateRange === '30d' ? 'MoM' : 'PoP';

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
            <h2 className="text-xl font-bold text-gray-900">@{acct.username}</h2>
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle>Engagement Over Time</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="engagementRate" stroke={COLORS.blue} strokeWidth={2} dot={false} name="Eng. Rate %" />
                <Line type="monotone" dataKey="engagements" stroke={COLORS.green} strokeWidth={2} dot={false} name="Engagements" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle>Follower Growth</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={followerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="followers" stroke={COLORS.green} fill="#dcfce7" strokeWidth={2} name="Followers" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle subtitle="Each dot = one post. Size = total engagements.">Post Performance Map</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="impressions" name="Impressions" tick={{ fontSize: 11 }} />
                <YAxis dataKey="engagementRate" name="Eng. Rate %" tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg max-w-xs">
                        <p className="text-xs text-gray-500 mb-1">{d.type}</p>
                        <p className="text-sm font-medium text-gray-900 mb-2">{d.content}</p>
                        <div className="flex gap-3 text-xs text-gray-600">
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
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Thread</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />Post</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Reddit</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle subtitle="Day x Hour — colored by avg engagement rate">Best Posting Times</SectionTitle>
            <div className="overflow-x-auto">
              <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(18, 1fr)' }}>
                <div />
                {Array.from({ length: 17 }, (_, i) => (
                  <div key={i} className="text-center text-[10px] text-gray-400">{i + 6}</div>
                ))}
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <>
                    <div key={day} className="text-[10px] text-gray-500 flex items-center">{day}</div>
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
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
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

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>Post Performance Table</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Post', 'Platform', 'Type', 'Published', 'Impressions', 'Engagements', 'Eng. Rate', 'Clicks', 'CTR'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {postPerformanceTable.map((post, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3 max-w-xs truncate font-medium text-gray-900">{post.content}</td>
                    <td className="py-3 px-3"><PlatformBadge platform={post.platform} /></td>
                    <td className="py-3 px-3 text-gray-600">{post.type}</td>
                    <td className="py-3 px-3 text-gray-500">{post.published}</td>
                    <td className="py-3 px-3 font-medium">{(post.impressions ?? 0).toLocaleString()}</td>
                    <td className="py-3 px-3 font-medium">{post.engagements}</td>
                    <td className="py-3 px-3">
                      <span className={`font-medium ${(post.engRate ?? 0) > 5 ? 'text-green-600' : 'text-gray-900'}`}>{post.engRate}%</span>
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
      <div className="flex items-center gap-2 mb-6">
        {['7d', '30d', '90d', 'Custom'].map((r) => (
          <button
            key={r}
            onClick={() => setDateRange(r)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
              dateRange === r
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {r === '7d' ? 'Last 7 days' : r === '30d' ? 'Last 30 days' : r === '90d' ? 'Last 90 days' : 'Custom'}
          </button>
        ))}
      </div>

      {/* Aggregate summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
          {Array.from({ length: 5 }).map((_, i) => <MetricCardSkeleton key={i} />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 mb-8 text-center">
          <div className="text-4xl mb-3">{'\uD83D\uDCE1'}</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No accounts connected</h3>
          <p className="text-sm text-gray-500 mb-4">
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
          <MetricCard label="Total Impressions" value={totals.impressions > 1000 ? `${(totals.impressions / 1000).toFixed(1)}K` : totals.impressions} delta={dashboard.impressionsDelta != null ? +dashboard.impressionsDelta.toFixed(0) : undefined} deltaLabel={deltaLabel} />
          <MetricCard label="Avg Eng. Rate" value={`${totals.engRate}%`} delta={dashboard.engagementRateDelta != null ? +dashboard.engagementRateDelta.toFixed(0) : undefined} deltaLabel={deltaLabel} />
          <MetricCard label="Total Followers" value={totals.followers.toLocaleString()} delta={dashboard.followersDelta != null ? +dashboard.followersDelta.toFixed(1) : undefined} deltaLabel={deltaLabel} />
          <MetricCard label="Engagements" value={(dashboard.engagements ?? 0).toLocaleString()} delta={dashboard.engagementsDelta != null ? +dashboard.engagementsDelta.toFixed(0) : undefined} deltaLabel={deltaLabel} />
          <MetricCard label="Posts Tracked" value={totals.posts} />
        </div>
      )}

      {/* Per-account breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
        <SectionTitle subtitle="Click any row to drill into detailed analytics">Per-Account Breakdown</SectionTitle>
        {accountBreakdownQ.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {['Account', 'Platform', 'Followers', 'Impressions', 'Eng. Rate', 'Posts'].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct) => (
                <tr
                  key={acct.id}
                  onClick={() => setDetailAccount(acct.id)}
                  className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={(acct.username || '??').slice(0, 2).toUpperCase()} platform={acct.platform} size="sm" />
                      <span className="font-medium text-gray-900">@{acct.username}</span>
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

      {/* Brand Sentiment */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle subtitle="AI-powered sentiment analysis across all mentions, replies, and conversations">Brand Sentiment</SectionTitle>
          <div className="flex items-center gap-3">
            {sentimentAlerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  alert.severity === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                }`}
              >
                <span>{alert.severity === 'warning' ? '\u26A0' : '\u2713'}</span>
                <span className="max-w-[200px] truncate">{alert.message}</span>
                <span className="text-gray-400 ml-1">{alert.time}</span>
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
                  <div className="text-4xl font-bold text-gray-900">{lastSentimentScore}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Overall Score</div>
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
                      <span className="text-[10px] text-gray-500 w-12">{s.label}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-8 text-right">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-platform breakdown */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">By Platform</div>
                {brandSentimentByPlatform.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <PlatformBadge platform={p.platform} />
                      <span className="text-sm font-medium">{p.score}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-600">{p.positive}% pos</span>
                      <span className="text-gray-400">{p.neutral}% neu</span>
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
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Sentiment Trend (30 days)</div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={brandSentimentOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="positive" stackId="1" stroke="#22c55e" fill="#dcfce7" name="Positive %" />
                  <Area type="monotone" dataKey="neutral" stackId="1" stroke="#9ca3af" fill="#f3f4f6" name="Neutral %" />
                  <Area type="monotone" dataKey="negative" stackId="1" stroke="#ef4444" fill="#fee2e2" name="Negative %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Sentiment Drivers */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Sentiment Drivers — AI-Detected Themes</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {brandSentimentDrivers.map((d) => (
              <div key={d.theme} className="p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-900">{d.theme}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      d.impact === 'high'
                        ? 'bg-red-50 text-red-600'
                        : d.impact === 'medium'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-gray-100 text-gray-500'
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
                <div className="text-[10px] text-gray-500">
                  <span className="font-medium text-gray-600">&quot;{d.topKeyword}&quot;</span> &middot; {d.volume} mentions
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>Engagement Trend (All Accounts)</SectionTitle>
          {engagementTrendQ.isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={6} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="engagementRate" stroke={COLORS.blue} strokeWidth={2} dot={false} name="Eng. Rate %" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>Follower Growth (All Accounts)</SectionTitle>
          {followerGrowthQ.isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={followerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={6} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="followers" stroke={COLORS.green} fill="#dcfce7" strokeWidth={2} name="Total Followers" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
