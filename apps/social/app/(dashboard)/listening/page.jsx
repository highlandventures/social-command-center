'use client';

import React, { useState, useCallback } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { trpc } from '@/lib/trpc-client';
import {
  COLORS, PlatformBadge, RelevanceBadge, SentimentDot,
  TabButton, SectionTitle, Skeleton, useChartColors,
} from '@/components/ui';

// ── Helpers ───────────────────────────────────────────────────

function ActionTypeBadge({ type }) {
  if (!type || type === 'FYI') return null;

  const config = {
    RESPOND: { label: 'Reply Needed', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
    INTEL: { label: 'Competitive Intel', bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300' },
    OPPORTUNITY: { label: 'Opportunity', bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
    CRISIS: { label: 'Urgent', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300' },
  };

  const c = config[type];
  if (!c) return null;

  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function formatFollowers(n) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ── Page Component ────────────────────────────────────────────

export default function ListeningPage() {
  const chartColors = useChartColors();
  const [subTab, setSubTab] = useState('feed');
  const [relevanceFilter, setRelevanceFilter] = useState('HIGH');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedBrands, setSelectedBrands] = useState([]); // multi-select topic IDs
  const [platformFilter, setPlatformFilter] = useState('all'); // 'all' | 'X' | 'REDDIT'
  const [feedTimeRange, setFeedTimeRange] = useState('7d'); // '24h' | '7d' | '30d' | '90d' | 'all'

  // New topic form state (AI-driven conversational flow)
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatedResult, setGeneratedResult] = useState(null); // AI-generated queries
  const [topicName, setTopicName] = useState('');
  const [topicDescription, setTopicDescription] = useState('');
  const [topicQueries, setTopicQueries] = useState([]);
  const [refineInput, setRefineInput] = useState('');
  const [newTopicChat, setNewTopicChat] = useState([]); // conversational chat messages
  const [clarifyingQuestions, setClarifyingQuestions] = useState([]); // AI questions for user

  // Per-topic AI refinement state
  const [expandedTopicId, setExpandedTopicId] = useState(null);
  const [topicRefineInput, setTopicRefineInput] = useState('');
  const [topicRefineResult, setTopicRefineResult] = useState(null);
  const [topicChatHistory, setTopicChatHistory] = useState([]); // chat messages

  // Scan state
  const [scanningTopicId, setScanningTopicId] = useState(null);

  // ── tRPC queries ──────────────────────────────────────────
  const hitsInput = {
    ...(selectedBrands.length > 0 ? { topicIds: selectedBrands } : {}),
    ...(platformFilter !== 'all' ? { platform: platformFilter } : {}),
    ...(relevanceFilter !== 'all' ? { relevance: relevanceFilter } : {}),
    ...(actionFilter !== 'all' ? { actionType: actionFilter } : {}),
    ...(feedTimeRange !== 'all' ? { timeRange: feedTimeRange } : {}),
  };
  const hitsQ = trpc.listening.hits.list.useQuery(
    Object.keys(hitsInput).length > 0 ? hitsInput : undefined,
    { staleTime: 15_000, keepPreviousData: true },
  );
  const topicsQ = trpc.listening.topics.list.useQuery(undefined, { staleTime: 30_000, keepPreviousData: true });
  const accountsQ = trpc.accounts.list.useQuery(undefined, { staleTime: 60_000 });
  const sentimentQ = trpc.analytics.brandSentiment.useQuery(undefined, { staleTime: 30_000 });

  // ── tRPC mutations ─────────────────────────────────────────
  const utils = trpc.useUtils();
  const generateQueriesMutation = trpc.listening.generateQueries.useMutation({
    onSuccess: (data) => {
      setGeneratedResult(data);
      if (data.topicName) setTopicName(data.topicName);
      if (data.description) setTopicDescription(data.description);
      if (data.queries) {
        setTopicQueries(data.queries.map((q) => ({
          platform: q.platform,
          queryString: q.queryString,
          negativeKeywords: (q.negativeKeywords || []).join(', '),
          subreddits: (q.subreddits || []).join(', '),
          rationale: q.rationale || '',
        })));
      }
      // Handle clarifying questions from AI
      if (data.clarifyingQuestions?.length > 0) {
        setClarifyingQuestions(data.clarifyingQuestions);
        setNewTopicChat((prev) => [
          ...prev,
          { role: 'assistant', content: `I've generated initial queries, but I have a few questions to make them more precise:`, questions: data.clarifyingQuestions },
        ]);
      } else {
        setClarifyingQuestions([]);
        setNewTopicChat((prev) => [
          ...prev,
          { role: 'assistant', content: `Generated ${data.queries?.length || 0} queries for "${data.topicName}". You can review and refine them below.` },
        ]);
      }
    },
  });

  const createTopicMutation = trpc.listening.topics.create.useMutation({
    onSuccess: () => {
      utils.listening.topics.list.invalidate();
      setShowNewTopic(false);
      setAiPrompt('');
      setGeneratedResult(null);
      setTopicName('');
      setTopicDescription('');
      setTopicQueries([]);
      setRefineInput('');
      setNewTopicChat([]);
      setClarifyingQuestions([]);
    },
  });
  const toggleTopicMutation = trpc.listening.topics.update.useMutation({
    onSuccess: () => utils.listening.topics.list.invalidate(),
  });
  const deleteTopicMutation = trpc.listening.topics.delete.useMutation({
    onSuccess: () => utils.listening.topics.list.invalidate(),
  });
  const triggerScanMutation = trpc.listening.triggerScan.useMutation({
    onSuccess: () => {
      utils.listening.hits.list.invalidate();
      utils.listening.topics.list.invalidate();
      setScanningTopicId(null);
    },
    onError: () => setScanningTopicId(null),
  });
  const dismissHitMutation = trpc.listening.hits.dismiss.useMutation({
    onSuccess: () => utils.listening.hits.list.invalidate(),
  });
  const reanalyzeSentimentMutation = trpc.listening.reanalyzeSentiment.useMutation({
    onSuccess: (data) => {
      utils.listening.hits.list.invalidate();
    },
  });
  const refineTopicMutation = trpc.listening.refineTopicQueries.useMutation({
    onSuccess: (data) => {
      setTopicRefineResult(data);
      setTopicChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: data.queries ? `Updated ${data.queries.length} queries.` : 'Refinement complete.' },
      ]);
      if (data.saved) {
        utils.listening.topics.list.invalidate();
      }
    },
  });

  // ── Derived data ──────────────────────────────────────────
  const listeningFeed = hitsQ.data?.items ?? [];
  const listeningTopics = topicsQ.data ?? [];
  const accounts = accountsQ.data ?? [];
  const sentimentTrendData = sentimentQ.data?.overTime ?? [];

  // Toggle a brand in the multi-select filter
  const toggleBrand = useCallback((topicId) => {
    setSelectedBrands((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId]
    );
  }, []);

  const filteredFeed = listeningFeed.filter((h) => {
    const matchRelevance = relevanceFilter === 'all' || h.relevance === relevanceFilter;
    return matchRelevance;
  });

  // ── Form handlers ─────────────────────────────────────────
  const handleGenerateQueries = useCallback(() => {
    if (!aiPrompt.trim()) return;
    // Add user message to chat
    setNewTopicChat((prev) => [...prev, { role: 'user', content: aiPrompt.trim() }]);
    // Pass conversation history for context
    const history = newTopicChat.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    generateQueriesMutation.mutate({
      prompt: aiPrompt.trim(),
      conversationHistory: history.length > 0 ? history : undefined,
      ...(topicQueries.length > 0 ? {
        existingQueries: topicQueries.map((q) => ({ platform: q.platform, queryString: q.queryString })),
        refinement: aiPrompt.trim(),
      } : {}),
    });
    setAiPrompt('');
  }, [aiPrompt, newTopicChat, topicQueries, generateQueriesMutation]);

  const handleRefineQueries = useCallback(() => {
    if (!refineInput.trim() || !topicQueries.length) return;
    generateQueriesMutation.mutate({
      prompt: aiPrompt,
      existingQueries: topicQueries.map((q) => ({
        platform: q.platform,
        queryString: q.queryString,
      })),
      refinement: refineInput.trim(),
    });
    setRefineInput('');
  }, [refineInput, aiPrompt, topicQueries, generateQueriesMutation]);

  const removeQuery = useCallback((index) => {
    setTopicQueries((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateQuery = useCallback((index, field, value) => {
    setTopicQueries((prev) => prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)));
  }, []);

  const handleCreateTopic = useCallback(() => {
    if (!topicName.trim() || !topicQueries.length) return;
    const validQueries = topicQueries
      .filter((q) => q.queryString.trim())
      .map((q) => ({
        platform: q.platform,
        queryString: q.queryString.trim(),
        negativeKeywords: q.negativeKeywords
          ? q.negativeKeywords.split(',').map((k) => k.trim()).filter(Boolean)
          : [],
        subreddits: q.subreddits
          ? q.subreddits.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      }));

    createTopicMutation.mutate({
      name: topicName.trim(),
      description: topicDescription.trim() || undefined,
      queries: validQueries,
    });
  }, [topicName, topicDescription, topicQueries, createTopicMutation]);

  const handleScanTopic = useCallback((topicId) => {
    setScanningTopicId(topicId || 'all');
    triggerScanMutation.mutate(topicId ? { topicId } : undefined);
  }, [triggerScanMutation]);

  const handleTopicRefine = useCallback((topicId) => {
    if (!topicRefineInput.trim()) return;
    setTopicChatHistory((prev) => [
      ...prev,
      { role: 'user', content: topicRefineInput.trim() },
    ]);
    refineTopicMutation.mutate({
      topicId,
      refinement: topicRefineInput.trim(),
      save: false, // Preview first, don't save yet
    });
    setTopicRefineInput('');
  }, [topicRefineInput, refineTopicMutation]);

  const handleSaveRefinedQueries = useCallback((topicId) => {
    if (!topicRefineResult?.queries) return;
    refineTopicMutation.mutate({
      topicId,
      refinement: 'Apply the last set of changes exactly as shown',
      save: true,
    });
  }, [topicRefineResult, refineTopicMutation]);

  const toggleExpandTopic = useCallback((topicId) => {
    if (expandedTopicId === topicId) {
      setExpandedTopicId(null);
      setTopicRefineInput('');
      setTopicRefineResult(null);
      setTopicChatHistory([]);
    } else {
      setExpandedTopicId(topicId);
      setTopicRefineInput('');
      setTopicRefineResult(null);
      setTopicChatHistory([]);
    }
  }, [expandedTopicId]);

  return (
    <div>
      {/* Filter bar: Platform + Brand multi-select */}
      <div className="flex flex-wrap items-center gap-3 mb-4 bg-surface-card rounded-xl border border-border px-4 py-2.5">
        {/* Platform filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-content-muted">Platform:</span>
          <div className="flex items-center gap-0.5 bg-surface-secondary rounded-lg p-0.5">
            {[
              { key: 'all', label: 'All' },
              { key: 'X', label: 'X' },
              { key: 'REDDIT', label: 'Reddit' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPlatformFilter(p.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  platformFilter === p.key ? 'bg-surface-card shadow-sm text-content-primary' : 'text-content-muted hover:text-content-secondary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-5 bg-surface-tertiary" />

        {/* Brand multi-select */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-content-muted">Brands:</span>
          {listeningTopics.length === 0 ? (
            <span className="text-xs text-content-faint italic">No topics yet</span>
          ) : (
            <>
              {listeningTopics.map((t) => {
                const isSelected = selectedBrands.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleBrand(t.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-surface-card text-content-secondary border-border hover:border-gray-400'
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
              {selectedBrands.length > 0 && (
                <button
                  onClick={() => setSelectedBrands([])}
                  className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear
                </button>
              )}
            </>
          )}
        </div>

        {/* Active filter summary */}
        {(selectedBrands.length > 0 || platformFilter !== 'all') && (
          <div className="ml-auto text-xs text-content-faint">
            Filtering: {platformFilter !== 'all' ? platformFilter : 'All platforms'}
            {selectedBrands.length > 0 && ` · ${selectedBrands.length} brand${selectedBrands.length > 1 ? 's' : ''}`}
          </div>
        )}
      </div>

      {/* Error banners */}
      {hitsQ.isError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          Failed to load listening feed. {hitsQ.error?.message || 'Please try again.'}
        </div>
      )}
      {topicsQ.isError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          Failed to load topics. {topicsQ.error?.message || 'Please try again.'}
        </div>
      )}
      {sentimentQ.isError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          Failed to load sentiment data. {sentimentQ.error?.message || 'Please try again.'}
        </div>
      )}
      {accountsQ.isError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          Failed to load accounts. {accountsQ.error?.message || 'Please try again.'}
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex items-center gap-2 mb-6 border-b border-border pb-3">
        {[
          { key: 'feed', label: 'Listening Feed', badge: filteredFeed.length || undefined },
          { key: 'insights', label: 'AI Insights' },
          { key: 'topics', label: 'Topics', badge: listeningTopics.length || undefined },
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
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-sm text-content-muted">Range:</span>
              {[
                { key: '24h', label: '24h' },
                { key: '7d', label: '7d' },
                { key: '30d', label: '30d' },
                { key: '90d', label: '90d' },
                { key: 'all', label: 'All' },
              ].map((r) => (
                <button
                  key={r.key}
                  onClick={() => setFeedTimeRange(r.key)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                    feedTimeRange === r.key ? 'bg-blue-600 text-white' : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
                  }`}
                >
                  {r.label}
                </button>
              ))}
              <span className="text-gray-300 mx-1">|</span>
              <span className="text-sm text-content-muted">Relevance:</span>
              {['all', 'HIGH', 'MEDIUM'].map((f) => (
                <button
                  key={f}
                  onClick={() => setRelevanceFilter(f)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                    relevanceFilter === f ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-sm text-content-muted">Action:</span>
              {['all', 'RESPOND', 'CRISIS', 'OPPORTUNITY', 'INTEL'].map((f) => (
                <button
                  key={f}
                  onClick={() => setActionFilter(f)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                    actionFilter === f ? 'bg-primary text-white' : 'bg-surface-page text-content-secondary'
                  }`}
                >
                  {f === 'all' ? 'All Actions' : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
              <div className="ml-auto">
                <button
                  onClick={() => handleScanTopic(null)}
                  disabled={triggerScanMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {triggerScanMutation.isPending ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    'Scan Now'
                  )}
                </button>
              </div>
            </div>

            {triggerScanMutation.isError && (
              <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
                Scan failed. {triggerScanMutation.error?.message || 'Please try again.'}
              </div>
            )}

            {hitsQ.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
              </div>
            ) : filteredFeed.length === 0 ? (
              <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">👂</span>
                </div>
                <h3 className="text-sm font-semibold text-content-primary mb-1">No listening hits yet</h3>
                <p className="text-xs text-content-muted mb-4">
                  Create a topic in the Topics tab, then click &quot;Scan Now&quot; to search for matching content.
                </p>
                <button
                  onClick={() => setSubTab('topics')}
                  className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg hover:bg-gray-800"
                >
                  Go to Topics
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFeed.map((hit) => (
                  <div
                    key={hit.id}
                    className={`bg-surface-card rounded-xl border p-4 hover:shadow-md transition-shadow ${
                      hit.relevance === 'HIGH' ? 'border-green-200 bg-green-50/30 dark:bg-green-900/30' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <PlatformBadge platform={hit.platform} />
                        <span className="font-semibold text-content-primary text-sm">
                          {hit.platform === 'x' ? `@${hit.author}` : `u/${hit.author}`}
                        </span>
                        <span className="text-xs text-content-faint">{formatFollowers(hit.followers)}</span>
                        {hit.subreddit && <span className="text-xs text-orange-600 font-medium">{hit.subreddit}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <ActionTypeBadge type={hit.actionType} />
                        <RelevanceBadge level={hit.relevance} />
                        <SentimentDot sentiment={hit.sentiment?.toLowerCase()} />
                        <span className="text-xs text-content-faint">{timeAgo(hit.time)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-content-secondary leading-relaxed mb-2">{hit.content}</p>
                    {hit.topicName && (
                      <p className="text-[11px] text-content-faint mb-2">Topic: {hit.topicName}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-content-muted">
                        <span>{hit.engagements} engagements</span>
                        <span>Score: {hit.heuristic}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hit.sourceUrl && (
                          <a
                            href={hit.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 rounded-lg hover:bg-blue-100 font-medium"
                          >
                            View
                          </a>
                        )}
                        <button
                          onClick={() => dismissHitMutation.mutate({ id: hit.id })}
                          className="px-2.5 py-1 text-xs bg-surface-page text-content-secondary rounded-lg hover:bg-surface-hover"
                        >
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
            <div className="bg-surface-card rounded-xl border border-border p-4">
              <h4 className="font-semibold text-content-primary text-sm mb-3">Active Topics</h4>
              {topicsQ.isLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : listeningTopics.length === 0 ? (
                <p className="text-xs text-content-muted py-2">No topics configured yet.</p>
              ) : (
                listeningTopics.filter((t) => t.active).map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-border-secondary last:border-0">
                    <div>
                      <p className="text-sm font-medium text-content-primary">{t.name}</p>
                      <p className="text-xs text-content-muted">
                        {t.queryCount} queries &middot; {t.hitCount} hits
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        t.pollingTier === 'HOT'
                          ? 'bg-red-100 text-red-700'
                          : t.pollingTier === 'WARM'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {t.pollingTier}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="bg-surface-card rounded-xl border border-border p-4">
              <h4 className="font-semibold text-content-primary text-sm mb-3">Sentiment (24h)</h4>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Positive', value: sentimentQ.data?.breakdown?.positive ?? 0 },
                      { name: 'Neutral', value: sentimentQ.data?.breakdown?.neutral ?? 0 },
                      { name: 'Negative', value: sentimentQ.data?.breakdown?.negative ?? 0 },
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
                  <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-3 text-xs text-content-secondary">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {sentimentQ.data?.breakdown?.positive ?? 0}% Pos
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  {sentimentQ.data?.breakdown?.neutral ?? 0}% Neu
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {sentimentQ.data?.breakdown?.negative ?? 0}% Neg
                </span>
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
              <span className="text-xs text-content-faint">Powered by listening data</span>
              <button
                onClick={() => reanalyzeSentimentMutation.mutate({ limit: 50 })}
                disabled={reanalyzeSentimentMutation.isLoading}
                className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {reanalyzeSentimentMutation.isLoading
                  ? 'Re-analyzing...'
                  : reanalyzeSentimentMutation.data
                    ? `Updated ${reanalyzeSentimentMutation.data.updated}/${reanalyzeSentimentMutation.data.total}`
                    : 'Re-analyze Sentiment with AI'}
              </button>
            </div>
          </div>

          {listeningFeed.length === 0 ? (
            <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-lg font-bold text-indigo-600">AI</span>
              </div>
              <h3 className="text-sm font-semibold text-content-primary mb-1">No data for insights yet</h3>
              <p className="text-xs text-content-muted">
                Create listening topics and run a scan first. AI insights will be generated from your listening data.
              </p>
            </div>
          ) : (
            <>
              {/* AI Summary Card */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    AI
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-sm font-bold text-indigo-900">Listening Summary</h4>
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                        {listeningFeed.length} hits analyzed
                      </span>
                    </div>
                    <p className="text-sm text-indigo-800 leading-relaxed">
                      {(() => {
                        const positive = listeningFeed.filter((h) => h.sentiment === 'POSITIVE').length;
                        const negative = listeningFeed.filter((h) => h.sentiment === 'NEGATIVE').length;
                        const neutral = listeningFeed.filter((h) => h.sentiment === 'NEUTRAL').length;
                        const highRelevance = listeningFeed.filter((h) => h.relevance === 'HIGH').length;
                        return `Across ${listeningFeed.length} detected mentions: ${positive} positive, ${neutral} neutral, ${negative} negative. ${highRelevance} are marked as high-relevance and may warrant engagement.`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Top hits */}
              <div className="bg-surface-card rounded-xl border border-border p-5">
                <SectionTitle subtitle="Highest-scoring mentions that may require attention">
                  Top Actionable Hits
                </SectionTitle>
                <div className="space-y-3 mt-4">
                  {listeningFeed
                    .filter((h) => h.relevance === 'HIGH')
                    .slice(0, 5)
                    .map((hit) => (
                      <div key={hit.id} className="flex items-start gap-3 p-3 rounded-lg border border-border-secondary hover:bg-surface-hover transition-colors">
                        <PlatformBadge platform={hit.platform} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-content-primary">
                              {hit.platform === 'x' ? `@${hit.author}` : `u/${hit.author}`}
                            </span>
                            <span className="text-xs text-content-faint">{formatFollowers(hit.followers)}</span>
                            <span className="text-xs text-content-faint">{timeAgo(hit.time)}</span>
                          </div>
                          <p className="text-xs text-content-secondary leading-relaxed line-clamp-2">{hit.content}</p>
                        </div>
                        <span className="text-xs font-bold text-green-700 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
                          {hit.heuristic}
                        </span>
                      </div>
                    ))}
                  {listeningFeed.filter((h) => h.relevance === 'HIGH').length === 0 && (
                    <p className="text-sm text-content-muted py-4 text-center">No high-relevance hits found yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Topics sub-tab ─── */}
      {subTab === 'topics' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Configure what to monitor — add search queries for X and Reddit">Listening Topics</SectionTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleScanTopic(null)}
                disabled={triggerScanMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {triggerScanMutation.isPending && scanningTopicId === 'all' ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Scanning All...
                  </>
                ) : (
                  'Scan All Topics'
                )}
              </button>
              <button
                onClick={() => setShowNewTopic(true)}
                className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg hover:bg-gray-800"
              >
                + New Topic
              </button>
            </div>
          </div>

          {/* ── New Topic Form (AI-powered conversational) ─── */}
          {showNewTopic && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">AI</div>
                  <h4 className="text-sm font-bold text-blue-900">Create New Listening Topic</h4>
                  <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Conversational</span>
                </div>
                <button
                  onClick={() => { setShowNewTopic(false); setGeneratedResult(null); setTopicQueries([]); setAiPrompt(''); setNewTopicChat([]); setClarifyingQuestions([]); }}
                  className="text-blue-400 hover:text-blue-600 text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4">
                {/* Conversation history */}
                {newTopicChat.length > 0 && (
                  <div className="bg-surface-card rounded-lg border border-blue-100 p-3 max-h-[300px] overflow-y-auto space-y-3">
                    {newTopicChat.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5">AI</div>
                        )}
                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-surface-page text-gray-800'} rounded-lg px-3 py-2`}>
                          <p className="text-xs leading-relaxed">{msg.content}</p>
                          {msg.questions && (
                            <div className="mt-2 space-y-1.5">
                              {msg.questions.map((q, qi) => (
                                <button
                                  key={qi}
                                  onClick={() => setAiPrompt(q)}
                                  className="block w-full text-left text-[11px] bg-surface-card/80 text-blue-800 dark:text-blue-300 px-2.5 py-1.5 rounded border border-blue-100 hover:bg-surface-hover transition-colors"
                                >
                                  {qi + 1}. {q}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {generateQueriesMutation.isPending && (
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">AI</div>
                        <div className="bg-surface-page rounded-lg px-3 py-2 flex items-center gap-2">
                          <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-content-muted">Thinking...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat input */}
                <div>
                  <label className="block text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
                    {newTopicChat.length === 0
                      ? 'Describe what you want to monitor in plain English'
                      : clarifyingQuestions.length > 0
                      ? 'Answer the questions above, or provide more details'
                      : 'Refine your queries — tell AI what to change'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleGenerateQueries()}
                      placeholder={newTopicChat.length === 0
                        ? "e.g. Track conversations about humanoid robots and Figure AI, from investors, analysts, and tech journalists"
                        : "e.g. Focus more on institutional investors, exclude retail crypto discussions..."}
                      className="flex-1 px-3 py-2.5 text-sm border border-blue-200 rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      onClick={handleGenerateQueries}
                      disabled={!aiPrompt.trim() || generateQueriesMutation.isPending}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {generateQueriesMutation.isPending ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        'Generate Queries'
                      )}
                    </button>
                  </div>
                  {generateQueriesMutation.isError && (
                    <p className="text-xs text-red-600 mt-1">
                      Error: {generateQueriesMutation.error?.message || 'Failed to generate queries'}
                    </p>
                  )}
                </div>

                {/* Step 2: Review generated queries */}
                {topicQueries.length > 0 && (
                  <>
                    <div className="border-t border-blue-200 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-blue-800 dark:text-blue-300">Topic Name</label>
                      </div>
                      <input
                        type="text"
                        value={topicName}
                        onChange={(e) => setTopicName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3"
                      />

                      <label className="block text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">
                        Generated Queries ({topicQueries.length})
                      </label>
                      <div className="space-y-2">
                        {topicQueries.map((q, i) => (
                          <div key={i} className="bg-surface-card rounded-lg p-3 border border-blue-100">
                            <div className="flex items-start gap-2">
                              <PlatformBadge platform={q.platform === 'X' ? 'x' : 'reddit'} />
                              <div className="flex-1 min-w-0">
                                <code className="text-xs text-content-secondary font-mono break-all">{q.queryString}</code>
                                {q.rationale && (
                                  <p className="text-[11px] text-content-muted mt-1 italic">{q.rationale}</p>
                                )}
                                {q.negativeKeywords && (
                                  <p className="text-[11px] text-content-faint mt-0.5">
                                    Excludes: {q.negativeKeywords}
                                  </p>
                                )}
                                {q.subreddits && (
                                  <p className="text-[11px] text-orange-600 mt-0.5">
                                    Subreddits: {q.subreddits}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => removeQuery(i)}
                                className="text-red-400 hover:text-red-600 text-sm flex-shrink-0"
                              >
                                &times;
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Refine with AI chat */}
                    <div className="bg-surface-card rounded-lg p-3 border border-blue-100">
                      <label className="block text-[11px] font-medium text-content-muted mb-1.5">
                        Refine queries with AI
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={refineInput}
                          onChange={(e) => setRefineInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRefineQueries()}
                          placeholder="e.g. Add more Reddit subreddits, focus more on founders, exclude crypto content..."
                          className="flex-1 px-2.5 py-1.5 text-xs border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button
                          onClick={handleRefineQueries}
                          disabled={!refineInput.trim() || generateQueriesMutation.isPending}
                          className="px-3 py-1.5 bg-surface-secondary text-content-secondary text-xs rounded-md hover:bg-surface-tertiary font-medium disabled:opacity-50 flex items-center gap-1"
                        >
                          {generateQueriesMutation.isPending ? (
                            <span className="w-3 h-3 border border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                          ) : (
                            'Refine'
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Create button */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleCreateTopic}
                        disabled={!topicName.trim() || !topicQueries.length || createTopicMutation.isPending}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {createTopicMutation.isPending ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Topic & Start Monitoring'
                        )}
                      </button>
                      <button
                        onClick={() => { setShowNewTopic(false); setGeneratedResult(null); setTopicQueries([]); setAiPrompt(''); }}
                        className="px-4 py-2 text-sm text-content-secondary hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      {createTopicMutation.isError && (
                        <span className="text-xs text-red-600">
                          Error: {createTopicMutation.error?.message || 'Failed to create topic'}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Topics table */}
          {topicsQ.isLoading ? (
            <Skeleton className="h-[200px] w-full rounded-xl" />
          ) : listeningTopics.length === 0 ? (
            <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-sm font-semibold text-content-primary mb-1">No listening topics yet</h3>
              <p className="text-xs text-content-muted mb-4">
                Create your first topic to start monitoring conversations across X and Reddit.
              </p>
              <button
                onClick={() => setShowNewTopic(true)}
                className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg hover:bg-gray-800"
              >
                + Create First Topic
              </button>
            </div>
          ) : (
            <div className="bg-surface-card rounded-xl border border-border p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Topic', 'Queries', 'Hits', 'Polling Tier', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-content-muted uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listeningTopics.map((t) => (
                    <React.Fragment key={t.id}>
                      <tr className={`border-b border-border-secondary hover:bg-surface-hover ${expandedTopicId === t.id ? 'bg-indigo-50/50' : ''}`}>
                        <td className="py-3 px-3">
                          <div>
                            <span className="font-medium text-content-primary">{t.name}</span>
                            {t.description && (
                              <p className="text-xs text-content-muted mt-0.5">{t.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-medium">{t.queryCount}</span>
                          {t.queries && t.queries.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {t.queries.slice(0, 2).map((q) => (
                                <div key={q.id} className="flex items-center gap-1">
                                  <PlatformBadge platform={q.platform === 'X' ? 'x' : 'reddit'} />
                                  <code className="text-[10px] text-content-muted truncate max-w-[120px]">{q.queryString}</code>
                                </div>
                              ))}
                              {t.queries.length > 2 && (
                                <span className="text-[10px] text-content-faint">+{t.queries.length - 2} more</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium">{t.hitCount}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              t.pollingTier === 'HOT' ? 'bg-red-100 text-red-700' : t.pollingTier === 'WARM' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {t.pollingTier}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => toggleTopicMutation.mutate({ id: t.id, data: { active: !t.active } })}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <span className={`w-2 h-2 rounded-full ${t.active ? 'bg-green-400' : 'bg-gray-300'}`} />
                            <span className={t.active ? 'text-green-700 font-medium' : 'text-content-muted'}>
                              {t.active ? 'Active' : 'Paused'}
                            </span>
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpandTopic(t.id)}
                              className={`px-2.5 py-1 text-xs rounded-lg font-medium flex items-center gap-1 ${
                                expandedTopicId === t.id
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                              }`}
                            >
                              <span className="text-[10px] font-bold">AI</span>
                              Refine
                            </button>
                            <button
                              onClick={() => handleScanTopic(t.id)}
                              disabled={triggerScanMutation.isPending}
                              className="px-2.5 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 rounded-lg hover:bg-blue-100 font-medium disabled:opacity-50"
                            >
                              {triggerScanMutation.isPending && scanningTopicId === t.id ? (
                                <span className="flex items-center gap-1">
                                  <span className="w-2.5 h-2.5 border border-blue-400 border-t-blue-700 rounded-full animate-spin" />
                                  Scanning...
                                </span>
                              ) : (
                                'Scan Now'
                              )}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete topic "${t.name}" and all its data?`)) {
                                  deleteTopicMutation.mutate({ id: t.id });
                                }
                              }}
                              className="px-2.5 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-300 hover:bg-red-50 dark:bg-red-900/30 rounded-lg"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* ── Per-topic AI chat panel ─── */}
                      {expandedTopicId === t.id && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <div className="bg-gradient-to-b from-indigo-50 to-white border-t border-indigo-100 p-4">
                              {/* Current queries */}
                              <div className="mb-3">
                                <h5 className="text-xs font-semibold text-indigo-800 mb-2">Current Queries</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {(topicRefineResult?.queries || t.queries || []).map((q, i) => (
                                    <div key={i} className="bg-surface-card rounded-lg p-2.5 border border-indigo-100 text-xs">
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <PlatformBadge platform={(q.platform || 'X') === 'X' ? 'x' : 'reddit'} />
                                        <code className="text-content-secondary font-mono break-all text-[11px]">{q.queryString}</code>
                                      </div>
                                      {q.rationale && (
                                        <p className="text-[10px] text-indigo-500 italic mt-0.5">{q.rationale}</p>
                                      )}
                                      {q.negativeKeywords && q.negativeKeywords.length > 0 && (
                                        <p className="text-[10px] text-content-faint mt-0.5">
                                          Excludes: {Array.isArray(q.negativeKeywords) ? q.negativeKeywords.join(', ') : q.negativeKeywords}
                                        </p>
                                      )}
                                      {q.subreddits && q.subreddits.length > 0 && (
                                        <p className="text-[10px] text-orange-500 mt-0.5">
                                          Subreddits: {Array.isArray(q.subreddits) ? q.subreddits.join(', ') : q.subreddits}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Chat history */}
                              {topicChatHistory.length > 0 && (
                                <div className="mb-3 space-y-2 max-h-[200px] overflow-y-auto">
                                  {topicChatHistory.map((msg, i) => (
                                    <div
                                      key={i}
                                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                      <div
                                        className={`max-w-[80%] px-3 py-1.5 rounded-lg text-xs ${
                                          msg.role === 'user'
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-surface-card border border-indigo-200 text-indigo-800'
                                        }`}
                                      >
                                        {msg.role === 'assistant' && (
                                          <span className="text-[10px] font-bold text-indigo-500 mr-1">AI:</span>
                                        )}
                                        {msg.content}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Chat input */}
                              <div className="flex gap-2 items-center">
                                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                  AI
                                </div>
                                <input
                                  type="text"
                                  value={topicRefineInput}
                                  onChange={(e) => setTopicRefineInput(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleTopicRefine(t.id)}
                                  placeholder="e.g. Add more subreddits, exclude crypto content, focus on B2B..."
                                  className="flex-1 px-3 py-2 text-xs border border-indigo-200 rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                                <button
                                  onClick={() => handleTopicRefine(t.id)}
                                  disabled={!topicRefineInput.trim() || refineTopicMutation.isPending}
                                  className="px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                  {refineTopicMutation.isPending ? (
                                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    'Refine'
                                  )}
                                </button>
                              </div>

                              {/* Save refined queries */}
                              {topicRefineResult?.queries && !topicRefineResult.saved && (
                                <div className="mt-3 flex items-center gap-2">
                                  <button
                                    onClick={() => handleSaveRefinedQueries(t.id)}
                                    disabled={refineTopicMutation.isPending}
                                    className="px-4 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {refineTopicMutation.isPending ? (
                                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : null}
                                    Save Updated Queries
                                  </button>
                                  <span className="text-[10px] text-content-muted">
                                    Preview above — click to apply changes
                                  </span>
                                </div>
                              )}

                              {topicRefineResult?.saved && (
                                <div className="mt-3 px-3 py-2 bg-green-50 dark:bg-green-900/30 border border-green-200 rounded-lg">
                                  <span className="text-xs text-green-700 font-medium">Queries updated and saved successfully!</span>
                                </div>
                              )}

                              {refineTopicMutation.isError && (
                                <p className="text-xs text-red-600 mt-2">
                                  Error: {refineTopicMutation.error?.message || 'Failed to refine queries'}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Success notification for scan */}
          {triggerScanMutation.isSuccess && triggerScanMutation.data && (
            <div className="mt-4 bg-green-50 dark:bg-green-900/30 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="text-green-600 text-lg">✓</span>
                <div>
                  <p className="text-sm font-medium text-green-900">Scan complete</p>
                  <p className="text-xs text-green-700">
                    {triggerScanMutation.data.topicsProcessed} topics scanned,{' '}
                    {triggerScanMutation.data.hitsCreated} new hits found.
                    {triggerScanMutation.data.errors?.length > 0 && (
                      <span className="text-amber-600"> ({triggerScanMutation.data.errors.length} errors)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
