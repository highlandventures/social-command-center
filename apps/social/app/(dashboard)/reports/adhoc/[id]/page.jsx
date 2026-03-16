'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { trpc } from '@/lib/trpc-client';
import { extractReportParams } from '@/lib/adhoc/param-extractor';
import { SectionTitle, Skeleton } from '@/components/ui';

const statusBadge = {
  SCOPING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  GENERATING: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  READY: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  FAILED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

export default function AdHocReportDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const messagesEndRef = useRef(null);
  const [snapshotForm, setSnapshotForm] = useState(false);
  const [snapshotIntervals, setSnapshotIntervals] = useState([]);

  const reportQ = trpc.adhocReports.get.useQuery({ id }, { staleTime: 5_000 });
  const utils = trpc.useUtils();

  const generateMutation = trpc.adhocReports.generate.useMutation({
    onSuccess: () => {
      utils.adhocReports.get.invalidate({ id });
    },
  });

  const rerunMutation = trpc.adhocReports.rerun.useMutation({
    onSuccess: () => {
      utils.adhocReports.get.invalidate({ id });
    },
  });

  const snapshotMutation = trpc.adhocReports.configureSnapshots.useMutation({
    onSuccess: () => {
      utils.adhocReports.get.invalidate({ id });
      setSnapshotForm(false);
    },
  });

  // Build initial messages from DB
  const loadedMessages = (reportQ.data?.messages || []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
  }));

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: chatLoading,
  } = useChat({
    api: '/api/adhoc-report/chat',
    initialMessages: loadedMessages,
    body: { adHocId: id },
  });

  const adHoc = reportQ.data;
  const status = adHoc?.status || 'SCOPING';

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detect params in latest assistant message
  const latestAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const detectedParams = latestAssistant ? extractReportParams(latestAssistant.content) : null;

  if (reportQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  const handleGenerate = () => {
    if (!detectedParams) return;
    generateMutation.mutate({ adHocId: id, reportParams: detectedParams });
  };

  const handleRerun = () => {
    rerunMutation.mutate({ adHocId: id });
  };

  const handleSaveSnapshots = () => {
    if (snapshotIntervals.length === 0) return;
    snapshotMutation.mutate({ adHocId: id, intervals: snapshotIntervals });
  };

  const toggleInterval = (hours) => {
    setSnapshotIntervals((prev) =>
      prev.includes(hours) ? prev.filter((h) => h !== hours) : [...prev, hours]
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/reports/adhoc')}
            className="text-sm text-content-muted hover:text-content-secondary"
          >
            &larr; Back
          </button>
          <SectionTitle>{adHoc?.title || 'New Ad Hoc Report'}</SectionTitle>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              statusBadge[status] || statusBadge.SCOPING
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Generating state */}
      {(status === 'GENERATING' || generateMutation.isPending || rerunMutation.isPending) && (
        <div className="bg-surface-card rounded-xl border border-border p-12 text-center mb-6">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-content-secondary font-medium">Generating your report...</p>
          <p className="text-xs text-content-muted mt-1">This may take 15-30 seconds</p>
        </div>
      )}

      {/* Report detail (READY state) */}
      {status === 'READY' && adHoc?.reportId && (
        <div className="bg-surface-card rounded-xl border border-border p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-content-primary">{adHoc.title || 'Generated Report'}</h3>
              <p className="text-xs text-content-muted mt-0.5">Report generated successfully</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/reports/${adHoc.reportId}`)}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                View Full Report
              </button>
              <button
                onClick={handleRerun}
                disabled={rerunMutation.isPending}
                className="px-3 py-1.5 text-xs bg-surface-secondary text-content-secondary rounded-lg hover:bg-surface-hover font-medium disabled:opacity-50"
              >
                {rerunMutation.isPending ? 'Re-running...' : 'Re-run'}
              </button>
            </div>
          </div>

          {/* Snapshot configuration */}
          {adHoc.snapshotIntervals ? (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-content-secondary">Snapshots Configured</p>
                  <p className="text-xs text-content-muted mt-0.5">
                    Intervals: {(Array.isArray(adHoc.snapshotIntervals) ? adHoc.snapshotIntervals : []).map((h) => `${h}h`).join(', ')}
                  </p>
                </div>
                {adHoc.nextSnapshotAt && (
                  <p className="text-xs text-content-muted">
                    Next: {new Date(adHoc.nextSnapshotAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-border">
              {!snapshotForm ? (
                <button
                  onClick={() => setSnapshotForm(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Configure Snapshots
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-content-secondary">Select snapshot intervals:</p>
                  <div className="flex items-center gap-2">
                    {[24, 48, 72].map((hours) => (
                      <label key={hours} className="flex items-center gap-1.5 text-xs text-content-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={snapshotIntervals.includes(hours)}
                          onChange={() => toggleInterval(hours)}
                          className="rounded border-border"
                        />
                        {hours}h
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveSnapshots}
                      disabled={snapshotIntervals.length === 0 || snapshotMutation.isPending}
                      className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setSnapshotForm(false)}
                      className="text-xs text-content-muted hover:text-content-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Failed state */}
      {status === 'FAILED' && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-5 mb-6">
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">Report generation failed</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            An error occurred while generating the report. You can retry.
          </p>
          <button
            onClick={handleRerun}
            disabled={rerunMutation.isPending}
            className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Chat interface */}
      <div className="bg-surface-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-page border-b border-border flex items-center justify-between">
          <h4 className="text-sm font-semibold text-content-primary">
            {status === 'READY' ? 'Chat History' : 'Report Scoping Chat'}
          </h4>
          {status === 'READY' && (
            <span className="text-[10px] text-content-faint">Read-only</span>
          )}
        </div>

        {/* Messages */}
        <div className="h-[400px] overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12 text-content-faint">
              <p className="text-sm">Start a conversation to scope your report.</p>
              <p className="text-xs mt-1">Describe what data and insights you need.</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-surface-secondary text-content-primary'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-surface-secondary rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-content-muted rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-content-muted rounded-full animate-bounce [animation-delay:0.15s]" />
                  <div className="w-2 h-2 bg-content-muted rounded-full animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Generate confirmation card */}
        {detectedParams && status === 'SCOPING' && !generateMutation.isPending && (
          <div className="mx-4 mb-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
            <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-2">
              Report Parameters Detected
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              {detectedParams.title && (
                <div>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">Title:</span>{' '}
                  <span className="text-content-secondary">{detectedParams.title}</span>
                </div>
              )}
              <div>
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">Date Range:</span>{' '}
                <span className="text-content-secondary">{detectedParams.dateStart} to {detectedParams.dateEnd}</span>
              </div>
              <div>
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">Type:</span>{' '}
                <span className="text-content-secondary">{detectedParams.reportType}</span>
              </div>
              {detectedParams.metricsScope && (
                <div>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">Metrics:</span>{' '}
                  <span className="text-content-secondary">{detectedParams.metricsScope}</span>
                </div>
              )}
            </div>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Generate Report
            </button>
          </div>
        )}

        {/* Input bar (only when SCOPING) */}
        {status === 'SCOPING' && (
          <form onSubmit={handleSubmit} className="border-t border-border p-3 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Describe the report you need..."
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-surface-card"
              disabled={chatLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || chatLoading}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
