'use client';

import { useState } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { trpc } from '@/lib/trpc-client';
import {
  COLORS, PlatformBadge, RelevanceBadge, SentimentDot,
  TabButton, SectionTitle, Skeleton,
} from '@/components/ui';

export default function ListeningPage() {
  const [subTab, setSubTab] = useState('feed');
  const [relevanceFilter, setRelevanceFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');

  // ── tRPC queries ──────────────────────────────────────────
  const hitsQ = trpc.listening.hits.list.useQuery(undefined, { staleTime: 15_000 });
  const topicsQ = trpc.listening.topics.list.useQuery(undefined, { staleTime: 30_000 });
  const sovQ = trpc.competitors.getSOV.useQuery(undefined, { staleTime: 60_000 });
  const sentimentQ = trpc.analytics.brandSentiment.useQuery(undefined, { staleTime: 30_000 });

  // ── Derived data ──────────────────────────────────────────
  const listeningFeed = hitsQ.data ?? [];
  const listeningTopics = topicsQ.data ?? [];
  const sovData = sovQ.data?.current ?? [];
  const sovTimeData = sovQ.data?.overTime ?? [];
  const sentimentTrendData = sentimentQ.data?.overTime ?? [];

  const brandAccounts = [
    { key: 'all', label: 'All Brands' },
    { key: '@highland_vc', label: '@highland_vc', platform: 'x' },
    { key: '@highland_official', label: '@highland_official', platform: 'x' },
    { key: 'u/highland_ventures', label: 'u/highland_ventures', platform: 'reddit' },
  ];

  const filteredFeed = listeningFeed.filter((h) => {
    const matchRelevance = relevanceFilter === 'all' || h.relevance === relevanceFilter;
    const matchBrand =
      brandFilter === 'all' || (brandFilter.startsWith('u/') ? h.platform === 'reddit' : h.platform === 'x');
    return matchRelevance && matchBrand;
  });

  return (
    <div>
      {/* Brand filter bar */}
      <div className="flex items-center gap-2 mb-4 bg-white rounded-xl border border-gray-200 px-4 py-2.5">
        <span className="text-xs font-medium text-gray-500 mr-1">Brand:</span>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {brandAccounts.map((b) => (
            <button
              key={b.key}
              onClick={() => setBrandFilter(b.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                brandFilter === b.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {b.platform && <PlatformBadge platform={b.platform} />}
              {b.label}
            </button>
          ))}
        </div>
        {brandFilter !== 'all' && (
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-gray-400">Showing data for</span>
            <span className="font-semibold text-gray-700">{brandFilter}</span>
            <button onClick={() => setBrandFilter('all')} className="text-blue-600 hover:text-blue-700 font-medium">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
        {[
          { key: 'feed', label: 'Listening Feed', badge: filteredFeed.length || undefined },
          { key: 'insights', label: 'AI Insights' },
          { key: 'topics', label: 'Topics' },
          { key: 'sov', label: 'Share of Voice' },
          { key: 'competitors', label: 'Competitors' },
        ].map((t) => (
          <TabButton key={t.key} active={subTab === t.key} onClick={() => setSubTab(t.key)} badge={t.badge}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {/* ── Feed sub-tab ─── */}
      {subTab === 'feed' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-500">Filter:</span>
              {['all', 'HIGH', 'MEDIUM'].map((f) => (
                <button
                  key={f}
                  onClick={() => setRelevanceFilter(f)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                    relevanceFilter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>

            {hitsQ.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFeed.map((hit) => (
                  <div
                    key={hit.id}
                    className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${
                      hit.relevance === 'HIGH' ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <PlatformBadge platform={hit.platform} />
                        <span className="font-semibold text-gray-900 text-sm">{hit.author}</span>
                        <span className="text-xs text-gray-400">{hit.followers}</span>
                        {hit.subreddit && <span className="text-xs text-orange-600 font-medium">{hit.subreddit}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <RelevanceBadge level={hit.relevance} />
                        <SentimentDot sentiment={hit.sentiment} />
                        <span className="text-xs text-gray-400">{hit.time}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed mb-3">{hit.content}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{hit.engagements} engagements</span>
                        <span>Score: {hit.heuristic}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium">
                          Reply
                        </button>
                        <button className="px-2.5 py-1 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100">
                          Bookmark
                        </button>
                        <button className="px-2.5 py-1 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-3">Active Topics</h4>
              {topicsQ.isLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                listeningTopics.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.queries} queries &middot; {t.hits24h} hits/24h
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        t.tier === 'Hot'
                          ? 'bg-red-100 text-red-700'
                          : t.tier === 'Warm'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {t.tier}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-3">Sentiment (24h)</h4>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Positive', value: sentimentQ.data?.breakdown?.positive ?? 62 },
                      { name: 'Neutral', value: sentimentQ.data?.breakdown?.neutral ?? 24 },
                      { name: 'Negative', value: sentimentQ.data?.breakdown?.negative ?? 14 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    dataKey="value"
                  >
                    <Cell fill={COLORS.green} />
                    <Cell fill={COLORS.gray} />
                    <Cell fill={COLORS.red} />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-3 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {sentimentQ.data?.breakdown?.positive ?? 62}% Pos
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  {sentimentQ.data?.breakdown?.neutral ?? 24}% Neu
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {sentimentQ.data?.breakdown?.negative ?? 14}% Neg
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-2">API Cost (This Month)</h4>
              <p className="text-2xl font-bold text-gray-900">$12.40</p>
              <p className="text-xs text-gray-500 mt-1">Budget: $30 &middot; 41% used</p>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '41%' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Insights sub-tab ─── */}
      {subTab === 'insights' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="AI-powered analysis of conversation themes, sentiment drivers, and strategic recommendations">
              AI Insights
            </SectionTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Last updated: 2h ago</span>
              <button className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Refresh Analysis
              </button>
            </div>
          </div>

          {/* AI Summary Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                AI
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-bold text-indigo-900">Weekly Landscape Summary</h4>
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                    Feb 26 – Mar 4
                  </span>
                </div>
                <p className="text-sm text-indigo-800 leading-relaxed">
                  The AI deal sourcing conversation is maturing from &quot;is this real?&quot; to &quot;which tool is best?&quot; —
                  a bullish signal for Highland&apos;s positioning. Three dominant narratives emerged this week:
                  (1) <strong>tool comparison threads</strong> are surging (+180% vs last week), with users actively evaluating specific products;
                  (2) <strong>skepticism around ROI</strong> persists on Reddit, but the tone is shifting from dismissive to genuinely curious;
                  (3) a new <strong>CRM integration</strong> angle is gaining traction that we haven&apos;t been addressing in our content.
                  Recommendation: publish a thread on concrete ROI metrics from your portfolio companies using AI sourcing —
                  this directly addresses the skepticism while positioning Highland as a thought leader with real data.
                </p>
              </div>
            </div>
          </div>

          {/* Narrative Shifts Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <SectionTitle subtitle="How the conversation is evolving week over week">Narrative Shift Timeline</SectionTitle>
            <div className="relative mt-4">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              {[
                { week: 'This Week', shift: 'Tool comparison phase — users actively evaluating specific products. Highland mentioned organically 3x.', sentiment: 72, direction: 'up' },
                { week: 'Last Week', shift: 'General awareness phase — "what is AI deal sourcing?" questions dominated. Low brand-specific mentions.', sentiment: 68, direction: 'stable' },
                { week: '2 Weeks Ago', shift: 'Skepticism peak — Reddit thread questioning AI in VC got 200+ upvotes. Negative sentiment spiked to 22%.', sentiment: 58, direction: 'down' },
                { week: '3 Weeks Ago', shift: 'Emerging interest — first wave of seed-stage founders asking about AI tools for fundraising. Positive curiosity phase.', sentiment: 65, direction: 'up' },
              ].map((entry, i) => (
                <div key={i} className="relative pl-10 pb-6">
                  <div className={`absolute left-[10px] w-3 h-3 rounded-full border-2 border-white ${i === 0 ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${i === 0 ? 'text-blue-600' : 'text-gray-500'}`}>{entry.week}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        entry.direction === 'up'
                          ? 'bg-green-50 text-green-600'
                          : entry.direction === 'down'
                          ? 'bg-red-50 text-red-500'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      Sentiment: {entry.sentiment} {entry.direction === 'up' ? '\u2191' : entry.direction === 'down' ? '\u2193' : '\u2192'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{entry.shift}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Strategic Recommendations */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle subtitle="Prioritized actions based on sentiment analysis and conversation trends">
              Strategic Recommendations
            </SectionTitle>
            <div className="space-y-3 mt-4">
              {[
                { priority: 'HIGH', action: 'Publish ROI data thread', detail: 'The #1 ask across both platforms is concrete ROI data from AI deal sourcing. A thread sharing anonymized portfolio results would directly counter the skepticism narrative and position Highland as the authority.', category: 'Content', effort: 'Medium' },
                { priority: 'HIGH', action: "Respond to Competitor A's viral thread", detail: "Their thread on 'AI-first portfolio management' hit 450+ engagements. Silence looks like concession. Best posted within 48 hours.", category: 'Response', effort: 'Low' },
                { priority: 'MEDIUM', action: 'Create CRM integration content', detail: "A new content gap has emerged — founders are asking about deal sourcing → CRM pipeline workflows and nobody is owning this narrative yet.", category: 'New Content', effort: 'High' },
                { priority: 'MEDIUM', action: 'Engage on Reddit r/venturecapital', detail: 'Reddit sentiment is 10 points lower than X (61.8 vs 72.4). Two specific threads have unanswered questions about Highland.', category: 'Engagement', effort: 'Low' },
                { priority: 'LOW', action: 'Prepare AI ethics positioning', detail: "The 'VC automation ethics' conversation is growing. Getting ahead of this with a thoughtful take prevents future crisis management.", category: 'Proactive', effort: 'Medium' },
              ].map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded flex-shrink-0 mt-0.5 ${
                      rec.priority === 'HIGH'
                        ? 'bg-red-100 text-red-700'
                        : rec.priority === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {rec.priority}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="text-sm font-semibold text-gray-900">{rec.action}</h5>
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{rec.category}</span>
                      <span className="text-[10px] text-gray-400">{rec.effort} effort</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{rec.detail}</p>
                  </div>
                  <button className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap flex-shrink-0">
                    Draft →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Topics sub-tab ─── */}
      {subTab === 'topics' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Describe what you want to monitor — AI generates the queries">Listening Topics</SectionTitle>
            <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">+ New Topic</button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-2">AI Query Builder</p>
                <div className="bg-white rounded-lg p-3 border border-blue-100 mb-3">
                  <p className="text-sm text-gray-500 italic">
                    &quot;Find people talking about AI agents for venture capital deal sourcing, especially founders building in this space or VCs evaluating tools&quot;
                  </p>
                </div>
                <p className="text-sm text-blue-800 mb-3">Generated 7 queries across X and Reddit:</p>
                <div className="space-y-2">
                  {[
                    { q: '"AI agent" ("deal sourcing" OR "deal flow" OR "venture capital")', p: 'x', vol: '~120/day' },
                    { q: '"AI copilot" VC (sourcing OR diligence OR pipeline)', p: 'x', vol: '~45/day' },
                    { q: 'subreddit:venturecapital "AI" (agent OR tool OR automation)', p: 'reddit', vol: '~18/day' },
                    { q: 'subreddit:startups ("AI sourcing" OR "AI deal flow")', p: 'reddit', vol: '~12/day' },
                  ].map((q, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                      <PlatformBadge platform={q.p} />
                      <code className="text-xs text-gray-700 flex-1 font-mono">{q.q}</code>
                      <span className="text-xs text-gray-400">{q.vol}</span>
                      <button className="text-xs text-red-500 hover:text-red-700">&times;</button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs text-gray-500">Est. cost: ~$2.40/mo</span>
                  <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">Activate Topic</button>
                  <button className="px-3 py-1.5 bg-white text-blue-600 text-xs rounded-lg border border-blue-200 hover:bg-blue-50 font-medium">Edit Queries</button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Topic', 'Queries', 'Hits (24h)', 'Sentiment', 'Polling Tier', 'Status'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listeningTopics.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <td className="py-3 px-3 font-medium text-gray-900">{t.name}</td>
                    <td className="py-3 px-3">{t.queries}</td>
                    <td className="py-3 px-3 font-medium">{t.hits24h}</td>
                    <td className="py-3 px-3">
                      <span className={`font-medium ${(t.sentiment ?? 0) > 65 ? 'text-green-600' : 'text-amber-600'}`}>
                        {t.sentiment}% pos
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          t.tier === 'Hot' ? 'bg-red-100 text-red-700' : t.tier === 'Warm' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {t.tier}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Active
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SOV sub-tab ─── */}
      {subTab === 'sov' && (
        <div>
          <SectionTitle subtitle="Your brand's share of the conversation vs. competitors">Share of Voice</SectionTitle>

          {sovQ.isLoading ? (
            <Skeleton className="h-[300px] w-full rounded-xl mb-8" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Current SOV</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={sovData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${value}%`}
                    >
                      {sovData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {sovData.map((s) => (
                    <span key={s.name} className="flex items-center gap-1 text-xs text-gray-600">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">SOV Over Time</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={sovTimeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="Highland" stackId="1" stroke="#3b82f6" fill="#93c5fd" />
                    <Area type="monotone" dataKey="Competitor A" stackId="1" stroke="#ef4444" fill="#fca5a5" />
                    <Area type="monotone" dataKey="Competitor B" stackId="1" stroke="#f59e0b" fill="#fcd34d" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Competitor comparison table */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Competitive Comparison</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Brand', 'SOV', 'Mentions', 'Sentiment', 'Avg Engagement', 'Follower Growth'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sovData.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className={`font-medium ${i === 0 ? 'text-blue-700' : 'text-gray-900'}`}>{s.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-lg">{s.value}%</td>
                    <td className="py-3 px-3">{s.mentions}</td>
                    <td className="py-3 px-3">
                      {s.sentiment ? (
                        <span className={s.sentiment > 65 ? 'text-green-600 font-medium' : 'text-amber-600'}>{s.sentiment}% pos</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-3">{s.avgEng ? `${s.avgEng}%` : '—'}</td>
                    <td className="py-3 px-3">{s.growth ? <span className="text-green-600 font-medium">+{s.growth}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sentiment trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Sentiment Trend (All Topics)</h4>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={sentimentTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="positive" stackId="1" stroke={COLORS.green} fill="#bbf7d0" name="Positive" />
                <Area type="monotone" dataKey="neutral" stackId="1" stroke={COLORS.gray} fill="#e5e7eb" name="Neutral" />
                <Area type="monotone" dataKey="negative" stackId="1" stroke={COLORS.red} fill="#fecaca" name="Negative" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Competitors sub-tab ─── */}
      {subTab === 'competitors' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Track competitor accounts, keywords, and content performance">Competitor Monitoring</SectionTitle>
            <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">+ Add Competitor</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {sovData
              .filter((s) => s.name !== 'Unattributed' && s.name !== 'Highland Ventures')
              .map((comp, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: comp.color }} />
                    <h4 className="font-semibold text-gray-900">{comp.name}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">SOV</p>
                      <p className="font-bold text-lg">{comp.value}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Mentions</p>
                      <p className="font-bold text-lg">{comp.mentions}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Sentiment</p>
                      <p className="font-medium text-amber-600">{comp.sentiment}% pos</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Engagement</p>
                      <p className="font-medium">{comp.avgEng}%</p>
                    </div>
                  </div>
                  <button className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium">View Posts →</button>
                </div>
              ))}
          </div>

          {/* Mindshare alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 text-lg">{'\u26A0'}</span>
              <div>
                <p className="text-sm font-medium text-amber-900">Mindshare Alert</p>
                <p className="text-sm text-amber-800 mt-1">
                  Competitor A&apos;s SOV has exceeded yours for 3 consecutive days (29% vs 27%). Their recent thread on &quot;AI-first portfolio management&quot; drove 450+ engagements. Consider responding with your perspective.
                </p>
                <div className="flex gap-2 mt-2">
                  <button className="px-3 py-1 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700">View Their Post</button>
                  <button className="px-3 py-1 text-xs bg-white text-amber-700 rounded-lg border border-amber-300 hover:bg-amber-50">Draft Response</button>
                  <button className="px-3 py-1 text-xs text-amber-600 hover:text-amber-800">Dismiss</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
