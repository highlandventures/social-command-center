'use client';

import { useState } from 'react';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { trpc } from '@/lib/trpc-client';
import { MetricCard, MetricCardSkeleton, SectionTitle, TabButton, Skeleton } from '@/components/ui';

// ── Static data that doesn't come from tRPC ─────────────────
const roadmapItems = [
  { id: 1, phase: 'Phase 1', title: 'Project scaffolding', status: 'deployed', est: 1, actual: 1, deployed: 'Jan 15' },
  { id: 2, phase: 'Phase 1', title: 'OAuth account connection', status: 'deployed', est: 1, actual: 1.5, deployed: 'Jan 22' },
  { id: 3, phase: 'Phase 1', title: 'Post composer + preview', status: 'deployed', est: 2, actual: 2, deployed: 'Feb 5' },
  { id: 4, phase: 'Phase 1', title: 'Basic scheduling + BullMQ', status: 'deployed', est: 1, actual: 1, deployed: 'Feb 10' },
  { id: 5, phase: 'Phase 1', title: 'Calendar view', status: 'deployed', est: 1, actual: 1, deployed: 'Feb 14' },
  { id: 6, phase: 'Phase 1', title: 'RBAC + team invitations', status: 'deployed', est: 1, actual: 1.5, deployed: 'Feb 20' },
  { id: 7, phase: 'Phase 1', title: 'API adapter layer (hybrid)', status: 'deployed', est: 1, actual: 1, deployed: 'Feb 24' },
  { id: 8, phase: 'Phase 1', title: 'Admin panel + cost tracker', status: 'deployed', est: 1, actual: 1, deployed: 'Feb 28' },
  { id: 9, phase: 'Phase 2', title: 'Thread composer + preview', status: 'in_progress', est: 2, actual: null, deployed: null },
  { id: 10, phase: 'Phase 2', title: 'Thread scheduling', status: 'in_progress', est: 1, actual: null, deployed: null },
  { id: 11, phase: 'Phase 2', title: 'Metrics poller worker', status: 'not_started', est: 1, actual: null, deployed: null },
  { id: 12, phase: 'Phase 2', title: 'Front dashboard + WoW', status: 'not_started', est: 2, actual: null, deployed: null },
  { id: 13, phase: 'Phase 2', title: 'Detailed analytics views', status: 'not_started', est: 2, actual: null, deployed: null },
  { id: 14, phase: 'Phase 3', title: 'Mentions tracking', status: 'not_started', est: 1, actual: null, deployed: null },
  { id: 15, phase: 'Phase 3', title: 'Unified inbox', status: 'not_started', est: 2, actual: null, deployed: null },
  { id: 16, phase: 'Phase 4a', title: 'AI query builder', status: 'not_started', est: 2, actual: null, deployed: null },
  { id: 17, phase: 'Phase 4a', title: 'Social listening feed', status: 'not_started', est: 2, actual: null, deployed: null },
  { id: 18, phase: 'Phase 4b', title: 'Competitor monitoring + SOV', status: 'not_started', est: 2, actual: null, deployed: null },
  { id: 19, phase: 'Phase 4c', title: 'KOL tracking + AI scoring', status: 'not_started', est: 3, actual: null, deployed: null },
  { id: 20, phase: 'Phase 4c', title: 'Content intelligence loop', status: 'not_started', est: 2, actual: null, deployed: null },
];

const featureRequests = [
  { id: 1, title: 'Dark mode for the dashboard', type: 'feature', submittedBy: 'Jenny K.', role: 'Internal', date: 'Feb 28', priority: 'nice_to_have', votes: 4, status: 'under_review', area: 'Analytics' },
  { id: 2, title: 'Bulk schedule from CSV upload', type: 'feature', submittedBy: 'Mike R.', role: 'Agency', date: 'Feb 25', priority: 'high', votes: 7, status: 'planned', area: 'Composer', linkedItem: 'Phase 2' },
  { id: 3, title: 'Timezone shows wrong for scheduled posts', type: 'bug', submittedBy: 'Sarah C.', role: 'Internal', date: 'Mar 1', priority: 'critical', votes: 3, status: 'in_progress', area: 'Calendar' },
  { id: 4, title: 'Add Bluesky as a platform', type: 'feature', submittedBy: 'Dan P.', role: 'Internal', date: 'Feb 20', priority: 'medium', votes: 5, status: 'new', area: 'Other' },
  { id: 5, title: 'Export analytics as PDF report', type: 'feature', submittedBy: 'Jenny K.', role: 'Internal', date: 'Feb 22', priority: 'medium', votes: 6, status: 'planned', area: 'Analytics', linkedItem: 'V2 Backlog' },
];

const deployLog = [
  { time: 'Mar 4, 2:15pm', sha: 'a3f2c8d', message: 'feat: add thread composer preview [roadmap:thread-composer]', status: 'success', items: ['Thread composer + preview'] },
  { time: 'Mar 3, 11:30am', sha: 'b7e1f4a', message: 'fix: timezone handling in scheduler [roadmap:basic-scheduling]', status: 'success', items: ['Basic scheduling + BullMQ'] },
  { time: 'Mar 2, 4:45pm', sha: 'c9d3a2b', message: 'feat: admin panel cost tracker charts', status: 'success', items: ['Admin panel + cost tracker'] },
  { time: 'Mar 1, 9:10am', sha: 'd1f5e7c', message: 'chore: update dependencies', status: 'success', items: [] },
  { time: 'Feb 28, 3:20pm', sha: 'e4a8b1d', message: 'feat: initial admin panel with roadmap view [roadmap:admin-panel]', status: 'success', items: ['Admin panel + cost tracker'] },
];

export default function AdminPage() {
  const [subTab, setSubTab] = useState('settings');

  // ── tRPC queries ──────────────────────────────────────────
  const usersQ = trpc.admin.users.list.useQuery(undefined, { staleTime: 60_000 });
  const costsQ = trpc.admin.apiCosts.useQuery(undefined, { staleTime: 60_000 });
  const auditQ = trpc.admin.auditLog.useQuery(undefined, { staleTime: 60_000 });

  // ── Derived data ──────────────────────────────────────────
  const costData = costsQ.data ?? {};
  const costByService = costData.byService ?? [
    { service: 'X Official API', thisMonth: 18.40, lastMonth: 15.20, pct: 27, color: '#1d9bf0' },
    { service: 'TwitterAPI.io', thisMonth: 8.60, lastMonth: 7.10, pct: 13, color: '#6b7280' },
    { service: 'Reddit API', thisMonth: 12.30, lastMonth: 11.40, pct: 18, color: '#ff4500' },
    { service: 'Claude API (Haiku)', thisMonth: 3.12, lastMonth: 2.21, pct: 5, color: '#8b5cf6' },
    { service: 'Lovable (Pro)', thisMonth: 25.00, lastMonth: 25.00, pct: 37, color: '#ec4899' },
    { service: 'Infrastructure', thisMonth: 0.00, lastMonth: 0.00, pct: 0, color: '#d1d5db' },
  ];
  const costByFeature = costData.byFeature ?? [
    { feature: 'Social Listening', calls: 18200, tokens: '1.2M', cost: 14.80, note: 'Highest cost, highest value' },
    { feature: 'Metrics Polling', calls: 12400, tokens: '\u2014', cost: 8.20, note: 'Scales with post volume' },
    { feature: 'Mentions / Inbox', calls: 8600, tokens: '\u2014', cost: 5.10, note: 'Scales with engagement' },
    { feature: 'Competitor Monitoring', calls: 6200, tokens: '340K', cost: 4.00, note: 'Per competitor' },
    { feature: 'AI Insights / Themes', calls: '\u2014', tokens: '2.8M', cost: 3.12, note: 'Minimal cost, high value' },
    { feature: 'KOL Tracking', calls: 3100, tokens: '180K', cost: 2.40, note: 'Efficient per KOL' },
    { feature: 'Publishing', calls: 420, tokens: '\u2014', cost: 1.80, note: 'Low, predictable' },
  ];
  const costTrendData = costData.trend ?? [];
  const claudeTokenBreakdown = costData.claudeBreakdown ?? [
    { job: 'Theme extraction', input: '720K', output: '540K', calls: 360, cost: 0.86 },
    { job: 'Relevance scoring', input: '180K', output: '90K', calls: 150, cost: 0.16 },
    { job: 'KOL scoring', input: '120K', output: '80K', calls: 20, cost: 0.13 },
    { job: 'Content suggestions', input: '96K', output: '128K', calls: 16, cost: 0.18 },
    { job: 'Post debriefs', input: '45K', output: '60K', calls: 30, cost: 0.09 },
    { job: 'Query building', input: '30K', output: '40K', calls: 8, cost: 0.06 },
    { job: 'Digests (daily/weekly)', input: '60K', output: '80K', calls: 32, cost: 0.12 },
  ];

  const accounts = usersQ.data ?? [];

  const totalDeployed = roadmapItems.filter((r) => r.status === 'deployed').length;
  const totalItems = roadmapItems.length;
  const inProgress = roadmapItems.filter((r) => r.status === 'in_progress').length;
  const totalCost = costByService.reduce((s, c) => s + c.thisMonth, 0);
  const lastMonthTotal = costByService.reduce((s, c) => s + c.lastMonth, 0);
  const costDelta = lastMonthTotal > 0 ? (((totalCost - lastMonthTotal) / lastMonthTotal) * 100).toFixed(0) : '0';
  const budget = 150;

  const statusColors = {
    deployed: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    not_started: 'bg-gray-100 text-gray-600',
    blocked: 'bg-red-100 text-red-800',
  };
  const statusLabels = {
    deployed: 'Deployed',
    in_progress: 'In Progress',
    not_started: 'Not Started',
    blocked: 'Blocked',
  };
  const reqStatusColors = {
    new: 'bg-gray-100 text-gray-700',
    under_review: 'bg-yellow-100 text-yellow-800',
    planned: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-green-100 text-green-800',
    wont_do: 'bg-red-100 text-red-700',
  };
  const reqTypeColors = {
    feature: 'bg-purple-100 text-purple-700',
    bug: 'bg-red-100 text-red-700',
    improvement: 'bg-cyan-100 text-cyan-700',
    question: 'bg-gray-100 text-gray-700',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
        {[
          { key: 'settings', label: 'Settings' },
          { key: 'costs', label: 'Cost Tracker' },
          { key: 'roadmap', label: 'Product Roadmap' },
          { key: 'requests', label: 'Feature Requests', badge: featureRequests.filter((r) => r.status === 'new').length },
        ].map((t) => (
          <TabButton key={t.key} active={subTab === t.key} onClick={() => setSubTab(t.key)} badge={t.badge}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {/* ── Roadmap ─── */}
      {subTab === 'roadmap' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard label="Features Deployed" value={`${totalDeployed} of ${totalItems}`} delta={Math.round((totalDeployed / totalItems) * 100)} deltaLabel="complete" />
            <MetricCard label="In Progress" value={inProgress} />
            <MetricCard label="Current Phase" value="Phase 2" />
            <MetricCard label="Velocity" value="2.3/week" delta={12} deltaLabel="vs last month" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm text-gray-500">
                {totalDeployed}/{totalItems} features ({Math.round((totalDeployed / totalItems) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="h-3 rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all" style={{ width: `${(totalDeployed / totalItems) * 100}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>Phase 1 {'\u2713'}</span>
              <span className="text-blue-600 font-medium">Phase 2 (current)</span>
              <span>Phase 3</span>
              <span>Phase 4</span>
            </div>
          </div>

          {['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4a', 'Phase 4b', 'Phase 4c'].map((phase) => {
            const items = roadmapItems.filter((r) => r.phase === phase);
            const deployed = items.filter((r) => r.status === 'deployed').length;
            const isCurrentPhase = items.some((r) => r.status === 'in_progress');
            return (
              <div key={phase} className={`bg-white rounded-xl border p-5 mb-4 ${isCurrentPhase ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">{phase}</h4>
                    {isCurrentPhase && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Current</span>}
                  </div>
                  <span className="text-sm text-gray-500">{deployed}/{items.length} deployed</span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${item.status === 'deployed' ? 'bg-green-400' : item.status === 'in_progress' ? 'bg-blue-400 animate-pulse' : 'bg-gray-300'}`} />
                        <span className={`text-sm ${item.status === 'deployed' ? 'text-gray-500' : 'text-gray-900 font-medium'}`}>{item.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {item.deployed && <span className="text-xs text-gray-400">Shipped {item.deployed}</span>}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.status]}`}>{statusLabels[item.status]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
            <SectionTitle subtitle="Auto-detected from GitHub pushes via webhook">Recent Deploys</SectionTitle>
            <div className="space-y-2">
              {deployLog.map((d, i) => (
                <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${d.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">{d.sha}</code>
                      <span className="text-gray-800">{d.message}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{d.time}</span>
                      {d.items.map((item, j) => (
                        <span key={j} className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                          → {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Feature Requests ─── */}
      {subTab === 'requests' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Submitted by team members — vote to prioritize">Feature Requests</SectionTitle>
            <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">+ Submit Request</button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Title', 'Type', 'Submitted By', 'Area', 'Priority', 'Votes', 'Status', 'Linked'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...featureRequests].sort((a, b) => b.votes - a.votes).map((req) => (
                  <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <td className="py-3 px-3 font-medium text-gray-900 max-w-xs">{req.title}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${reqTypeColors[req.type]}`}>{req.type}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div><span className="text-gray-900">{req.submittedBy}</span></div>
                      <div className="text-xs text-gray-400">{req.role} &middot; {req.date}</div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{req.area}</td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-medium ${req.priority === 'critical' ? 'text-red-600' : req.priority === 'high' ? 'text-amber-600' : 'text-gray-500'}`}>
                        {req.priority.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <button className="text-gray-400 hover:text-blue-600 text-lg leading-none">{'\u25B2'}</button>
                        <span className="font-bold text-gray-900 min-w-[1.5rem] text-center">{req.votes}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${reqStatusColors[req.status]}`}>{req.status.replace('_', ' ')}</span>
                    </td>
                    <td className="py-3 px-3 text-xs text-blue-600">{req.linkedItem || '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Cost Tracker ─── */}
      {subTab === 'costs' && (
        <div>
          {/* Total cost card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">March 2026 — Total Platform Cost</p>
                <p className="text-4xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
                <p className="text-sm mt-1">
                  <span className="text-gray-500">of ${budget} budget</span>
                  <span className="mx-2">&middot;</span>
                  <span className={+costDelta > 0 ? 'text-amber-600' : 'text-green-600'}>
                    {+costDelta > 0 ? '\u25B2' : '\u25BC'} {Math.abs(+costDelta)}% vs last month
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Budget Used</p>
                <p className="text-2xl font-bold text-gray-900">{Math.round((totalCost / budget) * 100)}%</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
              <div className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${Math.min(100, (totalCost / budget) * 100)}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>$0</span>
              <span className="text-amber-500">70% alert (${(budget * 0.7).toFixed(0)})</span>
              <span className="text-red-500">90% alert (${(budget * 0.9).toFixed(0)})</span>
              <span>${budget}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Cost by service */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <SectionTitle>Cost by Service</SectionTitle>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Service', 'This Month', 'Last Month', '\u0394', '% Total'].map((h) => (
                      <th key={h} className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {costByService.map((c, i) => {
                    const delta = c.lastMonth > 0 ? (((c.thisMonth - c.lastMonth) / c.lastMonth) * 100).toFixed(0) : '\u2014';
                    return (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                            <span className="font-medium text-gray-900">{c.service}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 font-bold">${c.thisMonth.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-gray-500">${c.lastMonth.toFixed(2)}</td>
                        <td className="py-2.5 px-2">
                          {delta !== '\u2014' ? (
                            <span className={`text-xs font-medium ${+delta > 0 ? 'text-amber-600' : +delta < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {+delta > 0 ? '\u25B2' : +delta < 0 ? '\u25BC' : '\u2014'} {Math.abs(+delta)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">{'\u2014'}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                            </div>
                            <span className="text-xs text-gray-500">{c.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cost trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <SectionTitle>Daily Cost Trend</SectionTitle>
              {costTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={costTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => `$${v}`} />
                    <Area type="monotone" dataKey="xOfficial" stackId="1" stroke="#1d9bf0" fill="#93c5fd" name="X Official" />
                    <Area type="monotone" dataKey="twitterApiIo" stackId="1" stroke="#6b7280" fill="#d1d5db" name="TwitterAPI.io" />
                    <Area type="monotone" dataKey="reddit" stackId="1" stroke="#ff4500" fill="#fed7aa" name="Reddit" />
                    <Area type="monotone" dataKey="claude" stackId="1" stroke="#8b5cf6" fill="#ddd6fe" name="Claude" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-sm text-gray-400">
                  No trend data available yet
                </div>
              )}
            </div>
          </div>

          {/* Cost by feature */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <SectionTitle subtitle="Which features cost the most to operate?">Cost by Feature</SectionTitle>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Feature', 'API Calls', 'Claude Tokens', 'Monthly Cost', 'Note'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {costByFeature.map((f, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2.5 px-3 font-medium text-gray-900">{f.feature}</td>
                    <td className="py-2.5 px-3">{typeof f.calls === 'number' ? f.calls.toLocaleString() : f.calls}</td>
                    <td className="py-2.5 px-3">{f.tokens}</td>
                    <td className="py-2.5 px-3 font-bold">${f.cost.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">{f.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Claude token breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <SectionTitle subtitle="Breakdown by AI job type">Claude API Token Usage</SectionTitle>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Job', 'Input', 'Output', 'Calls', 'Cost'].map((h) => (
                      <th key={h} className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {claudeTokenBreakdown.map((j, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-medium text-gray-900">{j.job}</td>
                      <td className="py-2 px-2 text-gray-600">{j.input}</td>
                      <td className="py-2 px-2 text-gray-600">{j.output}</td>
                      <td className="py-2 px-2">{j.calls}</td>
                      <td className="py-2 px-2 font-bold">${j.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td className="py-2 px-2">Total</td>
                    <td className="py-2 px-2">1.25M</td>
                    <td className="py-2 px-2">1.02M</td>
                    <td className="py-2 px-2">{claudeTokenBreakdown.reduce((s, j) => s + j.calls, 0)}</td>
                    <td className="py-2 px-2">${claudeTokenBreakdown.reduce((s, j) => s + j.cost, 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Lovable credits */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <SectionTitle>Lovable Credit Usage</SectionTitle>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-600">Credits Used</span>
                    <span className="text-sm font-bold">62 of 100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-pink-500" style={{ width: '62%' }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Burn Rate</p>
                    <p className="text-lg font-bold">~2.5/day</p>
                    <p className="text-xs text-gray-400">trailing 7-day avg</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Projected Exhaustion</p>
                    <p className="text-lg font-bold">Mar 19</p>
                    <p className="text-xs text-amber-500">15 days left at current rate</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Cost per Credit</p>
                    <p className="text-lg font-bold">~$0.25</p>
                    <p className="text-xs text-gray-400">Pro plan ($25/100)</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Plan</p>
                    <p className="text-lg font-bold">Pro</p>
                    <p className="text-xs text-gray-400">$25/month</p>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Heads up:</strong> At current burn rate, you&apos;ll exhaust credits ~11 days before the billing cycle resets.
                    Consider upgrading to Business ($50/mo, 200 credits) if velocity stays high during Phase 2.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings ─── */}
      {subTab === 'settings' && (
        <div className="max-w-2xl">
          <SectionTitle>Admin Settings</SectionTitle>
          <div className="space-y-4">
            {[
              { title: 'Connected Accounts', desc: 'Manage OAuth connections, re-authenticate expired tokens', count: `${accounts.length || 3} connected` },
              { title: 'Team Management', desc: 'Invite users, assign roles, manage Agency account access', count: '5 members' },
              { title: 'API Configuration', desc: 'X read provider toggle, spending caps, rate limit overrides' },
              { title: 'Notification Settings', desc: 'Slack webhook URL, email digest recipients, alert thresholds' },
              { title: 'Polling Configuration', desc: 'Override adaptive polling tiers, set business hours' },
              { title: 'Data Retention', desc: 'Configure how long to keep API logs, listening hits, metrics' },
              { title: 'Export', desc: 'Bulk export analytics, listening data, or KOL reports as CSV' },
            ].map((setting, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer">
                <div>
                  <h4 className="font-medium text-gray-900">{setting.title}</h4>
                  <p className="text-sm text-gray-500">{setting.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  {setting.count && <span className="text-sm text-gray-400">{setting.count}</span>}
                  <span className="text-gray-300">{'\u2192'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
