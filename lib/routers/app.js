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
import { audienceQuestionsRouter } from './audience-questions';
import { benchmarksRouter } from './benchmarks';

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
  audienceQuestions: audienceQuestionsRouter,
  benchmarks: benchmarksRouter,
});

/** @typedef {typeof appRouter} AppRouter */
