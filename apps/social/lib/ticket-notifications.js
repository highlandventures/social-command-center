'use client';

// Client-side "unread" state for tickets. Uses localStorage keyed by ticket id
// storing the comment count the user last saw; unread = current count > seen count.
// Kept intentionally dumb (per-browser, not per-user) so we don't need a schema change.

import { useEffect, useState, useCallback } from 'react';
import { trpc } from './trpc-client';

const STORAGE_KEY = 'ticket-seen-v1';

function readSeen() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeSeen(map) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage quota / private mode — fall back silently.
  }
}

export function markTicketSeen(ticketId, commentCount) {
  const map = readSeen();
  map[ticketId] = commentCount ?? 0;
  writeSeen(map);
  // Let other tabs / components know
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ticket-seen-change'));
  }
}

export function isTicketUnread(ticket, seenMap) {
  const count = ticket?._count?.comments ?? 0;
  if (count === 0) return false;
  const seen = seenMap[ticket.id];
  if (seen === undefined) return true;
  return count > seen;
}

/**
 * Hook: returns the number of unread tickets the current user authored.
 * Polls the tickets list at the same cadence as the TicketsTab (staleTime 10s)
 * so the badge stays in sync without separate requests. Scoped to the current
 * user so Philip sees a count of his own tickets that have new activity.
 */
export function useUnreadTicketCount({ currentUserId } = {}) {
  const listQ = trpc.tickets.list.useQuery({ limit: 100 }, { staleTime: 10_000 });
  const [seenMap, setSeenMap] = useState(() => readSeen());

  useEffect(() => {
    const handler = () => setSeenMap(readSeen());
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('storage', handler);
    window.addEventListener('ticket-seen-change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('ticket-seen-change', handler);
    };
  }, []);

  const tickets = listQ.data?.tickets ?? [];
  const scoped = currentUserId
    ? tickets.filter((t) => t.createdBy?.id === currentUserId)
    : tickets;

  const unreadCount = scoped.reduce(
    (n, t) => n + (isTicketUnread(t, seenMap) ? 1 : 0),
    0
  );

  const refresh = useCallback(() => setSeenMap(readSeen()), []);
  return { unreadCount, seenMap, refresh };
}
