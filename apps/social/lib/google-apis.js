/**
 * Google API helpers using native fetch (no SDK).
 * Follows the same pattern as the app's X/Reddit API calls.
 */

/**
 * Fetch recent Gmail messages from the user's inbox.
 *
 * @param {string} accessToken - Valid Google OAuth access token
 * @param {Object} opts
 * @param {number} [opts.maxResults=5] - Max messages to return
 * @returns {Array<{ id, threadId, subject, from, snippet, date, isUnread }>}
 */
export async function getGmailMessages(accessToken, { maxResults = 5 } = {}) {
  // Fetch important + recent messages in parallel, then merge and dedupe
  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  const [importantRes, recentRes] = await Promise.all([
    fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=in:inbox is:important`,
      { headers: authHeaders }
    ),
    fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=in:inbox`,
      { headers: authHeaders }
    ),
  ]);

  if (!recentRes.ok) {
    const err = await recentRes.text();
    throw new Error(`Gmail list failed: ${recentRes.status} ${err}`);
  }

  const importantData = importantRes.ok ? await importantRes.json() : {};
  const recentData = await recentRes.json();
  const importantIds = new Set((importantData.messages || []).map(m => m.id));

  // Merge and dedupe: important first, then recent
  const seen = new Set();
  const allIds = [];
  for (const m of [...(importantData.messages || []), ...(recentData.messages || [])]) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      allIds.push(m.id);
    }
  }

  // Limit to double the requested amount, then score and trim
  const fetchIds = allIds.slice(0, maxResults * 2);
  if (!fetchIds.length) return [];

  // Fetch metadata for each message in parallel
  const messages = await Promise.all(
    fetchIds.map(async (id) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: authHeaders }
      );

      if (!msgRes.ok) return null;

      const msg = await msgRes.json();
      const headers = msg.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
      const labels = msg.labelIds || [];

      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: getHeader('Subject') || '(no subject)',
        from: parseFrom(getHeader('From')),
        snippet: msg.snippet || '',
        date: getHeader('Date'),
        isUnread: labels.includes('UNREAD'),
        isImportant: importantIds.has(msg.id) || labels.includes('IMPORTANT'),
        isStarred: labels.includes('STARRED'),
      };
    })
  );

  // Score and sort: unread important first, then unread, then important, then rest
  const valid = messages.filter(Boolean);
  valid.sort((a, b) => {
    const scoreA = (a.isUnread ? 4 : 0) + (a.isImportant ? 2 : 0) + (a.isStarred ? 1 : 0);
    const scoreB = (b.isUnread ? 4 : 0) + (b.isImportant ? 2 : 0) + (b.isStarred ? 1 : 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return new Date(b.date) - new Date(a.date);
  });

  return valid.slice(0, maxResults);
}

/**
 * Parse "Name <email>" into { name, email }.
 */
function parseFrom(fromHeader) {
  const match = fromHeader.match(/^"?(.+?)"?\s*<(.+)>$/);
  if (match) return { name: match[1].trim(), email: match[2] };
  return { name: fromHeader, email: fromHeader };
}

/**
 * Fetch calendar events for a given time range.
 *
 * @param {string} accessToken - Valid Google OAuth access token
 * @param {Object} opts
 * @param {string} opts.timeMin - ISO datetime string (start of range)
 * @param {string} opts.timeMax - ISO datetime string (end of range)
 * @param {number} [opts.maxResults=10]
 * @returns {Array<{ id, title, start, end, location, meetLink, allDay, attendeesCount }>}
 */
export async function getCalendarEvents(accessToken, { timeMin, timeMax, timeZone, maxResults = 10 }) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  });
  if (timeZone) params.set('timeZone', timeZone);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar events failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const items = data.items || [];

  return items.map(event => ({
    id: event.id,
    title: event.summary || '(No title)',
    start: event.start?.dateTime || event.start?.date || '',
    end: event.end?.dateTime || event.end?.date || '',
    location: event.location || null,
    meetLink: event.hangoutLink || null,
    allDay: !event.start?.dateTime,
    attendeesCount: (event.attendees || []).length,
  }));
}
