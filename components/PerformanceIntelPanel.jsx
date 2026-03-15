'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc-client';
import { PlatformBadge, Skeleton, MiniSparkline, COLORS } from '@/components/ui';

// ── Category colors for insight cards ────────────────────────
const CATEGORY_COLORS = {
  format: { border: 'border-l-blue-500', bg: 'bg-blue-50' },
  timing: { border: 'border-l-amber-500', bg: 'bg-amber-50' },
  topic:  { border: 'border-l-purple-500', bg: 'bg-purple-50' },
};

const SPARKLINE_COLORS = {
  top: COLORS.green,
  average: COLORS.gray,
  poor: COLORS.red,
};

// ── InsightCardsSection ──────────────────────────────────────

function InsightCardsSection() {
  const { data, isLoading, error } = trpc.performanceIntel.insightCards.useQuery(
    { range: '30d' },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-2 mb-4">
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Insights</h4>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-4">
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Insights</h4>
        <p className="text-[10px] text-red-500">Failed to load insights.</p>
      </div>
    );
  }

  const cards = data || [];

  return (
    <div className="mb-4">
      <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Insights</h4>
      {cards.length === 0 ? (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-[10px] text-gray-400 text-center">Analyzing your content...</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {cards.map((card, i) => {
            const cat = CATEGORY_COLORS[card.category] || CATEGORY_COLORS.format;
            return (
              <div
                key={i}
                className={`p-2 rounded-lg border border-gray-100 border-l-[3px] ${cat.border} ${cat.bg}`}
              >
                <div className="flex items-baseline gap-1.5">
                  {card.metric && (
                    <span className="text-xs font-bold text-gray-900 flex-shrink-0">{card.metric}</span>
                  )}
                  <span className="text-[11px] font-semibold text-gray-800 leading-tight">{card.title}</span>
                </div>
                {card.body && (
                  <p className="text-[10px] text-gray-600 leading-snug mt-0.5">{card.body}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── TieredPostsSection ───────────────────────────────────────

const TIER_CONFIG = {
  top:     { label: 'Top Performers',      borderColor: 'border-l-green-500', icon: '\u2605' },
  average: { label: 'Average',             borderColor: 'border-l-gray-400',  icon: '\u2500' },
  poor:    { label: 'Needs Improvement',   borderColor: 'border-l-red-500',   icon: '\u25BC' },
};

function TierSection({ tierKey, posts, sparklines }) {
  const config = TIER_CONFIG[tierKey];
  const [expanded, setExpanded] = useState(tierKey === 'top');

  if (!posts || posts.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center gap-1.5 p-1.5 rounded-md hover:bg-gray-50 transition-colors border-l-[3px] ${config.borderColor}`}
      >
        <span className="text-[10px] text-gray-400">{expanded ? '\u25BC' : '\u25B6'}</span>
        <span className="text-[11px] font-semibold text-gray-700">{config.label}</span>
        <span className="text-[10px] text-gray-400 ml-auto">({posts.length})</span>
      </button>
      {expanded && (
        <div className="space-y-1 mt-1 pl-2">
          {posts.map((post) => {
            const sparkData = sparklines?.[post.id];
            const sparkPoints = sparkData?.map((s) => s.engagementRate) || [];
            return (
              <div
                key={post.id}
                className="flex items-center gap-1.5 p-1.5 rounded-md bg-white border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <PlatformBadge platform={post.platform} />
                    <span className="text-[9px] px-1 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">
                      {post.contentType}
                    </span>
                  </div>
                  <p
                    className="text-[10px] text-gray-700 leading-snug"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {post.content}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="text-[10px] font-bold text-gray-800">
                    {post.metrics.engagementRate.toFixed(1)}%
                  </span>
                  <MiniSparkline
                    data={sparkPoints}
                    width={56}
                    height={18}
                    color={SPARKLINE_COLORS[tierKey]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TieredPostsSection() {
  const { data, isLoading, error } = trpc.performanceIntel.tieredPosts.useQuery(
    { range: '30d' },
    { staleTime: 5 * 60 * 1000 }
  );

  // Collect all post IDs to batch-fetch sparklines
  const allPostIds = useMemo(() => {
    if (!data?.tiers) return [];
    return [
      ...data.tiers.top,
      ...data.tiers.average,
      ...data.tiers.poor,
    ].map((p) => p.id);
  }, [data]);

  const { data: sparklines } = trpc.performanceIntel.sparklineBatch.useQuery(
    { postIds: allPostIds },
    { enabled: allPostIds.length > 0, staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-2 mb-4">
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Post Performance</h4>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-4">
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Post Performance</h4>
        <p className="text-[10px] text-red-500">Failed to load posts.</p>
      </div>
    );
  }

  const tiers = data?.tiers;
  const totalPosts = data?.totalPosts || 0;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Post Performance</h4>
        <span className="text-[9px] text-gray-400">{totalPosts} posts</span>
      </div>
      {totalPosts === 0 ? (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-[10px] text-gray-400 text-center">No published posts in this period.</p>
        </div>
      ) : (
        <>
          <TierSection tierKey="top" posts={tiers?.top} sparklines={sparklines} />
          <TierSection tierKey="average" posts={tiers?.average} sparklines={sparklines} />
          <TierSection tierKey="poor" posts={tiers?.poor} sparklines={sparklines} />
        </>
      )}
    </div>
  );
}

// ── PatternCallouts ──────────────────────────────────────────

function PatternCallouts() {
  const { data, isLoading, error } = trpc.performanceIntel.patternAnalysis.useQuery(
    { range: '30d' },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Patterns</h4>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Patterns</h4>
        <p className="text-[10px] text-red-500">Failed to load patterns.</p>
      </div>
    );
  }

  const { formatPatterns = [], timePatterns = [], topicSignals = [] } = data || {};

  // Check if enough data to show patterns
  const totalPosts = formatPatterns.reduce((sum, f) => sum + f.postCount, 0);
  if (totalPosts < 5) {
    return (
      <div>
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Patterns</h4>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-[10px] text-gray-400 text-center">Need more published posts for pattern analysis</p>
        </div>
      </div>
    );
  }

  // Best format callout
  const bestFormat = formatPatterns.length > 1
    ? [...formatPatterns].sort((a, b) => b.avgEngRate - a.avgEngRate)[0]
    : null;
  const worstFormat = formatPatterns.length > 1
    ? [...formatPatterns].sort((a, b) => a.avgEngRate - b.avgEngRate)[0]
    : null;
  const formatMultiplier = bestFormat && worstFormat && worstFormat.avgEngRate > 0
    ? (bestFormat.avgEngRate / worstFormat.avgEngRate).toFixed(1)
    : null;

  // Best time callout
  const bestTime = timePatterns.length > 0 ? timePatterns[0] : null;

  // Top topic signal
  const topTopic = topicSignals.length > 0 ? topicSignals[0] : null;

  return (
    <div>
      <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Patterns</h4>
      <div className="space-y-1.5">
        {bestFormat && formatMultiplier && (
          <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-[10px] text-blue-800 leading-snug">
              <span className="font-bold">{bestFormat.format}s</span> get{' '}
              <span className="font-bold">{formatMultiplier}x</span> more engagement than{' '}
              {worstFormat.format.toLowerCase()}s
            </p>
          </div>
        )}

        {bestTime && (
          <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-[10px] text-amber-800 leading-snug">
              Posts on <span className="font-bold">{bestTime.day} {bestTime.hour}:00 UTC</span> get{' '}
              <span className="font-bold">{bestTime.avgEngRate}%</span> avg engagement
            </p>
          </div>
        )}

        {topTopic && (
          <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
            <p className="text-[10px] text-purple-800 leading-snug">
              Posts mentioning &ldquo;<span className="font-bold">{topTopic.phrase}</span>&rdquo; average{' '}
              <span className="font-bold">{topTopic.avgEngRate}%</span> engagement
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────

export default function PerformanceIntelPanel() {
  return (
    <div className="space-y-1" style={{ scrollbarWidth: 'thin' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
          PI
        </div>
        <span className="text-[10px] font-semibold text-gray-600">Performance Intel -- last 30 days</span>
      </div>
      <InsightCardsSection />
      <TieredPostsSection />
      <PatternCallouts />
    </div>
  );
}
