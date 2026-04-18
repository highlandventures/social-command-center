'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const accentBorder = {
  LAUNCH: 'border-l-blue-500',
  TENTPOLE: 'border-l-purple-500',
  EVENT: 'border-l-emerald-500',
  CAMPAIGN: 'border-l-amber-500',
  MILESTONE: 'border-l-slate-400',
  ACTIVATION: 'border-l-pink-400',
};

const pillStyle = {
  LAUNCH: 'border-blue-400/50 text-blue-600 dark:text-blue-400',
  TENTPOLE: 'border-purple-400/50 text-purple-600 dark:text-purple-400',
  EVENT: 'border-emerald-400/50 text-emerald-600 dark:text-emerald-400',
  CAMPAIGN: 'border-amber-400/50 text-amber-600 dark:text-amber-400',
  MILESTONE: 'border-slate-300/50 text-slate-500 dark:text-slate-400',
  ACTIVATION: 'border-pink-400/50 text-pink-500 dark:text-pink-400',
};

const dotColor = {
  LAUNCH: 'bg-blue-500',
  TENTPOLE: 'bg-purple-500',
  EVENT: 'bg-emerald-500',
  CAMPAIGN: 'bg-amber-500',
  MILESTONE: 'bg-slate-400',
  ACTIVATION: 'bg-pink-400',
};

const typeLabels = { LAUNCH: 'Launch', TENTPOLE: 'Tentpole', EVENT: 'Event', CAMPAIGN: 'Campaign', MILESTONE: 'Milestone', ACTIVATION: 'Activation' };

export default function GtmCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [expandedId, setExpandedId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('ALL');

  const { data: moments, isLoading } = trpc.gtmMoments.list.useQuery({
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  });

  // Group moments by month
  const monthGroups = useMemo(() => {
    if (!moments) return {};
    const groups = {};

    const filtered = typeFilter === 'ALL' ? moments : moments.filter((m) => m.type === typeFilter);

    filtered.forEach((m) => {
      const d = m.date ? new Date(m.date) : m.startDate ? new Date(m.startDate) : null;
      if (!d) return;
      const key = d.getMonth();
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });

    // Sort each month by date
    Object.values(groups).forEach((arr) => {
      arr.sort((a, b) => {
        const da = a.date ? new Date(a.date) : new Date(a.startDate);
        const db = b.date ? new Date(b.date) : new Date(b.startDate);
        return da - db;
      });
    });

    return groups;
  }, [moments, typeFilter]);

  const currentMonth = now.getMonth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-content-primary">GTM Calendar</h2>
          <p className="text-sm text-content-muted mt-0.5">
            The drumbeat of launches, events, and activations
          </p>
        </div>

        {/* Year nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(year - 1)}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-content-muted transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-content-primary min-w-[3rem] text-center">{year}</span>
          <button
            onClick={() => setYear(year + 1)}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-content-muted transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('ALL')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            typeFilter === 'ALL'
              ? 'bg-surface-card border border-border text-content-primary shadow-sm'
              : 'text-content-muted hover:bg-surface-hover'
          }`}
        >
          All
        </button>
        {Object.entries(typeLabels).filter(([k]) => k !== 'ACTIVATION').map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTypeFilter(typeFilter === key ? 'ALL' : key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
              typeFilter === key
                ? `border ${pillStyle[key]} bg-surface-card shadow-sm`
                : 'text-content-muted hover:bg-surface-hover'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dotColor[key]}`} />
            {label}
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-skeleton rounded w-24 mb-4" />
              <div className="h-12 bg-skeleton rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from({ length: 12 }).map((_, monthIdx) => {
            const monthMoments = monthGroups[monthIdx] || [];
            if (monthMoments.length === 0) return null;

            const isCurrentMonth = year === now.getFullYear() && monthIdx === currentMonth;

            return (
              <div key={monthIdx}>
                {/* Month header */}
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-sm font-semibold ${
                    isCurrentMonth ? 'text-emerald-600 dark:text-emerald-400' : 'text-content-primary'
                  }`}>
                    {FULL_MONTHS[monthIdx]}
                  </span>
                  {isCurrentMonth && (
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500 text-white rounded-full">
                      NOW
                    </span>
                  )}
                  <span className="text-xs text-content-faint">
                    {monthMoments.length} moment{monthMoments.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex-1 border-t border-border" />
                </div>

                {/* Moment rows */}
                <div className="space-y-1">
                  {monthMoments.map((m) => {
                    const borderClass = accentBorder[m.type] || accentBorder.MILESTONE;
                    const pill = pillStyle[m.type] || pillStyle.MILESTONE;
                    const isMultiDay = !m.date && m.startDate && m.endDate;
                    const isExpanded = expandedId === m.id;
                    const hasChildren = isMultiDay && m.childMoments?.length > 0;

                    const dateStr = m.date
                      ? new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : `${new Date(m.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${new Date(m.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

                    return (
                      <div key={m.id}>
                        <div
                          className={`flex items-center gap-3 px-3 py-2 rounded-r-lg bg-surface-card border border-border border-l-[3px] ${borderClass} ${hasChildren ? 'cursor-pointer' : ''} transition-colors hover:bg-surface-hover`}
                          onClick={() => {
                            if (hasChildren) setExpandedId(isExpanded ? null : m.id);
                          }}
                        >
                          {/* Date */}
                          <span className="text-xs text-content-muted tabular-nums w-[80px] shrink-0">
                            {dateStr}
                          </span>

                          {/* Type pill — width fits the longest label (ACTIVATION) so
                              none of the uppercase text spills past the pill border at
                              narrow viewports (ticket cmo3kwtps). */}
                          <span className={`text-[10px] uppercase font-medium border rounded-full px-2 py-0.5 w-[76px] text-center shrink-0 whitespace-nowrap opacity-70 ${pill}`}>
                            {typeLabels[m.type] || m.type}
                          </span>

                          {/* Label */}
                          <span className="text-sm font-medium text-content-primary flex-1 min-w-0 truncate">
                            {m.label}
                          </span>

                          {/* Project link */}
                          {m.project && (
                            <Link
                              href={`/gtm/projects/${m.project.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-content-faint hover:text-blue-600 dark:hover:text-blue-400 underline-offset-2 hover:underline truncate max-w-[160px] shrink-0"
                            >
                              {m.project.name}
                            </Link>
                          )}

                          {/* Expand chevron */}
                          {hasChildren && (
                            <svg
                              className={`w-3.5 h-3.5 text-content-faint transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          )}
                        </div>

                        {/* Expanded children */}
                        {isExpanded && m.childMoments && m.childMoments.length > 0 && (
                          <div className="ml-6 mt-0.5 space-y-0.5 pl-3 border-l-2 border-border">
                            {m.childMoments.map((child) => {
                              const childDot = dotColor[child.type] || dotColor.ACTIVATION;
                              const childDate = child.date
                                ? new Date(child.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                : '';

                              return (
                                <div key={child.id} className="flex items-center gap-2.5 px-2 py-1.5 text-xs">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${childDot}`} />
                                  <span className="text-content-muted tabular-nums w-[100px] shrink-0">{childDate}</span>
                                  <span className="text-content-secondary flex-1 min-w-0 truncate">{child.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
