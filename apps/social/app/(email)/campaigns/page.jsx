'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';

const statusConfig = {
  DRAFT: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
  SCHEDULED: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  SENDING: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
  SENT: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  FAILED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.DRAFT;
  return (
    <span className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${config.bg} ${config.text}`}>
      {status}
    </span>
  );
}

export default function CampaignsPage() {
  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.emailCampaigns.list.useQuery();

  const deleteMutation = trpc.emailCampaigns.delete.useMutation({
    onSuccess: () => {
      utils.emailCampaigns.list.invalidate();
    },
  });

  const handleDelete = (id, name) => {
    if (!confirm(`Delete campaign "${name}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id });
  };

  const formatDate = (date) => {
    if (!date) return '--';
    return new Date(date).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-content-primary">Campaigns</h2>
        <Link
          href="/email/campaigns/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Campaign
        </Link>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-card border border-border rounded-xl shadow-sm p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-5 w-48 bg-skeleton rounded" />
                <div className="h-5 w-20 bg-skeleton rounded" />
                <div className="h-5 w-32 bg-skeleton rounded ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : campaigns?.length === 0 ? (
        /* Empty state */
        <div className="bg-surface-card border border-border rounded-xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">&#x2709;&#xFE0F;</p>
          <h3 className="text-lg font-semibold text-content-primary mb-1">No campaigns yet</h3>
          <p className="text-sm text-content-muted mb-4">
            Create your first email campaign to reach your subscribers.
          </p>
          <Link
            href="/email/campaigns/new"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create Your First Campaign
          </Link>
        </div>
      ) : (
        /* Campaign list */
        <div className="bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_160px_100px_160px_100px] gap-4 px-5 py-3 border-b border-border bg-surface-secondary text-xs font-semibold text-content-faint uppercase tracking-wider">
            <span>Campaign</span>
            <span>List</span>
            <span>Status</span>
            <span>Date</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Campaign rows */}
          {campaigns?.map((campaign) => (
            <div
              key={campaign.id}
              className="grid grid-cols-[1fr_160px_100px_160px_100px] gap-4 px-5 py-4 border-b border-border-secondary last:border-0 items-center hover:bg-surface-hover/50 transition-colors"
            >
              {/* Name + subject */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-content-primary truncate">{campaign.name}</p>
                {campaign.subject && (
                  <p className="text-xs text-content-faint truncate mt-0.5">{campaign.subject}</p>
                )}
              </div>

              {/* List */}
              <div className="min-w-0">
                <p className="text-sm text-content-secondary truncate">
                  {campaign.list?.name || '--'}
                </p>
                {campaign.list?._count?.subscribers != null && (
                  <p className="text-xs text-content-faint">
                    {campaign.list._count.subscribers} subscriber{campaign.list._count.subscribers !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <StatusBadge status={campaign.status} />
              </div>

              {/* Date */}
              <div className="text-xs text-content-faint">
                {campaign.status === 'SCHEDULED'
                  ? formatDate(campaign.scheduledFor)
                  : campaign.status === 'SENT'
                  ? formatDate(campaign.sentAt)
                  : formatDate(campaign.createdAt)}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1">
                {campaign.status === 'DRAFT' && (
                  <>
                    <Link
                      href={`/email/campaigns/${campaign.id}`}
                      className="px-2.5 py-1 text-xs font-medium text-content-secondary hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(campaign.id, campaign.name)}
                      disabled={deleteMutation.isPending}
                      className="px-2.5 py-1 text-xs font-medium text-content-faint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
