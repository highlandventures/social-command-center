'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { PlatformBadge } from '@/components/ui';
import { useToast } from '@/components/ui';

const STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes Requested',
  REJECTED: 'Rejected',
};

const STATUS_COLORS = {
  PENDING: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  APPROVED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  CHANGES_REQUESTED: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  REJECTED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

export default function ReviewsPage() {
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [comment, setComment] = useState('');
  const toast = useToast();
  const utils = trpc.useUtils();

  const statsQ = trpc.approvals.stats.useQuery(undefined, { staleTime: 30_000 });
  const listQ = trpc.approvals.list.useQuery(
    { status: statusFilter || undefined },
    { staleTime: 15_000 }
  );
  const detailQ = trpc.approvals.get.useQuery(
    { id: selectedId },
    { enabled: !!selectedId, staleTime: 10_000 }
  );

  const reviewMutation = trpc.approvals.review.useMutation({
    onSuccess: () => {
      utils.approvals.list.invalidate();
      utils.approvals.stats.invalidate();
      utils.approvals.get.invalidate();
      toast.success('Review submitted');
    },
    onError: (err) => toast.error(err.message),
  });

  const addCommentMutation = trpc.approvals.addComment.useMutation({
    onSuccess: () => {
      utils.approvals.get.invalidate();
      setComment('');
      toast.success('Comment added');
    },
    onError: (err) => toast.error(err.message),
  });

  const stats = statsQ.data || { pending: 0, approvedToday: 0, changesRequested: 0, rejected: 0 };
  const approvals = listQ.data?.approvals || [];
  const detail = detailQ.data;

  const handleReview = (status) => {
    if (!selectedId) return;
    reviewMutation.mutate({ id: selectedId, status, comment: comment || undefined });
    setComment('');
  };

  const handleAddComment = () => {
    if (!selectedId || !comment.trim()) return;
    addCommentMutation.mutate({ approvalRequestId: selectedId, content: comment });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-content-primary">L&C Reviews</h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
          { label: 'Approved Today', value: stats.approvedToday, color: 'text-green-600' },
          { label: 'Changes Requested', value: stats.changesRequested, color: 'text-orange-600' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface-card rounded-xl border border-border p-4"
          >
            <p className="text-xs text-content-muted mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-3">
        {[null, 'PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-surface-secondary text-content-secondary hover:bg-surface-hover'
            }`}
          >
            {s ? STATUS_LABELS[s] : 'All'}
          </button>
        ))}
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
        {/* Left: Approval list */}
        <div className="overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          <div className="space-y-2">
            {approvals.map((a) => (
              <div
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`p-3.5 bg-surface-card rounded-xl border cursor-pointer transition-colors hover:bg-surface-hover ${
                  selectedId === a.id
                    ? 'border-blue-500 ring-1 ring-blue-500/30'
                    : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={a.post.platform} />
                    <span className="text-xs text-content-muted">
                      @{a.post.account?.username}
                    </span>
                    {a.post.contentType !== 'POST' && (
                      <span className="text-[10px] text-blue-600 font-medium">
                        {a.post.contentType}
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                      STATUS_COLORS[a.status]
                    }`}
                  >
                    {STATUS_LABELS[a.status]}
                  </span>
                </div>
                <p className="text-sm text-content-secondary line-clamp-2 mb-2">
                  {a.post.content}
                </p>
                <div className="flex items-center justify-between text-[10px] text-content-muted">
                  <span>
                    Requested by {a.requestedBy?.name || a.requestedBy?.email}
                  </span>
                  <div className="flex items-center gap-3">
                    {a.post.scheduledFor && (
                      <span>
                        Scheduled:{' '}
                        {new Date(a.post.scheduledFor).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    {a._count?.comments > 0 && (
                      <span>{a._count.comments} comment{a._count.comments !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {approvals.length === 0 && (
              <div className="text-center py-12 text-content-muted text-sm">
                No reviews found
              </div>
            )}
          </div>
        </div>

        {/* Right: Detail + review panel */}
        <div className="overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {detail ? (
            <div className="bg-surface-card rounded-xl border border-border p-4">
              {/* Post preview */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <PlatformBadge platform={detail.post.platform} />
                  <span className="text-sm font-medium text-content-primary">
                    @{detail.post.account?.username}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                      STATUS_COLORS[detail.status]
                    }`}
                  >
                    {STATUS_LABELS[detail.status]}
                  </span>
                </div>
                <div className="bg-surface-secondary rounded-lg p-3 text-sm text-content-secondary whitespace-pre-wrap">
                  {detail.post.content}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-content-muted">
                  {detail.post.scheduledFor && (
                    <span>
                      Scheduled: {new Date(detail.post.scheduledFor).toLocaleString()}
                    </span>
                  )}
                  {detail.post.notionPageId && (
                    <a
                      href={`https://notion.so/${detail.post.notionPageId.replace(/-/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Open in Notion
                    </a>
                  )}
                </div>
              </div>

              {/* Comments */}
              <div className="border-t border-border pt-3 mb-4">
                <h4 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
                  Comments ({detail.comments?.length || 0})
                </h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {(detail.comments || []).map((c) => (
                    <div
                      key={c.id}
                      className={`p-2.5 rounded-lg text-sm ${
                        c.source === 'notion'
                          ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
                          : 'bg-surface-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-content-primary">
                          {c.authorName}
                        </span>
                        {c.source === 'notion' && (
                          <span className="text-[10px] text-purple-600 font-medium">
                            via Notion
                          </span>
                        )}
                        <span className="text-[10px] text-content-muted">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-content-secondary">{c.content}</p>
                    </div>
                  ))}
                </div>

                {/* Add comment */}
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 text-sm bg-surface-secondary border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!comment.trim() || addCommentMutation.isLoading}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Review actions */}
              {detail.status === 'PENDING' && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
                    Review Decision
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview('APPROVED')}
                      disabled={reviewMutation.isLoading}
                      className="flex-1 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview('CHANGES_REQUESTED')}
                      disabled={reviewMutation.isLoading}
                      className="flex-1 px-3 py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                    >
                      Request Changes
                    </button>
                    <button
                      onClick={() => handleReview('REJECTED')}
                      disabled={reviewMutation.isLoading}
                      className="flex-1 px-3 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Reviewer info for reviewed items */}
              {detail.reviewer && (
                <div className="border-t border-border pt-3 mt-3 text-xs text-content-muted">
                  Reviewed by {detail.reviewer.name || detail.reviewer.email} on{' '}
                  {detail.reviewedAt
                    ? new Date(detail.reviewedAt).toLocaleString()
                    : '—'}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-content-muted text-sm">
              Select a review to see details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
