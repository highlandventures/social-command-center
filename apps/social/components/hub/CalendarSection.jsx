'use client';

import { trpc } from '@/lib/trpc-client';
import { Skeleton } from '@/components/ui';
import GoogleConnectCard from './GoogleConnectCard';

function formatEventTime(dateStr, allDay) {
  if (allDay) return 'All day';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function isHappeningNow(event) {
  if (event.allDay) return false;
  const now = Date.now();
  return new Date(event.start).getTime() <= now && new Date(event.end).getTime() > now;
}

function isNext(event, events) {
  if (event.allDay) return false;
  const now = Date.now();
  const upcoming = events.filter(e => !e.allDay && new Date(e.start).getTime() > now);
  return upcoming.length > 0 && upcoming[0].id === event.id;
}

function EventRow({ event, isNow, isUpNext }) {
  const startTime = formatEventTime(event.start, event.allDay);
  const endTime = event.allDay ? null : formatEventTime(event.end, false);

  const borderColor = isNow
    ? 'border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-900/10'
    : isUpNext
    ? 'border-blue-300 dark:border-blue-700'
    : 'border-border bg-surface-card';

  const barColor = isNow ? 'bg-green-500' : 'bg-blue-500';

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${borderColor}`}>
      {/* Time */}
      <div className="flex-shrink-0 w-16 text-right">
        <span className="text-xs font-medium text-content-primary">{startTime}</span>
        {endTime && (
          <span className="text-xs text-content-muted block">{endTime}</span>
        )}
      </div>

      {/* Divider */}
      <div className={`w-0.5 self-stretch ${barColor} rounded-full flex-shrink-0`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-content-primary truncate">{event.title}</p>
          {isNow && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex-shrink-0">
              Now
            </span>
          )}
          {isUpNext && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex-shrink-0">
              Next
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {event.location && (
            <span className="text-xs text-content-muted truncate">{event.location}</span>
          )}
          {event.meetLink && (
            <a
              href={event.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
            >
              Join
            </a>
          )}
          {event.attendeesCount > 0 && (
            <span className="text-xs text-content-faint flex-shrink-0">
              {event.attendeesCount} attendee{event.attendeesCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CalendarSection({ className = '' }) {
  const { data, isLoading } = trpc.google.calendarEvents.useQuery(undefined, {
    staleTime: 300_000, // 5 min
  });

  return (
    <div className={`bg-surface-card rounded-xl border border-border p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <h3 className="text-sm font-semibold text-content-primary">Today&apos;s Agenda</h3>
        <span className="text-xs text-content-muted">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <Skeleton className="w-16 h-8" />
              <Skeleton className="w-0.5 h-8" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Not connected */}
      {!isLoading && data && !data.connected && (
        <GoogleConnectCard
          title="Connect Calendar"
          description="See today's meetings and events at a glance"
        />
      )}

      {/* Connected but no events */}
      {!isLoading && data?.connected && data.events.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-content-muted">No events today</p>
          <p className="text-xs text-content-faint mt-1">Enjoy your free day!</p>
        </div>
      )}

      {/* Event list — only current + upcoming (past events drop off) */}
      {!isLoading && data?.connected && data.events.length > 0 && (() => {
        const now = Date.now();
        const visible = data.events.filter(e =>
          e.allDay || new Date(e.end).getTime() > now
        );

        if (visible.length === 0) {
          return (
            <div className="text-center py-8">
              <p className="text-sm text-content-muted">All done for today</p>
              <p className="text-xs text-content-faint mt-1">No more meetings</p>
            </div>
          );
        }

        const shown = visible.slice(0, 5);
        const overflow = visible.length - shown.length;

        return (
          <div className="space-y-2">
            {shown.map(event => {
              const happening = isHappeningNow(event);
              const upNext = !happening && isNext(event, visible);
              return (
                <EventRow key={event.id} event={event} isNow={happening} isUpNext={upNext} />
              );
            })}
            {overflow > 0 && (
              <p className="text-xs text-content-faint text-center pt-1">
                +{overflow} more event{overflow !== 1 ? 's' : ''} today
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
