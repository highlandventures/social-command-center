import { router } from '../trpc';
import { accountsRouter } from './accounts';
import { postsRouter } from './posts';
import { inboxRouter } from './inbox';
import { listeningRouter } from './listening';
import { analyticsRouter } from './analytics';
import { competitorsRouter } from './competitors';
import { kolRouter } from './kol';
import { reportsRouter } from './reports';
import { adminRouter } from './admin';
import { aiRouter } from './ai';
import { performanceIntelRouter } from './performance-intel';
import { competitorIntelRouter } from './competitor-intel';
import { benchmarksRouter } from './benchmarks';
import { ticketsRouter } from './tickets';
import { copilotRouter } from './copilot';
import { schedulesRouter } from './schedules';
import { adhocReportsRouter } from './adhoc-reports';
import { approvalsRouter } from './approvals';
import { milestonesRouter } from './milestones';
import { tasksRouter } from './tasks';
import { googleRouter } from './google';
import { emailListsRouter } from './email-lists';
import { emailSubscribersRouter } from './email-subscribers';
import { emailTemplatesRouter } from './email-templates';
import { emailCampaignsRouter } from './email-campaigns';
import { intelligenceRouter } from './intelligence';
import { notionTasksRouter } from './notion-tasks';

export const appRouter = router({
  accounts: accountsRouter,
  posts: postsRouter,
  inbox: inboxRouter,
  listening: listeningRouter,
  analytics: analyticsRouter,
  competitors: competitorsRouter,
  kol: kolRouter,
  reports: reportsRouter,
  admin: adminRouter,
  ai: aiRouter,
  performanceIntel: performanceIntelRouter,
  competitorIntel: competitorIntelRouter,
  benchmarks: benchmarksRouter,
  tickets: ticketsRouter,
  copilot: copilotRouter,
  schedules: schedulesRouter,
  adhocReports: adhocReportsRouter,
  approvals: approvalsRouter,
  milestones: milestonesRouter,
  tasks: tasksRouter,
  google: googleRouter,
  emailLists: emailListsRouter,
  emailSubscribers: emailSubscribersRouter,
  emailTemplates: emailTemplatesRouter,
  emailCampaigns: emailCampaignsRouter,
  intelligence: intelligenceRouter,
  notionTasks: notionTasksRouter,
});

/** @typedef {typeof appRouter} AppRouter */
