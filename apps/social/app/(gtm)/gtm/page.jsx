'use client';

import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

const healthColors = {
  ON_TRACK: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  AT_RISK: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  BEHIND: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const healthLabels = { ON_TRACK: 'On Track', AT_RISK: 'At Risk', BEHIND: 'Behind' };

const categoryBadge = {
  GTM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  EVERGREEN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  OPERATIONS: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
};

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-surface-card border border-border rounded-xl p-5">
      <p className="text-xs font-medium text-content-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent || 'text-content-primary'}`}>{value}</p>
    </div>
  );
}

export default function GtmOverviewPage() {
  const now = new Date();
  const currentQuarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;

  const { data: stats, isLoading: statsLoading } = trpc.gtmProjects.stats.useQuery();
  const { data: projects, isLoading: projectsLoading } = trpc.gtmProjects.list.useQuery({ status: 'ACTIVE' });
  const { data: myTasks } = trpc.gtmTasks.myTasks.useQuery({});
  const { data: moments } = trpc.gtmMoments.list.useQuery({});
  const { data: okrs } = trpc.gtmOkrs.list.useQuery({ quarter: currentQuarter });

  const activeTasks = (myTasks || []).filter((t) => t.status !== 'DONE');
  const upcomingMoments = (moments || []).slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-3 bg-skeleton rounded w-20 mb-3" />
              <div className="h-7 bg-skeleton rounded w-10" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Total Projects" value={stats?.total ?? 0} />
            <StatCard label="Active" value={stats?.active ?? 0} accent="text-emerald-600 dark:text-emerald-400" />
            <StatCard label="At Risk" value={stats?.atRisk ?? 0} accent="text-amber-600 dark:text-amber-400" />
            <StatCard label="Behind" value={stats?.behind ?? 0} accent="text-red-600 dark:text-red-400" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects */}
        <div className="lg:col-span-2 bg-surface-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-content-primary">Active Projects</h2>
            <Link href="/gtm/projects" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-border">
            {projectsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-4 animate-pulse">
                  <div className="h-4 bg-skeleton rounded w-48 mb-2" />
                  <div className="h-3 bg-skeleton rounded w-32" />
                </div>
              ))
            ) : (projects || []).length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-content-muted">
                No active projects yet. Create your first GTM project to get started.
              </div>
            ) : (
              (projects || []).slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  href={`/gtm/projects/${p.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-surface-hover transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-content-primary truncate">{p.name}</p>
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${categoryBadge[p.category]}`}>
                        {p.category}
                      </span>
                    </div>
                    <p className="text-xs text-content-muted">
                      {p.owner?.name || p.owner?.email} &middot; {p._count?.tasks ?? 0} tasks &middot; {p._count?.moments ?? 0} moments
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-semibold rounded-full ${healthColors[p.healthStatus]}`}>
                    {healthLabels[p.healthStatus]}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Right column: My Tasks + Upcoming Moments */}
        <div className="space-y-6">
          {/* My Tasks */}
          <div className="bg-surface-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-content-primary">My Tasks</h2>
              <Link href="/gtm/tasks" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-border">
              {activeTasks.length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-content-muted">No active tasks</div>
              ) : (
                activeTasks.slice(0, 5).map((t) => (
                  <div key={t.id} className="px-5 py-3 flex items-start gap-3">
                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      t.priority === 'HIGH' ? 'bg-red-500' : t.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-gray-400'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-content-primary truncate">{t.title}</p>
                      <p className="text-xs text-content-muted">{t.project?.name}</p>
                    </div>
                    {t.dueDate && (
                      <span className="text-[10px] text-content-faint whitespace-nowrap">
                        {new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Moments */}
          <div className="bg-surface-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-content-primary">Upcoming Moments</h2>
              <Link href="/gtm/calendar" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Calendar
              </Link>
            </div>
            <div className="divide-y divide-border">
              {upcomingMoments.length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-content-muted">No moments scheduled</div>
              ) : (
                upcomingMoments.map((m) => (
                  <div key={m.id} className="px-5 py-3 flex items-start gap-3">
                    <span className={`mt-1 w-2.5 h-2.5 rounded-sm shrink-0 ${
                      m.type === 'LAUNCH' ? 'bg-blue-500' :
                      m.type === 'TENTPOLE' ? 'bg-purple-500' :
                      m.type === 'EVENT' ? 'bg-emerald-500' :
                      m.type === 'CAMPAIGN' ? 'bg-amber-500' :
                      'bg-gray-400'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-content-primary truncate">{m.label}</p>
                      <p className="text-xs text-content-muted">
                        {m.date
                          ? new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : `${new Date(m.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(m.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                        }
                        {m.project && ` \u00b7 ${m.project.name}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* OKRs Summary */}
          <div className="bg-surface-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-content-primary">OKRs — {currentQuarter}</h2>
              <Link href="/gtm/okrs" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-border">
              {!okrs || okrs.length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-content-muted">No OKRs for this quarter</div>
              ) : (
                okrs.map((okr) => (
                  <Link key={okr.id} href="/gtm/okrs" className="px-5 py-3 flex items-center gap-3 hover:bg-surface-hover transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-content-primary truncate">{okr.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            okr.progress >= 70 ? 'bg-emerald-500' :
                            okr.progress >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${okr.progress}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold min-w-[3ch] text-right ${
                        okr.progress >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                        okr.progress >= 40 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {okr.progress}%
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
