'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

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

export default function HubPage() {
  const { user: clerkUser } = useUser();
  const firstName = clerkUser?.firstName
    || (clerkUser?.primaryEmailAddress?.emailAddress || '').split('@')[0];

  return (
    <div>
      {/* Hero */}
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-content-primary mb-1">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h2>
        <p className="text-content-muted">
          Select a module to get started.
        </p>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {modules.map((mod) => (
          <ModuleCard key={mod.key} mod={mod} />
        ))}
      </div>
    </div>
  );
}
