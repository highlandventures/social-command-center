'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc-client';
import { PlatformBadge, Skeleton } from '@/components/ui';

export default function CalendarPage() {
  const [view, setView] = useState('month');

  // ── tRPC queries ──────────────────────────────────────────
  const postsQ = trpc.posts.list.useQuery(undefined, { staleTime: 15_000 });
  const posts = postsQ.data ?? [];

  // ── Build calendar data from real posts ───────────────────
  const scheduledPosts = posts.filter(
    (p) => p.status === 'SCHEDULED' || p.status === 'scheduled'
  );
  const publishedPosts = posts.filter(
    (p) => p.status === 'PUBLISHED' || p.status === 'published'
  );

  // Build a map of day => posts for March 2026
  const calendarDays = useMemo(() => {
    const days = [];
    // If we have real post data, map them by day; otherwise provide static fallback
    const postMap = {};

    // Try to map real posts to day numbers
    [...scheduledPosts, ...publishedPosts].forEach((p) => {
      const date = p.scheduledFor || p.publishedAt || p.createdAt;
      if (!date) return;
      const d = new Date(date);
      if (d.getMonth() === 2 && d.getFullYear() === 2026) {
        const dayNum = d.getDate();
        if (!postMap[dayNum]) postMap[dayNum] = [];
        postMap[dayNum].push({
          type: p.type || 'post',
          platform: p.platform || 'x',
          label: (p.content || '').slice(0, 40),
          time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          status: (p.status || '').toLowerCase(),
        });
      }
    });

    // Fallback static entries when no real data
    if (Object.keys(postMap).length === 0) {
      postMap[5] = [{ type: 'thread', platform: 'x', label: '7 signals in founders', time: '9:15am', status: 'scheduled' }];
      postMap[6] = [{ type: 'post', platform: 'x', label: 'AI regulation take', time: '1:00pm', status: 'scheduled' }];
      postMap[7] = [{ type: 'post', platform: 'reddit', label: 'AI for deal flow', time: '10:00am', status: 'scheduled' }];
      postMap[8] = [{ type: 'thread', platform: 'x', label: 'Portfolio spotlight', time: '11:30am', status: 'scheduled' }];
      postMap[1] = [{ type: 'thread', platform: 'x', label: '10 lessons from pitches', time: '9:00am', status: 'published' }];
      postMap[2] = [{ type: 'post', platform: 'x', label: 'Hot take: seed stage', time: '2:00pm', status: 'published' }];
      postMap[10] = [{ type: 'ghost', platform: 'x', label: 'AI suggestion: LP reporting thread', time: '9:15am' }];
      postMap[12] = [{ type: 'ghost', platform: 'reddit', label: 'AI suggestion: Founder story', time: '10:00am' }];
    }

    for (let d = 1; d <= 31; d++) {
      days.push({ day: d, posts: postMap[d] || [], isToday: d === 4 });
    }
    return days;
  }, [scheduledPosts, publishedPosts]);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // March 2026 starts on Sunday (index 6), pad accordingly
  const startPad = 6;

  const postColors = {
    scheduled: 'bg-blue-100 border-blue-200 text-blue-800',
    published: 'bg-green-100 border-green-200 text-green-800',
    ghost: 'bg-gray-50 border-dashed border-gray-300 text-gray-500',
  };
  const platformDot = { x: 'bg-gray-800', reddit: 'bg-orange-500' };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">March 2026</h2>
          <div className="flex items-center gap-1">
            <button className="p-1 text-gray-400 hover:text-gray-600">{'\u2190'}</button>
            <button className="p-1 text-gray-400 hover:text-gray-600">{'\u2192'}</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['month', 'week', 'list'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize ${
                view === v
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {v}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-blue-200 border border-blue-300" />
              Scheduled
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-green-200 border border-green-300" />
              Published
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-gray-100 border border-dashed border-gray-300" />
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
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-gray-200">
                {daysOfWeek.map((d) => (
                  <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 uppercase">
                    {d}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {/* Padding for days before March 1 */}
                {Array.from({ length: startPad }, (_, i) => (
                  <div key={`pad-${i}`} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50/50" />
                ))}
                {calendarDays.map((day) => (
                  <div
                    key={day.day}
                    className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 ${
                      day.isToday ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                    } transition-colors`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-medium ${
                          day.isToday
                            ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center'
                            : 'text-gray-500'
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
                          className={`px-1.5 py-1 rounded border text-[10px] leading-tight cursor-pointer hover:shadow-sm transition-shadow ${
                            postColors[post.status || post.type]
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${platformDot[post.platform]}`} />
                            <span className="truncate font-medium">{post.label}</span>
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
                {Array.from({ length: (7 - ((startPad + 31) % 7)) % 7 }, (_, i) => (
                  <div key={`pad-end-${i}`} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50/50" />
                ))}
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500 mb-4">Week of March 2 — March 8, 2026</p>
              <div className="grid grid-cols-7 gap-3">
                {['Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7', 'Sun 8'].map((day, i) => {
                  const dayNum = i + 2;
                  const dayData = calendarDays.find((d) => d.day === dayNum);
                  return (
                    <div
                      key={day}
                      className={`rounded-lg border p-3 min-h-[200px] ${
                        dayNum === 4 ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'
                      }`}
                    >
                      <p className={`text-xs font-medium mb-2 ${dayNum === 4 ? 'text-blue-700' : 'text-gray-500'}`}>
                        {day} {dayNum === 4 && '(Today)'}
                      </p>
                      <div className="space-y-2">
                        {dayData?.posts.map((post, j) => (
                          <div key={j} className={`p-2 rounded-lg border ${postColors[post.status || post.type]}`}>
                            <div className="flex items-center gap-1 mb-1">
                              <span className={`w-2 h-2 rounded-full ${platformDot[post.platform]}`} />
                              <span className="text-[10px] font-medium uppercase">
                                {post.type === 'ghost' ? 'AI Suggestion' : post.type}
                              </span>
                            </div>
                            <p className="text-xs leading-snug">{post.label}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{post.time}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'list' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Content', 'Platform', 'Account', 'Type', 'Scheduled For', 'Status'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scheduledPosts.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                      <td className="py-3 px-3 font-medium text-gray-900 max-w-sm truncate">{p.content}</td>
                      <td className="py-3 px-3">
                        <PlatformBadge platform={p.platform} />
                      </td>
                      <td className="py-3 px-3 text-gray-600">{p.account}</td>
                      <td className="py-3 px-3">
                        <span className="text-xs font-medium text-gray-600">
                          {p.type}
                          {(p.tweets ?? 0) > 1 ? ` (${p.tweets})` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-600">{p.scheduledFor}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Upcoming (Next 7 Days)</h4>
          {scheduledPosts.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${platformDot[p.platform] || 'bg-gray-400'}`} />
                <span className="text-sm text-gray-800 truncate max-w-xs">{p.content}</span>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{p.scheduledFor}</span>
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
            <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <PlatformBadge platform="x" />
                <span className="text-xs font-medium text-blue-800">Thread &middot; Tuesday 9:15am</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">OPPORTUNITY</span>
              </div>
              <p className="text-xs text-gray-800">
                How AI is transforming LP reporting — first mover opportunity, rising theme in listening
              </p>
              <button className="text-xs text-blue-600 font-medium mt-1 hover:text-blue-800">Start Draft →</button>
            </div>
            <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <PlatformBadge platform="reddit" />
                <span className="text-xs font-medium text-blue-800">Text Post &middot; Thursday 10:00am</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">REINFORCE</span>
              </div>
              <p className="text-xs text-gray-800">
                Curate founder testimonials about AI sourcing — positive theme rising in r/venturecapital
              </p>
              <button className="text-xs text-blue-600 font-medium mt-1 hover:text-blue-800">Start Draft →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
