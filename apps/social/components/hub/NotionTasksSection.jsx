'use client';

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc-client';

// ─── Status badge colours ───────────────────────────────────────────────────

const STATUS_COLOURS = {
  'Not Started': 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  'In Progress': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  Done: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  'Ready for Compliance': 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800',
  'On Hold': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
};

const COMPLIANCE_COLOURS = {
  'Not Needed': null,
  'Legal Review': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'Not Started': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Comments Added': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Comments Addressed': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

const LEGAL_COLOURS = {
  'Not Needed': null,
  'Not Started': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Comments Added': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Comments Addressed': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

function StatusBadge({ status }) {
  const cls = STATUS_COLOURS[status] || 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {status || 'No status'}
    </span>
  );
}

function ComplianceBadge({ label, status, colourMap }) {
  if (!status || status === 'Not Needed') return null;
  const cls = colourMap[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${cls}`}>
      <span className="opacity-60">{label}:</span> {status}
    </span>
  );
}

// ─── Multi-select dropdown ──────────────────────────────────────────────────

function MultiSelectDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function toggle(opt) {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs w-full text-left border border-border bg-surface-page transition-colors ${
          selected.length > 0 ? 'text-content-primary' : 'text-content-faint'
        }`}
      >
        <span className="flex-1 truncate">
          {selected.length === 0 ? label : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        <svg className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg shadow-xl border border-border bg-surface-card overflow-hidden max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={typeof opt === 'string' ? opt : opt.name}
              type="button"
              onClick={() => toggle(typeof opt === 'string' ? opt : opt.name)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-hover transition-colors ${
                selected.includes(typeof opt === 'string' ? opt : opt.name) ? 'text-content-primary' : 'text-content-muted'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-sm shrink-0 flex items-center justify-center ${
                selected.includes(typeof opt === 'string' ? opt : opt.name)
                  ? 'bg-blue-500'
                  : 'border border-border'
              }`}>
                {selected.includes(typeof opt === 'string' ? opt : opt.name) && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              {typeof opt === 'string' ? opt : opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
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

// ─── Task row (table-like layout) ──────────────────────────────────────────

function TaskRow({ task }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  const utils = trpc.useUtils();
  const updateMutation = trpc.notionTasks.update.useMutation({
    onSuccess: () => {
      utils.notionTasks.list.invalidate();
      setUpdating(false);
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
    'Not Started': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'In Progress': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Ready for Compliance': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    'On Hold': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    Done: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-hover transition-colors border-b border-border-secondary last:border-b-0"
      >
        {/* Status */}
        <div className="w-[100px] shrink-0">
          <StatusBadge status={task.status} />
        </div>

        {/* Title */}
        <span className={`text-sm flex-1 truncate ${
          task.status === 'Done'
            ? 'line-through text-content-faint'
            : 'font-medium text-content-primary'
        }`}>
          {task.title || 'Untitled'}
        </span>

        {/* Compliance badges */}
        <div className="flex items-center gap-1 shrink-0">
          <ComplianceBadge label="FLLLC" status={task.flllcComplianceStatus} colourMap={COMPLIANCE_COLOURS} />
          <ComplianceBadge label="FM" status={task.fmComplianceStatus} colourMap={COMPLIANCE_COLOURS} />
          <ComplianceBadge label="Legal" status={task.legalStatus} colourMap={LEGAL_COLOURS} />
        </div>

        {/* Due date */}
        <span className="text-xs text-content-muted shrink-0 tabular-nums w-[50px] text-right">
          {task.due || '—'}
        </span>

        {/* Sync indicator */}
        <span className="shrink-0 w-3">
          {task.synced ? (
            <svg className="w-3 h-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-content-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </span>

        {/* Chevron */}
        <svg
          className={`w-3.5 h-3.5 shrink-0 text-content-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 py-3 border-b border-border-secondary bg-surface-page space-y-2">
          {task.summary && (
            <p className="text-sm text-content-secondary">{task.summary}</p>
          )}
          {task.notes && (
            <p className="text-sm text-content-muted italic">{task.notes}</p>
          )}

          {/* Metadata tags */}
          <div className="flex flex-wrap gap-1.5">
            {task.product?.map((p) => (
              <span key={p} className="text-[10px] px-2 py-0.5 rounded border border-border bg-surface-card text-content-muted">{p}</span>
            ))}
            {task.channel?.map((c) => (
              <span key={c} className="text-[10px] px-2 py-0.5 rounded border border-border bg-surface-card text-content-muted">{c}</span>
            ))}
            {task.company?.map((c) => (
              <span key={c} className="text-[10px] px-2 py-0.5 rounded border border-border bg-surface-card text-content-faint">{c}</span>
            ))}
            {task.audience?.map((a) => (
              <span key={a} className="text-[10px] px-2 py-0.5 rounded border border-border bg-surface-card text-content-faint">{a}</span>
            ))}
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex flex-wrap gap-3 text-[10px] text-content-faint">
              {task.filedBy && <span>Filed by {task.filedBy}</span>}
              {task.lcDueDate && <span>L&C due {task.lcDueDate}</span>}
              {task.publishDate && <span>Publish {task.publishDate}</span>}
              {task.editorialReviewStage && <span>Editorial: {task.editorialReviewStage}</span>}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Quick status action */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(nextStatus[task.status] || 'In Progress');
                }}
                disabled={updating}
                className={`text-[10px] font-medium px-2.5 py-1 rounded transition-colors disabled:opacity-50 ${actionColor[task.status] || actionColor['Not Started']}`}
              >
                {updating ? (
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  actionLabel[task.status] || 'Update'
                )}
              </button>

              {/* All status options */}
              {['Not Started', 'In Progress', 'Done', 'Ready for Compliance', 'On Hold']
                .filter((s) => s !== task.status && s !== nextStatus[task.status])
                .map((s) => (
                  <button
                    key={s}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(s);
                    }}
                    disabled={updating}
                    className="px-2 py-1 rounded text-[10px] font-medium border border-border text-content-faint hover:text-content-secondary hover:border-border-emphasis transition-colors disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}

              {/* Open in Notion */}
              {task.url && (
                <a
                  href={task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded hover:bg-surface-hover text-content-faint hover:text-content-secondary transition-colors"
                  title="Open in Notion"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New task modal ─────────────────────────────────────────────────────────

function NewTaskModal({ schema, onClose, onCreated }) {
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
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const createMutation = trpc.notionTasks.create.useMutation({
    onSuccess: () => {
      setSubmitting(false);
      onCreated?.();
      onClose();
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl shadow-2xl border border-border bg-surface-card"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-content-primary">New Marketing Task</h2>
          <button type="button" onClick={onClose} className="text-content-faint hover:text-content-secondary transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task name *"
            className="w-full text-sm rounded-lg px-3 py-2.5 border border-border bg-surface-page text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Essential fields row */}
          <div className="grid grid-cols-3 gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-xs rounded-md px-2 py-2 border border-border bg-surface-page text-content-primary"
            >
              <option value="">Status</option>
              {schema?.status?.options?.map((o) => (
                <option key={o.name} value={o.name}>{o.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="text-xs rounded-md px-2 py-2 border border-border bg-surface-page text-content-primary"
            />
            <select
              value={reviewPriority}
              onChange={(e) => setReviewPriority(e.target.value)}
              className="text-xs rounded-md px-2 py-2 border border-border bg-surface-page text-content-primary"
            >
              <option value="">Priority</option>
              {schema?.reviewPriority?.map((o) => (
                <option key={o.name} value={o.name}>{o.name}</option>
              ))}
            </select>
          </div>

          {/* Editorial + compliance */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={editorialReviewStage}
              onChange={(e) => setEditorialReviewStage(e.target.value)}
              className="text-xs rounded-md px-2 py-2 border border-border bg-surface-page text-content-primary"
            >
              <option value="">Editorial Stage</option>
              {schema?.editorialReviewStage?.options?.map((o) => (
                <option key={o.name} value={o.name}>{o.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 px-2 py-1.5 text-xs text-content-primary cursor-pointer">
              <input
                type="checkbox"
                checked={needComplianceApproval}
                onChange={(e) => setNeedComplianceApproval(e.target.checked)}
                className="rounded border-border"
              />
              Needs compliance approval
            </label>
          </div>

          {/* Collapsible details */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 text-xs text-content-faint hover:text-content-muted transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {showDetails ? 'Hide' : 'Add'} details (product, channel, audience, company)
          </button>

          {showDetails && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {schema?.product?.length > 0 && (
                <MultiSelectDropdown label="Product" options={schema.product} selected={product} onChange={setProduct} />
              )}
              {schema?.channel?.length > 0 && (
                <MultiSelectDropdown label="Channel" options={schema.channel} selected={channel} onChange={setChannel} />
              )}
              {schema?.audience?.length > 0 && (
                <MultiSelectDropdown label="Audience" options={schema.audience} selected={audience} onChange={setAudience} />
              )}
              {schema?.company?.length > 0 && (
                <MultiSelectDropdown label="Company" options={schema.company} selected={company} onChange={setCompany} />
              )}
              {schema?.socialChannel?.length > 0 && (
                <MultiSelectDropdown label="Social Channel" options={schema.socialChannel} selected={socialChannel} onChange={setSocialChannel} />
              )}
              {schema?.geo?.length > 0 && (
                <MultiSelectDropdown label="Geo" options={schema.geo} selected={geo} onChange={setGeo} />
              )}
            </div>
          )}

          {/* Notes */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full text-xs rounded-lg px-3 py-2 border border-border bg-surface-page text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <span className="text-[10px] text-content-faint">Syncs to Notion automatically</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 rounded-md text-content-muted hover:bg-surface-hover transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="text-xs font-medium px-4 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Filing...' : 'File Task'}
            </button>
          </div>
        </div>

        {createMutation.error && (
          <p className="px-5 pb-3 text-xs text-red-500">{createMutation.error.message}</p>
        )}
      </form>
    </div>
  );
}

// ─── Status filter tabs ─────────────────────────────────────────────────────

function StatusTabs({ options, active, onChange, taskCounts }) {
  const tabs = [{ name: 'All', value: '' }, ...options.map((o) => ({ name: o.name, value: o.name }))];
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const count = taskCounts?.[tab.value] ?? 0;
        // Hide zero-count tabs (except All)
        if (tab.value && count === 0) return null;
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-surface-card text-content-primary border border-border'
                : 'text-content-faint border border-transparent hover:text-content-muted'
            }`}
          >
            {tab.name}
            {count > 0 && <span className="text-content-faint ml-1">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function NotionTasksSection() {
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

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
      staleTime: 300_000,
      enabled: connStatus?.connected === true,
    }
  );

  // Count tasks per status for tab badges
  const { data: allTaskData } = trpc.notionTasks.list.useQuery(
    { pageSize: 100 },
    {
      staleTime: 300_000,
      enabled: connStatus?.connected === true,
    }
  );

  const taskCounts = {};
  if (allTaskData?.tasks) {
    taskCounts[''] = allTaskData.tasks.length;
    allTaskData.tasks.forEach((t) => {
      taskCounts[t.status] = (taskCounts[t.status] || 0) + 1;
    });
  }

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-content-primary">L&C Review</h2>
          <p className="text-xs text-content-muted mt-0.5">File tasks for legal & compliance review</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Task
        </button>
      </div>

      {/* Filter tabs */}
      {schema?.status?.options?.length > 0 && (
        <StatusTabs
          options={schema.status.options}
          active={statusFilter}
          onChange={setStatusFilter}
          taskCounts={taskCounts}
        />
      )}

      {/* Task list */}
      <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-page">
          <span className="text-[10px] uppercase tracking-wider font-medium text-content-faint w-[100px]">Status</span>
          <span className="text-[10px] uppercase tracking-wider font-medium text-content-faint flex-1">Task</span>
          <span className="text-[10px] uppercase tracking-wider font-medium text-content-faint">Compliance</span>
          <span className="text-[10px] uppercase tracking-wider font-medium text-content-faint w-[50px] text-right">Due</span>
          <span className="w-3" />
          <span className="w-3.5" />
        </div>

        {isFetching && !tasksLoading && (
          <div className="flex justify-center py-1">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {tasksLoading ? (
          <div className="px-4 py-8 text-center text-sm text-content-muted">
            <div className="w-5 h-5 mx-auto mb-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Loading tasks...
          </div>
        ) : !taskData?.tasks?.length ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-content-muted">
              No tasks{statusFilter ? ` with status "${statusFilter}"` : ''}
            </p>
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

      {/* Modal */}
      {showModal && (
        <NewTaskModal
          schema={schema}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
