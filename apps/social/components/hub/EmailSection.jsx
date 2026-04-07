'use client';

import { trpc } from '@/lib/trpc-client';
import { Skeleton } from '@/components/ui';
import GoogleConnectCard from './GoogleConnectCard';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function EmailRow({ message }) {
  const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${message.id}`;

  return (
    <a
      href={gmailUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors cursor-pointer hover:bg-surface-hover ${
        message.isUnread
          ? 'border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-900/10'
          : 'border-border bg-surface-card'
      }`}
    >
      {/* Unread indicator */}
      <div className="flex-shrink-0 pt-1.5">
        {message.isUnread ? (
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        ) : (
          <div className="w-2 h-2" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs truncate ${message.isUnread ? 'font-semibold text-content-primary' : 'text-content-secondary'}`}>
            {message.from?.name || message.from?.email || 'Unknown'}
          </span>
          <span className="text-xs text-content-faint flex-shrink-0 ml-auto">
            {timeAgo(message.date)}
          </span>
        </div>
        <p className={`text-sm truncate ${message.isUnread ? 'font-medium text-content-primary' : 'text-content-secondary'}`}>
          {message.subject}
        </p>
        <p className="text-xs text-content-muted truncate mt-0.5">
          {message.snippet}
        </p>
      </div>
    </a>
  );
}

export default function EmailSection() {
  const { data, isLoading } = trpc.google.gmailHighlights.useQuery(undefined, {
    staleTime: 120_000, // 2 min
  });

  return (
    <div className="bg-surface-card rounded-xl border border-border p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        <h3 className="text-sm font-semibold text-content-primary">Priority Inbox</h3>
        {data?.connected && data.messages.some(m => m.isUnread) && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            {data.messages.filter(m => m.isUnread).length} new
          </span>
        )}
        {data?.connected && (
          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-content-faint hover:text-blue-500 ml-auto transition-colors"
          >
            Open &rarr;
          </a>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5">
              <Skeleton className="w-2 h-2 rounded-full mt-1.5" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Not connected */}
      {!isLoading && data && !data.connected && (
        <GoogleConnectCard
          title="Connect Gmail"
          description="See your latest emails without leaving the hub"
        />
      )}

      {/* Connected but no messages */}
      {!isLoading && data?.connected && data.messages.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-content-muted">Inbox zero!</p>
          <p className="text-xs text-content-faint mt-1">No recent messages</p>
        </div>
      )}

      {/* Email list */}
      {!isLoading && data?.connected && data.messages.length > 0 && (
        <div className="space-y-2">
          {data.messages.map(msg => (
            <EmailRow key={msg.id} message={msg} />
          ))}
        </div>
      )}
    </div>
  );
}
