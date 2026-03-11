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
});

/** @typedef {typeof appRouter} AppRouter */
