'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { trpc } from '@/lib/trpc-client';
import { MetricCard, SectionTitle, TabButton, PlatformBadge, Skeleton } from '@/components/ui';

// ── Static roadmap data (internal planning, not from API) ───
const roadmapItems = [
  { id: 1, phase: 'Phase 1', title: 'Project scaffolding', status: 'deployed', deployed: 'Jan 15' },
  { id: 2, phase: 'Phase 1', title: 'OAuth account connection', status: 'deployed', deployed: 'Jan 22' },
  { id: 3, phase: 'Phase 1', title: 'Post composer + preview', status: 'deployed', deployed: 'Feb 5' },
  { id: 4, phase: 'Phase 1', title: 'Basic scheduling', status: 'deployed', deployed: 'Feb 10' },
  { id: 5, phase: 'Phase 1', title: 'Calendar view', status: 'deployed', deployed: 'Feb 14' },
  { id: 6, phase: 'Phase 1', title: 'RBAC + team invitations', status: 'deployed', deployed: 'Feb 20' },
  { id: 7, phase: 'Phase 1', title: 'API adapter layer (hybrid)', status: 'deployed', deployed: 'Feb 24' },
  { id: 8, phase: 'Phase 1', title: 'Admin panel + cost tracker', status: 'deployed', deployed: 'Feb 28' },
  { id: 9, phase: 'Phase 2', title: 'Thread composer + preview', status: 'in_progress', deployed: null },
  { id: 10, phase: 'Phase 2', title: 'Metrics poller worker', status: 'in_progress', deployed: null },
  { id: 11, phase: 'Phase 2', title: 'Front dashboard + WoW', status: 'not_started', deployed: null },
  { id: 12, phase: 'Phase 3', title: 'Mentions tracking', status: 'not_started', deployed: null },
  { id: 13, phase: 'Phase 3', title: 'Unified inbox', status: 'not_started', deployed: null },
  { id: 14, phase: 'Phase 4a', title: 'Social listening feed', status: 'not_started', deployed: null },
  { id: 15, phase: 'Phase 4b', title: 'Competitor monitoring', status: 'not_started', deployed: null },
  { id: 16, phase: 'Phase 4c', title: 'KOL tracking + AI scoring', status: 'not_started', deployed: null },
];

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-gray-100 rounded-xl" />}>
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const [subTab, setSubTab] = useState('settings');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('INTERNAL');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);
  const searchParams = useSearchParams();
  const successParam = searchParams.get('success');
  const errorParam = searchParams.get('error');

  // ── tRPC queries ──────────────────────────────────────────
  const accountsQ = trpc.accounts.list.useQuery(undefined, { staleTime: 30_000 });
  const usersQ = trpc.admin.users.list.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const costsQ = trpc.admin.apiCosts.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });

  // ── tRPC mutations ─────────────────────────────────────────
  const inviteMutation = trpc.admin.users.invite.useMutation({
    onSuccess: () => {
      setInviteEmail('');
      setInviteMsg({ type: 'success', text: 'User invited successfully!' });
      usersQ.refetch();
    },
    onError: (err) => {
      setInviteMsg({ type: 'error', text: err.message });
    },
  });

  const updateRoleMutation = trpc.admin.users.updateRole.useMutation({
    onSuccess: () => usersQ.refetch(),
  });

  // ── Derived data ──────────────────────────────────────────
  const accounts = accountsQ.data ?? [];
  const users = usersQ.data ?? [];
  const costData = costsQ.data ?? {};

  // Cost data from real APICallLog (no fake fallbacks)
  const totalCost = costData.totalCost ?? 0;
  const totalCalls = costData.totalCalls ?? 0;
  const byProvider = costData.byProvider ?? {};
  const timeSeries = costData.timeSeries ?? [];

  const providerColors = {
    x_official: '#1d9bf0',
    twitterapi_io: '#6b7280',
    reddit: '#ff4500',
    claude: '#8b5cf6',
  };
  const providerLabels = {
    x_official: 'X Official API',
    twitterapi_io: 'TwitterAPI.io',
    reddit: 'Reddit API',
    claude: 'Claude AI',
  };

  const totalDeployed = roadmapItems.filter((r) => r.status === 'deployed').length;
  const totalItems = roadmapItems.length;

  const statusColors = {
    deployed: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    not_started: 'bg-gray-100 text-gray-600',
  };
  const statusLabels = {
    deployed: 'Deployed',
    in_progress: 'In Progress',
    not_started: 'Not Started',
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteMsg(null);
    try {
      await inviteMutation.mutateAsync({ email: inviteEmail, role: inviteRole });
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div>
      {/* Success/error banners from OAuth callbacks */}
      {successParam && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          {successParam === 'x_connected' && 'X (Twitter) account connected successfully!'}
          {successParam === 'reddit_connected' && 'Reddit account connected successfully!'}
        </div>
      )}
      {errorParam && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          Connection error: {errorParam.replace(/_/g, ' ')}
        </div>
      )}

      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
        {[
          { key: 'settings', label: 'Settings' },
          { key: 'costs', label: 'Cost Tracker' },
          { key: 'roadmap', label: 'Roadmap' },
        ].map((t) => (
          <TabButton key={t.key} active={subTab === t.key} onClick={() => setSubTab(t.key)}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          SETTINGS TAB — real functionality
         ══════════════════════════════════════════════════════════ */}
      {subTab === 'settings' && (
        <div className="space-y-8">

          {/* ── Connected Accounts ────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <SectionTitle subtitle="Connect your social platforms via OAuth to start tracking">
              Connected Accounts
            </SectionTitle>

            {accountsQ.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : accounts.length > 0 ? (
              <div className="space-y-3 mb-6">
                {accounts.map((acct) => (
                  <div
                    key={acct.id}
                    className="flex items-center justify-between p-4 border border-gray-100 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        acct.platform === 'X' ? 'bg-gray-800' : 'bg-orange-500'
                      }`}>
                        {acct.platform === 'X' ? '\u{1D54F}' : 'R'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            @{acct.username}
                          </span>
                          <PlatformBadge platform={acct.platform} />
                        </div>
                        <p className="text-xs text-gray-500">
                          {acct.displayName || acct.username}
                          {' \u2022 Connected '}
                          {new Date(acct.connectedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        acct.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {acct.isActive ? 'Active' : 'Expired'}
                      </span>
                      {!acct.isActive && (
                        <a
                          href={`/api/connect/${acct.platform === 'X' ? 'x' : 'reddit'}`}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Re-connect
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 mb-6 border border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500 text-sm mb-1">No accounts connected yet</p>
                <p className="text-gray-400 text-xs">Connect your X or Reddit account to get started</p>
              </div>
            )}

            {/* Connect buttons */}
            <div className="flex items-center gap-3">
              <a
                href="/api/connect/x"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                <span className="text-base">{'\u{1D54F}'}</span>
                Connect X Account
              </a>
              <a
                href="/api/connect/reddit"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                <span className="text-base">R</span>
                Connect Reddit Account
              </a>
            </div>
          </div>

          {/* ── Team Management ───────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <SectionTitle subtitle="Invite team members and manage roles">
              Team Management
            </SectionTitle>

            {/* Invite form */}
            <form onSubmit={handleInvite} className="flex items-end gap-3 mb-6">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="INTERNAL">Internal</option>
                  <option value="AGENCY">Agency</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviteLoading}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {inviteLoading ? 'Inviting...' : 'Invite'}
              </button>
            </form>

            {inviteMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                inviteMsg.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {inviteMsg.text}
              </div>
            )}

            {/* User list */}
            {usersQ.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : usersQ.isError ? (
              <div className="text-center py-6 text-sm text-gray-500">
                <p>Unable to load team members.</p>
                <p className="text-xs text-gray-400 mt-1">
                  You may need ADMIN access. Sign out and back in to refresh your role.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Email', 'Name', 'Role', 'Joined', ''].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100">
                      <td className="py-3 px-3 font-medium text-gray-900">{u.email}</td>
                      <td className="py-3 px-3 text-gray-600">{u.name || '\u2014'}</td>
                      <td className="py-3 px-3">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            updateRoleMutation.mutate({ userId: u.id, role: e.target.value })
                          }
                          className="px-2 py-1 border border-gray-200 rounded text-xs bg-white"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="INTERNAL">Internal</option>
                          <option value="AGENCY">Agency</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-gray-500 text-xs">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-xs text-gray-400">
                        {u.lastActiveAt
                          ? `Active ${new Date(u.lastActiveAt).toLocaleDateString()}`
                          : 'Never signed in'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── API Configuration ─────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <SectionTitle subtitle="Configure how the platform reads from X/Twitter">
              API Configuration
            </SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-100 rounded-lg">
                <h5 className="text-sm font-medium text-gray-900 mb-1">X Read Provider</h5>
                <p className="text-xs text-gray-500 mb-2">
                  Primary provider for reading X data. TwitterAPI.io is cheaper for reads.
                </p>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {process.env.NEXT_PUBLIC_X_READ_PROVIDER || 'twitterapi_io'}
                  </span>
                  <span className="text-xs text-gray-400">Set via X_READ_PROVIDER env var</span>
                </div>
              </div>
              <div className="p-4 border border-gray-100 rounded-lg">
                <h5 className="text-sm font-medium text-gray-900 mb-1">Official API Fallback</h5>
                <p className="text-xs text-gray-500 mb-2">
                  Fall back to official X API when third-party provider fails.
                </p>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                    Enabled
                  </span>
                  <span className="text-xs text-gray-400">Set via X_READ_FALLBACK_TO_OFFICIAL env var</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Polling & Data ────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <SectionTitle subtitle="Polling intervals are managed via Vercel cron jobs">
              Polling Configuration
            </SectionTitle>
            <div className="space-y-2">
              {[
                { name: 'Publish scheduled posts', schedule: 'Every minute', path: '/api/cron/publish-scheduled' },
                { name: 'Poll mentions', schedule: 'Every 5 minutes', path: '/api/cron/poll-mentions' },
                { name: 'Poll metrics', schedule: 'Every 15 minutes', path: '/api/cron/poll-metrics' },
                { name: 'Social listening', schedule: 'Every 10 minutes', path: '/api/cron/poll-listening' },
                { name: 'Daily analytics', schedule: 'Daily at 2 AM', path: '/api/cron/daily-analytics' },
                { name: 'AI insights', schedule: 'Weekly on Monday 6 AM', path: '/api/cron/weekly-ai-insights' },
                { name: 'KOL activations', schedule: 'Every 30 minutes', path: '/api/cron/kol-activations' },
              ].map((cron) => (
                <div key={cron.path} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{cron.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{cron.path}</span>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{cron.schedule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          COST TRACKER TAB — real data only
         ══════════════════════════════════════════════════════════ */}
      {subTab === 'costs' && (
        <div>
          {costsQ.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
              </div>
            </div>
          ) : totalCalls === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">{'📊'}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No API costs yet</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Cost tracking data will appear here once your cron jobs start running
                and making API calls to X, Reddit, and Claude. Connect an account first to get started.
              </p>
            </div>
          ) : (
            <>
              {/* Total cost summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Last 30 Days — API Cost</p>
                    <p className="text-4xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {totalCalls.toLocaleString()} total API calls
                    </p>
                  </div>
                </div>
              </div>

              {/* Cost by provider */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                <SectionTitle>Cost by Provider</SectionTitle>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {['Provider', 'Calls', 'Cost'].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byProvider).map(([provider, data]) => (
                      <tr key={provider} className="border-b border-gray-100">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: providerColors[provider] || '#6b7280' }}
                            />
                            <span className="font-medium text-gray-900">
                              {providerLabels[provider] || provider}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">{data.callCount.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-bold">${data.totalCost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Daily trend chart */}
              {timeSeries.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <SectionTitle>Daily Cost Trend</SectionTitle>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart
                      data={timeSeries.map((d) => ({
                        date: d.date,
                        ...Object.fromEntries(
                          Object.entries(d.providers).map(([p, v]) => [p, v.cost])
                        ),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                      {Object.keys(byProvider).map((provider) => (
                        <Area
                          key={provider}
                          type="monotone"
                          dataKey={provider}
                          stackId="1"
                          stroke={providerColors[provider] || '#6b7280'}
                          fill={providerColors[provider] || '#6b7280'}
                          fillOpacity={0.3}
                          name={providerLabels[provider] || provider}
                        />
                      ))}
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ROADMAP TAB
         ══════════════════════════════════════════════════════════ */}
      {subTab === 'roadmap' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard
              label="Features Deployed"
              value={`${totalDeployed} / ${totalItems}`}
              delta={Math.round((totalDeployed / totalItems) * 100)}
              deltaLabel="complete"
            />
            <MetricCard
              label="In Progress"
              value={roadmapItems.filter((r) => r.status === 'in_progress').length}
            />
            <MetricCard label="Current Phase" value="Phase 2" />
            <MetricCard label="Accounts Connected" value={accounts.length} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm text-gray-500">
                {totalDeployed}/{totalItems} features ({Math.round((totalDeployed / totalItems) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                style={{ width: `${(totalDeployed / totalItems) * 100}%` }}
              />
            </div>
          </div>

          {['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4a', 'Phase 4b', 'Phase 4c'].map((phase) => {
            const items = roadmapItems.filter((r) => r.phase === phase);
            if (items.length === 0) return null;
            const deployed = items.filter((r) => r.status === 'deployed').length;
            const isCurrentPhase = items.some((r) => r.status === 'in_progress');
            return (
              <div
                key={phase}
                className={`bg-white rounded-xl border p-5 mb-4 ${
                  isCurrentPhase ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">{phase}</h4>
                    {isCurrentPhase && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {deployed}/{items.length} deployed
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.status === 'deployed'
                              ? 'bg-green-400'
                              : item.status === 'in_progress'
                              ? 'bg-blue-400 animate-pulse'
                              : 'bg-gray-300'
                          }`}
                        />
                        <span
                          className={`text-sm ${
                            item.status === 'deployed'
                              ? 'text-gray-500'
                              : 'text-gray-900 font-medium'
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {item.deployed && (
                          <span className="text-xs text-gray-400">
                            Shipped {item.deployed}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.status]}`}
                        >
                          {statusLabels[item.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
