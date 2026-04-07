'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';
import { Skeleton } from '@/components/ui';

const PRIORITY_STYLES = {
  URGENT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  HIGH: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  MEDIUM: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  LOW: 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400',
};

const PRIORITY_LABELS = { URGENT: 'Urgent', HIGH: 'High', MEDIUM: 'Med', LOW: 'Low' };

const PRIORITY_WEIGHT = { URGENT: 100, HIGH: 60, MEDIUM: 30, LOW: 10 };

function timeBonus(dueDate) {
  if (!dueDate) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d - now) / 86400000);
  if (diffDays < 0) return Math.min(50 + Math.abs(diffDays) * 2, 70); // overdue
  if (diffDays === 0) return 40; // today
  if (diffDays === 1) return 20; // tomorrow
  if (diffDays <= 7) return 10; // this week
  return 0;
}

function scoreAndBucket(activeTasks) {
  const scored = activeTasks.map(t => ({
    ...t,
    _score: (PRIORITY_WEIGHT[t.priority] || 10) + timeBonus(t.dueDate),
  }));

  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    // Ties: earlier due date first
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    // Then newer first
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Spotlight: top task only if score >= 60 (at least HIGH or overdue MEDIUM)
  let spotlight = null;
  let rest = scored;
  if (scored.length > 0 && scored[0]._score >= 60) {
    spotlight = scored[0];
    rest = scored.slice(1);
  }

  const upNext = rest.slice(0, 3);
  const quickWins = rest.slice(3, 6);
  const overflow = rest.slice(6);

  return { spotlight, upNext, quickWins, overflow };
}

function isOverdue(dueDate) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

function isToday(dueDate) {
  if (!dueDate) return false;
  const today = new Date();
  const d = new Date(dueDate);
  return d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate();
}

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (isToday(dueDate)) return 'Today';
  if (isOverdue(dueDate)) {
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return `${days}d overdue`;
  }
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days <= 7) return `in ${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SoftDivider({ label }) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-content-faint">{label}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete, spotlight }) {
  const isDone = task.status === 'DONE';
  const overdue = !isDone && isOverdue(task.dueDate);
  const dueToday = !isDone && isToday(task.dueDate);
  const dueDateText = formatDueDate(task.dueDate);

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
      isDone
        ? 'bg-surface-secondary border-border-secondary opacity-60'
        : spotlight
          ? 'bg-blue-50/40 dark:bg-blue-900/10 border-border border-l-4 border-l-blue-500'
          : 'bg-surface-card border-border'
    }`}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id, isDone)}
        className={`flex-shrink-0 w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-colors ${
          isDone
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-content-muted hover:border-blue-500'
        }`}
        style={{ width: 18, height: 18 }}
      >
        {isDone && (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        {task.source === 'gtm' && task.projectId ? (
          <Link href={`/gtm/projects/${task.projectId}`} className={`block truncate ${isDone ? 'text-sm line-through text-content-muted' : spotlight ? 'text-base font-medium text-content-primary hover:text-blue-600 dark:hover:text-blue-400' : 'text-sm text-content-primary hover:text-blue-600 dark:hover:text-blue-400'}`}>
            {task.title}
          </Link>
        ) : (
          <span className={`block truncate ${isDone ? 'text-sm line-through text-content-muted' : spotlight ? 'text-base font-medium text-content-primary' : 'text-sm text-content-primary'}`}>
            {task.title}
          </span>
        )}
        {task.projectName && !isDone && (
          <span className="text-[10px] text-content-faint truncate block">{task.projectName}</span>
        )}
      </div>

      {/* Priority badge */}
      {!isDone && (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_STYLES[task.priority]}`}>
          {PRIORITY_LABELS[task.priority]}
        </span>
      )}

      {/* Due date */}
      {dueDateText && !isDone && (
        <span className={`text-xs whitespace-nowrap ${
          overdue ? 'text-red-600 dark:text-red-400 font-medium' :
          dueToday ? 'text-amber-600 dark:text-amber-400 font-medium' :
          'text-content-muted'
        }`}>
          {dueDateText}
        </span>
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        className="flex-shrink-0 text-content-faint hover:text-red-500 transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function AddTaskForm({ onAdd }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [expanded, setExpanded] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
    });
    setTitle('');
    setDueDate('');
    setPriority('MEDIUM');
    setExpanded(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setExpanded(false);
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-2 text-sm text-content-muted hover:text-blue-600 dark:hover:text-blue-400 rounded-lg border border-dashed border-border hover:border-blue-400 px-3 py-2 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="rounded-lg border border-blue-400 bg-surface-card p-3 space-y-2">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title..."
        className="w-full text-sm bg-transparent text-content-primary placeholder:text-content-faint outline-none"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="text-xs bg-surface-secondary text-content-secondary rounded px-2 py-1 border border-border outline-none"
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="text-xs bg-surface-secondary text-content-secondary rounded px-2 py-1 border border-border outline-none"
        />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-content-muted hover:text-content-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim()}
          className="text-xs font-medium bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </div>
    </form>
  );
}

export default function TasksSection() {
  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery({}, { staleTime: 30_000 });

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
  });
  const updateMutation = trpc.tasks.update.useMutation({
    onMutate: async (newData) => {
      await utils.tasks.list.cancel();
      const prev = utils.tasks.list.getData({});
      utils.tasks.list.setData({}, (old) =>
        (old || []).map(t => t.id === newData.id ? {
          ...t,
          ...newData,
          completedAt: newData.status === 'DONE' ? new Date() : newData.status ? null : t.completedAt,
        } : t)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.tasks.list.setData({}, context.prev);
    },
    onSettled: () => utils.tasks.list.invalidate(),
  });
  const deleteMutation = trpc.tasks.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.tasks.list.cancel();
      const prev = utils.tasks.list.getData({});
      utils.tasks.list.setData({}, (old) => (old || []).filter(t => t.id !== id));
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.tasks.list.setData({}, context.prev);
    },
    onSettled: () => utils.tasks.list.invalidate(),
  });

  const [showCompleted, setShowCompleted] = useState(false);

  function handleAdd(taskData) {
    createMutation.mutate(taskData);
  }

  function handleToggle(id, currentlyDone) {
    updateMutation.mutate({
      id,
      status: currentlyDone ? 'TODO' : 'DONE',
    });
  }

  function handleDelete(id) {
    deleteMutation.mutate({ id });
  }

  const activeTasks = (tasks || []).filter(t => t.status !== 'DONE');
  const completedTasks = (tasks || []).filter(t => t.status === 'DONE');

  const { spotlight, upNext, quickWins, overflow } = scoreAndBucket(activeTasks);
  const [showOverflow, setShowOverflow] = useState(false);
  const visibleCount = (spotlight ? 1 : 0) + upNext.length + quickWins.length;

  return (
    <div className="bg-surface-card rounded-xl border border-border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          <h3 className="text-sm font-semibold text-content-primary">Today&apos;s Focus</h3>
          {visibleCount > 0 && (
            <span className="text-xs text-content-muted">({visibleCount}{overflow.length > 0 ? `+${overflow.length}` : ''})</span>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-12 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Task list */}
      {!isLoading && (
        <div className="space-y-2">
          {activeTasks.length === 0 && completedTasks.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-content-muted">No tasks yet</p>
              <p className="text-xs text-content-faint mt-0.5">Add one to get started</p>
            </div>
          )}

          {/* Spotlight: #1 priority task */}
          {spotlight && (
            <TaskRow key={spotlight.id} task={spotlight} spotlight onToggle={handleToggle} onDelete={handleDelete} />
          )}

          {/* Up next: secondary goals */}
          {upNext.length > 0 && (spotlight || quickWins.length > 0) && <SoftDivider label="Up next" />}
          {upNext.map(task => (
            <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
          ))}

          {/* Quick wins: small tasks */}
          {quickWins.length > 0 && <SoftDivider label="Quick wins" />}
          {quickWins.map(task => (
            <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
          ))}

          {/* Overflow: hidden behind toggle */}
          {overflow.length > 0 && (
            <>
              <button
                onClick={() => setShowOverflow(!showOverflow)}
                className="w-full text-xs text-content-muted hover:text-content-secondary flex items-center gap-1 pt-2"
              >
                <svg className={`w-3 h-3 transition-transform ${showOverflow ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {overflow.length} more {overflow.length === 1 ? 'task' : 'tasks'}
              </button>
              {showOverflow && (
                <div className="space-y-2 mt-1">
                  {overflow.map(task => (
                    <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </>
          )}

          <AddTaskForm onAdd={handleAdd} />

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-xs text-content-muted hover:text-content-secondary flex items-center gap-1"
              >
                <svg className={`w-3 h-3 transition-transform ${showCompleted ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {completedTasks.length} completed
              </button>
              {showCompleted && (
                <div className="space-y-1 mt-2">
                  {completedTasks.map(task => (
                    <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
