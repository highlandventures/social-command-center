'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Skeleton } from '@/components/ui';

export default function AudienceQuestionsPanel() {
  const [expandedCluster, setExpandedCluster] = useState(null);

  const { data: clustersData, isLoading: clustersLoading, error: clustersError } =
    trpc.audienceQuestions.clusters.useQuery(
      { days: 30 },
      { staleTime: 5 * 60 * 1000 }
    );

  const { data: questionsData, isLoading: questionsLoading, error: questionsError } =
    trpc.audienceQuestions.questions.useQuery(
      { days: 30 },
      { staleTime: 5 * 60 * 1000 }
    );

  const isLoading = clustersLoading || questionsLoading;
  const error = clustersError || questionsError;

  // ── Panel heading ──────────────────────────────────────────
  const heading = (
    <div className="flex items-center gap-1.5 mb-2">
      <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
        AQ
      </div>
      <span className="text-[10px] font-semibold text-content-secondary">Audience Questions -- last 30 days</span>
      {clustersData?.lastUpdated && (
        <span className="text-[9px] text-content-faint ml-auto">
          {new Date(clustersData.lastUpdated).toLocaleDateString()}
        </span>
      )}
    </div>
  );

  // ── Loading state ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-1">
        {heading}
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (error) {
    return (
      <div>
        {heading}
        <p className="text-[10px] text-red-500">Failed to load audience questions.</p>
      </div>
    );
  }

  const clusters = clustersData?.clusters || [];
  const questions = questionsData?.questions || [];

  // ── Empty state ────────────────────────────────────────────
  if (clusters.length === 0) {
    return (
      <div>
        {heading}
        <div className="p-3 bg-surface-secondary rounded-lg border border-border-secondary">
          <p className="text-[10px] text-content-faint text-center">
            No audience questions yet -- questions will appear after the next listening scan.
          </p>
        </div>
      </div>
    );
  }

  // ── Data render ────────────────────────────────────────────
  const sortedClusters = [...clusters].sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0));

  return (
    <div className="space-y-1">
      {heading}
      <div className="space-y-1.5">
        {sortedClusters.map((cluster, i) => {
          const isExpanded = expandedCluster === cluster.label;
          const clusterQuestions = (cluster.questionIndices || [])
            .map((idx) => questions[idx])
            .filter(Boolean);

          return (
            <div key={i}>
              {/* Cluster card */}
              <div
                className="bg-surface-card border border-border-secondary border-l-4 border-l-emerald-400 rounded-lg p-3 cursor-pointer hover:bg-surface-hover transition-colors"
                onClick={() => setExpandedCluster(isExpanded ? null : cluster.label)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-content-primary">{cluster.label}</span>
                  <span className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                    Score: {cluster.opportunityScore}
                  </span>
                </div>
                {cluster.description && (
                  <p className="text-[10px] text-content-muted mb-1">{cluster.description}</p>
                )}
                <div className="flex items-center gap-3 text-[9px] text-content-faint flex-wrap">
                  <span>{cluster.totalVolume} questions</span>
                  <span>{cluster.totalEngagement} engagement</span>
                  {cluster.totalReach > 0 && (
                    <span>{cluster.totalReach >= 1000 ? `${(cluster.totalReach / 1000).toFixed(0)}K` : cluster.totalReach} reach</span>
                  )}
                  {cluster.unansweredCount > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">{cluster.unansweredCount} unanswered</span>
                  )}
                  {cluster.recurringCount > 0 && (
                    <span className="text-red-600 dark:text-red-400">{cluster.recurringCount} recurring</span>
                  )}
                </div>
              </div>

              {/* Expanded questions list */}
              {isExpanded && clusterQuestions.length > 0 && (
                <div className="ml-2 mt-1 space-y-1 border-l-2 border-emerald-100 dark:border-emerald-800 pl-2">
                  {clusterQuestions.map((q, j) => (
                    <div key={j} className="flex items-start gap-1.5 py-0.5">
                      <span className="text-[10px] text-content-secondary flex-1">{q.text}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {q.isUnanswered && (
                          <span className="bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[8px] px-1 py-0.5 rounded font-medium">
                            Unanswered
                          </span>
                        )}
                        {q.isRecurring && (
                          <span className="bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[8px] px-1 py-0.5 rounded font-medium">
                            Recurring
                          </span>
                        )}
                        {q.count > 1 && (
                          <span className="text-[9px] text-content-faint">x{q.count}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
