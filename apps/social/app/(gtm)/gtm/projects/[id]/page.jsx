'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';

const healthColors = {
  ON_TRACK: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  AT_RISK: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  BEHIND: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const healthLabels = { ON_TRACK: 'On Track', AT_RISK: 'At Risk', BEHIND: 'Behind' };

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

export default function ProjectBriefPage() {
  const { id } = useParams();
  const { data: project, isLoading } = trpc.gtmProjects.byId.useQuery({ id });

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
            No tasks yet. Add tasks to track work for this project.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {project.tasks.map((task) => (
              <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${taskStatusColors[task.status]}`} />
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
                {task.owner && (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[8px] font-bold shrink-0">
                    {(task.owner.name?.[0] || task.owner.email?.[0] || 'U').toUpperCase()}
                  </div>
                )}
                {task.dueDate && (
                  <span className="text-[10px] text-content-faint whitespace-nowrap">
                    {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
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
