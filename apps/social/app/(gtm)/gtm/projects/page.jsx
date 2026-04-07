'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

const healthColors = {
  ON_TRACK: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  AT_RISK: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  BEHIND: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const healthLabels = { ON_TRACK: 'On Track', AT_RISK: 'At Risk', BEHIND: 'Behind' };

const statusColors = {
  PLANNING: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  ACTIVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  ON_HOLD: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
};

const categoryBadge = {
  GTM: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  EVERGREEN: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  OPERATIONS: 'bg-gray-50 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

export default function ProjectsPage() {
  const [filter, setFilter] = useState('ALL');
  const { data: projects, isLoading } = trpc.gtmProjects.list.useQuery({});

  const filtered = filter === 'ALL'
    ? (projects || [])
    : (projects || []).filter((p) => p.status === filter);

  const counts = {
    ALL: (projects || []).length,
    ACTIVE: (projects || []).filter((p) => p.status === 'ACTIVE').length,
    PLANNING: (projects || []).filter((p) => p.status === 'PLANNING').length,
    ON_HOLD: (projects || []).filter((p) => p.status === 'ON_HOLD').length,
    COMPLETED: (projects || []).filter((p) => p.status === 'COMPLETED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-content-primary">Projects</h2>
          <p className="text-sm text-content-muted mt-0.5">
            {counts.ACTIVE} active, {counts.ALL} total
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-surface-secondary rounded-lg p-1 w-fit">
        {['ALL', 'ACTIVE', 'PLANNING', 'ON_HOLD', 'COMPLETED'].map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === key
                ? 'bg-surface-card text-content-primary shadow-sm'
                : 'text-content-muted hover:text-content-secondary'
            }`}
          >
            {key === 'ALL' ? 'All' : key === 'ON_HOLD' ? 'On Hold' : key.charAt(0) + key.slice(1).toLowerCase()}
            <span className="ml-1.5 text-content-faint">{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* Project cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-skeleton rounded w-48 mb-3" />
              <div className="h-3 bg-skeleton rounded w-32 mb-2" />
              <div className="h-3 bg-skeleton rounded w-24" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl p-12 text-center">
          <p className="text-sm text-content-muted">No projects found for this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((project) => {
            const tasksDone = project._count?.tasks ?? 0;
            const startStr = new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            return (
              <Link
                key={project.id}
                href={`/gtm/projects/${project.id}`}
                className="bg-surface-card border border-border rounded-xl p-5 hover:border-border-hover hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-semibold text-content-primary truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </h3>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${categoryBadge[project.category]}`}>
                      {project.category}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full shrink-0 ${healthColors[project.healthStatus]}`}>
                    {healthLabels[project.healthStatus]}
                  </span>
                </div>

                {project.description && (
                  <p className="text-xs text-content-muted mb-3 line-clamp-2">{project.description}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-content-faint">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[project.status]}`}>
                    {project.status === 'ON_HOLD' ? 'On Hold' : project.status.charAt(0) + project.status.slice(1).toLowerCase()}
                  </span>
                  <span>{startStr} &ndash; {endStr}</span>
                  <span>{tasksDone} tasks</span>
                  <span>{project._count?.moments ?? 0} moments</span>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-secondary">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[9px] font-bold">
                    {(project.owner?.name?.[0] || project.owner?.email?.[0] || 'U').toUpperCase()}
                  </div>
                  <span className="text-xs text-content-muted truncate">
                    {project.owner?.name || project.owner?.email}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
