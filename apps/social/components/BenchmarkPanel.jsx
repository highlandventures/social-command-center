'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';
import { SectionTitle, Skeleton } from '@/components/ui';

/**
 * BenchmarkPanel (Compact)
 *
 * Shows a compact summary of benchmark grades on the dashboard.
 * Links to the full Competitors > Benchmarks tab for detailed breakdown.
 */

function GradeChip({ grade }) {
  const colors = {
    'A':  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    'A-': 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'B+': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'B':  'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    'B-': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    'C+': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'C':  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${colors[grade] || colors['C']}`}>
      {grade}
    </span>
  );
}

function DeltaTag({ value, label }) {
  if (value == null) return null;
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
      }`}
      title={`vs ${label}`}
    >
      {isPositive ? '↑' : '↓'} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

export default function BenchmarkPanel() {
  const summaryQ = trpc.benchmarks.summary.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  if (summaryQ.isLoading) {
    return (
      <div className="bg-surface-card rounded-xl border border-border p-5">
        <SectionTitle>Industry Benchmarks</SectionTitle>
        <Skeleton className="h-16 w-full mt-3" />
      </div>
    );
  }

  const data = summaryQ.data;

  if (!data) {
    return (
      <div className="bg-surface-card rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-5">
        <SectionTitle>Industry Benchmarks</SectionTitle>
        <div className="text-center py-4">
          <p className="text-sm text-content-muted">No benchmark data yet</p>
        </div>
      </div>
    );
  }

  const freshness = data.generatedAt ? new Date(data.generatedAt) : null;
  const stale = freshness && (Date.now() - freshness.getTime()) > 8 * 24 * 60 * 60 * 1000;

  return (
    <div className="bg-surface-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <SectionTitle subtitle={`${data.universeSize} crypto accounts`}>
          Industry Benchmarks
        </SectionTitle>
        <div className="flex items-center gap-2">
          {stale && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded font-medium">
              Stale
            </span>
          )}
        </div>
      </div>

      {/* Compact account grades */}
      <div className="space-y-2">
        {data.accounts.map((acct, i) => {
          const comp = data.comparisons[i] || {};
          return (
            <div
              key={acct.handle}
              className="flex items-center justify-between py-2 border-b border-border-secondary last:border-0"
            >
              <div className="flex items-center gap-2">
                <GradeChip grade={acct.grade} />
                <span className="text-sm font-medium text-content-primary">{acct.displayName}</span>
                <span className="text-xs text-content-faint">{acct.handle}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs text-content-secondary">{acct.engRate?.toFixed(2)}% eng</span>
                </div>
                <DeltaTag value={comp.engVsMedian} label="median" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Link to full breakdown */}
      <Link
        href="/competitors?tab=benchmarks"
        className="block mt-3 text-center text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
      >
        View full benchmark breakdown →
      </Link>
    </div>
  );
}
