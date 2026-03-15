'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import ReportViewer from '@/components/ReportViewer';
import EmailReportModal from '@/components/EmailReportModal';
import { Skeleton, SectionTitle, useToast } from '@/components/ui';

export default function ReportDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const reportQ = trpc.reports.getById.useQuery({ id }, { staleTime: 30_000 });
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  if (reportQ.isLoading) return <LoadingSkeleton />;
  if (reportQ.error || !reportQ.data) return <NotFound onBack={() => router.push('/reports')} />;

  const report = reportQ.data;

  async function handleExportPDF() {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/pdf/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'PDF generation failed');
      }
      const { url } = await res.json();
      // Trigger download by opening in new tab
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      toast.success('PDF ready - downloading');
    } catch (err) {
      console.error('[Export PDF]', err);
      toast.error(err.message || 'PDF generation failed');
    } finally {
      setPdfLoading(false);
    }
  }

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
        <div className="flex items-center gap-2">
          {/* Export PDF button */}
          <button
            onClick={handleExportPDF}
            disabled={pdfLoading}
            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg px-4 py-2 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {pdfLoading ? 'Generating...' : 'Export PDF'}
          </button>
          {/* Email Report */}
          <button
            onClick={() => setEmailModalOpen(true)}
            className="bg-white dark:bg-surface-card border border-gray-300 dark:border-border text-gray-700 dark:text-content-secondary text-sm font-medium rounded-lg px-4 py-2 hover:bg-gray-50 dark:hover:bg-surface-base transition-colors"
          >
            Email Report
          </button>
          {/* Status badge if GENERATING or FAILED */}
          {report.status && report.status !== 'READY' && (
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              report.status === 'GENERATING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
            }`}>
              {report.status}
            </span>
          )}
        </div>
      </div>
      <ReportViewer report={report} />

      {/* Email Report Modal */}
      <EmailReportModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportId={id}
        reportTitle={report.title}
      />

      {/* Delivery History */}
      <DeliveryHistory reportId={id} />
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

function DeliveryHistory({ reportId }) {
  const deliveryLogQ = trpc.reports.deliveryLog.useQuery({ reportId });

  if (deliveryLogQ.isLoading) return null;

  const deliveries = deliveryLogQ.data || [];

  return (
    <div className="mt-8">
      <SectionTitle>Delivery History</SectionTitle>
      {deliveries.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-content-muted mt-2">No deliveries yet</p>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs border border-gray-200 dark:border-border">
            <thead>
              <tr className="bg-gray-50 dark:bg-surface-base text-left">
                <th className="px-3 py-2 font-medium text-gray-600 dark:text-content-muted">Date</th>
                <th className="px-3 py-2 font-medium text-gray-600 dark:text-content-muted">Channel</th>
                <th className="px-3 py-2 font-medium text-gray-600 dark:text-content-muted">Recipients</th>
                <th className="px-3 py-2 font-medium text-gray-600 dark:text-content-muted">Status</th>
                <th className="px-3 py-2 font-medium text-gray-600 dark:text-content-muted">Error</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d, i) => {
                let recipientList = '---';
                try {
                  const parsed = typeof d.recipients === 'string' ? JSON.parse(d.recipients) : d.recipients;
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    recipientList = parsed.join(', ');
                  }
                } catch {
                  // keep default
                }

                return (
                  <tr
                    key={d.id}
                    className={i % 2 === 0 ? 'bg-white dark:bg-surface-card' : 'bg-gray-50/50 dark:bg-surface-base/50'}
                  >
                    <td className="px-3 py-2 text-gray-700 dark:text-content-secondary whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        d.channel === 'EMAIL'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {d.channel === 'PDF_DOWNLOAD' ? 'PDF' : d.channel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-content-muted max-w-[200px] truncate">
                      {recipientList}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        d.status === 'SENT'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-content-muted max-w-[150px] truncate">
                      {d.error || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
