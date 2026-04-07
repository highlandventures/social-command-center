'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

function CreateProjectModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('GTM');
  const [status, setStatus] = useState('ACTIVE');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [googleDocUrl, setGoogleDocUrl] = useState('');
  const [parsing, setParsing] = useState(false);
  const [aiCategory, setAiCategory] = useState(null);
  const [parsedTasks, setParsedTasks] = useState([]);
  const [parsedMoments, setParsedMoments] = useState([]);

  const utils = trpc.useUtils();

  const createProject = trpc.gtmProjects.create.useMutation({
    onSuccess: async (project) => {
      // Create parsed tasks and moments if any
      for (const task of parsedTasks) {
        await utils.client.gtmTasks.create.mutate({
          projectId: project.id,
          title: task.title,
          priority: task.priority || 'MEDIUM',
          dueDate: task.dueDate || undefined,
        });
      }
      for (const moment of parsedMoments) {
        await utils.client.gtmMoments.create.mutate({
          projectId: project.id,
          label: moment.label,
          type: moment.type || 'MILESTONE',
          date: moment.date || undefined,
        });
      }
      onCreated(project);
      onClose();
    },
  });

  const parseDoc = trpc.google.parseDocForProject.useMutation({
    onSuccess: (data) => {
      if (data.name) setName(data.name);
      if (data.description) setDescription(data.description);
      if (data.category) { setCategory(data.category); setAiCategory(data.category); }
      if (data.status) setStatus(data.status);
      if (data.startDate) setStartDate(data.startDate);
      if (data.endDate) setEndDate(data.endDate);
      if (data.googleDocUrl) setGoogleDocUrl(data.googleDocUrl);
      if (data.tasks?.length) setParsedTasks(data.tasks);
      if (data.moments?.length) setParsedMoments(data.moments);
      setParsing(false);
    },
    onError: () => setParsing(false),
  });

  const docId = extractDocId(googleDocUrl);
  const fetchDocMeta = trpc.google.driveFile.useQuery(
    { fileId: docId || '__skip__' },
    { enabled: !!docId, staleTime: 0 }
  );
  const docMeta = fetchDocMeta.data?.file || null;

  function handleParseDoc() {
    const id = extractDocId(googleDocUrl);
    if (!id) return;
    setParsing(true);
    parseDoc.mutate({ fileId: id });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;
    createProject.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      aiCategory: aiCategory || undefined,
      status,
      startDate,
      endDate,
      googleDocUrl: googleDocUrl.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-surface-card border border-border rounded-xl w-full max-w-lg mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-content-primary">New Project</h2>
          <button onClick={onClose} className="text-content-faint hover:text-content-primary transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Google Doc link */}
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1">Google Doc (optional)</label>
            <input
              type="url"
              value={googleDocUrl}
              onChange={(e) => setGoogleDocUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              className="w-full text-sm bg-surface-secondary text-content-primary placeholder:text-content-faint rounded-lg px-3 py-2 border border-border outline-none focus:border-blue-500"
            />
            {fetchDocMeta.isLoading && docId && (
              <p className="text-xs text-content-faint mt-1">Loading doc info...</p>
            )}
            {docMeta && (
              <div className="flex items-center gap-2 mt-1.5 px-2 py-1.5 bg-surface-secondary rounded text-xs text-content-muted">
                <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="truncate">{docMeta.name}</span>
                <svg className="w-3 h-3 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <button
                  type="button"
                  onClick={handleParseDoc}
                  disabled={parsing}
                  className="ml-auto text-[10px] font-medium text-blue-500 hover:text-blue-400 disabled:opacity-50"
                >
                  {parsing ? 'Reading doc...' : 'Auto-fill from doc'}
                </button>
              </div>
            )}
            {parsing && (
              <div className="flex items-center gap-2 mt-1.5 px-2 py-1.5 bg-blue-900/20 border border-blue-800/30 rounded text-xs text-blue-300">
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93" />
                </svg>
                AI is reading and extracting project info...
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Figure Pay Launch"
              className="w-full text-sm bg-surface-secondary text-content-primary placeholder:text-content-faint rounded-lg px-3 py-2 border border-border outline-none focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief project description..."
              rows={2}
              className="w-full text-sm bg-surface-secondary text-content-primary placeholder:text-content-faint rounded-lg px-3 py-2 border border-border outline-none focus:border-blue-500 resize-none"
            ></textarea>
          </div>

          {/* Category + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full text-sm bg-surface-secondary text-content-primary rounded-lg px-3 py-2 border border-border outline-none">
                <option value="GTM">GTM</option>
                <option value="EVERGREEN">Evergreen</option>
                <option value="OPERATIONS">Operations</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full text-sm bg-surface-secondary text-content-primary rounded-lg px-3 py-2 border border-border outline-none">
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full text-sm bg-surface-secondary text-content-primary rounded-lg px-3 py-2 border border-border outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full text-sm bg-surface-secondary text-content-primary rounded-lg px-3 py-2 border border-border outline-none" />
            </div>
          </div>

          {/* Parsed tasks/moments preview */}
          {(parsedTasks.length > 0 || parsedMoments.length > 0) && (
            <div className="border border-border rounded-lg p-3 space-y-2">
              {parsedTasks.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-content-faint uppercase tracking-wider mb-1">Tasks ({parsedTasks.length})</p>
                  <div className="space-y-1">
                    {parsedTasks.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-content-muted">
                        <span className="w-2 h-2 rounded-full border border-content-faint shrink-0" />
                        <span className="truncate flex-1">{t.title}</span>
                        <span className={`text-[10px] px-1 rounded ${
                          t.priority === 'HIGH' ? 'text-red-400' : t.priority === 'LOW' ? 'text-gray-500' : 'text-amber-400'
                        }`}>{t.priority}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {parsedMoments.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-content-faint uppercase tracking-wider mb-1">Moments ({parsedMoments.length})</p>
                  <div className="space-y-1">
                    {parsedMoments.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-content-muted">
                        <span className="w-2 h-2 rounded-sm bg-blue-500 shrink-0" />
                        <span className="truncate flex-1">{m.label}</span>
                        <span className="text-[10px] text-content-faint">{m.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm text-content-muted hover:text-content-primary px-4 py-2">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !startDate || !endDate || createProject.isLoading}
              className="text-sm font-medium bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {createProject.isLoading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function extractDocId(url) {
  if (!url) return null;
  const m = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

export default function ProjectsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
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
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Project
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={(project) => {
            utils.gtmProjects.list.invalidate();
            router.push(`/gtm/projects/${project.id}`);
          }}
        />
      )}

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
