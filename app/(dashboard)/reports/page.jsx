'use client';

import { useState } from 'react';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { trpc } from '@/lib/trpc-client';
import { TabButton, SectionTitle, Skeleton } from '@/components/ui';

export default function ReportsPage() {
  const [subTab, setSubTab] = useState('builder');
  const [aiPrompt, setAiPrompt] = useState('');
  const [reportType, setReportType] = useState('WEEKLY_PERFORMANCE');
  const [reportTypeFilter, setReportTypeFilter] = useState('all');
  const [selectedBenchmark, setSelectedBenchmark] = useState('engRate');
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
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
        {[
          { key: 'builder', label: 'AI Report Builder' },
          { key: 'repository', label: 'Report Repository', badge: reportRepository.length || undefined },
          { key: 'benchmarks', label: 'Historical Benchmarks' },
        ].map((t) => (
          <TabButton key={t.key} active={subTab === t.key} onClick={() => setSubTab(t.key)} badge={t.badge}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {/* ── AI Report Builder ─── */}
      {subTab === 'builder' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Describe the report you need — AI drafts it, you refine it">AI Report Builder</SectionTitle>
          </div>

          {/* AI Prompt Area */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
              <div className="flex-1">
                <p className="text-sm text-gray-700 mb-3">
                  Tell me what report you need and I&apos;ll draft it using your real data. You can refine any section before finalizing.
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500">Report type:</span>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    {Object.entries(reportTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full p-3 text-sm border border-gray-200 rounded-lg resize-none leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder='e.g. "Create a weekly performance report for the last 7 days, highlight our top 3 posts, include competitor comparison, and add sentiment trends. Make it executive-friendly."'
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">Quick templates:</span>
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
                        className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
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
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isGenerating ? 'Generating...' : 'Generate Report'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Report Preview / Editor */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-semibold text-gray-900">Report Preview</h4>
                {generatedReport && (
                  <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">AI Draft</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Edit</button>
                <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Export PDF</button>
                <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Export Slides</button>
                <button className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save to Repository</button>
              </div>
            </div>

            <div className="p-6 max-h-[500px] overflow-y-auto">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-500">Generating your report with AI...</p>
                  <p className="text-xs text-gray-400 mt-1">This may take 15-30 seconds</p>
                </div>
              ) : generatedReport?.content ? (
                <div className="max-w-2xl mx-auto">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">{generatedReport.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Generated {new Date(generatedReport.createdAt).toLocaleDateString()} | {reportTypeLabels[generatedReport.reportType] || 'Report'}
                    </p>
                  </div>

                  {/* Executive Summary */}
                  {(generatedReport.content.executiveSummary || generatedReport.content.summary) && (
                    <div className="mb-6">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">Executive Summary</h3>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {generatedReport.content.executiveSummary || generatedReport.content.summary}
                      </p>
                    </div>
                  )}

                  {/* Key Metrics */}
                  {generatedReport.content.keyMetrics && (
                    <div className="mb-6">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">Key Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(generatedReport.content.keyMetrics).map(([key, val]) => (
                          <div key={key} className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                            <p className="text-lg font-bold text-gray-900">{typeof val === 'number' ? val.toLocaleString() : val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Content */}
                  {generatedReport.content.topContent?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">Top Performing Content</h3>
                      <div className="space-y-2">
                        {generatedReport.content.topContent.map((item, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-900">{item.title || item.postId}</p>
                            {item.whyItWorked && <p className="text-xs text-gray-600 mt-1">{item.whyItWorked}</p>}
                            <div className="flex gap-3 mt-1 text-xs text-gray-500">
                              {item.impressions && <span>{item.impressions.toLocaleString()} imp</span>}
                              {item.engagementRate && <span>{item.engagementRate}% eng</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {generatedReport.content.recommendations?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">Recommendations</h3>
                      <div className="space-y-2">
                        {generatedReport.content.recommendations.map((rec, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-lg flex items-start gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 ${
                              rec.priority === 'HIGH' ? 'bg-red-50 text-red-600' : rec.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-600'
                            }`}>{rec.priority}</span>
                            <div>
                              <p className="text-sm text-gray-900">{rec.recommendation}</p>
                              {rec.expectedImpact && <p className="text-xs text-gray-500 mt-0.5">Impact: {rec.expectedImpact}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outlook */}
                  {generatedReport.content.outlook && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <h3 className="text-sm font-bold text-blue-900 mb-1">Week Ahead Outlook</h3>
                      <p className="text-sm text-blue-800">{generatedReport.content.outlook}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">Select a report type and describe what you need, then click Generate.</p>
                  <p className="text-xs mt-1">Your report will appear here.</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent AI generations */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Generations</h4>
            <div className="space-y-2">
              {[
                { prompt: 'Weekly performance report for Feb 24–Mar 2', time: '2h ago', status: 'Saved' },
                { prompt: 'Quick competitor comparison — Competitor A vs Highland', time: '1d ago', status: 'Draft' },
                { prompt: 'KOL ROI analysis for Q1 campaign partners', time: '3d ago', status: 'Saved' },
              ].map((gen, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[9px] font-bold">AI</div>
                    <span className="text-sm text-gray-700 truncate max-w-md">{gen.prompt}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        gen.status === 'Saved' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {gen.status}
                    </span>
                    <span className="text-xs text-gray-400">{gen.time}</span>
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
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {['all', 'weekly', 'monthly', 'campaign', 'competitor', 'audit'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setReportTypeFilter(f)}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                      reportTypeFilter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
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
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {['Report', 'Type', 'Created By', 'Date', 'Pages', 'AI %', 'Downloads', ''].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{'\uD83D\uDCC4'}</span>
                          <div>
                            <span className="font-medium text-gray-900 block">{report.title}</span>
                            {!report.content && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-medium">Draft</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            report.reportType === 'WEEKLY_PERFORMANCE'
                              ? 'bg-blue-50 text-blue-600'
                              : report.reportType === 'MONTHLY_SUMMARY'
                              ? 'bg-purple-50 text-purple-600'
                              : report.reportType === 'KOL_REPORT'
                              ? 'bg-green-50 text-green-600'
                              : report.reportType === 'COMPETITIVE_ANALYSIS'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-gray-100 text-gray-600'
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
                          <span className="text-gray-600 text-xs">{report.createdById || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{new Date(report.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-gray-600">—</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${report.aiPct ?? 0}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{report.aiPct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{report.downloads}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50">View</button>
                          <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">PDF</button>
                          <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Slides</button>
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
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
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
                    selectedBenchmark === m.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Benchmark chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">
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
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Actual</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-200" /> Target</span>
              </div>
            </div>
            {benchmarksQ.isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={benchmarkData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey={selectedBenchmark} stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} name="Actual" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Benchmark summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Engagement Rate', current: '4.2%', start: '2.1%', change: '+100%', goal: '5.0%', goalPct: 84 },
              { label: 'Followers', current: '16.4K', start: '6.2K', change: '+165%', goal: '20K', goalPct: 82 },
              { label: 'Impressions/mo', current: '24.3K', start: '8.0K', change: '+204%', goal: '30K', goalPct: 81 },
              { label: 'Brand Sentiment', current: '72', start: '55', change: '+31%', goal: '80', goalPct: 90 },
              { label: 'Share of Voice', current: '34%', start: '22%', change: '+55%', goal: '40%', goalPct: 85 },
            ].map((b, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{b.label}</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-2xl font-bold text-gray-900">{b.current}</span>
                  <span className="text-xs text-green-600 font-medium mb-1">{b.change} YoY</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Start: {b.start}</span>
                  <span>Goal: {b.goal}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${b.goalPct}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{b.goalPct}% to goal</p>
              </div>
            ))}
          </div>

          {/* Period comparison */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle subtitle="Compare any two time periods to measure progress">Period Comparison</SectionTitle>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-bold text-blue-900 uppercase">Q1 2026 (Current)</h5>
                  <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">In Progress</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Avg Eng. Rate', value: '4.2%' },
                    { label: 'Total Followers', value: '16,390' },
                    { label: 'Avg Monthly Impressions', value: '24.3K' },
                    { label: 'Avg Brand Sentiment', value: '72.1' },
                    { label: 'Content Published', value: '42 posts' },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-blue-700">{m.label}</span>
                      <span className="font-semibold text-blue-900">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-bold text-gray-600 uppercase">Q4 2025 (Previous)</h5>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">Completed</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Avg Eng. Rate', value: '3.1%' },
                    { label: 'Total Followers', value: '11,200' },
                    { label: 'Avg Monthly Impressions', value: '14.8K' },
                    { label: 'Avg Brand Sentiment', value: '62.4' },
                    { label: 'Content Published', value: '35 posts' },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{m.label}</span>
                      <span className="font-semibold text-gray-800">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
