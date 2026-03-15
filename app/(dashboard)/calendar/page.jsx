'use client';

import { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc-client';
import { PlatformBadge, Skeleton, useToast } from '@/components/ui';

export default function CalendarPage() {
  const [view, setView] = useState('month');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [dragOverDay, setDragOverDay] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [newTime, setNewTime] = useState('09:15');
  const [selectedPost, setSelectedPost] = useState(null); // click-to-view

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
  const firstDayDow = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const startPadCount = (firstDayDow + 6) % 7;
  const today = new Date();
  const todayDay = today.getFullYear() === currentMonth.year && today.getMonth() === currentMonth.month ? today.getDate() : null;

  // ── tRPC queries ──────────────────────────────────────────
  const postsQ = trpc.posts.list.useQuery(undefined, { staleTime: 15_000 });
  const posts = postsQ.data?.items ?? [];

  // ── Account color map ───────────────────────────────────────
  const ACCOUNT_COLORS = [
    { bg: 'bg-blue-500', border: 'border-l-blue-500', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
    { bg: 'bg-purple-500', border: 'border-l-purple-500', dot: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400' },
    { bg: 'bg-cyan-500', border: 'border-l-cyan-500', dot: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-400' },
    { bg: 'bg-amber-500', border: 'border-l-amber-500', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    { bg: 'bg-rose-500', border: 'border-l-rose-500', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
    { bg: 'bg-indigo-500', border: 'border-l-indigo-500', dot: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
    { bg: 'bg-teal-500', border: 'border-l-teal-500', dot: 'bg-teal-500', text: 'text-teal-600 dark:text-teal-400' },
    { bg: 'bg-orange-500', border: 'border-l-orange-500', dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
  ];

  const accountColorMap = useMemo(() => {
    const map = {};
    const seen = [];
    posts.forEach((p) => {
      const id = p.account?.id;
      if (id && !map[id]) {
        map[id] = {
          ...ACCOUNT_COLORS[seen.length % ACCOUNT_COLORS.length],
          username: p.account?.username || p.account?.displayName || '—',
          platform: p.platform,
        };
        seen.push(id);
      }
    });
    return map;
  }, [posts]);

  // ── Build calendar data from real posts ───────────────────
  const scheduledPosts = posts.filter(
    (p) => p.status === 'SCHEDULED' || p.status === 'scheduled'
  );
  const publishedPosts = posts.filter(
    (p) => p.status === 'PUBLISHED' || p.status === 'published'
  );

  const calendarDays = useMemo(() => {
    const days = [];
    const postMap = {};

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
          fullContent: p.content || '',
          time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          timeRaw: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
          fullDate: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
          status: (p.status || '').toLowerCase(),
          draggable: p.status === 'SCHEDULED',
          accountId: p.account?.id,
          accountUsername: p.account?.username || p.account?.displayName,
        });
      }
    });

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, posts: postMap[d] || [], isToday: d === todayDay });
    }
    return days;
  }, [scheduledPosts, publishedPosts, currentMonth, daysInMonth, todayDay]);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

  // ── Post card click handler ─────────────────────────────────
  const handlePostClick = useCallback((post) => {
    setSelectedPost(post);
  }, []);

  // ── Shared post card renderer ───────────────────────────────
  const renderPostCard = (post, i, compact = false) => {
    const acctColor = accountColorMap[post.accountId];
    const isScheduled = post.status === 'scheduled';
    const statusBadge = isScheduled
      ? 'bg-blue-500/20 text-blue-300'
      : 'bg-green-500/20 text-green-300';
    const statusLabel = isScheduled ? 'Scheduled' : 'Published';

    return (
      <div
        key={i}
        draggable={post.draggable}
        onDragStart={post.draggable ? (e) => { e.stopPropagation(); handleDragStart(e, post); } : undefined}
        onClick={(e) => { e.stopPropagation(); handlePostClick(post); }}
        className={`group rounded border-l-[3px] transition-all cursor-pointer ${
          acctColor ? acctColor.border : 'border-l-gray-400'
        } ${
          compact
            ? 'px-1.5 py-1 bg-surface-secondary/50 hover:bg-surface-secondary border border-l-[3px] border-border-secondary'
            : 'p-2 bg-surface-secondary/50 hover:bg-surface-secondary border border-l-[3px] border-border-secondary'
        } ${post.draggable ? 'hover:shadow-md' : ''}`}
      >
        {compact ? (
          <>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="truncate font-medium text-content-primary">{post.label}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[9px] text-content-muted">{post.time}</span>
              <span className={`text-[8px] px-1 rounded ${statusBadge}`}>{statusLabel}</span>
              {post.accountUsername && (
                <span className={`text-[9px] ml-auto ${acctColor?.text || 'text-content-muted'}`}>@{post.accountUsername}</span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${acctColor?.dot || 'bg-gray-400'}`} />
              <span className={`text-[10px] font-medium ${acctColor?.text || 'text-content-muted'}`}>
                @{post.accountUsername || '—'}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-auto ${statusBadge}`}>{statusLabel}</span>
            </div>
            <p className="text-xs leading-snug text-content-primary">{post.label}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-content-muted">{post.time}</span>
              <span className="text-[10px] text-content-faint capitalize">{post.type}</span>
              {post.draggable && (
                <span className="ml-auto text-[9px] text-content-faint opacity-0 group-hover:opacity-100 transition-opacity">Drag to move</span>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────── */}
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
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-3 text-xs text-content-muted flex-wrap">
        <span className="text-content-faint font-medium">Status:</span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">Scheduled</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 text-[10px]">Published</span>
        </span>
        {Object.entries(accountColorMap).length > 0 && (
          <>
            <span className="text-content-faint">|</span>
            <span className="text-content-faint font-medium">Accounts:</span>
            {Object.entries(accountColorMap).map(([id, acct]) => (
              <span key={id} className="flex items-center gap-1">
                <span className={`w-2.5 h-0.5 rounded-full ${acct.bg}`} />
                <span className={acct.text}>@{acct.username}</span>
              </span>
            ))}
          </>
        )}
      </div>

      {postsQ.isLoading ? (
        <Skeleton className="h-[500px] w-full rounded-xl" />
      ) : (
        <>
          {/* ── Month View ──────────────────────────────────────── */}
          {view === 'month' && (
            <div className="bg-surface-card rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-7 border-b border-border">
                {daysOfWeek.map((d) => (
                  <div key={d} className="py-2 text-center text-xs font-medium text-content-muted uppercase">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
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
                        : day.isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <div className="mb-1">
                      <span
                        className={`text-xs font-medium ${
                          day.isToday
                            ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center'
                            : 'text-content-muted'
                        }`}
                      >
                        {day.day}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {day.posts.map((post, i) => renderPostCard(post, i, true))}
                    </div>
                  </div>
                ))}
                {Array.from({ length: (7 - ((startPadCount + daysInMonth) % 7)) % 7 }, (_, i) => (
                  <div key={`pad-end-${i}`} className="min-h-[100px] border-b border-r border-border-secondary bg-surface-page/50" />
                ))}
              </div>
            </div>
          )}

          {/* ── Week View ───────────────────────────────────────── */}
          {view === 'week' && (() => {
            const refDate = todayDay ? new Date(currentMonth.year, currentMonth.month, todayDay) : new Date(currentMonth.year, currentMonth.month, 1);
            const refDow = (refDate.getDay() + 6) % 7;
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
                          ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-900/20 ring-2 ring-blue-300'
                          : isToday ? 'border-blue-300 bg-blue-50/20 dark:bg-blue-900/10' : 'border-border'
                      }`}
                    >
                      <p className={`text-xs font-medium mb-2 ${isToday ? 'text-blue-400' : 'text-content-muted'}`}>
                        {label} {isToday && '(Today)'}
                      </p>
                      <div className="space-y-2">
                        {dayData?.posts.map((post, j) => renderPostCard(post, j, false))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}

          {/* ── List View ───────────────────────────────────────── */}
          {view === 'list' && (
            <div className="bg-surface-card rounded-xl border border-border p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Content', 'Account', 'Type', 'Date', 'Status'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-content-muted uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...scheduledPosts, ...publishedPosts]
                    .sort((a, b) => new Date(a.scheduledFor || a.publishedAt || a.createdAt) - new Date(b.scheduledFor || b.publishedAt || b.createdAt))
                    .map((p) => {
                    const acctColor = accountColorMap[p.account?.id];
                    const isScheduled = p.status === 'SCHEDULED' || p.status === 'scheduled';
                    return (
                    <tr
                      key={p.id}
                      onClick={() => handlePostClick({
                        id: p.id,
                        fullContent: p.content,
                        label: (p.content || '').slice(0, 40),
                        platform: (p.platform || 'X').toLowerCase(),
                        type: p.contentType?.toLowerCase() || 'post',
                        status: (p.status || '').toLowerCase(),
                        time: new Date(p.scheduledFor || p.publishedAt || p.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                        fullDate: new Date(p.scheduledFor || p.publishedAt || p.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
                        accountId: p.account?.id,
                        accountUsername: p.account?.username || p.account?.displayName,
                      })}
                      className="border-b border-border-secondary hover:bg-surface-hover cursor-pointer"
                    >
                      <td className="py-3 px-3">
                        <div className={`font-medium text-content-primary max-w-sm truncate border-l-[3px] pl-2 ${acctColor?.border || 'border-l-gray-400'}`}>
                          {p.content}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="flex items-center gap-1.5">
                          <PlatformBadge platform={p.platform} />
                          <span className={`text-xs ${acctColor?.text || 'text-content-secondary'}`}>@{p.account?.username || '—'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs font-medium text-content-secondary capitalize">
                          {p.contentType === 'THREAD' ? 'Thread' : p.contentType === 'ARTICLE' ? 'Article' : 'Post'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-content-secondary text-xs">
                        {new Date(p.scheduledFor || p.publishedAt || p.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          isScheduled
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-green-500/20 text-green-400'
                        }`}>
                          {isScheduled ? 'Scheduled' : 'Published'}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Bottom: Upcoming + AI Suggestions ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-surface-card rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold text-content-primary mb-3">Upcoming (Next 7 Days)</h4>
          {scheduledPosts.length === 0 && (
            <p className="text-sm text-content-muted py-4">No scheduled posts</p>
          )}
          {scheduledPosts.map((p) => {
            const acctColor = accountColorMap[p.account?.id];
            return (
            <div
              key={p.id}
              onClick={() => handlePostClick({
                id: p.id,
                fullContent: p.content,
                label: (p.content || '').slice(0, 40),
                platform: (p.platform || 'X').toLowerCase(),
                type: p.contentType?.toLowerCase() || 'post',
                status: 'scheduled',
                time: p.scheduledFor ? new Date(p.scheduledFor).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—',
                fullDate: p.scheduledFor ? new Date(p.scheduledFor).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '—',
                accountId: p.account?.id,
                accountUsername: p.account?.username || p.account?.displayName,
              })}
              className="flex items-center justify-between py-2.5 border-b border-border-secondary last:border-0 cursor-pointer hover:bg-surface-hover -mx-2 px-2 rounded"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-0.5 h-6 rounded-full flex-shrink-0 ${acctColor?.bg || 'bg-gray-400'}`} />
                <div className="min-w-0">
                  <span className="text-sm text-content-primary truncate block">{p.content}</span>
                  <span className={`text-[10px] ${acctColor?.text || 'text-content-muted'}`}>@{p.account?.username || '—'}</span>
                </div>
              </div>
              <span className="text-xs text-content-faint whitespace-nowrap ml-3">{p.scheduledFor ? new Date(p.scheduledFor).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</span>
            </div>
            );
          })}
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
              AI
            </div>
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Content Suggestions for This Week</h4>
          </div>
          <div className="space-y-3">
            <div className="bg-white/70 dark:bg-white/5 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <PlatformBadge platform="x" />
                <span className="text-xs font-medium text-blue-800 dark:text-blue-300">Thread &middot; Tuesday 9:15am</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">OPPORTUNITY</span>
              </div>
              <p className="text-xs text-content-primary">
                How AI is transforming LP reporting — first mover opportunity, rising theme in listening
              </p>
              <button className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 hover:text-blue-800 dark:hover:text-blue-300">Start Draft →</button>
            </div>
            <div className="bg-white/70 dark:bg-white/5 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <PlatformBadge platform="reddit" />
                <span className="text-xs font-medium text-blue-800 dark:text-blue-300">Text Post &middot; Thursday 10:00am</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">REINFORCE</span>
              </div>
              <p className="text-xs text-content-primary">
                Curate founder testimonials about AI sourcing — positive theme rising in r/venturecapital
              </p>
              <button className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 hover:text-blue-800 dark:hover:text-blue-300">Start Draft →</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Post Detail Modal ────────────────────────────────── */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedPost(null)}>
          <div className="bg-surface-card rounded-xl shadow-xl w-[500px] max-w-[90vw] max-h-[80vh] overflow-auto border border-border" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <PlatformBadge platform={selectedPost.platform} />
                <span className={`text-sm font-medium ${accountColorMap[selectedPost.accountId]?.text || 'text-content-primary'}`}>
                  @{selectedPost.accountUsername || '—'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  selectedPost.status === 'scheduled'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-green-500/20 text-green-400'
                }`}>
                  {selectedPost.status === 'scheduled' ? 'Scheduled' : 'Published'}
                </span>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="text-content-muted hover:text-content-primary text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3 text-xs text-content-muted">
                <span>{selectedPost.fullDate}</span>
                <span>&middot;</span>
                <span>{selectedPost.time}</span>
                <span>&middot;</span>
                <span className="capitalize">{selectedPost.type}</span>
              </div>
              <p className="text-sm text-content-primary whitespace-pre-wrap leading-relaxed">
                {selectedPost.fullContent}
              </p>
            </div>

            {/* Actions */}
            {selectedPost.status === 'scheduled' && (
              <div className="flex items-center gap-2 p-4 border-t border-border">
                <button
                  onClick={() => {
                    setSelectedPost(null);
                    window.location.href = `/composer?edit=${selectedPost.id}`;
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-surface-secondary text-content-primary rounded-lg hover:bg-surface-tertiary"
                >
                  Edit Post
                </button>
                <button
                  onClick={() => {
                    updateMutation.mutate({
                      id: selectedPost.id,
                      data: { status: 'DRAFT', scheduledFor: null },
                    });
                    setSelectedPost(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 rounded-lg hover:bg-red-900/10"
                >
                  Move to Drafts
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Reschedule Modal ────────────────────────────────── */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRescheduleModal(null)}>
          <div className="bg-surface-card rounded-xl shadow-xl p-6 w-[380px] max-w-[90vw] border border-border" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-content-primary mb-1">Reschedule Post</h3>
            <p className="text-xs text-content-secondary mb-4 truncate">
              {rescheduleModal.postLabel}...
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleReschedule('keep')}
                disabled={updateMutation.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-surface-hover transition-colors text-left"
              >
                <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm flex-shrink-0">
                  {'\uD83D\uDD50'}
                </span>
                <div>
                  <p className="text-sm font-medium text-content-primary">
                    Move to {new Date(currentMonth.year, currentMonth.month, rescheduleModal.targetDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-content-muted">Keep original time: {rescheduleModal.originalTimeDisplay}</p>
                </div>
              </button>

              <div className="p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 text-sm flex-shrink-0">
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

              <button
                onClick={() => handleReschedule('drafts')}
                disabled={updateMutation.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left"
              >
                <span className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 text-sm flex-shrink-0">
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
