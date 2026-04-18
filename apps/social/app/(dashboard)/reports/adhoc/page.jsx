'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { SectionTitle, Skeleton } from '@/components/ui';

const statusBadge = {
  SCOPING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  GENERATING: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  READY: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  FAILED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

export default function AdHocReportsPage() {
  const router = useRouter();
  const reportsQ = trpc.adhocReports.list.useQuery(undefined, { staleTime: 15_000 });
  const utils = trpc.useUtils();

  const createMutation = trpc.adhocReports.create.useMutation({
    onSuccess: (data) => {
      utils.adhocReports.list.invalidate();
      router.push(`/reports/adhoc/${data.id}`);
    },
  });

  const reports = reportsQ.data ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <Link
          href="/reports"
          className="text-sm text-content-muted hover:text-blue-600 transition-colors"
        >
          Reports
        </Link>
        <span className="text-content-faint">/</span>
        <span className="text-sm font-semibold text-content-primary">Ad Hoc</span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <SectionTitle subtitle="Create custom reports through AI-guided conversations">
          Ad Hoc Reports
        </SectionTitle>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? 'Creating...' : 'New Report'}
        </button>
      </div>

      {reportsQ.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-xl font-bold mx-auto mb-4">
            AI
          </div>
          <p className="text-content-secondary text-sm mb-2">No ad hoc reports yet.</p>
          <p className="text-content-muted text-xs">
            Start a conversation to create your first custom report.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              onClick={() => router.push(`/reports/adhoc/${report.id}`)}
              className="bg-surface-card rounded-xl border border-border p-4 hover:bg-surface-hover cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">
                    AI
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-content-primary">
                      {report.title || 'Untitled Report'}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          statusBadge[report.status] || statusBadge.SCOPING
                        }`}
                      >
                        {report.status}
                      </span>
                      <span className="text-xs text-content-muted">
                        {report._count?.messages || 0} messages
                      </span>
                      <span className="text-xs text-content-faint">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {report.status === 'GENERATING' && (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {report.status === 'READY' && report.reportId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/reports/${report.reportId}`);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-surface-hover"
                    >
                      View Report
                    </button>
                  )}
                  <svg
                    className="w-4 h-4 text-content-faint"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
