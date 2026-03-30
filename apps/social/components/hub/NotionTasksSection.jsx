'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

// ─── Status badge colours ───────────────────────────────────────────────────

const STATUS_COLOURS = {
  'Not Started': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'Ready for Compliance': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'On Hold': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const COMPLIANCE_COLOURS = {
  'Not Needed': 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  'Legal Review': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'Not Started': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Comments Added': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Comments Addressed': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

const LEGAL_COLOURS = {
  'Not Needed': 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  'Not Started': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Comments Added': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Comments Addressed': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

function StatusBadge({ status }) {
  const cls = STATUS_COLOURS[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status || 'No status'}
    </span>
  );
}

function ComplianceBadge({ label, status, colourMap }) {
  if (!status || status === 'Not Needed') return null;
  const cls = colourMap[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>
      {label}: {status}
    </span>
  );
}

// ─── Synced indicator ───────────────────────────────────────────────────────

function SyncBadge({ synced }) {
  if (synced) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Synced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
      Pending sync
    </span>
  );
}

// ─── Database not-ready card ────────────────────────────────────────────────

function DatabaseNotReadyCard() {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-6 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl">
        📋
      </div>
      <h3 className="font-semibold text-content-primary mb-1">Task database not ready</h3>
      <p className="text-sm text-content-muted mb-4">
        Run the Prisma migration to set up the task inbox table, then redeploy.
      </p>
    </div>
  );
}

// ─── Task row ───────────────────────────────────────────────────────────────

function TaskRow({ task, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  const utils = trpc.useUtils();
  const updateMutation = trpc.notionTasks.update.useMutation({
    onSuccess: () => {
      utils.notionTasks.list.invalidate();
      setUpdating(false);
      onStatusChange?.();
    },
    onError: () => setUpdating(false),
  });

  function handleStatusChange(newStatus) {
    setUpdating(true);
    updateMutation.mutate({ taskId: task.id, status: newStatus });
  }

  const nextStatus = {
    'Not Started': 'In Progress',
    'In Progress': 'Ready for Compliance',
    'Ready for Compliance': 'Not Started',
    'On Hold': 'In Progress',
    Done: 'Not Started',
  };

  const actionLabel = {
    'Not Started': 'Start',
    'In Progress': 'Ready for L&C',
    'Ready for Compliance': 'Reopen',
    'On Hold': 'Resume',
    Done: 'Reopen',
  };

  const actionColor = {
    'Not Started': 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
    'In Progress': 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
    'Ready for Compliance': 'text-content-muted hover:bg-surface-hover',
    'On Hold': 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
    Done: 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20',
  };

  return (
    <div className="border-b border-border-secondary last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
      >
        <svg
          className={`w-4 h-4 mt-0.5 shrink-0 text-content-faint transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium truncate text-content-primary`}>
              {task.title || 'Untitled'}
            </span>
            <StatusBadge status={task.status} />
            <ComplianceBadge label="FLLLC" status={task.flllcComplianceStatus} colourMap={COMPLIANCE_COLOURS} />
            <ComplianceBadge label="FM" status={task.fmComplianceStatus} colourMap={COMPLIANCE_COLOURS} />
            <ComplianceBadge label="Legal" status={task.legalStatus} colourMap={LEGAL_COLOURS} />
            <SyncBadge synced={task.synced} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-content-muted">
            {task.due && <span>Due {task.due}</span>}
            {task.reviewPriority && <span>Priority: {task.reviewPriority}</span>}
            {task.product?.length > 0 && <span>{task.product.join(', ')}</span>}
            {task.company?.length > 0 && <span>{task.company.join(', ')}</span>}
          </div>
        </div>

        {/* Quick status action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleStatusChange(nextStatus[task.status] || 'In Progress');
          }}
          disabled={updating}
          className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${actionColor[task.status] || actionColor['Not Started']} ${updating ? 'opacity-50' : ''}`}
          title={`${actionLabel[task.status] || 'Update'} this task`}
        >
          {updating ? (
            <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            actionLabel[task.status] || 'Update'
          )}
        </button>

        {task.url && (
          <a
            href={task.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 p-1 rounded hover:bg-surface-hover text-content-faint hover:text-content-secondary transition-colors"
            title="Open in Notion"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 pl-11 space-y-2">
          {task.summary && (
            <p className="text-sm text-content-secondary">{task.summary}</p>
          )}
          {task.notes && (
            <p className="text-sm text-content-muted italic">{task.notes}</p>
          )}

          {/* Status actions row */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] font-medium text-content-muted uppercase tracking-wide mr-1">Move to:</span>
            {['Not Started', 'In Progress', 'Done', 'Ready for Compliance', 'On Hold'].filter((s) => s !== task.status).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={updating}
                className="px-2 py-1 rounded text-[11px] font-medium border border-border text-content-muted hover:text-content-secondary hover:border-border-emphasis transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-content-muted">
            {task.channel?.length > 0 && (
              <div>
                <span className="font-medium text-content-secondary">Channel:</span>{' '}
                {task.channel.join(', ')}
              </div>
            )}
            {task.audience?.length > 0 && (
              <div>
                <span className="font-medium text-content-secondary">Audience:</span>{' '}
                {task.audience.join(', ')}
              </div>
            )}
            {task.socialChannel?.length > 0 && (
              <div>
                <span className="font-medium text-content-secondary">Social:</span>{' '}
                {task.socialChannel.join(', ')}
              </div>
            )}
            {task.geo?.length > 0 && (
              <div>
                <span className="font-medium text-content-secondary">Geo:</span>{' '}
                {task.geo.join(', ')}
              </div>
            )}
            {task.editorialReviewStage && (
              <div>
                <span className="font-medium text-content-secondary">Editorial:</span>{' '}
                {task.editorialReviewStage}
              </div>
            )}
            {task.lcDueDate && (
              <div>
                <span className="font-medium text-content-secondary">L&C Due:</span>{' '}
                {task.lcDueDate}
              </div>
            )}
            {task.publishDate && (
              <div>
                <span className="font-medium text-content-secondary">Publish:</span>{' '}
                {task.publishDate}
              </div>
            )}
            {task.filedBy && (
              <div>
                <span className="font-medium text-content-secondary">Filed by:</span>{' '}
                {task.filedBy}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create task form ───────────────────────────────────────────────────────

function CreateTaskForm({ schema, onCreated }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [status, setStatus] = useState('');
  const [product, setProduct] = useState([]);
  const [channel, setChannel] = useState([]);
  const [audience, setAudience] = useState([]);
  const [socialChannel, setSocialChannel] = useState([]);
  const [company, setCompany] = useState([]);
  const [geo, setGeo] = useState([]);
  const [notes, setNotes] = useState('');
  const [reviewPriority, setReviewPriority] = useState('');
  const [editorialReviewStage, setEditorialReviewStage] = useState('');
  const [needComplianceApproval, setNeedComplianceApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const createMutation = trpc.notionTasks.create.useMutation({
    onSuccess: () => {
      setTitle('');
      setDue('');
      setStatus('');
      setProduct([]);
      setChannel([]);
      setAudience([]);
      setSocialChannel([]);
      setCompany([]);
      setGeo([]);
      setNotes('');
      setReviewPriority('');
      setEditorialReviewStage('');
      setNeedComplianceApproval(false);
      setOpen(false);
      setSubmitting(false);
      onCreated?.();
    },
    onError: () => setSubmitting(false),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    createMutation.mutate({
      title: title.trim(),
      status: status || undefined,
      due: due || undefined,
      product: product.length ? product : undefined,
      channel: channel.length ? channel : undefined,
      audience: audience.length ? audience : undefined,
      socialChannel: socialChannel.length ? socialChannel : undefined,
      company: company.length ? company : undefined,
      geo: geo.length ? geo : undefined,
      notes: notes.trim() || undefined,
      reviewPriority: reviewPriority || undefined,
      editorialReviewStage: editorialReviewStage || undefined,
      needComplianceApproval: needComplianceApproval || undefined,
    });
  }

  function toggleMulti(arr, setArr, val) {
    setArr((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors border border-dashed border-indigo-300 dark:border-indigo-700"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New Task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface-card p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-semibold text-content-primary">New Marketing Task</h4>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-content-faint hover:text-content-secondary text-xs"
        >
          Cancel
        </button>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task name *"
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-page text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-indigo-500"
        autoFocus
      />

      {/* Row: Status + Due + Review Priority */}
      <div className="grid grid-cols-3 gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-border bg-surface-page text-content-primary"
        >
          <option value="">Status</option>
          {schema?.status?.options?.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-border bg-surface-page text-content-primary"
        />
        <select
          value={reviewPriority}
          onChange={(e) => setReviewPriority(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-border bg-surface-page text-content-primary"
        >
          <option value="">Review Priority</option>
          {schema?.reviewPriority?.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {/* Row: Editorial Review Stage + Need Compliance Approval */}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={editorialReviewStage}
          onChange={(e) => setEditorialReviewStage(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-border bg-surface-page text-content-primary"
        >
          <option value="">Editorial Stage</option>
          {schema?.editorialReviewStage?.options?.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-2 py-1.5 text-xs text-content-primary cursor-pointer">
          <input
            type="checkbox"
            checked={needComplianceApproval}
            onChange={(e) => setNeedComplianceApproval(e.target.checked)}
            className="rounded border-border"
          />
          Need Compliance Approval
        </label>
      </div>

      {/* Product chips */}
      {schema?.product?.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-content-muted mb-1 uppercase tracking-wide">Product</p>
          <div className="flex flex-wrap gap-1">
            {schema.product.map((o) => (
              <button
                key={o.name}
                type="button"
                onClick={() => toggleMulti(product, setProduct, o.name)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                  product.includes(o.name)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-surface-page text-content-muted border-border hover:border-indigo-400'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Channel chips */}
      {schema?.channel?.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-content-muted mb-1 uppercase tracking-wide">Channel</p>
          <div className="flex flex-wrap gap-1">
            {schema.channel.map((o) => (
              <button
                key={o.name}
                type="button"
                onClick={() => toggleMulti(channel, setChannel, o.name)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                  channel.includes(o.name)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-surface-page text-content-muted border-border hover:border-indigo-400'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audience chips */}
      {schema?.audience?.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-content-muted mb-1 uppercase tracking-wide">Audience</p>
          <div className="flex flex-wrap gap-1">
            {schema.audience.map((o) => (
              <button
                key={o.name}
                type="button"
                onClick={() => toggleMulti(audience, setAudience, o.name)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                  audience.includes(o.name)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-surface-page text-content-muted border-border hover:border-indigo-400'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Social Channel chips */}
      {schema?.socialChannel?.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-content-muted mb-1 uppercase tracking-wide">Social Channel</p>
          <div className="flex flex-wrap gap-1">
            {schema.socialChannel.map((o) => (
              <button
                key={o.name}
                type="button"
                onClick={() => toggleMulti(socialChannel, setSocialChannel, o.name)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                  socialChannel.includes(o.name)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-surface-page text-content-muted border-border hover:border-indigo-400'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Company chips */}
      {schema?.company?.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-content-muted mb-1 uppercase tracking-wide">Company</p>
          <div className="flex flex-wrap gap-1">
            {schema.company.map((o) => (
              <button
                key={o.name}
                type="button"
                onClick={() => toggleMulti(company, setCompany, o.name)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                  company.includes(o.name)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-surface-page text-content-muted border-border hover:border-indigo-400'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Geo chips */}
      {schema?.geo?.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-content-muted mb-1 uppercase tracking-wide">Geo</p>
          <div className="flex flex-wrap gap-1">
            {schema.geo.map((o) => (
              <button
                key={o.name}
                type="button"
                onClick={() => toggleMulti(geo, setGeo, o.name)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                  geo.includes(o.name)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-surface-page text-content-muted border-border hover:border-indigo-400'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-page text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />

      {/* Submit */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-content-faint">
          Tasks sync to Marketing Tasks via Notion automation
        </p>
        <button
          type="submit"
          disabled={!title.trim() || submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Filing...' : 'File Task'}
        </button>
      </div>

      {createMutation.error && (
        <p className="text-xs text-red-500">{createMutation.error.message}</p>
      )}
    </form>
  );
}

// ─── Status filter tabs ─────────────────────────────────────────────────────

function StatusTabs({ options, active, onChange }) {
  const tabs = [{ name: 'All', value: '' }, ...options.map((o) => ({ name: o.name, value: o.name }))];
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            active === tab.value
              ? 'bg-indigo-600 text-white'
              : 'bg-surface-hover text-content-muted hover:text-content-secondary'
          }`}
        >
          {tab.name}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function NotionTasksSection() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data: connStatus, isLoading: connLoading } = trpc.notionTasks.connectionStatus.useQuery(
    undefined,
    { staleTime: 60_000 }
  );

  const { data: schema } = trpc.notionTasks.schema.useQuery(undefined, {
    staleTime: 300_000,
    enabled: connStatus?.connected === true,
  });

  const utils = trpc.useUtils();

  const {
    data: taskData,
    isLoading: tasksLoading,
    isFetching,
  } = trpc.notionTasks.list.useQuery(
    { status: statusFilter || undefined, pageSize: 25 },
    {
      staleTime: 300_000, // 5 min acceptable staleness
      enabled: connStatus?.connected === true,
    }
  );

  function handleCreated() {
    utils.notionTasks.list.invalidate();
  }

  // ── Not connected ──
  if (connLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface-card p-6">
        <div className="flex items-center gap-2 text-content-muted text-sm">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Loading task inbox...
        </div>
      </div>
    );
  }

  if (!connStatus?.connected) {
    return <DatabaseNotReadyCard />;
  }

  // ── Connected ──
  return (
    <div className="space-y-4">
      {/* Create task */}
      <CreateTaskForm schema={schema} onCreated={handleCreated} />

      {/* Filter tabs */}
      {schema?.status?.options?.length > 0 && (
        <StatusTabs options={schema.status.options} active={statusFilter} onChange={setStatusFilter} />
      )}

      {/* Task list */}
      <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-content-primary">
            Task Inbox
          </h3>
          {isFetching && !tasksLoading && (
            <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {tasksLoading ? (
          <div className="px-4 py-8 text-center text-sm text-content-muted">
            <div className="w-5 h-5 mx-auto mb-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Loading tasks...
          </div>
        ) : !taskData?.tasks?.length ? (
          <div className="px-4 py-8 text-center text-sm text-content-muted">
            No tasks found{statusFilter ? ` with status "${statusFilter}"` : ''}. File your first task above!
          </div>
        ) : (
          <div>
            {taskData.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
            {taskData.hasMore && (
              <div className="px-4 py-3 text-center">
                <span className="text-xs text-content-faint">
                  Showing {taskData.tasks.length} tasks
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
