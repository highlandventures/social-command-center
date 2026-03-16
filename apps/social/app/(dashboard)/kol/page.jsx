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
  TabButton, Avatar, Skeleton, useChartColors,
} from '@/components/ui';

/** Format a date in UTC to avoid SSR/client timezone drift */
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}/${dt.getUTCFullYear()}`;
}

// Transform API response to UI-friendly format
function transformKOL(k) {
  const m = k.latestMetrics;
  const initials = k.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const followers = m?.followers ?? k.baselineFollowers ?? 0;
  const scoreLabels = { A: 'High Value', B: 'Good', C: 'Watch', D: 'Low Value', F: 'Drop' };

  // Prefer live-computed values from activations, fall back to KOLMetrics
  const activations = k.activationCount ?? m?.activationsCount ?? 0;
  const sentimentRaw = k.sentimentPositivePct ?? m?.sentimentPositivePct ?? null;
  const engRate = k.engagementRate ?? m?.engagementRateBrand ?? k.baselineEngRate ?? 0;
  const impressionsRaw = k.totalImpressions ?? m?.totalImpressionsEst ?? 0;

  const fmtCurrency = (v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`;

  return {
    ...k,
    handle: `@${k.username}`,
    avatar: initials,
    avatarUrl: k.avatarUrl || null,
    bio: k.bio || null,
    location: k.location || null,
    verified: k.verified || false,
    followingCount: k.followingCount || null,
    accountCreatedAt: k.accountCreatedAt || null,
    websiteUrl: k.websiteUrl || null,
    profileSummary: k.profileSummary || null,
    followers: followers >= 1000 ? `${(followers / 1000).toFixed(1)}K` : followers,
    followersRaw: followers,
    rawType: k.relationshipType || 'ORGANIC_ADVOCATE',
    type: TYPE_LABELS[k.relationshipType] ? TYPE_LABELS[k.relationshipType].replace(/s$/, '') : 'Organic Advocate',
    activations,
    avgEng: engRate.toFixed(1),
    impressions: impressionsRaw >= 1000 ? `${(impressionsRaw / 1000).toFixed(1)}K` : impressionsRaw,
    impressionsRaw,
    sentiment: sentimentRaw !== null ? String(Math.round(sentimentRaw)) : null,
    score: k.aiScore || '—',
    scoreLabel: scoreLabels[k.aiScore] || 'Unscored',
    correlation: m?.followerGrowthCorrelation ?? 0,
    comp: k.compensationMonthly ? `$${k.compensationMonthly.toLocaleString()}/mo` : '—',
    compRaw: k.compensationMonthly || 0,
    trend: null,
    cohortName: k.cohort?.name || 'Uncategorized',
    // ROI metrics
    totalSpend: k.totalSpend || 0,
    totalSpendFmt: k.totalSpend ? fmtCurrency(k.totalSpend) : '—',
    costPerEngagement: k.costPerEngagement,
    cpm: k.cpm,
    estimatedMediaValue: k.estimatedMediaValue || 0,
    emvFmt: k.estimatedMediaValue ? fmtCurrency(k.estimatedMediaValue) : '$0',
    roi: k.roi,
    roiFmt: k.roi ? `${k.roi.toFixed(1)}x` : null,
    totalEngagement: k.totalEngagement || 0,
  };
}

const TYPE_LABELS = {
  ALL: 'All Types',
  COMPANY_EXEC: 'Figure Executives',
  RETAIL_ANALYST: 'Retail Analysts',
  PAID_PARTNER: 'Paid Partners',
  ORGANIC_ADVOCATE: 'Organic Advocates',
};

const TYPE_COLORS = {
  COMPANY_EXEC: 'bg-rose-100 text-rose-700',
  RETAIL_ANALYST: 'bg-cyan-100 text-cyan-700',
  PAID_PARTNER: 'bg-purple-100 text-purple-700',
  ORGANIC_ADVOCATE: 'bg-green-100 text-green-700',
};

const TYPE_ICONS = {
  COMPANY_EXEC: '\uD83C\uDFE2',
  RETAIL_ANALYST: '\uD83D\uDCC8',
  PAID_PARTNER: '\uD83E\uDD1D',
  ORGANIC_ADVOCATE: '\uD83C\uDF31',
};

const TYPE_DESCRIPTIONS = {
  COMPANY_EXEC: 'Figure Technology Solutions leadership and company representatives',
  RETAIL_ANALYST: 'Independent analysts and researchers who cover FIGR',
  PAID_PARTNER: 'Contracted KOLs with paid partnerships',
  ORGANIC_ADVOCATE: 'Community members who organically promote the brand',
};

// Display order for sections — execs first
const SECTION_ORDER = ['COMPANY_EXEC', 'RETAIL_ANALYST', 'PAID_PARTNER', 'ORGANIC_ADVOCATE'];

const EMPTY_KOL_FORM = {
  name: '', username: '', platform: 'X', relationshipType: 'ORGANIC_ADVOCATE',
  cohortId: '', compensationMonthly: '', baselineFollowers: '',
};

export default function KOLPage() {
  const chartColors = useChartColors();
  const [subTab, setSubTab] = useState('roster');
  const [selectedKOL, setSelectedKOL] = useState(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_KOL_FORM);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [editingKOL, setEditingKOL] = useState(null);
  const [editForm, setEditForm] = useState({});

  // ── tRPC queries ──────────────────────────────────────────
  const kolsQ = trpc.kol.list.useQuery(undefined, { staleTime: 30_000, keepPreviousData: true });
  const activationsQ = trpc.kol.getActivations.useQuery(
    { kolId: selectedKOL },
    { staleTime: 30_000, keepPreviousData: true, enabled: !!selectedKOL }
  );
  const metricsHistoryQ = trpc.kol.getMetricsHistory.useQuery(
    { kolId: selectedKOL },
    { staleTime: 60_000, keepPreviousData: true, enabled: !!selectedKOL }
  );
  const discoverQ = trpc.kol.discoverCandidates.useQuery(undefined, { staleTime: 60_000, keepPreviousData: true });
  const recentActivationsQ = trpc.kol.recentActivations.useQuery(undefined, { staleTime: 30_000, keepPreviousData: true });
  const cohortsQ = trpc.kol.getCohorts.useQuery(undefined, { staleTime: 60_000, keepPreviousData: true });
  const createMutation = trpc.kol.create.useMutation({
    onSuccess: () => { kolsQ.refetch(); setShowAddModal(false); setAddForm(EMPTY_KOL_FORM); },
  });
  const updateMutation = trpc.kol.update.useMutation({
    onSuccess: () => { kolsQ.refetch(); setEditingKOL(null); },
  });
  const deactivateMutation = trpc.kol.deactivate.useMutation({
    onSuccess: () => kolsQ.refetch(),
  });

  // ── Profile enrichment ──────────────────────────────────
  const enrichMutation = trpc.kol.enrichProfile.useMutation({
    onSuccess: () => kolsQ.refetch(),
  });

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

  const toggleSection = useCallback((sectionType) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionType]: !prev[sectionType] }));
  }, []);

  const openEditModal = useCallback((kol) => {
    setEditForm({
      name: kol.name,
      username: kol.username,
      relationshipType: kol.rawType,
      cohortId: kol.cohort?.id || '',
      compensationMonthly: kol.compRaw || '',
      baselineFollowers: kol.followersRaw || '',
      baselineEngRate: kol.baselineEngRate || '',
    });
    setEditingKOL(kol);
  }, []);

  // ── KOL detail drill-down ─────────────────────────────────
  if (selectedKOL) {
    const kol = allKols.find((k) => k.id === selectedKOL);
    if (!kol) {
      setSelectedKOL(null);
      return null;
    }

    return (
      <div>
        <button onClick={() => setSelectedKOL(null)} className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-1">
          {'\u2190'} Back to roster
        </button>

        {activationsQ.isError && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
            Failed to load activations. {activationsQ.error?.message || 'Please try again.'}
          </div>
        )}
        {metricsHistoryQ.isError && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
            Failed to load metrics history. {metricsHistoryQ.error?.message || 'Please try again.'}
          </div>
        )}

        {/* KOL header */}
        <div className="bg-surface-card rounded-xl border border-border p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar initials={kol.avatar} src={kol.avatarUrl} platform={kol.platform} size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-content-primary">{kol.name}</h2>
                  {kol.verified && <span className="text-blue-500" title="Verified">&#10004;</span>}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-content-muted">{kol.handle}</span>
                  <PlatformBadge platform={kol.platform} />
                  <span className="text-sm text-content-faint">&middot;</span>
                  <span className="text-sm text-content-muted">{kol.followers} followers</span>
                  {kol.followingCount && (
                    <>
                      <span className="text-sm text-content-faint">&middot;</span>
                      <span className="text-sm text-content-muted">{kol.followingCount >= 1000 ? `${(kol.followingCount / 1000).toFixed(1)}K` : kol.followingCount} following</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[kol.rawType] || 'bg-surface-secondary text-content-secondary'}`}>{kol.type}</span>
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded text-xs text-blue-600">{kol.cohortName}</span>
                  {kol.comp !== '—' && <span className="text-xs text-content-muted">Comp: {kol.comp}</span>}
                  {kol.location && <span className="text-xs text-content-faint">&#128205; {kol.location}</span>}
                  {kol.accountCreatedAt && <span className="text-xs text-content-faint">Joined {new Date(kol.accountCreatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                  {kol.websiteUrl && (
                    <a href={kol.websiteUrl.startsWith('http') ? kol.websiteUrl : `https://${kol.websiteUrl}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline" onClick={(e) => e.stopPropagation()}>
                      &#128279; {kol.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => openEditModal(kol)}
                  className="px-3 py-1.5 bg-surface-secondary text-content-secondary text-xs rounded-lg font-medium hover:bg-surface-tertiary transition-colors"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${kol.name} from the KOL roster? This can be undone later.`)) {
                      deactivateMutation.mutate({ kolId: kol.id }, { onSuccess: () => setSelectedKOL(null) });
                    }
                  }}
                  className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                >
                  Remove KOL
                </button>
              </div>
              <div className="text-right">
                <ScoreBadge score={kol.score} />
                <p className="text-sm text-content-muted mt-1">{kol.scoreLabel}</p>
                <TrendArrow trend={kol.trend} />
              </div>
            </div>
          </div>
        </div>

        {/* Profile & Bio */}
        {(kol.bio || kol.profileSummary) && (
          <div className="bg-surface-card rounded-xl border border-border p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-content-muted uppercase">Profile</p>
              <button
                onClick={() => enrichMutation.mutate({ kolId: kol.id })}
                disabled={enrichMutation.isLoading}
                className="px-2.5 py-1 bg-surface-secondary text-content-secondary text-[10px] rounded-md font-medium hover:bg-surface-tertiary disabled:opacity-50"
              >
                {enrichMutation.isLoading ? 'Refreshing...' : 'Refresh Profile'}
              </button>
            </div>
            {kol.bio && (
              <p className="text-sm text-content-primary mb-3">{kol.bio}</p>
            )}
            {kol.profileSummary && (
              <div className="border-t border-border-secondary pt-3">
                <p className="text-xs font-semibold text-content-muted uppercase mb-1">AI Summary</p>
                <p className="text-sm text-content-secondary leading-relaxed">{kol.profileSummary.summary}</p>
                {kol.profileSummary.audienceProfile && (
                  <p className="text-sm text-content-secondary mt-2"><strong>Audience:</strong> {kol.profileSummary.audienceProfile}</p>
                )}
                {kol.profileSummary.brandRelevance && (
                  <p className="text-sm text-content-secondary mt-1"><strong>Brand relevance:</strong> {kol.profileSummary.brandRelevance}</p>
                )}
                {kol.profileSummary.keyTopics?.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {kol.profileSummary.keyTopics.map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-surface-secondary rounded text-xs text-content-secondary">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* KOL metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <MetricCard label="Activations" value={kol.activations} />
          <MetricCard label="Avg Engagement" value={`${kol.avgEng}%`} />
          <MetricCard label="Est. Impressions" value={kol.impressions} />
          <MetricCard label="Sentiment" value={kol.sentiment !== null ? `${kol.sentiment}% pos` : '—'} />
          <MetricCard label="Est. Media Value" value={kol.emvFmt} />
          <MetricCard label="Cost/Engagement" value={kol.costPerEngagement != null ? `$${kol.costPerEngagement.toFixed(2)}` : 'N/A'} />
        </div>

        {/* ROI Analysis (for paid KOLs) */}
        {kol.compRaw > 0 && (
          <div className="bg-surface-card rounded-xl border border-border p-5 mb-6">
            <p className="text-xs font-semibold text-content-muted uppercase mb-3">ROI Analysis</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-content-faint">Total Spend</p>
                <p className="text-lg font-bold text-content-primary">{kol.totalSpendFmt}</p>
              </div>
              <div>
                <p className="text-xs text-content-faint">Est. Media Value</p>
                <p className="text-lg font-bold text-content-primary">{kol.emvFmt}</p>
              </div>
              <div>
                <p className="text-xs text-content-faint">CPM</p>
                <p className="text-lg font-bold text-content-primary">{kol.cpm != null ? `$${kol.cpm.toFixed(2)}` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-content-faint">ROI</p>
                <p className={`text-lg font-bold ${kol.roi >= 2 ? 'text-green-600' : kol.roi >= 1 ? 'text-amber-600' : 'text-red-500'}`}>
                  {kol.roiFmt || '—'}
                </p>
                {kol.roi != null && (
                  <p className="text-[10px] text-content-faint">{kol.roi >= 2 ? 'Strong return' : kol.roi >= 1 ? 'Breaking even' : 'Below target'}</p>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border-secondary flex gap-6 text-xs text-content-muted">
              <span>Total engagements: {kol.totalEngagement.toLocaleString()}</span>
              <span>Total impressions: {(kol.impressionsRaw || 0).toLocaleString()}</span>
              <span>Comp: {kol.comp}</span>
            </div>
          </div>
        )}

        {/* AI Analysis */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl p-5 mb-6">
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
                    <p className="text-sm text-content-primary leading-relaxed">{scorecard.summary}</p>
                  )}
                  {scorecard.highlights?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-1">Highlights</p>
                      <ul className="space-y-0.5">
                        {scorecard.highlights.map((h, i) => (
                          <li key={i} className="text-sm text-content-secondary flex items-start gap-1.5">
                            <span className="text-green-500 mt-0.5">+</span> {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {scorecard.concerns?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">Concerns</p>
                      <ul className="space-y-0.5">
                        {scorecard.concerns.map((c, i) => (
                          <li key={i} className="text-sm text-content-secondary flex items-start gap-1.5">
                            <span className="text-red-500 mt-0.5">-</span> {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {scorecard.recommendations?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">Recommendations</p>
                      <ul className="space-y-0.5">
                        {scorecard.recommendations.map((r, i) => (
                          <li key={i} className="text-sm text-content-secondary flex items-start gap-1.5">
                            <span className="text-blue-500 mt-0.5">&rarr;</span> {typeof r === 'string' ? r : r.recommendation || r.action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {scorecard.costEfficiency && (
                    <p className="text-xs text-content-muted">Cost efficiency: {typeof scorecard.costEfficiency === 'string' ? scorecard.costEfficiency : scorecard.costEfficiency.rating || JSON.stringify(scorecard.costEfficiency)}</p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-content-primary leading-relaxed">
                  <p><strong>Score: {kol.score} ({kol.scoreLabel}).</strong> {kol.name.split(' ')[0]} has {kol.activations} activations this period averaging {kol.avgEng}% engagement. Click &quot;Generate Full Report&quot; for a detailed AI-powered analysis.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-surface-card rounded-xl border border-border p-5">
            <SectionTitle>Activation Performance Over Time</SectionTitle>
            {kolPerformanceData.length === 0 ? (
              <p className="text-sm text-content-faint text-center py-12">No weekly metrics yet. Data aggregates daily at 5 AM UTC.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={kolPerformanceData.map(d => ({ ...d, week: new Date(d.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
                  <Bar dataKey="activationsCount" fill={COLORS.blue} radius={[4, 4, 0, 0]} name="Activations" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-surface-card rounded-xl border border-border p-5">
            <SectionTitle>Estimated Impressions Over Time</SectionTitle>
            {kolPerformanceData.length === 0 ? (
              <p className="text-sm text-content-faint text-center py-12">No weekly metrics yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={kolPerformanceData.map(d => ({ ...d, week: new Date(d.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
                  <Line type="monotone" dataKey="totalImpressionsEst" stroke={COLORS.purple} strokeWidth={2} dot={false} name="Est. Impressions" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Activation timeline */}
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <SectionTitle>Activation Timeline</SectionTitle>
          <div className="space-y-3">
            {kolActivations.length === 0 && (
              <p className="text-sm text-content-faint text-center py-6">No activations detected yet. The cron job checks every 30 minutes.</p>
            )}
            {kolActivations.map((act) => {
              const m = act.metricsAtDetection || {};
              const engagements = (m.likes || 0) + (m.retweets || 0) + (m.replies || 0) + (m.upvotes || 0) + (m.comments || 0);
              const impressions = m.impressions || ((m.upvotes || 0) + (m.comments || 0)) * 10;
              const typeLabel = (act.activationType || 'MENTION').replace(/_/g, ' ');
              return (
                <div key={act.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-hover">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-blue-600">{typeLabel}</span>
                      <span className="text-xs text-content-faint">{fmtDate(act.postedAt || act.detectedAt)}</span>
                    </div>
                    <p className="text-sm text-content-primary">{act.content}</p>
                    <div className="flex gap-3 mt-1 text-xs text-content-muted">
                      <span>{engagements} engagements</span>
                      <span>{impressions} impressions</span>
                      {act.sourceUrl && <a href={act.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View</a>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit KOL Modal (detail view) */}
        {editingKOL && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingKOL(null)}>
            <div className="bg-surface-card rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-content-primary mb-4">Edit KOL &mdash; {editingKOL.name}</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({
                  kolId: editingKOL.id,
                  name: editForm.name,
                  username: editForm.username.replace(/^@/, ''),
                  relationshipType: editForm.relationshipType,
                  ...(editForm.cohortId ? { cohortId: editForm.cohortId } : { cohortId: null }),
                  compensationMonthly: editForm.compensationMonthly ? Number(editForm.compensationMonthly) : null,
                  baselineFollowers: editForm.baselineFollowers ? parseInt(editForm.baselineFollowers) : null,
                  baselineEngRate: editForm.baselineEngRate ? parseFloat(editForm.baselineEngRate) : null,
                });
              }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">Name</label>
                    <input type="text" required value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">Username</label>
                    <input type="text" required value={editForm.username} onChange={(e) => setEditForm(f => ({ ...f, username: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Relationship Type</label>
                  <select value={editForm.relationshipType} onChange={(e) => setEditForm(f => ({ ...f, relationshipType: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-card">
                    {Object.entries(TYPE_LABELS).filter(([k]) => k !== 'ALL').map(([k, v]) => (
                      <option key={k} value={k}>{v.replace(/s$/, '')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Cohort</label>
                  <select value={editForm.cohortId} onChange={(e) => setEditForm(f => ({ ...f, cohortId: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-card">
                    <option value="">No cohort</option>
                    {(cohortsQ.data || []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">Comp ($/mo)</label>
                    <input type="number" value={editForm.compensationMonthly} onChange={(e) => setEditForm(f => ({ ...f, compensationMonthly: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">Followers</label>
                    <input type="number" value={editForm.baselineFollowers} onChange={(e) => setEditForm(f => ({ ...f, baselineFollowers: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">Eng. Rate %</label>
                    <input type="number" step="0.1" value={editForm.baselineEngRate} onChange={(e) => setEditForm(f => ({ ...f, baselineEngRate: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="0.0" />
                  </div>
                </div>
                {updateMutation.error && (
                  <p className="text-sm text-red-600">{updateMutation.error.message}</p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setEditingKOL(null)}
                    className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary">Cancel</button>
                  <button type="submit" disabled={updateMutation.isLoading}
                    className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main roster view ──────────────────────────────────────
  return (
    <div>
      <div className="flex items-center gap-2 mb-6 border-b border-border pb-3">
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
        <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg hover:bg-gray-800">+ Add KOL</button>
      </div>

      {kolsQ.isError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          Failed to load KOL roster. {kolsQ.error?.message || 'Please try again.'}
        </div>
      )}
      {recentActivationsQ.isError && subTab === 'activations' && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          Failed to load recent activations. {recentActivationsQ.error?.message || 'Please try again.'}
        </div>
      )}
      {discoverQ.isError && subTab === 'discover' && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          Failed to load AI discovery candidates. {discoverQ.error?.message || 'Please try again.'}
        </div>
      )}
      {cohortsQ.isError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          Failed to load cohorts. {cohortsQ.error?.message || 'Please try again.'}
        </div>
      )}

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
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
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
                    <div key={sectionType} className="bg-surface-card rounded-xl border border-border overflow-x-auto">
                      {/* Section header — clickable accordion */}
                      <button
                        type="button"
                        onClick={() => toggleSection(sectionType)}
                        className={`w-full px-5 py-3 ${collapsedSections[sectionType] ? '' : 'border-b border-border-secondary'} flex items-center justify-between cursor-pointer hover:bg-surface-hover transition-colors`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{TYPE_ICONS[sectionType]}</span>
                          <div className="text-left">
                            <h3 className="text-sm font-semibold text-content-primary">{TYPE_LABELS[sectionType]}</h3>
                            <p className="text-xs text-content-muted">{TYPE_DESCRIPTIONS[sectionType]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-content-muted">
                          <span><strong className="text-content-primary">{sectionKols.length}</strong> KOLs</span>
                          <span><strong className="text-content-primary">{sectionActivations}</strong> activations</span>
                          <span><strong className="text-content-primary">{sectionAvgEng}%</strong> avg eng.</span>
                          <svg className={`w-4 h-4 text-content-muted transition-transform ${collapsedSections[sectionType] ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </button>
                      {/* Section table — collapsible */}
                      {!collapsedSections[sectionType] && <table className="w-full text-sm min-w-[900px]">
                        <thead>
                          <tr className="border-b border-border-secondary bg-surface-page/50">
                            {['KOL', 'Platform', 'Followers', 'Activations', 'Avg Eng.', 'Impressions', 'Sentiment', 'ROI', 'Actions'].map((h) => (
                              <th key={h} className="text-left py-2 px-3 text-[10px] font-medium text-content-faint uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sectionKols.map((kol) => (
                            <tr
                              key={kol.id}
                              onClick={() => setSelectedKOL(kol.id)}
                              className="border-b border-border-secondary hover:bg-surface-hover cursor-pointer transition-colors"
                            >
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5">
                                  <Avatar initials={kol.avatar} src={kol.avatarUrl} platform={kol.platform} size="sm" />
                                  <div>
                                    <p className="font-medium text-content-primary text-sm">{kol.name}</p>
                                    <p className="text-xs text-content-faint">{kol.handle}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3"><PlatformBadge platform={kol.platform} /></td>
                              <td className="py-2.5 px-3 text-content-secondary">{kol.followers}</td>
                              <td className="py-2.5 px-3 font-medium">{kol.activations}</td>
                              <td className="py-2.5 px-3">
                                <span className={`font-medium ${parseFloat(kol.avgEng) > 4 ? 'text-green-600' : parseFloat(kol.avgEng) > 2 ? 'text-content-primary' : 'text-red-500'}`}>
                                  {kol.avgEng}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-content-secondary">{kol.impressions}</td>
                              <td className="py-2.5 px-3">
                                {kol.sentiment !== null ? (
                                  <span className={parseInt(kol.sentiment) > 60 ? 'text-green-600' : parseInt(kol.sentiment) > 30 ? 'text-amber-600' : 'text-red-500'}>{kol.sentiment}% pos</span>
                                ) : (
                                  <span className="text-content-faint">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {kol.roiFmt ? (
                                  <span className={`font-medium ${kol.roi >= 2 ? 'text-green-600' : kol.roi >= 1 ? 'text-amber-600' : 'text-red-500'}`}>{kol.roiFmt}</span>
                                ) : kol.compRaw > 0 ? (
                                  <span className="text-content-faint">—</span>
                                ) : (
                                  <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded">Free</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1">
                                  <select
                                    value={kol.rawType}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      updateMutation.mutate({ kolId: kol.id, relationshipType: e.target.value });
                                    }}
                                    className="text-xs border border-border rounded px-1.5 py-1 bg-surface-card text-content-secondary cursor-pointer hover:border-gray-400"
                                  >
                                    {SECTION_ORDER.map((t) => (
                                      <option key={t} value={t}>{TYPE_LABELS[t]?.replace(/s$/, '')}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); if (confirm(`Remove ${kol.name} from roster?`)) deactivateMutation.mutate({ kolId: kol.id }); }}
                                    className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0"
                                    title="Remove from roster"
                                  >
                                    &minus;
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Monthly AI Portfolio Review */}
          {allKols.length > 0 && (() => {
            // Compute dynamic portfolio stats
            const scoreCounts = {};
            for (const k of allKols) {
              const s = k.score || 'Unscored';
              scoreCounts[s] = (scoreCounts[s] || 0) + 1;
            }
            const scoreBreakdown = ['A', 'B', 'C', 'D', 'F']
              .filter(s => scoreCounts[s])
              .map(s => `${scoreCounts[s]} rated ${s}`)
              .join(', ');

            // Top performer by activations
            const topByActivations = [...allKols].sort((a, b) => (b.activations ?? 0) - (a.activations ?? 0))[0];

            // Underperforming paid partners (D or F rated, or 0 activations with compensation)
            const underperformers = allKols.filter(k =>
              (k.score === 'D' || k.score === 'F') && k.comp !== '—'
            );

            // Platform diversity
            const redditKols = allKols.filter(k => k.platform === 'REDDIT');
            const unscoredCount = allKols.filter(k => !k.score || k.score === '—').length;

            const healthLabel = (scoreCounts['A'] || 0) + (scoreCounts['B'] || 0) > allKols.length / 2 ? 'Good' :
              (scoreCounts['D'] || 0) + (scoreCounts['F'] || 0) > allKols.length / 3 ? 'Needs Attention' : 'Fair';

            return (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl p-5 mt-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-2">Monthly KOL Portfolio Review &mdash; {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                    <div className="text-sm text-content-primary leading-relaxed space-y-2">
                      <p><strong>Portfolio health: {healthLabel}.</strong> {allKols.length} active KOLs across {Object.keys(typeCounts).length} segments. {scoreBreakdown || `${unscoredCount} KOLs not yet scored.`}</p>
                      {topByActivations && topByActivations.activations > 0 && (
                        <p><strong>Top performer:</strong> @{topByActivations.username} leads with {topByActivations.activations} activations and {topByActivations.avgEng}% avg engagement{topByActivations.score !== '—' ? ` (${topByActivations.score}-rated)` : ''}.</p>
                      )}
                      {underperformers.length > 0 && (
                        <p><strong>Action required:</strong> {underperformers.map(k => `@${k.username} (${k.score}-rated, ${k.comp})`).join(', ')} {underperformers.length === 1 ? 'has' : 'have'} low performance relative to compensation. Review for wind-down or renegotiation.</p>
                      )}
                      {unscoredCount > 0 && (
                        <p><strong>Note:</strong> {unscoredCount} KOL{unscoredCount > 1 ? 's have' : ' has'} not been scored yet. AI scoring runs weekly on Mondays, or trigger manually from a KOL&apos;s detail view.</p>
                      )}
                      <p><strong>Coverage:</strong> {allKols.length - redditKols.length} X / {redditKols.length} Reddit KOLs.{redditKols.length === 0 ? ' Consider adding Reddit-native KOLs from the discovery suggestions.' : ''}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {subTab === 'activations' && (
        <div>
          <SectionTitle subtitle="All KOL activations across platforms, most recent first">Recent Activations</SectionTitle>
          {recentActivationsQ.isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
          ) : !recentActivationsQ.data?.length ? (
            <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
              <p className="text-3xl mb-3">{'\uD83D\uDCE1'}</p>
              <h3 className="text-lg font-semibold text-content-primary mb-1">No activations yet</h3>
              <p className="text-sm text-content-muted">The KOL activation scanner runs every 30 minutes, searching for brand mentions from tracked KOLs.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivationsQ.data.map((act) => {
                const m = act.metricsAtDetection || {};
                const engagements = (m.likes || 0) + (m.retweets || 0) + (m.replies || 0) + (m.upvotes || 0) + (m.comments || 0);
                const impressions = m.impressions || ((m.upvotes || 0) + (m.comments || 0)) * 10;
                const typeLabel = (act.activationType || 'MENTION').replace(/_/g, ' ');
                return (
                  <div key={act.id} className="bg-surface-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar initials={act.kol?.name?.split(' ').map(w => w[0]).join('').slice(0, 2) || '?'} src={act.kol?.avatarUrl} platform={act.kol?.platform || act.platform} size="sm" />
                        <span className="font-semibold text-content-primary text-sm">{act.kol?.name || 'Unknown'}</span>
                        <span className="text-xs text-content-faint">@{act.kol?.username}</span>
                        <PlatformBadge platform={act.platform} />
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 rounded text-xs font-medium">{typeLabel}</span>
                      </div>
                      <span className="text-xs text-content-faint">{fmtDate(act.postedAt || act.detectedAt)}</span>
                    </div>
                    <p className="text-sm text-content-primary leading-relaxed mb-2">{act.content}</p>
                    <div className="flex items-center gap-4 text-xs text-content-muted">
                      <span>{engagements} engagements</span>
                      <span>{impressions} impressions</span>
                      {act.sourceUrl && <a href={act.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View post</a>}
                    </div>
                  </div>
                );
              })}
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
            <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
              <p className="text-3xl mb-3">{'\uD83D\uDD0D'}</p>
              <h3 className="text-lg font-semibold text-content-primary mb-1">No candidates yet</h3>
              <p className="text-sm text-content-muted">AI Discovery analyzes your listening feed to find potential KOLs. Candidates appear after they show up 2+ times in your monitored conversations.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {discoveries.map((sug, i) => {
                const formattedFollowers = sug.followers >= 1000 ? `${(sug.followers / 1000).toFixed(1)}K` : sug.followers;
                return (
                  <div key={i} className="bg-surface-card rounded-xl border border-border p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <PlatformBadge platform={sug.platform} />
                          <span className="font-semibold text-content-primary">{sug.username}</span>
                          <span className="text-sm text-content-faint">{formattedFollowers} {sug.platform === 'REDDIT' ? 'karma' : 'followers'}</span>
                        </div>
                        <p className="text-sm text-content-secondary mb-2">
                          Appeared <strong>{sug.appearances} times</strong> in your listening feed over the past month.
                          Average {sug.avgEngagement} engagements per post. Sentiment: {sug.sentimentPct}% positive.
                          {sug.topics.length > 0 && <> Topics: {sug.topics.join(', ')}.</>}
                        </p>
                        {sug.sampleContent && (
                          <p className="text-xs text-content-muted italic mb-2 line-clamp-2">&ldquo;{sug.sampleContent}&rdquo;</p>
                        )}
                        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-2">
                          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">AI</div>
                          <p className="text-xs text-blue-800 dark:text-blue-300">
                            {sug.avgScore > 0.6
                              ? `Strong candidate. High engagement (score: ${sug.avgScore}) with ${sug.appearances} organic mentions suggests authentic interest in your ecosystem. Consider reaching out for a partnership.`
                              : sug.avgScore > 0.3
                              ? `Moderate candidate. ${sug.appearances} mentions with decent engagement. Worth monitoring for another week before outreach.`
                              : `Early signal. Appeared ${sug.appearances} times but engagement is still building. Keep on watchlist.`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => {
                            setAddForm({ ...EMPTY_KOL_FORM, name: sug.username, username: sug.username.replace(/^@/, ''), platform: sug.platform, baselineFollowers: String(sug.followers || '') });
                            setShowAddModal(true);
                          }}
                          className="px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg hover:bg-gray-800 whitespace-nowrap"
                        >Add as KOL</button>
                        <button className="px-3 py-1.5 bg-surface-secondary text-content-secondary text-xs rounded-lg hover:bg-surface-tertiary whitespace-nowrap">Dismiss</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit KOL Modal */}
      {editingKOL && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingKOL(null)}>
          <div className="bg-surface-card rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-content-primary mb-4">Edit KOL &mdash; {editingKOL.name}</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                kolId: editingKOL.id,
                name: editForm.name,
                username: editForm.username.replace(/^@/, ''),
                relationshipType: editForm.relationshipType,
                ...(editForm.cohortId ? { cohortId: editForm.cohortId } : { cohortId: null }),
                compensationMonthly: editForm.compensationMonthly ? Number(editForm.compensationMonthly) : null,
                baselineFollowers: editForm.baselineFollowers ? parseInt(editForm.baselineFollowers) : null,
                baselineEngRate: editForm.baselineEngRate ? parseFloat(editForm.baselineEngRate) : null,
              });
            }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Name</label>
                  <input type="text" required value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Username</label>
                  <input type="text" required value={editForm.username} onChange={(e) => setEditForm(f => ({ ...f, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Relationship Type</label>
                <select value={editForm.relationshipType} onChange={(e) => setEditForm(f => ({ ...f, relationshipType: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-card">
                  {Object.entries(TYPE_LABELS).filter(([k]) => k !== 'ALL').map(([k, v]) => (
                    <option key={k} value={k}>{v.replace(/s$/, '')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Cohort</label>
                <select value={editForm.cohortId} onChange={(e) => setEditForm(f => ({ ...f, cohortId: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-card">
                  <option value="">No cohort</option>
                  {(cohortsQ.data || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Comp ($/mo)</label>
                  <input type="number" value={editForm.compensationMonthly} onChange={(e) => setEditForm(f => ({ ...f, compensationMonthly: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Followers</label>
                  <input type="number" value={editForm.baselineFollowers} onChange={(e) => setEditForm(f => ({ ...f, baselineFollowers: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Eng. Rate %</label>
                  <input type="number" step="0.1" value={editForm.baselineEngRate} onChange={(e) => setEditForm(f => ({ ...f, baselineEngRate: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="0.0" />
                </div>
              </div>
              {updateMutation.error && (
                <p className="text-sm text-red-600">{updateMutation.error.message}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingKOL(null)}
                  className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary">Cancel</button>
                <button type="submit" disabled={updateMutation.isLoading}
                  className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add KOL Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-surface-card rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-content-primary mb-4">Add New KOL</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                name: addForm.name,
                username: addForm.username.replace(/^@/, ''),
                platform: addForm.platform,
                relationshipType: addForm.relationshipType,
                ...(addForm.cohortId ? { cohortId: addForm.cohortId } : {}),
                ...(addForm.compensationMonthly ? { compensationMonthly: Number(addForm.compensationMonthly) } : {}),
                ...(addForm.baselineFollowers ? { baselineFollowers: parseInt(addForm.baselineFollowers) } : {}),
              });
            }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Name</label>
                  <input type="text" required value={addForm.name} onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Display name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Username</label>
                  <input type="text" required value={addForm.username} onChange={(e) => setAddForm(f => ({ ...f, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="@handle" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Platform</label>
                  <select value={addForm.platform} onChange={(e) => setAddForm(f => ({ ...f, platform: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-card">
                    <option value="X">X (Twitter)</option>
                    <option value="REDDIT">Reddit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Type</label>
                  <select value={addForm.relationshipType} onChange={(e) => setAddForm(f => ({ ...f, relationshipType: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-card">
                    {Object.entries(TYPE_LABELS).filter(([k]) => k !== 'ALL').map(([k, v]) => (
                      <option key={k} value={k}>{v.replace(/s$/, '')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Cohort</label>
                <select value={addForm.cohortId} onChange={(e) => setAddForm(f => ({ ...f, cohortId: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-card">
                  <option value="">No cohort</option>
                  {(cohortsQ.data || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Compensation ($/mo)</label>
                  <input type="number" value={addForm.compensationMonthly} onChange={(e) => setAddForm(f => ({ ...f, compensationMonthly: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Followers</label>
                  <input type="number" value={addForm.baselineFollowers} onChange={(e) => setAddForm(f => ({ ...f, baselineFollowers: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="0" />
                </div>
              </div>
              {createMutation.error && (
                <p className="text-sm text-red-600">{createMutation.error.message}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowAddModal(false); setAddForm(EMPTY_KOL_FORM); }}
                  className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary">Cancel</button>
                <button type="submit" disabled={createMutation.isLoading}
                  className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {createMutation.isLoading ? 'Adding...' : 'Add KOL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
