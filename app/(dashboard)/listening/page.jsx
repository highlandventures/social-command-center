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
  TabButton, SectionTitle, Skeleton,
} from '@/components/ui';

// ── Helpers ───────────────────────────────────────────────────

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
  const [subTab, setSubTab] = useState('feed');
  const [relevanceFilter, setRelevanceFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');

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
  const hitsQ = trpc.listening.hits.list.useQuery(undefined, { staleTime: 15_000 });
  const topicsQ = trpc.listening.topics.list.useQuery(undefined, { staleTime: 30_000 });
  const accountsQ = trpc.accounts.list.useQuery(undefined, { staleTime: 60_000 });
  const sovQ = trpc.competitors.getSOV.useQuery(undefined, { staleTime: 60_000 });
  const sentimentQ = trpc.analytics.brandSentiment.useQuery(undefined, { staleTime: 30_000 });
  const mentionMetricsQ = trpc.listening.mentionMetrics.useQuery(undefined, { staleTime: 30_000 });

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
  const sovData = sovQ.data?.current ?? [];
  const sovTimeData = sovQ.data?.overTime ?? [];
  const sentimentTrendData = sentimentQ.data?.overTime ?? [];

  // Build brand filter from listening topics
  const brandFilters = [
    { key: 'all', label: 'All Topics' },
    ...listeningTopics.map((t) => ({
      key: t.id,
      label: t.name,
    })),
  ];

  const filteredFeed = listeningFeed.filter((h) => {
    const matchRelevance = relevanceFilter === 'all' || h.relevance === relevanceFilter;
    const matchBrand = brandFilter === 'all' || h.topicName === (listeningTopics.find(t => t.id === brandFilter)?.name || brandFilter);
    return matchRelevance && matchBrand;
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
      {/* Topic filter bar */}
      <div className="flex items-center gap-2 mb-4 bg-white rounded-xl border border-gray-200 px-4 py-2.5">
        <span className="text-xs font-medium text-gray-500 mr-1">Topic:</span>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {brandFilters.map((b) => (
            <button
              key={b.key}
              onClick={() => setBrandFilter(b.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                brandFilter === b.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        {brandFilter !== 'all' && (
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-gray-400">Showing hits from</span>
            <span className="font-semibold text-gray-700">{listeningTopics.find(t => t.id === brandFilter)?.name || 'Unknown'}</span>
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
          { key: 'topics', label: 'Topics', badge: listeningTopics.length || undefined },
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

            {hitsQ.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
              </div>
            ) : filteredFeed.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">👂</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">No listening hits yet</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Create a topic in the Topics tab, then click &quot;Scan Now&quot; to search for matching content.
                </p>
                <button
                  onClick={() => setSubTab('topics')}
                  className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
                >
                  Go to Topics
                </button>
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
                        <span className="font-semibold text-gray-900 text-sm">
                          {hit.platform === 'x' ? `@${hit.author}` : `u/${hit.author}`}
                        </span>
                        <span className="text-xs text-gray-400">{formatFollowers(hit.followers)}</span>
                        {hit.subreddit && <span className="text-xs text-orange-600 font-medium">{hit.subreddit}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <RelevanceBadge level={hit.relevance} />
                        <SentimentDot sentiment={hit.sentiment?.toLowerCase()} />
                        <span className="text-xs text-gray-400">{timeAgo(hit.time)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed mb-2">{hit.content}</p>
                    {hit.topicName && (
                      <p className="text-[11px] text-gray-400 mb-2">Topic: {hit.topicName}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{hit.engagements} engagements</span>
                        <span>Score: {hit.heuristic}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hit.sourceUrl && (
                          <a
                            href={hit.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium"
                          >
                            View
                          </a>
                        )}
                        <button
                          onClick={() => dismissHitMutation.mutate({ id: hit.id })}
                          className="px-2.5 py-1 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100"
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
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-3">Active Topics</h4>
              {topicsQ.isLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : listeningTopics.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">No topics configured yet.</p>
              ) : (
                listeningTopics.filter((t) => t.active).map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">
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

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-3">Sentiment (24h)</h4>
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
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-3 text-xs text-gray-600">
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
              <span className="text-xs text-gray-400">Powered by listening data</span>
            </div>
          </div>

          {listeningFeed.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-lg font-bold text-indigo-600">AI</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No data for insights yet</h3>
              <p className="text-xs text-gray-500">
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
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <SectionTitle subtitle="Highest-scoring mentions that may require attention">
                  Top Actionable Hits
                </SectionTitle>
                <div className="space-y-3 mt-4">
                  {listeningFeed
                    .filter((h) => h.relevance === 'HIGH')
                    .slice(0, 5)
                    .map((hit) => (
                      <div key={hit.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <PlatformBadge platform={hit.platform} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">
                              {hit.platform === 'x' ? `@${hit.author}` : `u/${hit.author}`}
                            </span>
                            <span className="text-xs text-gray-400">{formatFollowers(hit.followers)}</span>
                            <span className="text-xs text-gray-400">{timeAgo(hit.time)}</span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{hit.content}</p>
                        </div>
                        <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
                          {hit.heuristic}
                        </span>
                      </div>
                    ))}
                  {listeningFeed.filter((h) => h.relevance === 'HIGH').length === 0 && (
                    <p className="text-sm text-gray-500 py-4 text-center">No high-relevance hits found yet.</p>
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
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
              >
                + New Topic
              </button>
            </div>
          </div>

          {/* ── New Topic Form (AI-powered conversational) ─── */}
          {showNewTopic && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
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
                  <div className="bg-white rounded-lg border border-blue-100 p-3 max-h-[300px] overflow-y-auto space-y-3">
                    {newTopicChat.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5">AI</div>
                        )}
                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-800'} rounded-lg px-3 py-2`}>
                          <p className="text-xs leading-relaxed">{msg.content}</p>
                          {msg.questions && (
                            <div className="mt-2 space-y-1.5">
                              {msg.questions.map((q, qi) => (
                                <button
                                  key={qi}
                                  onClick={() => setAiPrompt(q)}
                                  className="block w-full text-left text-[11px] bg-white/80 text-blue-800 px-2.5 py-1.5 rounded border border-blue-100 hover:bg-blue-50 transition-colors"
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
                        <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2">
                          <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-gray-500">Thinking...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat input */}
                <div>
                  <label className="block text-xs font-medium text-blue-800 mb-1">
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
                      className="flex-1 px-3 py-2.5 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                        <label className="block text-xs font-medium text-blue-800">Topic Name</label>
                      </div>
                      <input
                        type="text"
                        value={topicName}
                        onChange={(e) => setTopicName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3"
                      />

                      <label className="block text-xs font-medium text-blue-800 mb-2">
                        Generated Queries ({topicQueries.length})
                      </label>
                      <div className="space-y-2">
                        {topicQueries.map((q, i) => (
                          <div key={i} className="bg-white rounded-lg p-3 border border-blue-100">
                            <div className="flex items-start gap-2">
                              <PlatformBadge platform={q.platform === 'X' ? 'x' : 'reddit'} />
                              <div className="flex-1 min-w-0">
                                <code className="text-xs text-gray-700 font-mono break-all">{q.queryString}</code>
                                {q.rationale && (
                                  <p className="text-[11px] text-gray-500 mt-1 italic">{q.rationale}</p>
                                )}
                                {q.negativeKeywords && (
                                  <p className="text-[11px] text-gray-400 mt-0.5">
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
                    <div className="bg-white rounded-lg p-3 border border-blue-100">
                      <label className="block text-[11px] font-medium text-gray-500 mb-1.5">
                        Refine queries with AI
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={refineInput}
                          onChange={(e) => setRefineInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRefineQueries()}
                          placeholder="e.g. Add more Reddit subreddits, focus more on founders, exclude crypto content..."
                          className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button
                          onClick={handleRefineQueries}
                          disabled={!refineInput.trim() || generateQueriesMutation.isPending}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-md hover:bg-gray-200 font-medium disabled:opacity-50 flex items-center gap-1"
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
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
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
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No listening topics yet</h3>
              <p className="text-xs text-gray-500 mb-4">
                Create your first topic to start monitoring conversations across X and Reddit.
              </p>
              <button
                onClick={() => setShowNewTopic(true)}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
              >
                + Create First Topic
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Topic', 'Queries', 'Hits', 'Polling Tier', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listeningTopics.map((t) => (
                    <React.Fragment key={t.id}>
                      <tr className={`border-b border-gray-100 hover:bg-gray-50 ${expandedTopicId === t.id ? 'bg-indigo-50/50' : ''}`}>
                        <td className="py-3 px-3">
                          <div>
                            <span className="font-medium text-gray-900">{t.name}</span>
                            {t.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
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
                                  <code className="text-[10px] text-gray-500 truncate max-w-[120px]">{q.queryString}</code>
                                </div>
                              ))}
                              {t.queries.length > 2 && (
                                <span className="text-[10px] text-gray-400">+{t.queries.length - 2} more</span>
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
                            <span className={t.active ? 'text-green-700 font-medium' : 'text-gray-500'}>
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
                              className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium disabled:opacity-50"
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
                              className="px-2.5 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
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
                                    <div key={i} className="bg-white rounded-lg p-2.5 border border-indigo-100 text-xs">
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <PlatformBadge platform={(q.platform || 'X') === 'X' ? 'x' : 'reddit'} />
                                        <code className="text-gray-700 font-mono break-all text-[11px]">{q.queryString}</code>
                                      </div>
                                      {q.rationale && (
                                        <p className="text-[10px] text-indigo-500 italic mt-0.5">{q.rationale}</p>
                                      )}
                                      {q.negativeKeywords && q.negativeKeywords.length > 0 && (
                                        <p className="text-[10px] text-gray-400 mt-0.5">
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
                                            : 'bg-white border border-indigo-200 text-indigo-800'
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
                                  className="flex-1 px-3 py-2 text-xs border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                                  <span className="text-[10px] text-gray-500">
                                    Preview above — click to apply changes
                                  </span>
                                </div>
                              )}

                              {topicRefineResult?.saved && (
                                <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
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
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
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

      {/* ── SOV sub-tab ─── */}
      {subTab === 'sov' && (
        <div>
          <SectionTitle subtitle="Your brand's share of the conversation vs. competitors">Share of Voice & Analytics</SectionTitle>

          {/* Mention Metrics Summary */}
          {mentionMetricsQ.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Total (30d)</p>
                <p className="text-2xl font-bold text-gray-900">{mentionMetricsQ.data?.total30d || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">This Week (7d)</p>
                <p className="text-2xl font-bold text-gray-900">{mentionMetricsQ.data?.total7d || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Positive</p>
                <p className="text-2xl font-bold text-green-600">{mentionMetricsQ.data?.bySentiment?.POSITIVE || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Neutral</p>
                <p className="text-2xl font-bold text-gray-600">{mentionMetricsQ.data?.bySentiment?.NEUTRAL || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Negative</p>
                <p className="text-2xl font-bold text-red-600">{mentionMetricsQ.data?.bySentiment?.NEGATIVE || 0}</p>
              </div>
            </div>
          )}

          {/* Topic Breakdown */}
          {mentionMetricsQ.data?.byTopic && mentionMetricsQ.data.byTopic.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Mentions by Topic (7d)</h4>
              <div className="space-y-2">
                {mentionMetricsQ.data.byTopic.map((topic) => (
                  <div key={topic.topicId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-700">{topic.topicName}</span>
                    <span className="font-semibold text-gray-900">{topic.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Trend */}
          {mentionMetricsQ.data?.dailyTrend && mentionMetricsQ.data.dailyTrend.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Daily Mention Trend (14d)</h4>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={mentionMetricsQ.data.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#93c5fd" name="Mentions" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {sovQ.isLoading ? (
            <Skeleton className="h-[300px] w-full rounded-xl mb-8" />
          ) : sovData.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No Share of Voice data yet</h3>
              <p className="text-xs text-gray-500">Configure competitors to start tracking share of voice.</p>
            </div>
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
                      label={({ value }) => `${value}%`}
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
                    {sovData.map((entry, i) => (
                      <Area key={entry.name} type="monotone" dataKey={entry.name} stackId="1" stroke={entry.color} fill={entry.color} fillOpacity={0.3} />
                    ))}
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sentiment trend */}
          {sentimentTrendData.length > 0 && (
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
          )}
        </div>
      )}

      {/* ── Competitors sub-tab ─── */}
      {subTab === 'competitors' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Track competitor accounts, keywords, and content performance">Competitor Monitoring</SectionTitle>
            <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">+ Add Competitor</button>
          </div>

          {sovData.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No competitors configured</h3>
              <p className="text-xs text-gray-500">Add competitors to start tracking their activity and share of voice.</p>
            </div>
          ) : (
            <>
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
                    </div>
                  ))}
              </div>

              {/* Competitive comparison table */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
