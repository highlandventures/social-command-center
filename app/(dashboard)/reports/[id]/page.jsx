'use client';

import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import ReportViewer from '@/components/ReportViewer';
import { Skeleton } from '@/components/ui';

export default function ReportDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const reportQ = trpc.reports.getById.useQuery({ id }, { staleTime: 30_000 });

  if (reportQ.isLoading) return <LoadingSkeleton />;
  if (reportQ.error || !reportQ.data) return <NotFound onBack={() => router.push('/reports')} />;

  const report = reportQ.data;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/reports')}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium mb-2 inline-block"
          >
            &larr; Back to Reports
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-content-primary">{report.title}</h1>
          <p className="text-sm text-gray-500 dark:text-content-muted mt-1">
            {(report.reportType || '').replace(/_/g, ' ')} | Generated {new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>
        {/* Status badge if GENERATING or FAILED */}
        {report.status && report.status !== 'READY' && (
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            report.status === 'GENERATING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
          }`}>
            {report.status}
          </span>
        )}
      </div>
      <ReportViewer report={report} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6">
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-4 w-64 mb-6" />
      {/* KPI placeholders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-surface-card rounded-lg border border-border p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-20 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      {/* Content placeholders */}
      <Skeleton className="h-4 w-32 mb-3" />
      <Skeleton className="h-32 w-full mb-6" />
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function NotFound({ onBack }) {
  return (
    <div className="p-6 text-center py-24">
      <p className="text-lg font-semibold text-gray-900 dark:text-content-primary mb-2">Report not found</p>
      <p className="text-sm text-gray-500 dark:text-content-muted mb-4">This report may have been deleted or the link is invalid.</p>
      <button
        onClick={onBack}
        className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
      >
        Back to Reports
      </button>
    </div>
  );
}
