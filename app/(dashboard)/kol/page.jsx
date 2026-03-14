'use client';

import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { trpc } from '@/lib/trpc-client';
import {
  COLORS, PlatformBadge, ScoreBadge, TrendArrow,
  MetricCard, MetricCardSkeleton, SectionTitle,
  TabButton, Avatar, Skeleton,
} from '@/components/ui';

// Transform API response to UI-friendly format
function transformKOL(k) {
  const m = k.latestMetrics;
  const initials = k.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const followers = m?.followers ?? k.baselineFollowers ?? 0;
  const scoreLabels = { A: 'High Value', B: 'Good', C: 'Watch', D: 'Low Value', F: 'Drop' };
  return {
    ...k,
    handle: `@${k.username}`,
    avatar: initials,
    avatarUrl: k.avatarUrl || null,
    followers: followers >= 1000 ? `${(followers / 1000).toFixed(1)}K` : followers,
    followersRaw: followers,
    type: (k.relationshipType || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).toLowerCase().replace(/^\w/, c => c.toUpperCase()),
    activations: m?.activationsCount ?? 0,
    avgEng: (m?.engagementRateBrand ?? k.baselineEngRate ?? 0).toFixed(1),
    impressions: (m?.totalImpressionsEst ?? 0) >= 1000 ? `${((m?.totalImpressionsEst ?? 0) / 1000).toFixed(1)}K` : (m?.totalImpressionsEst ?? 0),
    sentiment: (m?.sentimentPositivePct ?? 0).toFixed(0),
    score: k.aiScore || '—',
    scoreLabel: scoreLabels[k.aiScore] || 'Unscored',
    correlation: m?.followerGrowthCorrelation ?? 0,
    comp: k.compensationMonthly ? `$${k.compensationMonthly.toLocaleString()}/mo` : '—',
    trend: null,
    cohortName: k.cohort?.name || 'Uncategorized',
  };
}

export default function KOLPage() {
  const [subTab, setSubTab] = useState('roster');
  const [selectedKOL, setSelectedKOL] = useState(null);

  // ── tRPC queries ──────────────────────────────────────────
  const kolsQ = trpc.kol.list.useQuery(undefined, { staleTime: 30_000 });
  const activationsQ = trpc.kol.getActivations.useQuery(
    { kolId: selectedKOL },
    { staleTime: 30_000, enabled: !!selectedKOL }
  );
  const metricsHistoryQ = trpc.kol.getMetricsHistory.useQuery(
    { kolId: selectedKOL },
    { staleTime: 60_000, enabled: !!selectedKOL }
  );
  const discoverQ = trpc.kol.discoverCandidates.useQuery(undefined, { staleTime: 60_000 });

  // ── Derived ───────────────────────────────────────────────
  const kols = (kolsQ.data ?? []).map(transformKOL);
  const kolActivations = activationsQ.data ?? [];
  const kolPerformanceData = metricsHistoryQ.data ?? [];
  const discoveries = discoverQ.data ?? [];

  // ── KOL detail drill-down ─────────────────────────────────
  if (selectedKOL) {
    const kol = kols.find((k) => k.id === selectedKOL);
    if (!kol) {
      setSelectedKOL(null);
      return null;
    }

    return (
      <div>
        <button onClick={() => setSelectedKOL(null)} className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1">
          {'\u2190'} Back to roster
        </button>

        {/* KOL header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar initials={kol.avatar} src={kol.avatarUrl} platform={kol.platform} size="lg" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">{kol.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500">{kol.handle}</span>
                  <PlatformBadge platform={kol.platform} />
                  <span className="text-sm text-gray-400">&middot;</span>
                  <span className="text-sm text-gray-500">{kol.followers} followers</span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{kol.type}</span>
                  <span className="px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-600">{kol.cohort}</span>
                  {kol.comp !== '—' && <span className="text-xs text-gray-500">Comp: {kol.comp}</span>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <ScoreBadge score={kol.score} />
              <p className="text-sm text-gray-500 mt-1">{kol.scoreLabel}</p>
              <TrendArrow trend={kol.trend} />
            </div>
          </div>
        </div>

        {/* KOL metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <MetricCard label="Activations (30d)" value={kol.activations} delta={15} />
          <MetricCard label="Avg Engagement" value={`${kol.avgEng}%`} delta={8} />
          <MetricCard label="Est. Impressions" value={kol.impressions} delta={12} />
          <MetricCard label="Sentiment" value={`${kol.sentiment}% pos`} delta={3} />
          <MetricCard label="Follower Correlation" value={(kol.correlation ?? 0).toFixed(2)} />
          <MetricCard label="Cost/Engagement" value={kol.comp !== '—' ? '$0.42' : 'N/A'} />
        </div>

        {/* AI Analysis */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-2">AI Analysis — Updated 2 days ago</p>
              {kol.score === 'A' && (
                <div className="text-sm text-gray-800 leading-relaxed space-y-2">
                  <p><strong>Score: A (High Value).</strong> {kol.name.split(' ')[0]} is one of your strongest KOLs. Their activations outperform both their own baseline ({kol.avgEng}% vs 5.8% non-brand) and your organic content ({kol.avgEng}% vs 4.8%), suggesting their audience has genuine interest in your brand.</p>
                  <p>The {kol.correlation} follower growth correlation is strong — their posts are directly driving new followers to your account. At {kol.comp} for ~{kol.impressions} quality impressions, the CPM is premium but justified given engagement quality and follower attribution.</p>
                  <p><strong>Recommendation:</strong> Maintain and explore co-created content (threads together, AMAs) to deepen the partnership. Consider a performance bonus tied to follower milestones.</p>
                </div>
              )}
              {kol.score === 'D' && (
                <div className="text-sm text-gray-800 leading-relaxed space-y-2">
                  <p><strong>Score: D (Not Worth It).</strong> Despite {kol.followers} followers, {kol.name.split(' ')[0]}&apos;s single activation generated only {kol.impressions} impressions with {kol.avgEng}% engagement — well below both their baseline and your organic content.</p>
                  <p>The 0.05 follower correlation suggests near-zero impact on your growth. At {kol.comp}, the cost per quality engagement is $52.08 — roughly 100x your organic cost.</p>
                  <p><strong>Recommendation:</strong> Wind down this partnership. Their audience doesn&apos;t overlap with your target market. Reallocate budget to micro-KOLs with higher engagement quality.</p>
                </div>
              )}
              {kol.score !== 'A' && kol.score !== 'D' && (
                <div className="text-sm text-gray-800 leading-relaxed">
                  <p><strong>Score: {kol.score} ({kol.scoreLabel}).</strong> {kol.name.split(' ')[0]} shows moderate engagement with {kol.activations} activations this period averaging {kol.avgEng}% engagement. Follower correlation at {kol.correlation} indicates some positive impact but room for improvement.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle>Activation Performance Over Time</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={kolPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="activations" fill={COLORS.blue} radius={[4, 4, 0, 0]} name="Activations" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle>Impressions per Activation</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={kolPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="impressions" stroke={COLORS.purple} strokeWidth={2} dot={false} name="Impressions" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activation timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>Activation Timeline</SectionTitle>
          <div className="space-y-3">
            {kolActivations
              .filter((a) => a.kol === kol.handle)
              .map((act, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-blue-600">{act.type}</span>
                      <span className="text-xs text-gray-400">{act.time}</span>
                    </div>
                    <p className="text-sm text-gray-800">{act.content}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      <span>{act.engagements} engagements</span>
                      <span>{act.impressions} impressions</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Main roster view ──────────────────────────────────────
  return (
    <div>
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
        {[
          { key: 'roster', label: 'KOL Roster' },
          { key: 'activations', label: 'Recent Activations' },
          { key: 'discover', label: 'AI Discovery' },
        ].map((t) => (
          <TabButton key={t.key} active={subTab === t.key} onClick={() => setSubTab(t.key)}>
            {t.label}
          </TabButton>
        ))}
        <div className="flex-1" />
        <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">+ Add KOL</button>
      </div>

      {subTab === 'roster' && (
        <div>
          {/* Summary cards */}
          {kolsQ.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[1, 2, 3, 4].map((i) => <MetricCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <MetricCard label="Active KOLs" value={kols.length} />
              <MetricCard label="Total Activations (30d)" value={kols.reduce((s, k) => s + (k.activations ?? 0), 0)} delta={18} />
              <MetricCard label="Avg Engagement" value={`${kols.length ? (kols.reduce((s, k) => s + (k.avgEng ?? 0), 0) / kols.length).toFixed(1) : 0}%`} delta={5} />
              <MetricCard label="Est. Total Impressions" value="42.3K" delta={14} />
            </div>
          )}

          {/* KOL roster table */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {kolsQ.isLoading ? (
              <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['KOL', 'Platform', 'Followers', 'Type', 'Activations', 'Avg Eng.', 'Impressions', 'Sentiment', 'AI Score', 'Trend'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kols.map((kol) => (
                    <tr
                      key={kol.id}
                      onClick={() => setSelectedKOL(kol.id)}
                      className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={kol.avatar} src={kol.avatarUrl} platform={kol.platform} size="sm" />
                          <div>
                            <p className="font-medium text-gray-900">{kol.name}</p>
                            <p className="text-xs text-gray-400">{kol.handle}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3"><PlatformBadge platform={kol.platform} /></td>
                      <td className="py-3 px-3">{kol.followers}</td>
                      <td className="py-3 px-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{kol.type}</span></td>
                      <td className="py-3 px-3 font-medium">{kol.activations}</td>
                      <td className="py-3 px-3">
                        <span className={`font-medium ${(kol.avgEng ?? 0) > 4 ? 'text-green-600' : (kol.avgEng ?? 0) > 2 ? 'text-gray-900' : 'text-red-500'}`}>
                          {kol.avgEng}%
                        </span>
                      </td>
                      <td className="py-3 px-3">{kol.impressions}</td>
                      <td className="py-3 px-3">
                        <span className={(kol.sentiment ?? 0) > 75 ? 'text-green-600' : 'text-amber-600'}>{kol.sentiment}% pos</span>
                      </td>
                      <td className="py-3 px-3"><ScoreBadge score={kol.score} /></td>
                      <td className="py-3 px-3">
                        <TrendArrow trend={kol.trend} /> <span className="text-xs text-gray-400">{kol.scoreLabel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Monthly AI Portfolio Review */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mt-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-2">Monthly KOL Portfolio Review — March 2026</p>
                <div className="text-sm text-gray-800 leading-relaxed space-y-2">
                  <p><strong>Portfolio health: Good.</strong> 2 of {kols.length} KOLs rated A (High Value), 1 rated B, 1 rated C (declining), and 1 rated D (recommended for wind-down).</p>
                  <p><strong>Top performer:</strong> @techVC_sarah delivers 53% of your total KOL-driven impressions at the lowest cost per engagement ($0.42). Her follower correlation (0.72) is the strongest in your portfolio.</p>
                  <p><strong>Action required:</strong> @ai_influencer (D-rated) has generated only 1 activation in 30 days despite $5,000/mo compensation. Recommend immediate wind-down.</p>
                  <p><strong>Opportunity:</strong> Your Reddit KOL coverage is thin (1 of {kols.length}). Consider adding 2 Reddit-native KOLs from the discovery suggestions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'activations' && (
        <div>
          <SectionTitle subtitle="All KOL activations across platforms, most recent first">Recent Activations</SectionTitle>
          {activationsQ.isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
          ) : (
            <div className="space-y-3">
              {kolActivations.map((act, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{act.kol}</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{act.type}</span>
                    </div>
                    <span className="text-xs text-gray-400">{act.time}</span>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed mb-2">{act.content}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{act.engagements} engagements</span>
                    <span>{act.impressions} impressions</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'discover' && (
        <div>
          <SectionTitle subtitle="AI-identified potential KOLs from your social listening feed">KOL Discovery Suggestions</SectionTitle>
          {discoverQ.isLoading ? (
            <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
          ) : !discoveries.length ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-3xl mb-3">{'\uD83D\uDD0D'}</p>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No candidates yet</h3>
              <p className="text-sm text-gray-500">AI Discovery analyzes your listening feed to find potential KOLs. Candidates appear after they show up 2+ times in your monitored conversations.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {discoveries.map((sug, i) => {
                const formattedFollowers = sug.followers >= 1000 ? `${(sug.followers / 1000).toFixed(1)}K` : sug.followers;
                return (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <PlatformBadge platform={sug.platform} />
                          <span className="font-semibold text-gray-900">{sug.username}</span>
                          <span className="text-sm text-gray-400">{formattedFollowers} {sug.platform === 'REDDIT' ? 'karma' : 'followers'}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">
                          Appeared <strong>{sug.appearances} times</strong> in your listening feed over the past month.
                          Average {sug.avgEngagement} engagements per post. Sentiment: {sug.sentimentPct}% positive.
                          {sug.topics.length > 0 && <> Topics: {sug.topics.join(', ')}.</>}
                        </p>
                        {sug.sampleContent && (
                          <p className="text-xs text-gray-500 italic mb-2 line-clamp-2">&ldquo;{sug.sampleContent}&rdquo;</p>
                        )}
                        <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3 mt-2">
                          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">AI</div>
                          <p className="text-xs text-blue-800">
                            {sug.avgScore > 0.6
                              ? `Strong candidate. High engagement (score: ${sug.avgScore}) with ${sug.appearances} organic mentions suggests authentic interest in your ecosystem. Consider reaching out for a partnership.`
                              : sug.avgScore > 0.3
                              ? `Moderate candidate. ${sug.appearances} mentions with decent engagement. Worth monitoring for another week before outreach.`
                              : `Early signal. Appeared ${sug.appearances} times but engagement is still building. Keep on watchlist.`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <button className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 whitespace-nowrap">Add as KOL</button>
                        <button className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 whitespace-nowrap">Dismiss</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
