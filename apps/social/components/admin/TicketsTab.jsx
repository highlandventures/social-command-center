'use client';

import { useState, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc-client';
import { MetricCard, SectionTitle } from '@/components/ui';
import { markTicketSeen, isTicketUnread, useUnreadTicketCount } from '@/lib/ticket-notifications';

// ── Badge helpers ──────────────────────────────────────────
const typeBadge = {
  BUG: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  FEATURE_REQUEST: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
};
const typeLabel = { BUG: 'Bug', FEATURE_REQUEST: 'Feature' };

const priorityBadge = {
  LOW: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  MEDIUM: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  HIGH: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  CRITICAL: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const statusBadge = {
  OPEN: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  IN_PROGRESS: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  AI_REVIEWING: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  RESOLVED: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  WONT_FIX: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500',
  DEFERRED: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
};
const statusLabel = {
  OPEN: 'Open', IN_PROGRESS: 'In Progress', AI_REVIEWING: 'AI Reviewing',
  RESOLVED: 'Resolved', WONT_FIX: "Won't Fix", DEFERRED: 'Deferred',
};

export default function TicketsTab() {
  const [filter, setFilter] = useState(null); // null = all
  const [bucket, setBucket] = useState('active'); // 'active' | 'archive'
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const statsQ = trpc.tickets.stats.useQuery(undefined, { staleTime: 15_000 });
  const listQ = trpc.tickets.list.useQuery(
    filter ? { type: filter, limit: 100 } : { limit: 100 },
    { staleTime: 10_000 }
  );

  const stats = statsQ.data;

  // Subscribe to the shared seen-map so each row can show its unread indicator.
  const { seenMap } = useUnreadTicketCount();
  const hasUnreadActivity = useCallback((ticket) => isTicketUnread(ticket, seenMap), [seenMap]);

  // Partition tickets into active vs archive:
  //  - Archive: RESOLVED or WONT_FIX, and no outstanding caveat comment
  //  - Active:  everything else (including resolved-with-caveat, which stays visible
  //             because there's a follow-up noted against it)
  const allTickets = listQ.data?.tickets ?? [];
  const activeTickets = allTickets.filter((t) => {
    if (t.status === 'RESOLVED' || t.status === 'WONT_FIX') return t.hasCaveat;
    return true;
  });
  const archiveTickets = allTickets.filter((t) => {
    if (t.status === 'RESOLVED' || t.status === 'WONT_FIX') return !t.hasCaveat;
    return false;
  });
  const visibleTickets = bucket === 'active' ? activeTickets : archiveTickets;

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Open Bugs" value={stats?.openBugs ?? '—'} />
        <MetricCard label="Feature Requests" value={stats?.openFeatures ?? '—'} />
        <MetricCard label="AI Reviewed" value={stats?.aiReviewed ?? '—'} />
        <MetricCard label="Resolved (7d)" value={stats?.resolvedThisWeek ?? '—'} />
      </div>

      {/* Active / Archive tabs */}
      <div className="flex items-center gap-2 mb-3 border-b border-border pb-2">
        {[
          { key: 'active', label: 'Active', count: activeTickets.length },
          { key: 'archive', label: 'Archive', count: archiveTickets.length },
        ].map((b) => (
          <button
            key={b.key}
            onClick={() => setBucket(b.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
              bucket === b.key
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                : 'text-content-muted hover:text-content-secondary'
            }`}
          >
            {b.label}
            <span className="ml-1.5 text-xs text-content-faint">({b.count})</span>
          </button>
        ))}
      </div>

      {/* Filter bar + new button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {[
            { key: null, label: 'All' },
            { key: 'BUG', label: 'Bugs' },
            { key: 'FEATURE_REQUEST', label: 'Features' },
          ].map((f) => (
            <button
              key={f.key ?? 'all'}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                filter === f.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-surface-card text-content-secondary border-border hover:bg-surface-hover'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Ticket
        </button>
      </div>

      {/* Ticket list */}
      <div className="space-y-2">
        {listQ.isLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-surface-secondary rounded-xl" />
            ))}
          </div>
        ) : !visibleTickets.length ? (
          <div className="bg-surface-card rounded-xl border border-border p-8 text-center text-content-muted">
            {bucket === 'active'
              ? 'No active tickets. Click "+ New Ticket" to report a bug or request a feature.'
              : 'No archived tickets yet. Resolved tickets without outstanding caveats appear here.'}
          </div>
        ) : (
          visibleTickets.map((ticket) => {
            const isUnread = hasUnreadActivity(ticket);
            return (
            <div
              key={ticket.id}
              onClick={() => {
                setSelectedId(ticket.id);
                markTicketSeen(ticket.id, ticket._count?.comments ?? 0);
              }}
              className={`bg-surface-card rounded-xl border p-4 hover:bg-surface-hover cursor-pointer transition-colors ${
                isUnread ? 'border-blue-400 dark:border-blue-600 ring-1 ring-blue-200 dark:ring-blue-800' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="New activity since you last viewed" />
                  )}
                  <span className={`px-2 py-0.5 text-xs font-medium rounded border ${typeBadge[ticket.type]}`}>
                    {typeLabel[ticket.type]}
                  </span>
                  <span className="text-sm font-medium text-content-primary truncate">
                    {ticket.title}
                  </span>
                  {ticket.hasCaveat && (
                    <span
                      className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      title="Has a follow-up caveat from the Claude AI triage — see the comments"
                    >
                      FOLLOW-UP
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${priorityBadge[ticket.priority]}`}>
                    {ticket.priority}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded ${statusBadge[ticket.status]}`}>
                    {statusLabel[ticket.status]}
                  </span>
                  {ticket._count?.comments > 0 && (
                    <span className="text-xs text-content-muted">{ticket._count.comments} comment{ticket._count.comments !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-content-muted">
                <span>{ticket.createdBy?.name || ticket.createdBy?.email}</span>
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                {ticket.aiAnalysis && (
                  <span className="text-violet-500 dark:text-violet-400 font-medium">AI triaged</span>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* New Ticket Modal */}
      {showNew && (
        <NewTicketModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            listQ.refetch();
            statsQ.refetch();
          }}
        />
      )}

      {/* Ticket Detail Modal */}
      {selectedId && (
        <TicketDetailModal
          ticketId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={() => {
            listQ.refetch();
            statsQ.refetch();
          }}
        />
      )}
    </div>
  );
}

// ── New Ticket Modal ───────────────────────────────────────
function NewTicketModal({ onClose, onCreated }) {
  const [type, setType] = useState('BUG');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [screenshots, setScreenshots] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const createMutation = trpc.tickets.create.useMutation({
    onSuccess: () => onCreated(),
    onError: (err) => setError(err.message),
  });

  const uploadFile = useCallback(async (file) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/screenshot', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setScreenshots((prev) => [...prev, data]);
    } catch {
      setError('Screenshot upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }, [uploadFile]);

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required');
      return;
    }
    createMutation.mutate({
      type,
      title: title.trim(),
      description: description.trim(),
      priority,
      screenshots: screenshots.length > 0 ? screenshots : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-content-primary mb-4">New Ticket</h3>

        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {/* Type toggle */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'BUG', label: 'Bug Report', icon: '🐛' },
            { key: 'FEATURE_REQUEST', label: 'Feature Request', icon: '✨' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                type === t.key
                  ? t.key === 'BUG'
                    ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                    : 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                  : 'bg-surface-secondary border-border text-content-muted hover:bg-surface-hover'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-content-muted mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'BUG' ? 'What went wrong?' : 'What would you like to see?'}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-page text-content-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-content-muted mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={type === 'BUG' ? 'Steps to reproduce, expected vs actual behavior...' : 'Describe the feature and why it would be helpful...'}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-page text-content-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Priority */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-content-muted mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-page text-content-primary focus:ring-2 focus:ring-blue-500"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        {/* Screenshot drop zone */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-content-muted mb-1">Screenshots</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-border hover:border-blue-300 hover:bg-surface-hover'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => Array.from(e.target.files).forEach(uploadFile)}
            />
            <p className="text-sm text-content-muted">
              {uploading ? 'Uploading...' : 'Drag & drop images here, or click to browse'}
            </p>
          </div>

          {/* Thumbnail previews */}
          {screenshots.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {screenshots.map((s, i) => (
                <div key={i} className="relative group">
                  <img src={s.url} alt={s.filename} className="w-16 h-16 object-cover rounded-lg border border-border" />
                  <button
                    onClick={() => setScreenshots((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isLoading || uploading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {createMutation.isLoading ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ticket Detail Modal ────────────────────────────────────
function TicketDetailModal({ ticketId, onClose, onUpdate }) {
  const [comment, setComment] = useState('');
  const ticketQ = trpc.tickets.get.useQuery({ id: ticketId });
  const addCommentMutation = trpc.tickets.addComment.useMutation({
    onSuccess: () => {
      setComment('');
      ticketQ.refetch();
      onUpdate();
    },
  });
  const updateStatusMutation = trpc.tickets.updateStatus.useMutation({
    onSuccess: () => {
      ticketQ.refetch();
      onUpdate();
    },
  });

  const ticket = ticketQ.data;

  if (!ticket) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-surface-card rounded-xl p-8" onClick={(e) => e.stopPropagation()}>
          <div className="animate-pulse h-32 w-64 bg-surface-secondary rounded-lg" />
        </div>
      </div>
    );
  }

  const screenshots = Array.isArray(ticket.screenshots) ? ticket.screenshots : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${typeBadge[ticket.type]}`}>
                {typeLabel[ticket.type]}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded ${priorityBadge[ticket.priority]}`}>
                {ticket.priority}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded ${statusBadge[ticket.status]}`}>
                {statusLabel[ticket.status]}
              </span>
            </div>
            <h3 className="text-lg font-bold text-content-primary">{ticket.title}</h3>
            <p className="text-xs text-content-muted mt-1">
              by {ticket.createdBy?.name || ticket.createdBy?.email} on {new Date(ticket.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary text-xl leading-none">&times;</button>
        </div>

        {/* Description */}
        <div className="bg-surface-secondary rounded-lg p-4 mb-4">
          <p className="text-sm text-content-primary whitespace-pre-wrap">{ticket.description}</p>
        </div>

        {/* Screenshots */}
        {screenshots.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-content-muted mb-2">Screenshots</h4>
            <div className="flex gap-2 flex-wrap">
              {screenshots.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">
                  <img src={s.url} alt={s.filename} className="w-32 h-24 object-cover rounded-lg border border-border hover:ring-2 hover:ring-blue-400 transition" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* AI Analysis */}
        {ticket.aiAnalysis && (
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg p-4 mb-4">
            <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">AI Triage Analysis</h4>
            {ticket.aiAnalysis.summary && (
              <p className="text-sm text-content-primary mb-2">{ticket.aiAnalysis.summary}</p>
            )}
            {ticket.aiAnalysis.suggestedFix && (
              <p className="text-sm text-content-secondary"><strong>Suggested fix:</strong> {ticket.aiAnalysis.suggestedFix}</p>
            )}
            {ticket.aiAnalysis.likelyAffectedAreas?.length > 0 && (
              <p className="text-sm text-content-secondary mt-1"><strong>Affected areas:</strong> {ticket.aiAnalysis.likelyAffectedAreas.join(', ')}</p>
            )}
            <div className="flex gap-3 mt-2">
              {ticket.aiAnalysis.severity && (
                <span className="text-xs text-content-muted">Severity: <strong>{ticket.aiAnalysis.severity}</strong></span>
              )}
              {ticket.aiAnalysis.confidence && (
                <span className="text-xs text-content-muted">Confidence: <strong>{ticket.aiAnalysis.confidence}</strong></span>
              )}
            </div>
          </div>
        )}

        {/* Status actions */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX', 'DEFERRED'].map((s) => (
            s !== ticket.status && (
              <button
                key={s}
                onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: s })}
                disabled={updateStatusMutation.isLoading}
                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${statusBadge[s]} border-border hover:opacity-80`}
              >
                {statusLabel[s]}
              </button>
            )
          ))}
        </div>

        {/* Comments */}
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-content-primary mb-3">
            Comments ({ticket.comments?.length || 0})
          </h4>
          <div className="space-y-3 mb-4">
            {ticket.comments?.map((c) => (
              <div key={c.id} className={`rounded-lg p-3 text-sm ${
                c.authorName === 'Claude AI'
                  ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800'
                  : 'bg-surface-secondary'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-content-primary text-xs">{c.authorName}</span>
                  <span className="text-xs text-content-faint">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-content-secondary whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>

          {/* Add comment */}
          <div className="flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && comment.trim()) {
                  addCommentMutation.mutate({ ticketId: ticket.id, content: comment.trim() });
                }
              }}
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface-page text-content-primary focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                if (comment.trim()) {
                  addCommentMutation.mutate({ ticketId: ticket.id, content: comment.trim() });
                }
              }}
              disabled={addCommentMutation.isLoading || !comment.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
