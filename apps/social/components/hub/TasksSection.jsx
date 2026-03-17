'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Skeleton } from '@/components/ui';

const PRIORITY_STYLES = {
  URGENT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  HIGH: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  MEDIUM: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  LOW: 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400',
};

const PRIORITY_LABELS = { URGENT: 'Urgent', HIGH: 'High', MEDIUM: 'Med', LOW: 'Low' };

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

function TaskRow({ task, onToggle, onDelete }) {
  const isDone = task.status === 'DONE';
  const overdue = !isDone && isOverdue(task.dueDate);
  const dueToday = !isDone && isToday(task.dueDate);
  const dueDateText = formatDueDate(task.dueDate);

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
      isDone ? 'bg-surface-secondary border-border-secondary opacity-60' : 'bg-surface-card border-border'
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
      <span className={`flex-1 text-sm truncate ${isDone ? 'line-through text-content-muted' : 'text-content-primary'}`}>
        {task.title}
      </span>

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
    <form onSubmit={handleSubmit} className="rounded-lg border border-blue-400 bg-surface-card p-3 space-y-2">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title..."
        className="w-full text-sm bg-transparent text-content-primary placeholder:text-content-faint outline-none"
      />
      <div className="flex items-center gap-2">
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
    onSuccess: () => utils.tasks.list.invalidate(),
  });
  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
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

  // Sort active: overdue first, then today, then upcoming, then no date
  activeTasks.sort((a, b) => {
    const aOverdue = isOverdue(a.dueDate);
    const bOverdue = isOverdue(b.dueDate);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    const aToday = isToday(a.dueDate);
    const bToday = isToday(b.dueDate);
    if (aToday && !bToday) return -1;
    if (!aToday && bToday) return 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    return 0;
  });

  return (
    <div className="bg-surface-card rounded-xl border border-border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          <h3 className="text-sm font-semibold text-content-primary">Tasks</h3>
          {activeTasks.length > 0 && (
            <span className="text-xs text-content-muted">({activeTasks.length})</span>
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
          {activeTasks.map(task => (
            <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
          ))}

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
