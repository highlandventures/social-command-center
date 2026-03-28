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
  // List message IDs from inbox
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=in:inbox`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Gmail list failed: ${listRes.status} ${err}`);
  }

  const listData = await listRes.json();
  const messageIds = listData.messages || [];

  if (!messageIds.length) return [];

  // Fetch metadata for each message in parallel
  const messages = await Promise.all(
    messageIds.map(async ({ id }) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgRes.ok) return null;

      const msg = await msgRes.json();
      const headers = msg.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: getHeader('Subject') || '(no subject)',
        from: parseFrom(getHeader('From')),
        snippet: msg.snippet || '',
        date: getHeader('Date'),
        isUnread: (msg.labelIds || []).includes('UNREAD'),
      };
    })
  );

  return messages.filter(Boolean);
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
