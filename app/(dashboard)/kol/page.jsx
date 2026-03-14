'use client';

import { useState, useCallback } from 'react';
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
    rawType: k.relationshipType || 'ORGANIC_ADVOCATE',
    type: TYPE_LABELS[k.relationshipType] ? TYPE_LABELS[k.relationshipType].replace(/s$/, '') : 'Organic Advocate',
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

const TYPE_LABELS = {
  ALL: 'All Types',
  COMPANY_EXEC: 'Figure Executives',
  RETAIL_ANALYST: 'Retail Analysts',
  PAID_PARTNER: 'Paid Partners',
  ORGANIC_ADVOCATE: 'Organic Advocates',
  ADVISOR: 'Advisors',
  PORTFOLIO_FOUNDER: 'Portfolio Founders',
};

const TYPE_COLORS = {
  COMPANY_EXEC: 'bg-rose-100 text-rose-700',
  RETAIL_ANALYST: 'bg-cyan-100 text-cyan-700',
  PAID_PARTNER: 'bg-purple-100 text-purple-700',
  ORGANIC_ADVOCATE: 'bg-green-100 text-green-700',
  ADVISOR: 'bg-amber-100 text-amber-700',
  PORTFOLIO_FOUNDER: 'bg-blue-100 text-blue-700',
};

const TYPE_ICONS = {
  COMPANY_EXEC: '\uD83C\uDFE2',
  RETAIL_ANALYST: '\uD83D\uDCC8',
  PAID_PARTNER: '\uD83E\uDD1D',
  ORGANIC_ADVOCATE: '\uD83C\uDF31',
  ADVISOR: '\uD83C\uDFAF',
  PORTFOLIO_FOUNDER: '\uD83D\uDCBC',
};

const TYPE_DESCRIPTIONS = {
  COMPANY_EXEC: 'Figure Technology Solutions leadership and company representatives',
  RETAIL_ANALYST: 'Independent analysts and researchers who cover FIGR',
  PAID_PARTNER: 'Contracted KOLs with paid partnerships',
  ORGANIC_ADVOCATE: 'Community members who organically promote the brand',
  ADVISOR: 'Strategic advisors with industry influence',
  PORTFOLIO_FOUNDER: 'Founders of portfolio companies',
};

// Display order for sections — execs first
const SECTION_ORDER = ['COMPANY_EXEC', 'RETAIL_ANALYST', 'PAID_PARTNER', 'ORGANIC_ADVOCATE', 'ADVISOR', 'PORTFOLIO_FOUNDER'];

export default function KOLPage() {
  const [subTab, setSubTab] = useState('roster');
  const [selectedKOL, setSelectedKOL] = useState(null);
  const [typeFilter, setTypeFilter] = useState('ALL');

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

  // ── AI Scorecard ────────────────────────────────────────
  const [scorecard, setScorecard] = useState(null);
  const scorecardMutation = trpc.kol.generateScorecard.useMutation({
    onSuccess: (data) => setScorecard(data),
  });
  const handleGenerateScorecard = useCallback(() => {
    if (!selectedKOL) return;
    setScorecard(null);
    scorecardMutation.mutate({ kolId: selectedKOL });
  }, [selectedKOL, scorecardMutation]);

  // ── Derived ───────────────────────────────────────────────
  const allKols = (kolsQ.data ?? []).map(transformKOL);
  const kols = typeFilter === 'ALL' ? allKols : allKols.filter(k => k.rawType === typeFilter);

  // Type breakdown for summary
  const typeCounts = {};
  for (const k of allKols) {
    typeCounts[k.rawType] = (typeCounts[k.rawType] || 0) + 1;
  }
  const kolActivations = activationsQ.data ?? [];
  const kolPerformanceData = metricsHistoryQ.data ?? [];
  const discoveries = discoverQ.data ?? [];

  // ── KOL detail drill-down ─────────────────────────────────
  if (selectedKOL) {
    const kol = allKols.find((k) => k.id === selectedKOL);
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
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[kol.rawType] || 'bg-gray-100 text-gray-600'}`}>{kol.type}</span>
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
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-blue-900">
                  {scorecard ? 'AI Scorecard' : 'AI Analysis'}
                </p>
                <button
                  onClick={handleGenerateScorecard}
                  disabled={scorecardMutation.isLoading}
                  className="px-2.5 py-1 bg-blue-600 text-white text-[10px] rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {scorecardMutation.isLoading ? 'Generating...' : scorecard ? 'Regenerate Report' : 'Generate Full Report'}
                </button>
              </div>
              {scorecardMutation.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ) : scorecard ? (
                <div className="space-y-3">
                  {scorecard.summary && (
                    <p className="text-sm text-gray-800 leading-relaxed">{scorecard.summary}</p>
                  )}
                  {scorecard.highlights?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-800 mb-1">Highlights</p>
                      <ul className="space-y-0.5">
                        {scorecard.highlights.map((h, i) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                            <span className="text-green-500 mt-0.5">+</span> {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {scorecard.concerns?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-800 mb-1">Concerns</p>
                      <ul className="space-y-0.5">
                        {scorecard.concerns.map((c, i) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                            <span className="text-red-500 mt-0.5">-</span> {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {scorecard.recommendations?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-blue-800 mb-1">Recommendations</p>
                      <ul className="space-y-0.5">
                        {scorecard.recommendations.map((r, i) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                            <span className="text-blue-500 mt-0.5">&rarr;</span> {typeof r === 'string' ? r : r.recommendation || r.action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {scorecard.costEfficiency && (
                    <p className="text-xs text-gray-500">Cost efficiency: {typeof scorecard.costEfficiency === 'string' ? scorecard.costEfficiency : scorecard.costEfficiency.rating || JSON.stringify(scorecard.costEfficiency)}</p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-800 leading-relaxed">
                  <p><strong>Score: {kol.score} ({kol.scoreLabel}).</strong> {kol.name.split(' ')[0]} has {kol.activations} activations this period averaging {kol.avgEng}% engagement. Click &quot;Generate Full Report&quot; for a detailed AI-powered analysis.</p>
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {[1, 2, 3, 4, 5].map((i) => <MetricCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <MetricCard label="Active KOLs" value={allKols.length} />
              <MetricCard label="Retail Analysts" value={typeCounts.RETAIL_ANALYST || 0} />
              <MetricCard label="Paid Partners" value={typeCounts.PAID_PARTNER || 0} />
              <MetricCard label="Organic Advocates" value={typeCounts.ORGANIC_ADVOCATE || 0} />
              <MetricCard label="Total Activations (30d)" value={allKols.reduce((s, k) => s + (k.activations ?? 0), 0)} />
            </div>
          )}

          {/* Type filter pills */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  typeFilter === key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label} {key !== 'ALL' && typeCounts[key] ? `(${typeCounts[key]})` : key === 'ALL' ? `(${allKols.length})` : ''}
              </button>
            ))}
          </div>

          {/* Grouped KOL sections */}
          {kolsQ.isLoading ? (
            <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <div className="space-y-6">
              {SECTION_ORDER
                .filter((sectionType) => typeFilter === 'ALL' || typeFilter === sectionType)
                .filter((sectionType) => {
                  const sectionKols = allKols.filter(k => k.rawType === sectionType);
                  return sectionKols.length > 0;
                })
                .map((sectionType) => {
                  const sectionKols = allKols.filter(k => k.rawType === sectionType);
                  const sectionActivations = sectionKols.reduce((s, k) => s + (k.activations ?? 0), 0);
                  const sectionAvgEng = sectionKols.length
                    ? (sectionKols.reduce((s, k) => s + parseFloat(k.avgEng || 0), 0) / sectionKols.length).toFixed(1)
                    : '0.0';

                  return (
                    <div key={sectionType} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Section header */}
                      <div className={`px-5 py-3 border-b border-gray-100 flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{TYPE_ICONS[sectionType]}</span>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{TYPE_LABELS[sectionType]}</h3>
                            <p className="text-xs text-gray-500">{TYPE_DESCRIPTIONS[sectionType]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span><strong className="text-gray-900">{sectionKols.length}</strong> KOLs</span>
                          <span><strong className="text-gray-900">{sectionActivations}</strong> activations</span>
                          <span><strong className="text-gray-900">{sectionAvgEng}%</strong> avg eng.</span>
                        </div>
                      </div>
                      {/* Section table */}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            {['KOL', 'Platform', 'Followers', 'Activations', 'Avg Eng.', 'Impressions', 'Sentiment', 'AI Score'].map((h) => (
                              <th key={h} className="text-left py-2 px-3 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sectionKols.map((kol) => (
                            <tr
                              key={kol.id}
                              onClick={() => setSelectedKOL(kol.id)}
                              className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                            >
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5">
                                  <Avatar initials={kol.avatar} src={kol.avatarUrl} platform={kol.platform} size="sm" />
                                  <div>
                                    <p className="font-medium text-gray-900 text-sm">{kol.name}</p>
                                    <p className="text-xs text-gray-400">{kol.handle}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3"><PlatformBadge platform={kol.platform} /></td>
                              <td className="py-2.5 px-3 text-gray-700">{kol.followers}</td>
                              <td className="py-2.5 px-3 font-medium">{kol.activations}</td>
                              <td className="py-2.5 px-3">
                                <span className={`font-medium ${parseFloat(kol.avgEng) > 4 ? 'text-green-600' : parseFloat(kol.avgEng) > 2 ? 'text-gray-900' : 'text-red-500'}`}>
                                  {kol.avgEng}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-gray-700">{kol.impressions}</td>
                              <td className="py-2.5 px-3">
                                <span className={parseInt(kol.sentiment) > 75 ? 'text-green-600' : 'text-amber-600'}>{kol.sentiment}% pos</span>
                              </td>
                              <td className="py-2.5 px-3">
                                <ScoreBadge score={kol.score} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
            </div>
          )}

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
