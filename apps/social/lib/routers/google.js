import { router, protectedProcedure } from '../trpc';
import { getValidGoogleToken } from '../google-token-refresh';
import { getGmailMessages, getCalendarEvents } from '../google-apis';

export const googleRouter = router({
  /**
   * google.connectionStatus
   * Checks if the current user has a Google account connected.
   */
  connectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const token = await ctx.prisma.googleOAuthToken.findUnique({
      where: { userId: ctx.user.id },
      select: { googleEmail: true },
    });
    return {
      connected: !!token,
      googleEmail: token?.googleEmail || null,
    };
  }),

  /**
   * google.calendarEvents
   * Fetches today's calendar events from Google Calendar.
   */
  calendarEvents: protectedProcedure.query(async ({ ctx }) => {
    const tokenRecord = await ctx.prisma.googleOAuthToken.findUnique({
      where: { userId: ctx.user.id },
    });

    if (!tokenRecord) {
      return { connected: false, events: [] };
    }

    try {
      const accessToken = await getValidGoogleToken(tokenRecord);

      // Today's range: start of today to end of today
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const events = await getCalendarEvents(accessToken, {
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
      });

      return { connected: true, events };
    } catch (err) {
      console.error('Google Calendar fetch error:', err.message);
      return { connected: true, events: [], error: 'Failed to fetch calendar' };
    }
  }),

  /**
   * google.gmailHighlights
   * Fetches the 5 most recent inbox emails from Gmail.
   */
  gmailHighlights: protectedProcedure.query(async ({ ctx }) => {
    const tokenRecord = await ctx.prisma.googleOAuthToken.findUnique({
      where: { userId: ctx.user.id },
    });

    if (!tokenRecord) {
      return { connected: false, messages: [] };
    }

    try {
      const accessToken = await getValidGoogleToken(tokenRecord);
      const messages = await getGmailMessages(accessToken, { maxResults: 5 });
      return { connected: true, messages };
    } catch (err) {
      console.error('Gmail fetch error:', err.message);
      return { connected: true, messages: [], error: 'Failed to fetch email' };
    }
  }),

  /**
   * google.disconnect
   * Removes the user's Google OAuth token.
   */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.googleOAuthToken.deleteMany({
      where: { userId: ctx.user.id },
    });
    return { success: true };
  }),
});
