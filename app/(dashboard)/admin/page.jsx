'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { trpc } from '@/lib/trpc-client';
import { MetricCard, SectionTitle, TabButton, PlatformBadge, Skeleton, useChartColors } from '@/components/ui';

// ── Static roadmap data (internal planning, not from API) ───
// Last updated: Mar 14, 2026 — Sprint 5 (Reddit + cost optimization)
const roadmapItems = [
  // Phase 1: Foundation — COMPLETE
  { id: 1, phase: 'Phase 1', title: 'Project scaffolding + Prisma schema (30+ models)', status: 'deployed', deployed: 'Jan 15' },
  { id: 2, phase: 'Phase 1', title: 'OAuth account connection (X via OAuth 2.0)', status: 'deployed', deployed: 'Jan 22' },
  { id: 3, phase: 'Phase 1', title: 'Post composer + preview (single, thread, article)', status: 'deployed', deployed: 'Feb 5' },
  { id: 4, phase: 'Phase 1', title: 'Scheduling + publish cron (every minute)', status: 'deployed', deployed: 'Feb 10' },
  { id: 5, phase: 'Phase 1', title: 'Calendar view (month + week)', status: 'deployed', deployed: 'Feb 14' },
  { id: 6, phase: 'Phase 1', title: 'RBAC + team invitations (Admin/Internal/Agency)', status: 'deployed', deployed: 'Feb 20' },
  { id: 7, phase: 'Phase 1', title: 'Hybrid X adapter (Official writes, TwitterAPI.io reads)', status: 'deployed', deployed: 'Feb 24' },
  { id: 8, phase: 'Phase 1', title: 'Admin panel + cost tracker + polling config', status: 'deployed', deployed: 'Feb 28' },

  // Phase 2: Intelligence Layer — COMPLETE
  { id: 9, phase: 'Phase 2', title: 'Thread composer mutations + field wiring', status: 'deployed', deployed: 'Mar 5' },
  { id: 10, phase: 'Phase 2', title: 'Metrics poller + batch tweet fetching (100/req)', status: 'deployed', deployed: 'Mar 5' },
  { id: 11, phase: 'Phase 2', title: 'Dashboard with real mentions + period comparison', status: 'deployed', deployed: 'Mar 7' },
  { id: 12, phase: 'Phase 2', title: 'Social listening + AI query generation', status: 'deployed', deployed: 'Mar 7' },
  { id: 13, phase: 'Phase 2', title: 'KOL tracking + AI scoring (A–F, 4 factors)', status: 'deployed', deployed: 'Mar 7' },
  { id: 14, phase: 'Phase 2', title: 'Competitor monitoring + share-of-voice', status: 'deployed', deployed: 'Mar 7' },
  { id: 15, phase: 'Phase 2', title: 'AI reports (5 types) + dynamic renderer', status: 'deployed', deployed: 'Mar 9' },
  { id: 16, phase: 'Phase 2', title: 'Conversational listening (clarifying questions)', status: 'deployed', deployed: 'Mar 9' },

  // Phase 3: Hardening & DX — COMPLETE
  { id: 17, phase: 'Phase 3', title: 'Error boundary + toast notification system', status: 'deployed', deployed: 'Mar 9' },
  { id: 18, phase: 'Phase 3', title: 'README + .env.example documentation', status: 'deployed', deployed: 'Mar 9' },
  { id: 19, phase: 'Phase 3', title: 'Cron job failure alerting + observability', status: 'deployed', deployed: 'Mar 9' },
  { id: 20, phase: 'Phase 3', title: 'Lib directory restructure (adapters/, etc.)', status: 'deployed', deployed: 'Mar 9' },
  { id: 21, phase: 'Phase 3', title: 'PRD v1.0 documentation', status: 'deployed', deployed: 'Mar 9' },

  // Phase 4: Data Quality & Accuracy — COMPLETE
  { id: 22, phase: 'Phase 4', title: 'Sentiment drivers, SOV, benchmark remediation', status: 'deployed', deployed: 'Mar 10' },
  { id: 23, phase: 'Phase 4', title: 'Follower snapshots — backfill zeros + gap prevention', status: 'deployed', deployed: 'Mar 11' },
  { id: 24, phase: 'Phase 4', title: 'Fix poll-metrics to snapshot all active accounts', status: 'deployed', deployed: 'Mar 11' },
  { id: 25, phase: 'Phase 4', title: 'KOL profile pictures + competitor quality thresholds', status: 'deployed', deployed: 'Mar 12' },
  { id: 26, phase: 'Phase 4', title: 'Listening accuracy — AI prompt, scoring, KOL gate', status: 'deployed', deployed: 'Mar 12' },
  { id: 27, phase: 'Phase 4', title: 'Functional account switcher dropdown + filtering', status: 'deployed', deployed: 'Mar 13' },
  { id: 28, phase: 'Phase 4', title: 'Sentiment trend uses original post timestamps', status: 'deployed', deployed: 'Mar 13' },

  // Phase 5: Reddit & Cost Optimization — IN PROGRESS
  { id: 29, phase: 'Phase 5', title: 'SociaVault Reddit adapter + search normalization', status: 'deployed', deployed: 'Mar 13' },
  { id: 30, phase: 'Phase 5', title: 'Figure subreddit monitoring (r/FigureTech, r/FigureMarkets, r/FIGR)', status: 'deployed', deployed: 'Mar 14' },
  { id: 31, phase: 'Phase 5', title: 'Subreddit metrics tracking — subscribers, posts, engagement', status: 'deployed', deployed: 'Mar 14' },
  { id: 32, phase: 'Phase 5', title: 'Reddit polling throttle (3x/day via Redis KV)', status: 'deployed', deployed: 'Mar 14' },
  { id: 33, phase: 'Phase 5', title: 'Global Reddit search — 80% cost reduction', status: 'deployed', deployed: 'Mar 14' },
  { id: 34, phase: 'Phase 5', title: 'Reddit Communities card on dashboard', status: 'deployed', deployed: 'Mar 14' },
  { id: 35, phase: 'Phase 5', title: 'SociaVault cost logging in API tracker', status: 'deployed', deployed: 'Mar 14' },
  { id: 36, phase: 'Phase 5', title: 'Infrastructure overview + updated cost tracker', status: 'deployed', deployed: 'Mar 14' },
  { id: 37, phase: 'Phase 5', title: 'Account switcher stacking fix + dropdown z-index', status: 'deployed', deployed: 'Mar 14' },
  { id: 38, phase: 'Phase 5', title: 'KOL AI scoring wired up (scoreAll + weekly cron)', status: 'deployed', deployed: 'Mar 14' },
  { id: 39, phase: 'Phase 5', title: 'KOL metrics aggregation cron (engagement stats)', status: 'deployed', deployed: 'Mar 14' },

  // Phase 6: Planned — NOT STARTED
  { id: 40, phase: 'Phase 6', title: 'Individual auth (SSO/email login, audit trail)', status: 'not_started', deployed: null },
  { id: 41, phase: 'Phase 6', title: 'Image/media upload in posts', status: 'not_started', deployed: null },
  { id: 42, phase: 'Phase 6', title: 'Mobile-responsive layout', status: 'not_started', deployed: null },
  { id: 43, phase: 'Phase 6', title: 'LinkedIn integration + multi-platform publishing', status: 'not_started', deployed: null },
];

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-surface-secondary rounded-xl" />}>
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
  const chartColors = useChartColors();
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

  const [scoringStatus, setScoringStatus] = useState(null);
  const scoreAllMutation = trpc.kol.scoreAll.useMutation({
    onSuccess: (data) => {
      setScoringStatus({ type: 'success', text: `Scored ${data.scored} KOLs${data.failed ? `, ${data.failed} failed` : ''}` });
    },
    onError: (err) => {
      setScoringStatus({ type: 'error', text: err.message });
    },
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
    sociavault: '#ff6b35',
    claude: '#8b5cf6',
  };
  const providerLabels = {
    x_official: 'X Official API',
    twitterapi_io: 'TwitterAPI.io',
    reddit: 'Reddit (Legacy)',
    sociavault: 'SociaVault (Reddit)',
    claude: 'Claude AI',
  };

  const totalDeployed = roadmapItems.filter((r) => r.status === 'deployed').length;
  const totalItems = roadmapItems.length;

  const statusColors = {
    deployed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    not_started: 'bg-surface-secondary text-content-secondary',
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
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 rounded-lg text-sm text-green-800 dark:text-green-300">
          {successParam === 'x_connected' && 'X (Twitter) account connected successfully!'}
          {successParam === 'reddit_connected' && 'Reddit account connected successfully!'}
        </div>
      )}
      {errorParam && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-lg text-sm text-red-800 dark:text-red-300">
          Connection error: {errorParam.replace(/_/g, ' ')}
        </div>
      )}

      <div className="flex items-center gap-2 mb-6 border-b border-border pb-3">
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
          <div className="bg-surface-card rounded-xl border border-border p-6">
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
                    className="flex items-center justify-between p-4 border border-border-secondary rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        acct.platform === 'X' ? 'bg-gray-800' : 'bg-orange-500'
                      }`}>
                        {acct.platform === 'X' ? '\u{1D54F}' : 'R'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-content-primary">
                            @{acct.username}
                          </span>
                          <PlatformBadge platform={acct.platform} />
                        </div>
                        <p className="text-xs text-content-muted">
                          {acct.displayName || acct.username}
                          {' \u2022 Connected '}
                          {new Date(acct.connectedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        acct.isActive
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
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
              <div className="text-center py-8 mb-6 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <p className="text-content-muted text-sm mb-1">No accounts connected yet</p>
                <p className="text-content-faint text-xs">Connect your X or Reddit account to get started</p>
              </div>
            )}

            {/* Connect buttons */}
            <div className="flex items-center gap-3">
              <a
                href="/api/connect/x"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
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
          <div className="bg-surface-card rounded-xl border border-border p-6">
            <SectionTitle subtitle="Invite team members and manage roles">
              Team Management
            </SectionTitle>

            {/* Invite form */}
            <form onSubmit={handleInvite} className="flex items-end gap-3 mb-6">
              <div className="flex-1">
                <label className="block text-xs font-medium text-content-muted mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-surface-card focus:border-blue-500 focus:outline-none"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="INTERNAL">Internal</option>
                  <option value="AGENCY">Agency</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviteLoading}
                className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
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
              <div className="text-center py-6 text-sm text-content-muted">
                <p>Unable to load team members.</p>
                <p className="text-xs text-content-faint mt-1">
                  You may need ADMIN access. Sign out and back in to refresh your role.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Email', 'Name', 'Role', 'Joined', ''].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-content-muted uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border-secondary">
                      <td className="py-3 px-3 font-medium text-content-primary">{u.email}</td>
                      <td className="py-3 px-3 text-content-secondary">{u.name || '\u2014'}</td>
                      <td className="py-3 px-3">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            updateRoleMutation.mutate({ userId: u.id, role: e.target.value })
                          }
                          className="px-2 py-1 border border-border rounded text-xs bg-surface-card"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="INTERNAL">Internal</option>
                          <option value="AGENCY">Agency</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-content-muted text-xs">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-xs text-content-faint">
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
          <div className="bg-surface-card rounded-xl border border-border p-6">
            <SectionTitle subtitle="Configure how the platform reads from X/Twitter">
              API Configuration
            </SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-border-secondary rounded-lg">
                <h5 className="text-sm font-medium text-content-primary mb-1">X Read Provider</h5>
                <p className="text-xs text-content-muted mb-2">
                  Primary provider for reading X data. TwitterAPI.io is cheaper for reads.
                </p>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                    {process.env.NEXT_PUBLIC_X_READ_PROVIDER || 'twitterapi_io'}
                  </span>
                  <span className="text-xs text-content-faint">Set via X_READ_PROVIDER env var</span>
                </div>
              </div>
              <div className="p-4 border border-border-secondary rounded-lg">
                <h5 className="text-sm font-medium text-content-primary mb-1">Official API Fallback</h5>
                <p className="text-xs text-content-muted mb-2">
                  Fall back to official X API when third-party provider fails.
                </p>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                    Enabled
                  </span>
                  <span className="text-xs text-content-faint">Set via X_READ_FALLBACK_TO_OFFICIAL env var</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── AI Actions ──────────────────────────────────── */}
          <div className="bg-surface-card rounded-xl border border-border p-6">
            <SectionTitle subtitle="On-demand AI operations powered by Claude">
              AI Actions
            </SectionTitle>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-border-secondary bg-surface-page">
                <div>
                  <span className="text-sm font-medium text-content-primary">Score All KOLs</span>
                  <p className="text-xs text-content-muted mt-0.5">
                    Run Claude AI scoring on all active KOLs (A–F grade, 4-factor analysis).
                    Also runs automatically every Monday at 6 AM UTC.
                  </p>
                </div>
                <button
                  onClick={() => { setScoringStatus(null); scoreAllMutation.mutate(); }}
                  disabled={scoreAllMutation.isLoading}
                  className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {scoreAllMutation.isLoading ? 'Scoring...' : 'Run Now'}
                </button>
              </div>
              {scoringStatus && (
                <div className={`px-4 py-2 rounded-lg text-sm ${
                  scoringStatus.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200'
                }`}>
                  {scoringStatus.text}
                </div>
              )}
            </div>
          </div>

          {/* ── Polling & Data ────────────────────────────────── */}
          <div className="bg-surface-card rounded-xl border border-border p-6">
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
                { name: 'Subreddit metrics', schedule: 'Daily at 4 AM', path: '/api/cron/poll-subreddit-metrics' },
                { name: 'KOL metrics aggregation', schedule: 'Daily at 5 AM', path: '/api/cron/aggregate-kol-metrics' },
              ].map((cron) => (
                <div key={cron.path} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-hover">
                  <div>
                    <span className="text-sm font-medium text-content-primary">{cron.name}</span>
                    <span className="text-xs text-content-faint ml-2">{cron.path}</span>
                  </div>
                  <span className="text-xs text-content-muted bg-surface-secondary px-2 py-1 rounded">{cron.schedule}</span>
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
            <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
              <div className="text-4xl mb-3">{'📊'}</div>
              <h3 className="text-lg font-semibold text-content-primary mb-1">No API costs yet</h3>
              <p className="text-sm text-content-muted max-w-md mx-auto">
                Cost tracking data will appear here once your cron jobs start running
                and making API calls to X, Reddit, and Claude. Connect an account first to get started.
              </p>
            </div>
          ) : (
            <>
              {/* Total cost summary */}
              <div className="bg-surface-card rounded-xl border border-border p-6 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-content-muted mb-1">Last 30 Days — API Cost</p>
                    <p className="text-4xl font-bold text-content-primary">${totalCost.toFixed(2)}</p>
                    <p className="text-sm text-content-muted mt-1">
                      {totalCalls.toLocaleString()} total API calls
                    </p>
                  </div>
                </div>
              </div>

              {/* Cost by provider */}
              <div className="bg-surface-card rounded-xl border border-border p-5 mb-6">
                <SectionTitle>Cost by Provider</SectionTitle>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Provider', 'Calls', 'Cost'].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-medium text-content-muted uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byProvider).map(([provider, data]) => (
                      <tr key={provider} className="border-b border-border-secondary">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: providerColors[provider] || '#6b7280' }}
                            />
                            <span className="font-medium text-content-primary">
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
                <div className="bg-surface-card rounded-xl border border-border p-5 mb-6">
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
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, color: chartColors.tooltipText }} />
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

          {/* ── Infrastructure Overview (always shown) ─────────── */}
          <div className="bg-surface-card rounded-xl border border-border p-6 mt-6">
            <SectionTitle subtitle="Fixed and usage-based costs across all platform services">
              Infrastructure Overview
            </SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  name: 'SociaVault',
                  icon: '🔍',
                  color: 'border-orange-200 bg-orange-50',
                  plan: 'Starter — $29 / 6,000 credits',
                  usage: '~42 credits/day (throttled 3x/day + global search)',
                  projected: '~$6/mo (pack lasts ~5 months)',
                  details: 'Reddit scraping: search, subreddit monitoring, metrics polling',
                },
                {
                  name: 'TwitterAPI.io',
                  icon: '🐦',
                  color: 'border-blue-200 bg-blue-50',
                  plan: 'Pay-as-you-go — $0.15/1K requests',
                  usage: `${(byProvider.twitterapi_io?.callCount || 0).toLocaleString()} calls (last 30d)`,
                  projected: `$${((byProvider.twitterapi_io?.totalCost || 0)).toFixed(2)}/mo`,
                  details: 'Tweet fetching, user profiles, mentions, metrics',
                },
                {
                  name: 'X Official API',
                  icon: '𝕏',
                  color: 'border-border bg-surface-page',
                  plan: 'Basic — $100/mo (write access)',
                  usage: `${(byProvider.x_official?.callCount || 0).toLocaleString()} calls (last 30d)`,
                  projected: '$100/mo (fixed)',
                  details: 'Publishing posts, threads. Reads fall back to TwitterAPI.io',
                },
                {
                  name: 'Claude AI (Anthropic)',
                  icon: '🧠',
                  color: 'border-purple-200 bg-purple-50',
                  plan: 'Haiku 3.5 — $0.25/MTok in, $1.25/MTok out',
                  usage: `${(byProvider.claude?.callCount || 0).toLocaleString()} calls (last 30d)`,
                  projected: `$${((byProvider.claude?.totalCost || 0)).toFixed(2)}/mo`,
                  details: 'Sentiment analysis, listening scoring, KOL evaluation, reports',
                },
                {
                  name: 'Vercel',
                  icon: '▲',
                  color: 'border-border bg-surface-page',
                  plan: 'Pro — $20/mo',
                  usage: 'Hosting, serverless functions, cron jobs',
                  projected: '$20/mo (fixed)',
                  details: 'Next.js hosting, 8 cron jobs, edge functions',
                },
                {
                  name: 'Neon (PostgreSQL)',
                  icon: '🐘',
                  color: 'border-green-200 bg-green-50',
                  plan: 'Free tier',
                  usage: '30+ tables, connection pooling',
                  projected: '$0/mo',
                  details: 'Primary database with Prisma ORM, branching support',
                },
                {
                  name: 'Upstash (Redis KV)',
                  icon: '⚡',
                  color: 'border-red-200 bg-red-50',
                  plan: 'Free tier — 10K commands/day',
                  usage: 'Rate limiting, poll throttle, cron locking',
                  projected: '$0/mo',
                  details: 'Reddit polling throttle (8-hr interval), cron deduplication',
                },
              ].map((svc) => (
                <div key={svc.name} className={`p-4 border rounded-lg ${svc.color}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{svc.icon}</span>
                    <h5 className="text-sm font-semibold text-content-primary">{svc.name}</h5>
                  </div>
                  <p className="text-xs text-content-secondary mb-1">{svc.plan}</p>
                  <p className="text-xs text-content-muted mb-1">{svc.usage}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                    <span className="text-xs text-content-faint">{svc.details}</span>
                    <span className="text-sm font-bold text-content-primary whitespace-nowrap ml-2">{svc.projected}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-surface-page rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-content-secondary">Estimated Total Monthly Cost</span>
                <span className="text-lg font-bold text-content-primary">
                  ~${(
                    126 + // X Official ($100) + Vercel ($20) + SociaVault ($6)
                    (byProvider.twitterapi_io?.totalCost || 0) +
                    (byProvider.claude?.totalCost || 0) +
                    (byProvider.sociavault?.totalCost || 0)
                  ).toFixed(0)}/mo
                </span>
              </div>
              <p className="text-xs text-content-faint mt-1">
                Fixed: $120/mo (X Official + Vercel). Variable: TwitterAPI.io + Claude + SociaVault based on usage.
              </p>
            </div>
          </div>
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
            <MetricCard label="Current Phase" value="Phase 5" />
            <MetricCard label="Accounts Connected" value={accounts.length} />
          </div>

          <div className="bg-surface-card rounded-xl border border-border p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-content-secondary">Overall Progress</span>
              <span className="text-sm text-content-muted">
                {totalDeployed}/{totalItems} features ({Math.round((totalDeployed / totalItems) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-surface-tertiary rounded-full h-3">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                style={{ width: `${(totalDeployed / totalItems) * 100}%` }}
              />
            </div>
          </div>

          {['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6'].map((phase) => {
            const items = roadmapItems.filter((r) => r.phase === phase);
            if (items.length === 0) return null;
            const deployed = items.filter((r) => r.status === 'deployed').length;
            const isCurrentPhase = items.some((r) => r.status === 'in_progress');
            return (
              <div
                key={phase}
                className={`bg-surface-card rounded-xl border p-5 mb-4 ${
                  isCurrentPhase ? 'border-blue-300 ring-1 ring-blue-100' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-content-primary">{phase}</h4>
                    {isCurrentPhase && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-content-muted">
                    {deployed}/{items.length} deployed
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-hover"
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
                              ? 'text-content-muted'
                              : 'text-content-primary font-medium'
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {item.deployed && (
                          <span className="text-xs text-content-faint">
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
