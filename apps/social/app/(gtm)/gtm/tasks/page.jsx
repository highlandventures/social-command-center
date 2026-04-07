'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

const statusLabels = { TODO: 'To Do', IN_PROGRESS: 'In Progress', BLOCKED: 'Blocked', DONE: 'Done' };

const statusIcon = {
  TODO: 'border-gray-300 dark:border-gray-600',
  IN_PROGRESS: 'border-blue-400 bg-blue-400/20',
  BLOCKED: 'border-red-400 bg-red-400/20',
  DONE: 'border-emerald-400 bg-emerald-400',
};

export default function MyTasksPage() {
  const [filter, setFilter] = useState('ACTIVE');
  const { data: tasks, isLoading } = trpc.gtmTasks.myTasks.useQuery({});
  const utils = trpc.useUtils();
  const updateTask = trpc.gtmTasks.update.useMutation({
    onSuccess: () => utils.gtmTasks.myTasks.invalidate(),
  });

  const activeTasks = (tasks || []).filter((t) => t.status !== 'DONE');
  const doneTasks = (tasks || []).filter((t) => t.status === 'DONE');
  const displayed = filter === 'ACTIVE' ? activeTasks : filter === 'DONE' ? doneTasks : (tasks || []);

  const toggleDone = (task) => {
    updateTask.mutate({
      id: task.id,
      status: task.status === 'DONE' ? 'TODO' : 'DONE',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-content-primary">My Tasks</h2>
        <p className="text-sm text-content-muted mt-0.5">
          {activeTasks.length} active across all projects
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-surface-secondary rounded-lg p-1 w-fit">
        {['ACTIVE', 'DONE', 'ALL'].map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === key
                ? 'bg-surface-card text-content-primary shadow-sm'
                : 'text-content-muted hover:text-content-secondary'
            }`}
          >
            {key === 'ACTIVE' ? `Active (${activeTasks.length})` :
             key === 'DONE' ? `Done (${doneTasks.length})` :
             `All (${(tasks || []).length})`}
          </button>
        ))}
      </div>

      {/* Tasks list */}
      {isLoading ? (
        <div className="bg-surface-card border border-border rounded-xl">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 border-b border-border animate-pulse">
              <div className="h-4 bg-skeleton rounded w-64 mb-2" />
              <div className="h-3 bg-skeleton rounded w-32" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl p-12 text-center">
          <p className="text-sm text-content-muted">
            {filter === 'ACTIVE' ? 'No active tasks. Nice work!' : 'No tasks found.'}
          </p>
        </div>
      ) : (
        <div className="bg-surface-card border border-border rounded-xl divide-y divide-border">
          {displayed.map((task) => (
            <div key={task.id} className="px-5 py-4 flex items-center gap-4 hover:bg-surface-hover/50 transition-colors">
              {/* Checkbox */}
              <button
                onClick={() => toggleDone(task)}
                className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${statusIcon[task.status]} hover:border-emerald-400`}
              />

              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${task.status === 'DONE' ? 'text-content-faint line-through' : 'text-content-primary'}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.project && (
                    <Link
                      href={`/gtm/projects/${task.project.id}`}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {task.project.name}
                    </Link>
                  )}
                  {task.project?.healthStatus && task.project.healthStatus !== 'ON_TRACK' && (
                    <span className={`text-[10px] px-1 rounded ${
                      task.project.healthStatus === 'AT_RISK' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {task.project.healthStatus === 'AT_RISK' ? 'At Risk' : 'Behind'}
                    </span>
                  )}
                </div>
              </div>

              {/* Priority */}
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                task.priority === 'HIGH' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {task.priority}
              </span>

              {/* Status */}
              {task.status !== 'DONE' && task.status !== 'TODO' && (
                <span className={`text-[10px] font-medium ${
                  task.status === 'IN_PROGRESS' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {statusLabels[task.status]}
                </span>
              )}

              {/* Due date */}
              {task.dueDate && (
                <span className={`text-xs whitespace-nowrap ${
                  new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                    ? 'text-red-600 dark:text-red-400 font-medium'
                    : 'text-content-faint'
                }`}>
                  {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
