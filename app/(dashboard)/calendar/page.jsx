'use client';

import { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc-client';
import { PlatformBadge, Skeleton, useToast } from '@/components/ui';

export default function CalendarPage() {
  const [view, setView] = useState('month');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // 0-indexed
  });
  const [dragOverDay, setDragOverDay] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null); // { postId, postLabel, originalTime, targetDay }
  const [newTime, setNewTime] = useState('09:15');

  const toast = useToast();
  const utils = trpc.useUtils();

  const updateMutation = trpc.posts.update.useMutation({
    onSuccess: () => {
      utils.posts.list.invalidate();
      toast.success('Post updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update post');
    },
  });

  const goToPrevMonth = () => {
    setCurrentMonth((prev) => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  };
  const goToNextMonth = () => {
    setCurrentMonth((prev) => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  };

  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  // Day of week the 1st falls on (0=Sun). Convert to Mon-start: (dow + 6) % 7
  const firstDayDow = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const startPadCount = (firstDayDow + 6) % 7;
  const today = new Date();
  const todayDay = today.getFullYear() === currentMonth.year && today.getMonth() === currentMonth.month ? today.getDate() : null;

  // ── tRPC queries ──────────────────────────────────────────
  const postsQ = trpc.posts.list.useQuery(undefined, { staleTime: 15_000 });
  const posts = postsQ.data?.items ?? [];

  // ── Build calendar data from real posts ───────────────────
  const scheduledPosts = posts.filter(
    (p) => p.status === 'SCHEDULED' || p.status === 'scheduled'
  );
  const publishedPosts = posts.filter(
    (p) => p.status === 'PUBLISHED' || p.status === 'published'
  );

  // Build a map of day => posts for the current month
  const calendarDays = useMemo(() => {
    const days = [];
    const postMap = {};

    // Map real posts to day numbers for the current month
    [...scheduledPosts, ...publishedPosts].forEach((p) => {
      const date = p.scheduledFor || p.publishedAt || p.createdAt;
      if (!date) return;
      const d = new Date(date);
      if (d.getMonth() === currentMonth.month && d.getFullYear() === currentMonth.year) {
        const dayNum = d.getDate();
        if (!postMap[dayNum]) postMap[dayNum] = [];
        postMap[dayNum].push({
          id: p.id,
          type: p.contentType?.toLowerCase() || p.type || 'post',
          platform: (p.platform || 'X').toLowerCase(),
          label: (p.content || '').slice(0, 40),
          time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          timeRaw: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
          status: (p.status || '').toLowerCase(),
          draggable: p.status === 'SCHEDULED',
        });
      }
    });

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, posts: postMap[d] || [], isToday: d === todayDay });
    }
    return days;
  }, [scheduledPosts, publishedPosts, currentMonth, daysInMonth, todayDay]);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const postColors = {
    scheduled: 'bg-blue-100 border-blue-200 text-blue-800',
    published: 'bg-green-100 border-green-200 text-green-800',
    ghost: 'bg-surface-page border-dashed border-gray-300 text-content-muted',
  };
  const platformDot = { x: 'bg-gray-800', reddit: 'bg-orange-500' };

  // ── Drag & Drop handlers ──────────────────────────────────
  const handleDragStart = useCallback((e, post) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      postId: post.id,
      postLabel: post.label,
      originalTime: post.timeRaw,
      originalTimeDisplay: post.time,
    }));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, dayNum) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDay(dayNum);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDay(null);
  }, []);

  const handleDrop = useCallback((e, targetDay) => {
    e.preventDefault();
    setDragOverDay(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      setNewTime(data.originalTime);
      setRescheduleModal({
        postId: data.postId,
        postLabel: data.postLabel,
        originalTime: data.originalTime,
        originalTimeDisplay: data.originalTimeDisplay,
        targetDay,
      });
    } catch { /* invalid drag data */ }
  }, []);

  const handleReschedule = useCallback((action) => {
    if (!rescheduleModal) return;
    const { postId, originalTime, targetDay } = rescheduleModal;

    if (action === 'drafts') {
      updateMutation.mutate({
        id: postId,
        data: { status: 'DRAFT', scheduledFor: null },
      });
    } else {
      const time = action === 'keep' ? originalTime : newTime;
      const [hours, minutes] = time.split(':').map(Number);
      const newDate = new Date(currentMonth.year, currentMonth.month, targetDay, hours, minutes);
      updateMutation.mutate({
        id: postId,
        data: { scheduledFor: newDate },
      });
    }
    setRescheduleModal(null);
  }, [rescheduleModal, newTime, currentMonth, updateMutation]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-content-primary">{monthName}</h2>
          <div className="flex items-center gap-1">
            <button onClick={goToPrevMonth} className="p-1 text-content-faint hover:text-content-secondary">{'\u2190'}</button>
            <button onClick={goToNextMonth} className="p-1 text-content-faint hover:text-content-secondary">{'\u2192'}</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['month', 'week', 'list'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize ${
                view === v
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                  : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
              }`}
            >
              {v}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-3 text-xs text-content-muted">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-blue-200 border border-blue-300" />
              Scheduled
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-green-200 border border-green-300" />
              Published
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-surface-secondary border border-dashed border-gray-300" />
              AI Suggestion
            </span>
          </div>
        </div>
      </div>

      {postsQ.isLoading ? (
        <Skeleton className="h-[500px] w-full rounded-xl" />
      ) : (
        <>
          {view === 'month' && (
            <div className="bg-surface-card rounded-xl border border-border overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-border">
                {daysOfWeek.map((d) => (
                  <div key={d} className="py-2 text-center text-xs font-medium text-content-muted uppercase">
                    {d}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {/* Padding for days before the 1st */}
                {Array.from({ length: startPadCount }, (_, i) => (
                  <div key={`pad-${i}`} className="min-h-[100px] border-b border-r border-border-secondary bg-surface-page/50" />
                ))}
                {calendarDays.map((day) => (
                  <div
                    key={day.day}
                    onDragOver={(e) => handleDragOver(e, day.day)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day.day)}
                    className={`min-h-[100px] border-b border-r border-border-secondary p-1.5 transition-colors ${
                      dragOverDay === day.day
                        ? 'bg-blue-100/60 dark:bg-blue-900/30 ring-2 ring-inset ring-blue-400'
                        : day.isToday ? 'bg-blue-50/50' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-medium ${
                          day.isToday
                            ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center'
                            : 'text-content-muted'
                        }`}
                      >
                        {day.day}
                      </span>
                      {(day.day === 3 || day.day === 10 || day.day === 17 || day.day === 24) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-300" title="Optimal posting day" />
                      )}
                    </div>
                    <div className="space-y-1">
                      {day.posts.map((post, i) => (
                        <div
                          key={i}
                          draggable={post.draggable}
                          onDragStart={post.draggable ? (e) => handleDragStart(e, post) : undefined}
                          className={`px-1.5 py-1 rounded border text-[10px] leading-tight transition-shadow ${
                            postColors[post.status || post.type]
                          } ${post.draggable ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:ring-1 hover:ring-blue-300' : 'cursor-default'}`}
                        >
                          <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${platformDot[post.platform]}`} />
                            <span className="truncate font-medium">{post.label}</span>
                            {post.draggable && (
                              <span className="ml-auto text-[8px] opacity-40 flex-shrink-0" title="Drag to reschedule">&#x2630;</span>
                            )}
                          </div>
                          <span className="text-[9px] opacity-70">
                            {post.time} &middot; {post.type === 'ghost' ? 'Suggestion' : post.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {/* Padding for remaining cells */}
                {Array.from({ length: (7 - ((startPadCount + daysInMonth) % 7)) % 7 }, (_, i) => (
                  <div key={`pad-end-${i}`} className="min-h-[100px] border-b border-r border-border-secondary bg-surface-page/50" />
                ))}
              </div>
            </div>
          )}

          {view === 'week' && (() => {
            // Compute the current week (Mon-Sun) containing today or the 1st of the displayed month
            const refDate = todayDay ? new Date(currentMonth.year, currentMonth.month, todayDay) : new Date(currentMonth.year, currentMonth.month, 1);
            const refDow = (refDate.getDay() + 6) % 7; // 0=Mon
            const weekStart = new Date(refDate);
            weekStart.setDate(refDate.getDate() - refDow);
            const weekDays = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(weekStart);
              d.setDate(weekStart.getDate() + i);
              return d;
            });
            const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
            <div className="bg-surface-card rounded-xl border border-border p-4">
              <p className="text-sm text-content-muted mb-4">Week of {fmt(weekDays[0])} — {fmt(weekDays[6])}, {weekDays[0].getFullYear()}</p>
              <div className="grid grid-cols-7 gap-3">
                {weekDays.map((wd, i) => {
                  const dayNum = wd.getDate();
                  const isInMonth = wd.getMonth() === currentMonth.month && wd.getFullYear() === currentMonth.year;
                  const dayData = isInMonth ? calendarDays.find((d) => d.day === dayNum) : null;
                  const isToday = wd.toDateString() === today.toDateString();
                  const label = `${daysOfWeek[i]} ${dayNum}`;
                  return (
                    <div
                      key={i}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDay(dayNum); }}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, dayNum)}
                      className={`rounded-lg border p-3 min-h-[200px] transition-colors ${
                        dragOverDay === dayNum
                          ? 'border-blue-400 bg-blue-50/40 ring-2 ring-blue-300'
                          : isToday ? 'border-blue-300 bg-blue-50/30' : 'border-border'
                      }`}
                    >
                      <p className={`text-xs font-medium mb-2 ${isToday ? 'text-blue-700' : 'text-content-muted'}`}>
                        {label} {isToday && '(Today)'}
                      </p>
                      <div className="space-y-2">
                        {dayData?.posts.map((post, j) => (
                          <div
                            key={j}
                            draggable={post.draggable}
                            onDragStart={post.draggable ? (e) => handleDragStart(e, post) : undefined}
                            className={`p-2 rounded-lg border ${postColors[post.status || post.type]} ${
                              post.draggable ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : ''
                            }`}
                          >
                            <div className="flex items-center gap-1 mb-1">
                              <span className={`w-2 h-2 rounded-full ${platformDot[post.platform]}`} />
                              <span className="text-[10px] font-medium uppercase">
                                {post.type === 'ghost' ? 'AI Suggestion' : post.type}
                              </span>
                              {post.draggable && (
                                <span className="ml-auto text-[9px] opacity-40">&#x2630;</span>
                              )}
                            </div>
                            <p className="text-xs leading-snug">{post.label}</p>
                            <p className="text-[10px] text-content-faint mt-1">{post.time}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}

          {view === 'list' && (
            <div className="bg-surface-card rounded-xl border border-border p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Content', 'Platform', 'Account', 'Type', 'Scheduled For', 'Status'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-content-muted uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scheduledPosts.map((p) => (
                    <tr key={p.id} className="border-b border-border-secondary hover:bg-surface-hover cursor-pointer">
                      <td className="py-3 px-3 font-medium text-content-primary max-w-sm truncate">{p.content}</td>
                      <td className="py-3 px-3">
                        <PlatformBadge platform={p.platform} />
                      </td>
                      <td className="py-3 px-3 text-content-secondary">{p.account}</td>
                      <td className="py-3 px-3">
                        <span className="text-xs font-medium text-content-secondary">
                          {p.contentType === 'THREAD' ? 'Thread' : p.contentType === 'ARTICLE' ? 'Article' : 'Post'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-content-secondary">{p.scheduledFor ? new Date(p.scheduledFor).toLocaleString() : '—'}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          Scheduled
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Bottom: upcoming + AI suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold text-content-primary mb-3">Upcoming (Next 7 Days)</h4>
          {scheduledPosts.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-border-secondary last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${platformDot[p.platform] || 'bg-gray-400'}`} />
                <span className="text-sm text-content-primary truncate max-w-xs">{p.content}</span>
              </div>
              <span className="text-xs text-content-faint whitespace-nowrap">{p.scheduledFor ? new Date(p.scheduledFor).toLocaleString() : '—'}</span>
            </div>
          ))}
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
              AI
            </div>
            <h4 className="text-sm font-semibold text-blue-900">Content Suggestions for This Week</h4>
          </div>
          <div className="space-y-3">
            <div className="bg-white/70 dark:bg-white/10 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <PlatformBadge platform="x" />
                <span className="text-xs font-medium text-blue-800">Thread &middot; Tuesday 9:15am</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">OPPORTUNITY</span>
              </div>
              <p className="text-xs text-content-primary">
                How AI is transforming LP reporting — first mover opportunity, rising theme in listening
              </p>
              <button className="text-xs text-blue-600 font-medium mt-1 hover:text-blue-800">Start Draft →</button>
            </div>
            <div className="bg-white/70 dark:bg-white/10 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <PlatformBadge platform="reddit" />
                <span className="text-xs font-medium text-blue-800">Text Post &middot; Thursday 10:00am</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">REINFORCE</span>
              </div>
              <p className="text-xs text-content-primary">
                Curate founder testimonials about AI sourcing — positive theme rising in r/venturecapital
              </p>
              <button className="text-xs text-blue-600 font-medium mt-1 hover:text-blue-800">Start Draft →</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reschedule Modal ────────────────────────────────── */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRescheduleModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-[380px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-content-primary mb-1">Reschedule Post</h3>
            <p className="text-xs text-content-secondary mb-4 truncate">
              {rescheduleModal.postLabel}...
            </p>

            <div className="space-y-2">
              {/* Option 1: Keep same time */}
              <button
                onClick={() => handleReschedule('keep')}
                disabled={updateMutation.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-surface-hover transition-colors text-left"
              >
                <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm flex-shrink-0">
                  {'\uD83D\uDD50'}
                </span>
                <div>
                  <p className="text-sm font-medium text-content-primary">
                    Move to {new Date(currentMonth.year, currentMonth.month, rescheduleModal.targetDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-content-muted">Keep original time: {rescheduleModal.originalTimeDisplay}</p>
                </div>
              </button>

              {/* Option 2: New time */}
              <div className="p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-sm flex-shrink-0">
                    {'\u23F0'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-content-primary">Set new time</p>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="px-2 py-1 text-xs border border-border rounded bg-surface-page text-content-primary"
                      />
                      <button
                        onClick={() => handleReschedule('newTime')}
                        disabled={updateMutation.isPending}
                        className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {updateMutation.isPending ? 'Saving...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Option 3: Move to Drafts */}
              <button
                onClick={() => handleReschedule('drafts')}
                disabled={updateMutation.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-red-200 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left"
              >
                <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm flex-shrink-0">
                  {'\uD83D\uDCC4'}
                </span>
                <div>
                  <p className="text-sm font-medium text-content-primary">Move to Drafts</p>
                  <p className="text-xs text-content-muted">Unschedule and save as draft</p>
                </div>
              </button>
            </div>

            <button
              onClick={() => setRescheduleModal(null)}
              className="mt-3 w-full text-center text-xs text-content-muted hover:text-content-secondary py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
