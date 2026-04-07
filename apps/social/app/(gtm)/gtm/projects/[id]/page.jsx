'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';
import AssigneePicker from '@/components/gtm/AssigneePicker';

const healthColors = {
  ON_TRACK: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  AT_RISK: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  BEHIND: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const healthLabels = { ON_TRACK: 'On Track', AT_RISK: 'At Risk', BEHIND: 'Behind' };

const categoryBadge = {
  GTM: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  EVERGREEN: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  OPERATIONS: 'bg-gray-50 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

function CategoryPicker({ current, onSelect }) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`px-2 py-0.5 text-[10px] font-semibold rounded border cursor-pointer transition-colors hover:opacity-80 ${categoryBadge[current]}`}
      >
        {current}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-36 bg-surface-card border border-border rounded-lg shadow-lg overflow-hidden">
          {['GTM', 'EVERGREEN', 'OPERATIONS'].map((cat) => (
            <button
              key={cat}
              onClick={() => { onSelect(cat); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-hover transition-colors ${current === cat ? 'bg-surface-secondary' : ''}`}
            >
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${categoryBadge[cat]}`}>{cat}</span>
              {current === cat && (
                <svg className="w-3 h-3 text-blue-500 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const taskStatusColors = {
  TODO: 'border-gray-300 dark:border-gray-600',
  IN_PROGRESS: 'border-blue-400 bg-blue-400/20',
  BLOCKED: 'border-red-400 bg-red-400/20',
  DONE: 'border-emerald-400 bg-emerald-400',
};

const momentTypeColors = {
  LAUNCH: 'bg-blue-500',
  TENTPOLE: 'bg-purple-500',
  EVENT: 'bg-emerald-500',
  CAMPAIGN: 'bg-amber-500',
  MILESTONE: 'bg-gray-400',
  ACTIVATION: 'bg-pink-400',
};

const NEXT_STATUS = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  BLOCKED: 'TODO',
  DONE: 'TODO',
};

function AddGtmTaskForm({ projectId, members, onCreated }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [ownerId, setOwnerId] = useState(null);
  const [ownerObj, setOwnerObj] = useState(null);

  const createTask = trpc.gtmTasks.create.useMutation({
    onSuccess: () => {
      onCreated();
      setTitle('');
      setDueDate('');
      setPriority('MEDIUM');
      setOwnerId(null);
      setOwnerObj(null);
      setExpanded(false);
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    createTask.mutate({
      projectId,
      title: title.trim(),
      priority,
      ...(ownerId ? { ownerId } : {}),
      ...(dueDate ? { dueDate } : {}),
    });
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-2 text-sm text-content-muted hover:text-blue-600 dark:hover:text-blue-400 px-5 py-3 transition-colors"
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
    <form onSubmit={handleSubmit} onKeyDown={(e) => e.key === 'Escape' && setExpanded(false)} className="px-5 py-3 space-y-2 border-t border-border">
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
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="text-xs bg-surface-secondary text-content-secondary rounded px-2 py-1 border border-border outline-none"
        />
        <AssigneePicker
          currentOwner={ownerObj}
          members={members}
          onSelect={(id) => {
            setOwnerId(id);
            setOwnerObj(members.find((m) => m.id === id) || null);
          }}
        />
        <div className="flex-1" />
        <button type="button" onClick={() => setExpanded(false)} className="text-xs text-content-muted hover:text-content-primary">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || createTask.isLoading}
          className="text-xs font-medium bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </div>
    </form>
  );
}

export default function ProjectBriefPage() {
  const { id } = useParams();
  const utils = trpc.useUtils();
  const { data: project, isLoading } = trpc.gtmProjects.byId.useQuery({ id });
  const { data: members } = trpc.team.members.useQuery();

  const updateProject = trpc.gtmProjects.update.useMutation({
    onSuccess: () => {
      utils.gtmProjects.byId.invalidate({ id });
      utils.gtmProjects.list.invalidate();
    },
  });

  const updateTask = trpc.gtmTasks.update.useMutation({
    onSuccess: () => {
      utils.gtmProjects.byId.invalidate({ id });
      utils.tasks.list.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 bg-skeleton rounded w-64 mb-2" />
        <div className="h-4 bg-skeleton rounded w-96" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-card border border-border rounded-xl p-5">
              <div className="h-3 bg-skeleton rounded w-20 mb-2" />
              <div className="h-6 bg-skeleton rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-content-muted">Project not found.</p>
        <Link href="/gtm/projects" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          Back to Projects
        </Link>
      </div>
    );
  }

  const startStr = new Date(project.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const endStr = new Date(project.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const tasksByStatus = {
    TODO: project.tasks.filter((t) => t.status === 'TODO'),
    IN_PROGRESS: project.tasks.filter((t) => t.status === 'IN_PROGRESS'),
    BLOCKED: project.tasks.filter((t) => t.status === 'BLOCKED'),
    DONE: project.tasks.filter((t) => t.status === 'DONE'),
  };

  const tasksDone = tasksByStatus.DONE.length;
  const tasksTotal = project.tasks.length;
  const progressPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Breadcrumb + header */}
      <div>
        <Link href="/gtm/projects" className="text-xs text-content-faint hover:text-content-muted transition-colors">
          Projects
        </Link>
        <span className="text-xs text-content-faint mx-1.5">/</span>
        <span className="text-xs text-content-muted">{project.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-content-primary">{project.name}</h1>
            <CategoryPicker
              current={project.category}
              onSelect={(category) => updateProject.mutate({ id, category })}
            />
            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${healthColors[project.healthStatus]}`}>
              {healthLabels[project.healthStatus]}
            </span>
          </div>
          {project.description && (
            <p className="text-sm text-content-muted max-w-2xl">{project.description}</p>
          )}
        </div>
        {project.googleDocUrl && (
          <a
            href={project.googleDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-surface-card border border-border rounded-lg text-sm text-content-secondary hover:bg-surface-hover transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Project Doc
          </a>
        )}
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-card border border-border rounded-xl p-4">
          <p className="text-[10px] font-medium text-content-faint uppercase tracking-wider mb-1">Owner</p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
              {(project.owner?.name?.[0] || 'U').toUpperCase()}
            </div>
            <p className="text-sm font-medium text-content-primary truncate">{project.owner?.name || project.owner?.email}</p>
          </div>
        </div>
        <div className="bg-surface-card border border-border rounded-xl p-4">
          <p className="text-[10px] font-medium text-content-faint uppercase tracking-wider mb-1">Timeline</p>
          <p className="text-sm font-medium text-content-primary">{startStr}</p>
          <p className="text-xs text-content-muted">to {endStr}</p>
        </div>
        <div className="bg-surface-card border border-border rounded-xl p-4">
          <p className="text-[10px] font-medium text-content-faint uppercase tracking-wider mb-1">Progress</p>
          <p className="text-sm font-medium text-content-primary">{tasksDone}/{tasksTotal} tasks</p>
          <div className="mt-1.5 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="bg-surface-card border border-border rounded-xl p-4">
          <p className="text-[10px] font-medium text-content-faint uppercase tracking-wider mb-1">Moments</p>
          <p className="text-2xl font-bold text-content-primary">{project.moments.length}</p>
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-surface-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-content-primary">Tasks</h2>
        </div>
        {tasksTotal === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-content-muted">
            No tasks yet. Add one below.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {project.tasks.map((task) => (
              <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                <button
                  onClick={() => updateTask.mutate({ id: task.id, status: NEXT_STATUS[task.status] })}
                  className={`w-3 h-3 rounded-full border-2 shrink-0 cursor-pointer transition-colors ${taskStatusColors[task.status]}`}
                  title={`${task.status} → ${NEXT_STATUS[task.status]}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${task.status === 'DONE' ? 'text-content-faint line-through' : 'text-content-primary'}`}>
                    {task.title}
                  </p>
                </div>
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                  task.priority === 'HIGH' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                  task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {task.priority}
                </span>
                <AssigneePicker
                  currentOwner={task.owner}
                  members={members || []}
                  onSelect={(ownerId) => updateTask.mutate({ id: task.id, ownerId })}
                />
                {task.dueDate && (
                  <span className="text-[10px] text-content-faint whitespace-nowrap">
                    {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <AddGtmTaskForm
          projectId={id}
          members={members || []}
          onCreated={() => utils.gtmProjects.byId.invalidate({ id })}
        />
      </div>

      {/* Moments timeline */}
      {project.moments.length > 0 && (
        <div className="bg-surface-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-content-primary">Moments</h2>
          </div>
          <div className="divide-y divide-border">
            {project.moments.map((m) => (
              <div key={m.id} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${momentTypeColors[m.type]}`} />
                  <p className="text-sm text-content-primary flex-1">{m.label}</p>
                  <span className="text-[10px] text-content-faint uppercase">{m.type}</span>
                  <span className="text-xs text-content-muted">
                    {m.date
                      ? new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : `${new Date(m.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(m.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    }
                  </span>
                </div>
                {/* Child moments (activations) */}
                {m.childMoments && m.childMoments.length > 0 && (
                  <div className="ml-8 mt-2 space-y-1.5">
                    {m.childMoments.map((child) => (
                      <div key={child.id} className="flex items-center gap-2 text-xs text-content-muted">
                        <span className={`w-1.5 h-1.5 rounded-full ${momentTypeColors[child.type] || 'bg-gray-400'}`} />
                        <span>{child.label}</span>
                        {child.date && (
                          <span className="text-content-faint">
                            {new Date(child.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
