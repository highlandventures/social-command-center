'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';

import { useSession } from 'next-auth/react';
import { PlatformBadge, Skeleton } from '@/components/ui';
import CalendarSection from '@/components/hub/CalendarSection';
import EmailSection from '@/components/hub/EmailSection';
import TasksSection from '@/components/hub/TasksSection';

// ── Helpers ─────────────────────────────────────────────────
function formatNumber(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function timeUntil(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((d - now) / 1000);
  if (seconds < 0) return timeAgo(date);
  if (seconds < 3600) return `in ${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

function truncate(str, len = 60) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// ── Delta Badge ─────────────────────────────────────────────
function DeltaBadge({ value }) {
  if (value == null || value === 0) return null;
  const isPositive = value > 0;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${
      isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
    }`}>
      {isPositive ? '\u2191' : '\u2193'}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// ── Stat Card ───────────────────────────────────────────────
function StatCard({ label, value, delta, highlight, icon }) {
  return (
    <div className={`bg-surface-card rounded-xl border p-4 ${
      highlight ? 'border-amber-500/40' : 'border-border'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-content-muted text-xs">{icon}</span>
        <span className="text-xs font-medium text-content-muted">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${
          highlight && value > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-content-primary'
        }`}>
          {value != null ? (typeof value === 'string' ? value : formatNumber(value)) : '—'}
        </span>
        {delta != null && <DeltaBadge value={delta} />}
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-surface-card rounded-xl border border-border p-4">
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-7 w-14 mb-1" />
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

// ── Stats Bar ───────────────────────────────────────────────
function StatsBar() {
  const dashboard = trpc.analytics.dashboard.useQuery(
    { range: '30d' },
    { staleTime: 300_000 }
  );
  const approvalStats = trpc.approvals.stats.useQuery(undefined, {
    staleTime: 300_000,
  });

  if (dashboard.isLoading || approvalStats.isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
    );
  }

  const d = dashboard.data;
  const a = approvalStats.data;

  // Empty state — no data at all
  if (!d && !a) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <StatCard
        icon={<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
        label="Followers"
        value={d?.totalFollowers}
        delta={d?.followersDelta}
      />
      <StatCard
        icon={<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
        label="Impressions (30d)"
        value={d?.impressions}
        delta={d?.impressionsDelta}
      />
      <StatCard
        icon={<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
        label="Eng. Rate"
        value={d?.engagementRate != null ? `${d.engagementRate.toFixed(1)}%` : null}
        delta={d?.engagementRateDelta}
      />
      <StatCard
        icon={<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
        label="Pending Reviews"
        value={a?.pending ?? 0}
        highlight={a?.pending > 0}
      />
    </div>
  );
}

// ── Pending Reviews Banner ──────────────────────────────────
function PendingReviewsBanner() {
  const { data } = trpc.approvals.stats.useQuery(undefined, {
    staleTime: 300_000,
  });

  if (!data?.pending) return null;

  return (
    <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-4 mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-sm text-amber-800 dark:text-amber-200">
          You have <span className="font-semibold">{data.pending}</span> post{data.pending !== 1 ? 's' : ''} awaiting L&C review
        </p>
      </div>
      <Link
        href="/reviews"
        className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline whitespace-nowrap"
      >
        Review now &rarr;
      </Link>
    </div>
  );
}

// ── Activity Section ────────────────────────────────────────
function ActivitySection({ title, href, linkText, children, isEmpty }) {
  if (isEmpty) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
        <Link href={href} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          {linkText} &rarr;
        </Link>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ActivityRow({ children }) {
  return (
    <div className="flex items-center gap-3 bg-surface-card rounded-lg border border-border px-3 py-2.5 text-sm">
      {children}
    </div>
  );
}

function ActivityRowSkeleton() {
  return (
    <div className="flex items-center gap-3 bg-surface-card rounded-lg border border-border px-3 py-2.5">
      <Skeleton className="h-5 w-12" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-16 ml-auto" />
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    PENDING: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    APPROVED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    CHANGES_REQUESTED: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    REJECTED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  };
  const labels = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    CHANGES_REQUESTED: 'Changes',
    REJECTED: 'Rejected',
  };
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}

// ── Recent Activity Feed ────────────────────────────────────
function RecentActivity() {
  const scheduled = trpc.posts.list.useQuery(
    { status: 'SCHEDULED', limit: 5 },
    { staleTime: 300_000 }
  );
  const published = trpc.posts.list.useQuery(
    { status: 'PUBLISHED', limit: 5 },
    { staleTime: 300_000 }
  );
  const approvals = trpc.approvals.list.useQuery(
    { limit: 5 },
    { staleTime: 300_000 }
  );

  const isLoading = scheduled.isLoading || published.isLoading || approvals.isLoading;
  const hasNoData =
    !scheduled.data?.items?.length &&
    !published.data?.items?.length &&
    !approvals.data?.approvals?.length;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <ActivityRowSkeleton key={i} />)}
      </div>
    );
  }

  if (hasNoData) return null;

  const scheduledItems = (scheduled.data?.items || [])
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));

  return (
    <div className="space-y-8">
      {/* Upcoming Scheduled */}
      <ActivitySection
        title="Upcoming Scheduled"
        href="/calendar"
        linkText="View calendar"
        isEmpty={!scheduledItems.length}
      >
        {scheduledItems.map((post) => (
          <ActivityRow key={post.id}>
            <PlatformBadge platform={post.account?.platform} />
            <span className="text-content-primary truncate flex-1">
              {truncate(post.content)}
            </span>
            <span className="text-xs text-content-muted whitespace-nowrap ml-auto">
              {timeUntil(post.scheduledFor)}
            </span>
          </ActivityRow>
        ))}
      </ActivitySection>

      {/* Recently Published */}
      <ActivitySection
        title="Recently Published"
        href="/dashboard"
        linkText="View dashboard"
        isEmpty={!published.data?.items?.length}
      >
        {(published.data?.items || []).map((post) => {
          const m = post.metrics?.[0];
          return (
            <ActivityRow key={post.id}>
              <PlatformBadge platform={post.account?.platform} />
              <span className="text-content-primary truncate flex-1">
                {truncate(post.content)}
              </span>
              <div className="flex items-center gap-3 ml-auto text-xs text-content-muted whitespace-nowrap">
                {m && (
                  <span>{formatNumber(m.impressions)} imp</span>
                )}
                <span>{timeAgo(post.publishedAt || post.createdAt)}</span>
              </div>
            </ActivityRow>
          );
        })}
      </ActivitySection>

      {/* Review Activity */}
      <ActivitySection
        title="Review Activity"
        href="/reviews"
        linkText="View all"
        isEmpty={!approvals.data?.approvals?.length}
      >
        {(approvals.data?.approvals || []).map((req) => (
          <ActivityRow key={req.id}>
            <StatusBadge status={req.status} />
            <PlatformBadge platform={req.post?.platform} />
            <span className="text-content-primary truncate flex-1">
              {truncate(req.post?.content)}
            </span>
            <div className="flex items-center gap-2 ml-auto text-xs text-content-muted whitespace-nowrap">
              <span>{req.requestedBy?.name || req.requestedBy?.email}</span>
              <span>{timeAgo(req.requestedAt)}</span>
            </div>
          </ActivityRow>
        ))}
      </ActivitySection>
    </div>
  );
}

// ── Module Cards (unchanged) ────────────────────────────────
const modules = [
  {
    key: 'social',
    name: 'Social Command Center',
    description: 'Compose, schedule, and analyze social media posts across X and Reddit. Includes listening, KOL tracking, competitor intel, and AI copilot.',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
    href: '/dashboard',
    active: true,
    color: 'blue',
  },
  {
    key: 'ads',
    name: 'Ads Manager',
    description: 'Manage paid campaigns across Google, Meta, and LinkedIn. Budget tracking, creative testing, and ROAS reporting.',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
      </svg>
    ),
    href: null,
    active: false,
    color: 'purple',
  },
  {
    key: 'gtm',
    name: 'GTM Projects',
    description: 'Track product launches, marketing moments, and cross-functional GTM initiatives. Calendar view of launches, tentpoles, and activations.',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    href: '/gtm',
    active: true,
    color: 'emerald',
  },
  {
    key: 'email',
    name: 'Email Campaigns',
    description: 'Design, schedule, and track email campaigns. Audience segmentation, A/B testing, and deliverability insights.',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    href: null,
    active: false,
    color: 'emerald',
  },
  {
    key: 'analytics',
    name: 'Analytics Hub',
    description: 'Unified cross-channel analytics. Attribution modeling, funnel analysis, and executive reporting across all marketing.',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    href: null,
    active: false,
    color: 'amber',
  },
];

const colorMap = {
  blue: {
    border: 'border-blue-500/40 hover:border-blue-500',
    iconBg: 'bg-blue-500/10',
    iconText: 'text-blue-500',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  purple: {
    border: 'border-purple-500/20',
    iconBg: 'bg-purple-500/10',
    iconText: 'text-purple-400',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  emerald: {
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    border: 'border-amber-500/20',
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-400',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
};

function ModuleCard({ mod }) {
  const colors = colorMap[mod.color];

  const card = (
    <div
      className={`relative bg-surface-card rounded-xl border-2 ${colors.border} p-6 transition-all duration-200 ${
        mod.active
          ? 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
          : 'opacity-50 cursor-default'
      }`}
    >
      {/* Icon */}
      <div className={`w-14 h-14 rounded-xl ${colors.iconBg} ${colors.iconText} flex items-center justify-center mb-4`}>
        {mod.icon}
      </div>

      {/* Title + badge */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-base font-semibold text-content-primary">
          {mod.name}
        </h3>
        {mod.active ? (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
            Live
          </span>
        ) : (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-tertiary text-content-faint">
            Coming Soon
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-content-muted leading-relaxed">
        {mod.description}
      </p>

      {/* Arrow for active */}
      {mod.active && (
        <div className="absolute top-6 right-6 text-content-faint">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      )}
    </div>
  );

  if (mod.active && mod.href) {
    return <Link href={mod.href}>{card}</Link>;
  }
  return card;
}

// ── Greeting Helper ──────────────────────────────────────────
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Section Header ──────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-10">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-content-faint">{title}</h3>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Main Hub Page ───────────────────────────────────────────
export default function HubPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0]
    || (session?.user?.email || '').split('@')[0];

  return (
    <div>
      {/* Hero */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-content-primary mb-1">
          {firstName ? `${getGreeting()}, ${firstName}` : getGreeting()}
        </h2>
        <p className="text-content-muted">
          Here&apos;s what&apos;s on your plate today.
        </p>
      </div>

      {/* Quick Stats */}
      <StatsBar />

      {/* Pending Reviews Banner */}
      <PendingReviewsBanner />

      {/* ── Home Hub: Calendar, Tasks, Email ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-2">
        {/* Left column: Calendar + Tasks */}
        <div className="lg:col-span-2 space-y-5">
          <CalendarSection />
          <TasksSection />
        </div>

        {/* Right column: Email */}
        <div className="lg:self-start lg:sticky lg:top-6">
          <EmailSection />
        </div>
      </div>

      {/* Modules */}
      <SectionHeader title="Modules" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {modules.map((mod) => (
          <ModuleCard key={mod.key} mod={mod} />
        ))}
      </div>

      {/* Recent Activity */}
      <SectionHeader title="Recent Activity" />
      <RecentActivity />
    </div>
  );
}
