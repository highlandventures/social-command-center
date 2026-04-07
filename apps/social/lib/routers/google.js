import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { getValidGoogleToken } from '../google-token-refresh';
import { getGmailMessages, getCalendarEvents } from '../google-apis';
import { listDriveFiles, searchDriveFiles, getDriveFile, listFolderContents, exportDocAsText } from '../google-drive';
import { generateInsight } from '../ai';

export const googleRouter = router({
  /**
   * google.connectionStatus
   * Checks if the current user has a Google account connected.
   */
  connectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const token = await ctx.prisma.googleOAuthToken.findUnique({
      where: { userId: ctx.user.id },
      select: { googleEmail: true, scopes: true, tokenExpiresAt: true },
    });
    console.log('[Google] connectionStatus for user:', ctx.user.id, '→', token ? `connected (${token.googleEmail}, scopes: ${token.scopes}, expires: ${token.tokenExpiresAt})` : 'not connected');
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

      // Today's range in user's timezone (default Pacific)
      // Google Calendar API accepts timeZone param and handles conversion
      const timeZone = 'America/Los_Angeles';
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
      const todayStr = formatter.format(new Date()); // e.g. "2026-03-27"
      const startOfDay = new Date(`${todayStr}T00:00:00`);
      const endOfDay = new Date(`${todayStr}T23:59:59.999`);

      const events = await getCalendarEvents(accessToken, {
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        timeZone,
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

  // ---- Google Drive ----

  /**
   * google.driveRecentFiles
   * Fetches recently modified files from the user's Google Drive.
   */
  driveRecentFiles: protectedProcedure
    .input(z.object({
      pageSize: z.number().min(1).max(25).optional().default(10),
      pageToken: z.string().optional(),
    }).optional().default({}))
    .query(async ({ ctx, input }) => {
      const tokenRecord = await ctx.prisma.googleOAuthToken.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!tokenRecord) {
        return { connected: false, files: [], nextPageToken: null };
      }

      try {
        const accessToken = await getValidGoogleToken(tokenRecord);
        console.log('[Drive] Token scopes:', tokenRecord.scopes);
        console.log('[Drive] Fetching files for user:', ctx.user.id);
        const result = await listDriveFiles(accessToken, {
          pageSize: input.pageSize,
          pageToken: input.pageToken,
        });
        console.log('[Drive] Got', result.files?.length, 'files');
        return { connected: true, ...result };
      } catch (err) {
        console.error('[Drive] Error:', err.message);
        return { connected: true, files: [], nextPageToken: null, error: err.message };
      }
    }),

  /**
   * google.driveSearch
   * Searches Drive files by name or content.
   */
  driveSearch: protectedProcedure
    .input(z.object({
      searchTerm: z.string().min(1),
      pageSize: z.number().min(1).max(25).optional().default(10),
      mimeType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tokenRecord = await ctx.prisma.googleOAuthToken.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!tokenRecord) {
        return { connected: false, files: [], nextPageToken: null };
      }

      try {
        const accessToken = await getValidGoogleToken(tokenRecord);
        const result = await searchDriveFiles(accessToken, input.searchTerm, {
          pageSize: input.pageSize,
          mimeType: input.mimeType,
        });
        return { connected: true, ...result };
      } catch (err) {
        console.error('Drive search error:', err.message);
        return { connected: true, files: [], nextPageToken: null, error: 'Failed to search Drive' };
      }
    }),

  /**
   * google.driveFile
   * Fetches metadata for a single Drive file.
   */
  driveFile: protectedProcedure
    .input(z.object({ fileId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const tokenRecord = await ctx.prisma.googleOAuthToken.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!tokenRecord) {
        return { connected: false, file: null };
      }

      try {
        const accessToken = await getValidGoogleToken(tokenRecord);
        const file = await getDriveFile(accessToken, input.fileId);
        return { connected: true, file };
      } catch (err) {
        console.error('Drive file fetch error:', err.message);
        return { connected: true, file: null, error: 'Failed to fetch file' };
      }
    }),

  /**
   * google.driveFolderContents
   * Lists files inside a specific Drive folder.
   */
  driveFolderContents: protectedProcedure
    .input(z.object({
      folderId: z.string().min(1),
      pageSize: z.number().min(1).max(25).optional().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const tokenRecord = await ctx.prisma.googleOAuthToken.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!tokenRecord) {
        return { connected: false, files: [], nextPageToken: null };
      }

      try {
        const accessToken = await getValidGoogleToken(tokenRecord);
        const result = await listFolderContents(accessToken, input.folderId, {
          pageSize: input.pageSize,
        });
        return { connected: true, ...result };
      } catch (err) {
        console.error('Drive folder error:', err.message);
        return { connected: true, files: [], nextPageToken: null, error: 'Failed to list folder' };
      }
    }),

  /**
   * google.driveDocContent
   * Exports a Google Doc as plain text.
   */
  driveDocContent: protectedProcedure
    .input(z.object({ fileId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const tokenRecord = await ctx.prisma.googleOAuthToken.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!tokenRecord) {
        return { connected: false, content: null };
      }

      try {
        const accessToken = await getValidGoogleToken(tokenRecord);
        const content = await exportDocAsText(accessToken, input.fileId);
        return { connected: true, content };
      } catch (err) {
        console.error('Drive doc content error:', err.message);
        return { connected: true, content: null, error: 'Failed to read document' };
      }
    }),

  /**
   * google.parseDocForProject
   * Reads a Google Doc and uses AI to extract GTM project fields.
   */
  parseDocForProject: protectedProcedure
    .input(z.object({ fileId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const tokenRecord = await ctx.prisma.googleOAuthToken.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!tokenRecord) {
        throw new Error('Google not connected');
      }

      const accessToken = await getValidGoogleToken(tokenRecord);
      const [fileMeta, content] = await Promise.all([
        getDriveFile(accessToken, input.fileId),
        exportDocAsText(accessToken, input.fileId),
      ]);

      // Truncate to ~8k chars to stay within token budget
      const truncated = content.length > 8000 ? content.slice(0, 8000) + '\n...[truncated]' : content;

      // Fetch recent category corrections for few-shot learning
      const corrections = await ctx.prisma.gtmCategoryCorrection.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { projectName: true, aiCategory: true, userCategory: true },
      });
      const categoryExamples = corrections.length > 0
        ? corrections.map(c => `- "${c.projectName}": AI said ${c.aiCategory}, user corrected to ${c.userCategory}`).join('\n')
        : '';

      const result = await generateInsight('project_parse', truncated, {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 2048,
        systemPrompt: `You are extracting structured project information from a Google Doc. Today's date is ${new Date().toISOString().slice(0, 10)}.

Return a JSON object with these fields:
{
  "name": "Project name (short, clear title)",
  "description": "1-2 sentence project description",
  "category": "GTM" | "EVERGREEN" | "OPERATIONS",
  "status": "PLANNING" | "ACTIVE",
  "startDate": "YYYY-MM-DD (best guess from doc, or today)",
  "endDate": "YYYY-MM-DD (best guess from doc)",
  "tasks": [
    { "title": "task description", "priority": "HIGH" | "MEDIUM" | "LOW", "dueDate": "YYYY-MM-DD or null" }
  ],
  "moments": [
    { "label": "moment name", "type": "LAUNCH" | "EVENT" | "CAMPAIGN" | "MILESTONE" | "ACTIVATION", "date": "YYYY-MM-DD" }
  ]
}

Category rules:
- GTM: product launches, go-to-market campaigns, feature rollouts — the project's primary goal is getting a product/feature to market
- EVERGREEN: always-on brand campaigns, ongoing content programs, recurring social engagement — long-running with no fixed end event
- OPERATIONS: team offsites, internal planning, process optimization, staffing, vendor management — internal coordination, not customer-facing deliverables

${categoryExamples ? `\nPast category corrections (learn from these):\n${categoryExamples}\n` : ''}Extract real tasks and milestones from the document. Infer dates from context. If unsure about a date, omit it. Keep task titles concise and actionable. Only return valid JSON, no markdown or explanation.`,
      });

      // generateInsight already parses JSON via parseAIJSON — result is the parsed object
      return {
        ...result,
        name: result.name || fileMeta.name,
        googleDocUrl: fileMeta.webViewLink,
      };
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
