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
      <span className="text-[10px] font-semibold text-gray-600">Audience Questions -- last 30 days</span>
      {clustersData?.lastUpdated && (
        <span className="text-[9px] text-gray-400 ml-auto">
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
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-[10px] text-gray-400 text-center">
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
                className="bg-white border border-gray-100 border-l-4 border-l-emerald-400 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedCluster(isExpanded ? null : cluster.label)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-gray-900">{cluster.label}</span>
                  <span className="bg-emerald-50 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                    Score: {cluster.opportunityScore}
                  </span>
                </div>
                {cluster.description && (
                  <p className="text-[10px] text-gray-500 mb-1">{cluster.description}</p>
                )}
                <div className="flex items-center gap-3 text-[9px] text-gray-400">
                  <span>{cluster.totalVolume} questions</span>
                  <span>{cluster.totalEngagement} engagement</span>
                </div>
              </div>

              {/* Expanded questions list */}
              {isExpanded && clusterQuestions.length > 0 && (
                <div className="ml-2 mt-1 space-y-1 border-l-2 border-emerald-100 pl-2">
                  {clusterQuestions.map((q, j) => (
                    <div key={j} className="flex items-start gap-1.5 py-0.5">
                      <span className="text-[10px] text-gray-600 flex-1">{q.text}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {q.isUnanswered && (
                          <span className="bg-amber-50 text-amber-700 text-[8px] px-1 py-0.5 rounded font-medium">
                            Unanswered
                          </span>
                        )}
                        {q.isRecurring && (
                          <span className="bg-red-50 text-red-700 text-[8px] px-1 py-0.5 rounded font-medium">
                            Recurring
                          </span>
                        )}
                        {q.count > 1 && (
                          <span className="text-[9px] text-gray-400">x{q.count}</span>
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
