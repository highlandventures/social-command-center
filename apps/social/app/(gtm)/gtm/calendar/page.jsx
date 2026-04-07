'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const typeStyles = {
  LAUNCH: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300 dark:border-blue-700', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
  TENTPOLE: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-300 dark:border-purple-700', dot: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300' },
  EVENT: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  CAMPAIGN: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
  MILESTONE: { bg: 'bg-gray-50 dark:bg-gray-800/40', border: 'border-gray-300 dark:border-gray-600', dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400' },
  ACTIVATION: { bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-300 dark:border-pink-700', dot: 'bg-pink-400', text: 'text-pink-700 dark:text-pink-300' },
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
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            typeFilter === 'ALL'
              ? 'bg-surface-card border-border text-content-primary shadow-sm'
              : 'border-transparent text-content-muted hover:bg-surface-hover'
          }`}
        >
          All
        </button>
        {Object.entries(typeLabels).filter(([k]) => k !== 'ACTIVATION').map(([key, label]) => {
          const style = typeStyles[key];
          return (
            <button
              key={key}
              onClick={() => setTypeFilter(typeFilter === key ? 'ALL' : key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors flex items-center gap-1.5 ${
                typeFilter === key
                  ? `${style.bg} ${style.border} ${style.text}`
                  : 'border-transparent text-content-muted hover:bg-surface-hover'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              {label}
            </button>
          );
        })}
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
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, monthIdx) => {
            const monthMoments = monthGroups[monthIdx] || [];
            const isCurrentMonth = year === now.getFullYear() && monthIdx === currentMonth;
            const isEmpty = monthMoments.length === 0;

            return (
              <div
                key={monthIdx}
                className={`rounded-xl border transition-colors ${
                  isCurrentMonth
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-900/10'
                    : isEmpty
                    ? 'border-border bg-surface-card/50'
                    : 'border-border bg-surface-card'
                }`}
              >
                <div className={`flex items-center gap-3 px-5 py-3 ${!isEmpty ? 'border-b border-border' : ''}`}>
                  <span className={`text-sm font-semibold ${
                    isCurrentMonth ? 'text-emerald-700 dark:text-emerald-300' : 'text-content-primary'
                  }`}>
                    {FULL_MONTHS[monthIdx]}
                  </span>
                  {isCurrentMonth && (
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500 text-white rounded-full">
                      NOW
                    </span>
                  )}
                  <span className="text-xs text-content-faint">
                    {monthMoments.length > 0 ? `${monthMoments.length} moment${monthMoments.length > 1 ? 's' : ''}` : ''}
                  </span>
                </div>

                {monthMoments.length > 0 && (
                  <div className="px-5 py-3 space-y-2">
                    {monthMoments.map((m) => {
                      const style = typeStyles[m.type] || typeStyles.MILESTONE;
                      const isMultiDay = !m.date && m.startDate && m.endDate;
                      const isExpanded = expandedId === m.id;

                      const dateStr = m.date
                        ? new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : `${new Date(m.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${new Date(m.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

                      return (
                        <div key={m.id}>
                          <div
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${style.bg} ${style.border} cursor-pointer transition-colors hover:opacity-90`}
                            onClick={() => {
                              if (isMultiDay && m.childMoments?.length > 0) {
                                setExpandedId(isExpanded ? null : m.id);
                              }
                            }}
                          >
                            <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${style.dot}`} />
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-medium ${style.text}`}>{m.label}</span>
                            </div>
                            <span className={`text-xs ${style.text} opacity-70`}>{dateStr}</span>
                            <span className={`text-[10px] uppercase font-medium ${style.text} opacity-60`}>{m.type}</span>
                            {m.project && (
                              <Link
                                href={`/gtm/projects/${m.project.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-content-faint hover:text-blue-600 dark:hover:text-blue-400 underline-offset-2 hover:underline"
                              >
                                {m.project.name}
                              </Link>
                            )}
                            {isMultiDay && m.childMoments?.length > 0 && (
                              <svg
                                className={`w-3.5 h-3.5 text-content-faint transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            )}
                          </div>

                          {/* Expanded child activations */}
                          {isExpanded && m.childMoments && m.childMoments.length > 0 && (
                            <div className="ml-6 mt-1 space-y-1 pl-3 border-l-2 border-border">
                              {m.childMoments.map((child) => {
                                const childStyle = typeStyles[child.type] || typeStyles.ACTIVATION;
                                const childDate = child.date
                                  ? new Date(child.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                  : '';

                                return (
                                  <div key={child.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${childStyle.bg} border ${childStyle.border}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${childStyle.dot}`} />
                                    <span className={`text-xs font-medium ${childStyle.text} flex-1`}>{child.label}</span>
                                    <span className={`text-[10px] ${childStyle.text} opacity-70`}>{childDate}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
