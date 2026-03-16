'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { trpc } from '@/lib/trpc-client';
import { TabButton, SectionTitle, Skeleton, useChartColors } from '@/components/ui';
import ReportViewer from '@/components/ReportViewer';

export default function ReportsPage() {
  const [subTab, setSubTab] = useState('builder');
  const [aiPrompt, setAiPrompt] = useState('');
  const [reportType, setReportType] = useState('WEEKLY_PERFORMANCE');
  const [reportTypeFilter, setReportTypeFilter] = useState('all');
  const [selectedBenchmark, setSelectedBenchmark] = useState('engRate');
  const chartColors = useChartColors();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);

  // ── tRPC queries ──────────────────────────────────────────
  const reportsQ = trpc.reports.list.useQuery(undefined, { staleTime: 30_000 });
  const benchmarksQ = trpc.reports.getBenchmarks.useQuery(undefined, { staleTime: 60_000 });

  const utils = trpc.useUtils();

  const generateMutation = trpc.reports.generate.useMutation({
    onSuccess: (data) => {
      utils.reports.list.invalidate();
      setIsGenerating(false);
      setGeneratedReport(data);
    },
    onError: () => {
      setIsGenerating(false);
    },
  });

  // ── Derived ───────────────────────────────────────────────
  const reportRepository = reportsQ.data ?? [];
  const benchmarkData = benchmarksQ.data ?? [];

  const filteredReports =
    reportTypeFilter === 'all'
      ? reportRepository
      : reportRepository.filter((r) => (r.reportType || '').toLowerCase().includes(reportTypeFilter));

  const reportTypeLabels = {
    WEEKLY_PERFORMANCE: 'Weekly Performance',
    MONTHLY_SUMMARY: 'Monthly Summary',
    COMPETITIVE_ANALYSIS: 'Competitive Analysis',
    KOL_REPORT: 'KOL Report',
    CUSTOM: 'Custom',
  };

  const handleGenerate = () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setGeneratedReport(null);
    generateMutation.mutate({
      title: `${reportTypeLabels[reportType] || 'Custom'} Report — ${new Date().toLocaleDateString()}`,
      reportType,
      prompt: aiPrompt,
    });
  };

  return (
    <div>
      {/* Sub-navigation */}
      <div className="flex items-center gap-2 mb-6 border-b border-border pb-3">
        {[
          { key: 'builder', label: 'AI Report Builder' },
          { key: 'repository', label: 'Report Repository', badge: reportRepository.length || undefined },
          { key: 'benchmarks', label: 'Historical Benchmarks' },
          { key: 'schedules', label: 'Schedules', href: '/reports/schedules' },
        ].map((t) => (
          t.href ? (
            <Link key={t.key} href={t.href}>
              <TabButton active={false} badge={t.badge}>{t.label}</TabButton>
            </Link>
          ) : (
          <TabButton key={t.key} active={subTab === t.key} onClick={() => setSubTab(t.key)} badge={t.badge}>
            {t.label}
          </TabButton>
          )
        ))}
      </div>

      {/* ── AI Report Builder ─── */}
      {subTab === 'builder' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Describe the report you need — AI drafts it, you refine it">AI Report Builder</SectionTitle>
          </div>

          {/* AI Prompt Area */}
          <div className="bg-surface-card rounded-xl border border-border p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
              <div className="flex-1">
                <p className="text-sm text-content-secondary mb-3">
                  Tell me what report you need and I&apos;ll draft it using your real data. You can refine any section before finalizing.
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-content-muted">Report type:</span>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-surface-card"
                  >
                    {Object.entries(reportTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full p-3 text-sm border border-border rounded-lg resize-none leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder='e.g. "Create a weekly performance report for the last 7 days, highlight our top 3 posts, include competitor comparison, and add sentiment trends. Make it executive-friendly."'
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-content-faint">Quick templates:</span>
                    {[
                      { label: 'Weekly performance', type: 'WEEKLY_PERFORMANCE' },
                      { label: 'Monthly executive summary', type: 'MONTHLY_SUMMARY' },
                      { label: 'KOL campaign review', type: 'KOL_REPORT' },
                      { label: 'Competitor deep dive', type: 'COMPETITIVE_ANALYSIS' },
                      { label: 'Content audit', type: 'CUSTOM' },
                    ].map((t) => (
                      <button
                        key={t.label}
                        onClick={() => {
                          setReportType(t.type);
                          setAiPrompt(
                            `Generate a ${t.label.toLowerCase()} report for the most recent period. Include key metrics, trends, highlights, and strategic recommendations.`
                          );
                        }}
                        className="text-xs px-2.5 py-1 bg-surface-secondary text-content-secondary rounded-lg hover:bg-surface-hover hover:text-blue-600 transition-colors"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={!aiPrompt.trim() || isGenerating}
                    className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                      aiPrompt.trim() && !isGenerating
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-surface-secondary text-content-faint cursor-not-allowed'
                    }`}
                  >
                    {isGenerating ? 'Generating...' : 'Generate Report'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Report Preview / Editor */}
          <div className="bg-surface-card rounded-xl border border-border overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-3 bg-surface-page border-b border-border">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-semibold text-content-primary">Report Preview</h4>
                {generatedReport && (
                  <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">AI Draft</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs text-content-muted hover:text-content-secondary px-2 py-1 rounded hover:bg-surface-hover">Edit</button>
                <button className="text-xs text-content-muted hover:text-content-secondary px-2 py-1 rounded hover:bg-surface-hover">Export PDF</button>
                <button className="text-xs text-content-muted hover:text-content-secondary px-2 py-1 rounded hover:bg-surface-hover">Export Slides</button>
                <button className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save to Repository</button>
              </div>
            </div>

            <div className="p-6 max-h-[500px] overflow-y-auto">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-content-muted">Generating your report with AI...</p>
                  <p className="text-xs text-content-faint mt-1">This may take 15-30 seconds</p>
                </div>
              ) : generatedReport ? (
                <div>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-content-primary">{generatedReport.title}</h2>
                    <p className="text-sm text-content-muted mt-1">
                      Generated {new Date(generatedReport.createdAt).toLocaleDateString()} | {reportTypeLabels[generatedReport.reportType] || 'Report'}
                    </p>
                  </div>
                  <ReportViewer report={generatedReport} />
                </div>
              ) : (
                <div className="text-center py-12 text-content-faint">
                  <p className="text-sm">Select a report type and describe what you need, then click Generate.</p>
                  <p className="text-xs mt-1">Your report will appear here.</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent AI generations */}
          <div className="bg-surface-page rounded-xl border border-border p-4">
            <h4 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3">Recent Generations</h4>
            <div className="space-y-2">
              {[
                { prompt: 'Weekly performance report for Feb 24–Mar 2', time: '2h ago', status: 'Saved' },
                { prompt: 'Quick competitor comparison — Competitor A vs Highland', time: '1d ago', status: 'Draft' },
                { prompt: 'KOL ROI analysis for Q1 campaign partners', time: '3d ago', status: 'Saved' },
              ].map((gen, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-surface-card rounded-lg border border-border-secondary">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[9px] font-bold">AI</div>
                    <span className="text-sm text-content-secondary truncate max-w-md">{gen.prompt}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        gen.status === 'Saved' ? 'bg-green-50 dark:bg-green-900/30 text-green-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'
                      }`}
                    >
                      {gen.status}
                    </span>
                    <span className="text-xs text-content-faint">{gen.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Repository ─── */}
      {subTab === 'repository' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="All saved reports with version history and download options">Report Repository</SectionTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-1">
                {['all', 'weekly', 'monthly', 'campaign', 'competitor', 'audit'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setReportTypeFilter(f)}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                      reportTypeFilter === f ? 'bg-surface-card shadow-sm text-content-primary' : 'text-content-muted'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {reportsQ.isLoading ? (
            <Skeleton className="h-[300px] w-full rounded-xl" />
          ) : (
            <div className="bg-surface-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-page">
                    {['Report', 'Type', 'Created By', 'Date', 'Pages', 'AI %', 'Downloads', ''].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-content-muted uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="border-b border-border-secondary hover:bg-surface-hover cursor-pointer transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{'\uD83D\uDCC4'}</span>
                          <div>
                            <span className="font-medium text-content-primary block">{report.title}</span>
                            {!report.content && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded font-medium">Draft</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            report.reportType === 'WEEKLY_PERFORMANCE'
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'
                              : report.reportType === 'MONTHLY_SUMMARY'
                              ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600'
                              : report.reportType === 'KOL_REPORT'
                              ? 'bg-green-50 dark:bg-green-900/30 text-green-600'
                              : report.reportType === 'COMPETITIVE_ANALYSIS'
                              ? 'bg-red-50 dark:bg-red-900/30 text-red-600'
                              : 'bg-surface-secondary text-content-secondary'
                          }`}
                        >
                          {reportTypeLabels[report.reportType] || report.reportType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {(report.aiPct ?? 0) > 0 && (
                            <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[8px] font-bold">AI</span>
                          )}
                          <span className="text-content-secondary text-xs">{report.createdById || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-content-muted text-xs">{new Date(report.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-content-secondary">—</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${report.aiPct ?? 0}%` }} />
                          </div>
                          <span className="text-xs text-content-muted">{report.aiPct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-content-muted">{report.downloads}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Link href={`/reports/${report.id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-surface-hover">View</Link>
                          <button className="text-xs text-content-muted hover:text-content-secondary px-2 py-1 rounded hover:bg-surface-hover">PDF</button>
                          <button className="text-xs text-content-muted hover:text-content-secondary px-2 py-1 rounded hover:bg-surface-hover">Slides</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Benchmarks ─── */}
      {subTab === 'benchmarks' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="12-month historical trends to track progress and set goals">Historical Benchmarks</SectionTitle>
            <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-1">
              {[
                { key: 'engRate', label: 'Engagement' },
                { key: 'followers', label: 'Followers' },
                { key: 'impressions', label: 'Impressions' },
                { key: 'sentiment', label: 'Sentiment' },
                { key: 'sovPct', label: 'Share of Voice' },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setSelectedBenchmark(m.key)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    selectedBenchmark === m.key ? 'bg-surface-card shadow-sm text-content-primary' : 'text-content-muted'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Benchmark chart */}
          <div className="bg-surface-card rounded-xl border border-border p-5 mb-6">
            {benchmarkData.length === 0 && !benchmarksQ.isLoading && (
              <div className="mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                Showing historical data from your tracked posts. More data points will appear as posts are published and metrics are collected.
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-content-primary">
                {selectedBenchmark === 'engRate'
                  ? 'Engagement Rate'
                  : selectedBenchmark === 'followers'
                  ? 'Total Followers'
                  : selectedBenchmark === 'impressions'
                  ? 'Monthly Impressions'
                  : selectedBenchmark === 'sentiment'
                  ? 'Brand Sentiment Score'
                  : 'Share of Voice'}{' '}
                — 12 Month Trend
              </h4>
              <div className="flex items-center gap-3 text-xs text-content-muted">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Actual</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-200" /> Target</span>
              </div>
            </div>
            {benchmarksQ.isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={benchmarkData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
                  <Area type="monotone" dataKey={selectedBenchmark} stroke={chartColors.blue} fill={chartColors.fillBlue} strokeWidth={2} name="Actual" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Benchmark summary cards — computed from real data */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {(() => {
              const bd = benchmarkData;
              const latest = bd[bd.length - 1] || {};
              const earliest = bd[0] || {};
              const fmt = (v, suffix = '') => v != null ? (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`) + suffix : '—';
              const pctChange = (cur, start) => cur != null && start != null && start > 0
                ? `${((cur - start) / start * 100) >= 0 ? '+' : ''}${Math.round((cur - start) / start * 100)}%`
                : '—';
              return [
                {
                  label: 'Engagement Rate',
                  current: latest.engRate != null ? `${latest.engRate.toFixed(1)}%` : '—',
                  start: earliest.engRate != null ? `${earliest.engRate.toFixed(1)}%` : '—',
                  change: pctChange(latest.engRate, earliest.engRate),
                },
                {
                  label: 'Followers',
                  current: fmt(latest.followers),
                  start: fmt(earliest.followers),
                  change: pctChange(latest.followers, earliest.followers),
                },
                {
                  label: 'Impressions/mo',
                  current: fmt(latest.impressions),
                  start: fmt(earliest.impressions),
                  change: pctChange(latest.impressions, earliest.impressions),
                },
                {
                  label: 'Brand Sentiment',
                  current: latest.sentiment != null ? `${latest.sentiment}` : '—',
                  start: earliest.sentiment != null ? `${earliest.sentiment}` : '—',
                  change: pctChange(latest.sentiment, earliest.sentiment),
                },
                {
                  label: 'Posts Published',
                  current: `${latest.postCount ?? 0}`,
                  start: `${earliest.postCount ?? 0}`,
                  change: pctChange(latest.postCount, earliest.postCount),
                },
              ].map((b, i) => (
                <div key={i} className="bg-surface-card rounded-xl border border-border p-4">
                  <p className="text-xs text-content-muted mb-1">{b.label}</p>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-2xl font-bold text-content-primary">{b.current}</span>
                    <span className={`text-xs font-medium mb-1 ${b.change.startsWith('+') ? 'text-green-600' : b.change.startsWith('-') ? 'text-red-600' : 'text-content-faint'}`}>
                      {b.change !== '—' ? `${b.change} period` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-content-faint">
                    <span>Start: {b.start}</span>
                    <span>Current: {b.current}</span>
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Period comparison — computed from benchmark data */}
          {benchmarkData.length >= 2 && (() => {
            const latest = benchmarkData[benchmarkData.length - 1] || {};
            const mid = benchmarkData[Math.floor(benchmarkData.length / 2)] || {};
            const fmt = (v, suffix = '') => v != null ? (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${Number(v).toFixed(1)}`) + suffix : '—';
            return (
              <div className="bg-surface-card rounded-xl border border-border p-5">
                <SectionTitle subtitle="Compare recent vs earlier period from tracked data">Period Comparison</SectionTitle>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase">Recent ({latest.month || 'Latest'})</h5>
                      <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full">Current</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Avg Eng. Rate', value: latest.engRate != null ? `${latest.engRate.toFixed(1)}%` : '—' },
                        { label: 'Total Followers', value: fmt(latest.followers) },
                        { label: 'Monthly Impressions', value: fmt(latest.impressions) },
                        { label: 'Brand Sentiment', value: latest.sentiment != null ? `${latest.sentiment}` : '—' },
                        { label: 'Posts Published', value: `${latest.postCount ?? 0} posts` },
                      ].map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-blue-700 dark:text-blue-300">{m.label}</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-100">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-surface-page rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-bold text-content-secondary uppercase">Earlier ({mid.month || 'Midpoint'})</h5>
                      <span className="text-[10px] px-2 py-0.5 bg-surface-tertiary text-content-secondary rounded-full">Baseline</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Avg Eng. Rate', value: mid.engRate != null ? `${mid.engRate.toFixed(1)}%` : '—' },
                        { label: 'Total Followers', value: fmt(mid.followers) },
                        { label: 'Monthly Impressions', value: fmt(mid.impressions) },
                        { label: 'Brand Sentiment', value: mid.sentiment != null ? `${mid.sentiment}` : '—' },
                        { label: 'Posts Published', value: `${mid.postCount ?? 0} posts` },
                      ].map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-content-secondary">{m.label}</span>
                          <span className="font-semibold text-content-primary">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
