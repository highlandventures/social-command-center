'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { useQueryClient } from '@tanstack/react-query';

// ── Priority Badge ──
function PriorityBadge({ priority }) {
  const config = {
    CRITICAL: { label: 'Critical', bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-200' },
    HIGH: { label: 'High', bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-200' },
    MEDIUM: { label: 'Medium', bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-200' },
    LOW: { label: 'Low', bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-200' },
  };
  const c = config[priority] || config.MEDIUM;
  return (
    <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ring-1 ${c.bg} ${c.text} ${c.ring}`}>
      {c.label}
    </span>
  );
}

// ── Source Badge ──
function SourceBadge({ type }) {
  const icons = { LISTENING: '👂', EMAIL: '✉️', CALENDAR: '📅', CAMPAIGN: '📣', REPORT: '📋', MANUAL: '✏️' };
  return <span className="text-[10px] text-content-muted">{icons[type] || '📌'} {type.toLowerCase()}</span>;
}

// ── Weekly Briefing Card ──
function BriefingCard({ briefing, isLoading, onRefresh }) {
  if (isLoading) {
    return (
      <div className="bg-surface-card border border-border rounded-lg p-8 animate-pulse">
        <div className="h-6 bg-surface-hover rounded w-1/3 mb-4" />
        <div className="space-y-3">
          <div className="h-4 bg-surface-hover rounded w-full" />
          <div className="h-4 bg-surface-hover rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="bg-surface-card border border-border rounded-lg p-8 text-center">
        <p className="text-content-muted mb-4">No briefing generated yet</p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Generate Briefing
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-border rounded-lg p-6 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-content-primary">Weekly Briefing</h2>
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          >
            Refresh
          </button>
        </div>
        <p className="text-sm text-content-secondary leading-relaxed">{briefing.summary}</p>
      </div>

      {briefing.topPriorities && briefing.topPriorities.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-content-primary mb-3">Top Priorities</h3>
          <div className="space-y-2">
            {briefing.topPriorities.map((priority, idx) => (
              <div key={idx} className="p-3 bg-surface-hover rounded-lg border border-border-secondary">
                <div className="font-medium text-sm text-content-primary mb-1">{priority.title}</div>
                <div className="text-xs text-content-muted mb-2">{priority.reason}</div>
                <div className="text-xs text-content-secondary italic">{priority.suggestedAction}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {briefing.signalsSummary && (
        <div>
          <h3 className="text-sm font-semibold text-content-primary mb-3">Signal Summary</h3>
          <div className="grid grid-cols-4 gap-2">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded text-center">
              <div className="text-2xl font-bold text-blue-600">{briefing.signalsSummary.respond || 0}</div>
              <div className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-medium">Replies</div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded text-center">
              <div className="text-2xl font-bold text-red-600">{briefing.signalsSummary.crisis || 0}</div>
              <div className="text-[10px] text-red-700 dark:text-red-300 uppercase font-medium">Crisis</div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded text-center">
              <div className="text-2xl font-bold text-green-600">{briefing.signalsSummary.opportunity || 0}</div>
              <div className="text-[10px] text-green-700 dark:text-green-300 uppercase font-medium">Opps</div>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded text-center">
              <div className="text-2xl font-bold text-indigo-600">{briefing.signalsSummary.intel || 0}</div>
              <div className="text-[10px] text-indigo-700 dark:text-indigo-300 uppercase font-medium">Intel</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── X Analyst Report Card ──
function XAnalystCard({ report, isLoading }) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-surface-card border border-border rounded-lg p-6 animate-pulse">
        <div className="h-5 bg-surface-hover rounded w-1/3 mb-4" />
        <div className="space-y-2">
          <div className="h-3 bg-surface-hover rounded w-full" />
          <div className="h-3 bg-surface-hover rounded w-4/5" />
        </div>
      </div>
    );
  }

  if (!report?.content) {
    return (
      <div className="bg-surface-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">📊</span>
          <h2 className="text-lg font-bold text-content-primary">X Account Analyst</h2>
        </div>
        <p className="text-sm text-content-muted">
          No X analyst report yet. The weekly analysis runs every Monday at 7 AM UTC, or you can trigger it manually.
        </p>
      </div>
    );
  }

  const data = report.content;
  const generatedDate = new Date(report.generatedAt).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  // Health grade color
  const gradeColor = (grade) => {
    if (!grade) return 'text-gray-500';
    const letter = grade.charAt(0);
    if (letter === 'A') return 'text-green-600';
    if (letter === 'B') return 'text-blue-600';
    if (letter === 'C') return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="bg-surface-card border border-border rounded-lg p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h2 className="text-lg font-bold text-content-primary">X Account Analyst</h2>
          <span className="text-[10px] text-content-muted bg-surface-hover px-2 py-0.5 rounded-full">{generatedDate}</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Executive Summary — always visible */}
      {data.executiveSummary && (
        <div>
          <h3 className="text-sm font-semibold text-content-primary mb-2">Executive Summary</h3>
          <ul className="space-y-1.5">
            {data.executiveSummary.map((item, i) => (
              <li key={i} className="text-xs text-content-secondary leading-relaxed flex gap-2">
                <span className="text-content-muted mt-0.5 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Account Health — always visible */}
      {data.accountHealth?.accounts && (
        <div>
          <h3 className="text-sm font-semibold text-content-primary mb-2">Account Health</h3>
          <div className="grid grid-cols-3 gap-2">
            {data.accountHealth.accounts.map((acct, i) => (
              <div key={i} className="p-3 bg-surface-hover rounded-lg text-center">
                <div className={`text-2xl font-bold ${gradeColor(acct.healthGrade)}`}>{acct.healthGrade || '—'}</div>
                <div className="text-[11px] font-medium text-content-primary mt-1">{acct.handle}</div>
                <div className="text-[10px] text-content-muted mt-0.5">{acct.engagementQuality}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="space-y-5 pt-2 border-t border-border-secondary">
          {/* Top Performers */}
          {data.topPerformers?.posts?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-content-primary mb-2">Top Performing Content</h3>
              <div className="space-y-2">
                {data.topPerformers.posts.map((post, i) => (
                  <div key={i} className="p-3 bg-surface-hover rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-blue-600">{post.account}</span>
                      <span className="text-[10px] text-content-muted">{post.format}</span>
                    </div>
                    <p className="text-xs text-content-secondary">{post.contentSummary}</p>
                    <p className="text-[10px] text-content-muted mt-1 italic">Why: {post.whyItWorked}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Underperformers */}
          {data.underperformers?.patterns?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-content-primary mb-2">Underperforming Patterns</h3>
              <div className="space-y-2">
                {data.underperformers.patterns.map((p, i) => (
                  <div key={i} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold ${p.severity === 'critical' ? 'text-red-600' : p.severity === 'high' ? 'text-orange-600' : 'text-yellow-600'}`}>
                        {p.severity?.toUpperCase()}
                      </span>
                      <span className="text-xs font-medium text-content-primary">{p.pattern}</span>
                    </div>
                    <p className="text-[10px] text-content-secondary">Fix: {p.fix}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitor Intel */}
          {data.competitorIntel?.competitors?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-content-primary mb-2">Competitor Intel</h3>
              <div className="space-y-2">
                {data.competitorIntel.competitors.map((c, i) => (
                  <div key={i} className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg">
                    <div className="text-[11px] font-bold text-indigo-600 mb-1">{c.handle}</div>
                    <p className="text-xs text-content-secondary">{c.winningTactic}</p>
                    <p className="text-[10px] text-content-muted mt-1">→ {c.adaptableInsight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Algorithm Signals */}
          {data.algorithmSignals && (
            <div>
              <h3 className="text-sm font-semibold text-content-primary mb-2">Algorithm Signals</h3>
              <div className="p-3 bg-surface-hover rounded-lg space-y-2">
                {data.algorithmSignals.changesDetected?.map((change, i) => (
                  <p key={i} className="text-xs text-content-secondary flex gap-2">
                    <span className="text-orange-500 shrink-0">⚡</span> {change}
                  </p>
                ))}
                {data.algorithmSignals.formatRanking && (
                  <p className="text-[10px] text-content-muted">
                    Format ranking: {data.algorithmSignals.formatRanking.join(' → ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Content Calendar */}
          {data.contentCalendar?.recommendations?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-content-primary mb-2">
                Content Recommendations ({data.contentCalendar.recommendations.length})
              </h3>
              <div className="space-y-2">
                {data.contentCalendar.recommendations.map((rec, i) => (
                  <div key={i} className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-green-600">{rec.account}</span>
                      <span className="text-[10px] text-content-muted">{rec.format}</span>
                      <span className="text-[10px] text-content-muted">{rec.postingWindow}</span>
                    </div>
                    <p className="text-xs font-medium text-content-primary">{rec.contentPillar}</p>
                    {rec.hookOptions?.[0] && (
                      <p className="text-[10px] text-content-secondary mt-1 italic">"{rec.hookOptions[0]}"</p>
                    )}
                    {rec.complianceNotes && (
                      <p className="text-[10px] text-orange-600 mt-1">⚠ {rec.complianceNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Task Card ──
function TaskCard({ task, onComplete, onDismiss, onSnooze }) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  return (
    <div className="p-4 bg-surface-card border border-border rounded-lg space-y-3 hover:border-border-secondary transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-content-primary mb-1 break-words">{task.title}</h3>
          <div className="flex items-center gap-2 mb-2">
            <PriorityBadge priority={task.priority} />
            <SourceBadge type={task.sourceType} />
          </div>
        </div>
      </div>

      {task.suggestedAction && (
        <p className="text-xs text-content-secondary bg-surface-hover p-2 rounded">
          {task.suggestedAction}
        </p>
      )}

      {task.dueDate && (
        <p className="text-xs text-content-muted">
          Due: {new Date(task.dueDate).toLocaleDateString()}
        </p>
      )}

      {task.sourceUrl && (
        <a
          href={task.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          View Source →
        </a>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border-secondary">
        <button
          onClick={() => onComplete(task.id)}
          className="flex-1 px-2 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 rounded transition-colors"
          title="Mark complete"
        >
          ✓ Done
        </button>
        <button
          onClick={() => onDismiss(task.id)}
          className="flex-1 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-900/10 rounded transition-colors"
          title="Dismiss"
        >
          ✗ Dismiss
        </button>
        <button
          onClick={() => setSnoozeOpen(!snoozeOpen)}
          className="flex-1 px-2 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 rounded transition-colors"
          title="Snooze"
        >
          ⏰ Snooze
        </button>
      </div>

      {snoozeOpen && (
        <div className="p-2 bg-surface-hover rounded space-y-2">
          <button
            onClick={() => {
              const date = new Date();
              date.setHours(date.getHours() + 2);
              onSnooze(task.id, date);
              setSnoozeOpen(false);
            }}
            className="block w-full text-left px-2 py-1 text-xs hover:bg-surface-card rounded"
          >
            2 hours
          </button>
          <button
            onClick={() => {
              const date = new Date();
              date.setDate(date.getDate() + 1);
              onSnooze(task.id, date);
              setSnoozeOpen(false);
            }}
            className="block w-full text-left px-2 py-1 text-xs hover:bg-surface-card rounded"
          >
            Tomorrow
          </button>
          <button
            onClick={() => {
              const date = new Date();
              date.setDate(date.getDate() + 3);
              onSnooze(task.id, date);
              setSnoozeOpen(false);
            }}
            className="block w-full text-left px-2 py-1 text-xs hover:bg-surface-card rounded"
          >
            3 days
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function IntelligencePage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // all, critical, high, medium
  const [showCompleted, setShowCompleted] = useState(false);

  // Fetch data
  const briefingQ = trpc.intelligence.getBriefing.useQuery();
  const xAnalystQ = trpc.intelligence.getXAnalystReport.useQuery();
  const tasksQ = trpc.intelligence.getTasks.useQuery({ status: 'PENDING' });
  const completedQ = trpc.intelligence.getTasks.useQuery({ status: 'COMPLETED', limit: 20 });

  // Mutations
  const updateTask = trpc.intelligence.updateTask.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['intelligence', 'getTasks']] });
    },
  });

  const regenerate = trpc.intelligence.regenerateBriefing.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['intelligence', 'getBriefing']] });
    },
  });

  const createTask = trpc.intelligence.createTask.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['intelligence', 'getTasks']] });
      setCreateOpen(false);
    },
  });

  // Filter tasks
  const tasks = tasksQ.data || [];
  const filtered = tasks.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'critical') return t.priority === 'CRITICAL';
    if (filter === 'high') return t.priority === 'HIGH';
    if (filter === 'medium') return t.priority === 'MEDIUM';
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-content-primary">Intelligence</h1>
        <p className="text-sm text-content-muted mt-1">Your weekly briefing and task inbox</p>
      </div>

      {/* Weekly Briefing */}
      <BriefingCard
        briefing={briefingQ.data}
        isLoading={briefingQ.isLoading}
        onRefresh={() => regenerate.mutate()}
      />

      {/* X Account Analyst Report */}
      <XAnalystCard
        report={xAnalystQ.data}
        isLoading={xAnalystQ.isLoading}
      />

      {/* Task Inbox */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-content-primary">Tasks ({filtered.length})</h2>
          <button
            onClick={() => setCreateOpen(!createOpen)}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Task
          </button>
        </div>

        {/* Create Task Form */}
        {createOpen && (
          <div className="bg-surface-card border border-border rounded-lg p-4 space-y-3">
            <input
              type="text"
              placeholder="Task title"
              id="taskTitle"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-page"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setCreateOpen(false);
              }}
            />
            <textarea
              placeholder="Description (optional)"
              id="taskDesc"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-page"
              rows="2"
            />
            <select
              id="taskPriority"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-page"
            >
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const title = document.getElementById('taskTitle').value;
                  const desc = document.getElementById('taskDesc').value;
                  const priority = document.getElementById('taskPriority').value;
                  if (title) {
                    createTask.mutate({
                      title,
                      description: desc || undefined,
                      priority,
                    });
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setCreateOpen(false)}
                className="flex-1 px-3 py-1.5 border border-border text-content-secondary rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex gap-2">
          {['all', 'critical', 'high', 'medium'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface-hover text-content-muted hover:text-content-secondary'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Task List */}
        {tasksQ.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-surface-card border border-border rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={(id) => updateTask.mutate({ id, status: 'COMPLETED' })}
                onDismiss={(id) => updateTask.mutate({ id, status: 'DISMISSED' })}
                onSnooze={(id, until) => updateTask.mutate({ id, snoozedUntil: until })}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-content-muted mb-4">No pending tasks</p>
            <button
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded transition-colors"
            >
              Create your first task
            </button>
          </div>
        )}
      </div>

      {/* Completed Tasks */}
      <div className="space-y-3">
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="text-sm font-medium text-content-secondary hover:text-content-primary transition-colors"
        >
          {showCompleted ? '▼' : '▶'} Completed ({completedQ.data?.length || 0})
        </button>
        {showCompleted && completedQ.data && completedQ.data.length > 0 && (
          <div className="space-y-2">
            {completedQ.data.map(task => (
              <div key={task.id} className="p-3 bg-surface-hover rounded-lg opacity-60 line-through">
                <div className="text-sm text-content-muted">{task.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
