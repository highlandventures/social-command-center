'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';
import { useToast } from '@/components/ui';

const PERIOD_OPTIONS = [
  { value: 'WoW', label: 'WoW' },
  { value: 'MoM', label: 'MoM' },
  { value: 'QoQ', label: 'QoQ' },
  { value: 'YoY', label: 'YoY' },
];

export default function BenchmarkSelector({ reportId, coveragePeriod, onCompare }) {
  const [mode, setMode] = useState('period'); // 'period' | 'milestone'
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('');
  const toast = useToast();

  const milestonesQ = trpc.milestones.list.useQuery(undefined, { staleTime: 30_000 });
  const milestones = milestonesQ.data ?? [];

  const compareMutation = trpc.reports.compareBenchmark.useMutation({
    onSuccess: (data) => {
      onCompare(data);
    },
    onError: (err) => {
      toast.error(err.message || 'Benchmark comparison failed');
    },
  });

  function handleCompare() {
    if (mode === 'period' && !selectedPeriod) return;
    if (mode === 'milestone' && !selectedMilestoneId) return;

    compareMutation.mutate({
      reportId,
      comparisonType: mode === 'period' ? selectedPeriod : 'MILESTONE',
      milestoneId: mode === 'milestone' ? selectedMilestoneId : undefined,
    });
  }

  const canCompare =
    (mode === 'period' && selectedPeriod) ||
    (mode === 'milestone' && selectedMilestoneId);

  return (
    <div className="bg-surface-card rounded-lg border border-border p-4 mb-6">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-content-primary">Benchmark Comparison</h4>
        <p className="text-xs text-content-muted mt-0.5">
          Compare this report against a previous period or milestone
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-1 mb-3 w-fit">
        <button
          onClick={() => setMode('period')}
          className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
            mode === 'period'
              ? 'bg-surface-card shadow-sm text-content-primary'
              : 'text-content-muted'
          }`}
        >
          Period
        </button>
        <button
          onClick={() => setMode('milestone')}
          className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
            mode === 'milestone'
              ? 'bg-surface-card shadow-sm text-content-primary'
              : 'text-content-muted'
          }`}
        >
          Milestone
        </button>
      </div>

      {/* Period mode */}
      {mode === 'period' && (
        <div className="flex items-center gap-2 mb-3">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedPeriod(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors ${
                selectedPeriod === opt.value
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-surface-card text-content-secondary border-border hover:border-purple-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Milestone mode */}
      {mode === 'milestone' && (
        <div className="mb-3">
          {milestones.length === 0 ? (
            <p className="text-xs text-content-muted">
              No milestones yet.{' '}
              <Link href="/reports/milestones" className="text-blue-600 hover:text-blue-800 font-medium">
                Create one
              </Link>
            </p>
          ) : (
            <select
              value={selectedMilestoneId}
              onChange={(e) => setSelectedMilestoneId(e.target.value)}
              className="w-full max-w-xs px-3 py-2 text-sm border border-border rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select a milestone...</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({new Date(m.startDate).toLocaleDateString()} - {new Date(m.endDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Compare button */}
      <button
        onClick={handleCompare}
        disabled={!canCompare || compareMutation.isLoading}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          canCompare && !compareMutation.isLoading
            ? 'bg-purple-600 text-white hover:bg-purple-700'
            : 'bg-surface-secondary text-content-faint cursor-not-allowed'
        }`}
      >
        {compareMutation.isLoading ? (
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Comparing...
          </span>
        ) : (
          'Compare'
        )}
      </button>
    </div>
  );
}
