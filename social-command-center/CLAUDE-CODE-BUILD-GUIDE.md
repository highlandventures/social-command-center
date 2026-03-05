# Social Command Center — Claude Code Build Guide

This document contains sequential implementation prompts for Claude Code. Copy each section into Claude Code as a task. Wait for each to complete before moving to the next. The only manual steps are entering API keys in `.env.local` and the Vercel dashboard.

Reference files already in the project:
- `prisma/schema.prisma` — Full database schema (all models, enums, relations, indexes)
- `lib/db.js` — Prisma client singleton
- `lib/redis.js` — Vercel KV client + cache helpers + TTL constants
- `lib/x-adapter.js` — X platform adapter (hybrid read/write routing)
- `lib/reddit-adapter.js` — Reddit platform adapter
- `lib/encryption.js` — AES-256-GCM for OAuth token encryption at rest
- `.env.example` — All required environment variables
- `components/SocialCommandCenter.jsx` — Full frontend prototype (keep as reference)

---

## Phase 1: Foundation Setup

### Task 1.1 — Project Bootstrap & Database

```
I have a Next.js 14 project at the current directory. Do the following:

1. Run `npm install` to install all dependencies from package.json
2. Run `npx prisma generate` to generate the Prisma client from prisma/schema.prisma
3. Create `lib/auth.js` with NextAuth.js config:
   - Google OAuth provider (using GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars)
   - Prisma adapter for session storage
   - Callbacks: include user.id and user.role in the session and JWT
   - Session strategy: "jwt"
   - Pages: custom sign-in page at /auth/signin
4. Create `app/api/auth/[...nextauth]/route.js` that exports GET and POST handlers from the auth config
5. Create `app/auth/signin/page.jsx` — a clean sign-in page with:
   - Centered card layout
   - "Social Command Center" title
   - "Sign in with Google" button that calls signIn("google")
   - Tailwind styling consistent with the app's gray/blue theme
6. Create `middleware.js` at project root that protects all routes except /auth/* and /api/auth/*
   - Redirect unauthenticated users to /auth/signin
   - Use NextAuth's middleware approach
7. Create `prisma/seed.js` that seeds:
   - One admin user with your email (miso@highlandventures.io, role ADMIN)
   - Two sample X accounts (@highland_vc, @highland_official)
   - One sample Reddit account (u/highland_ventures)
   - A few sample posts with different statuses (draft, scheduled, published)
   - A few sample listening topics with queries

Do NOT modify the existing schema.prisma, lib/db.js, lib/redis.js, or the frontend components.
```

### Task 1.2 — tRPC Setup

```
Set up tRPC v10 with the following structure:

1. Create `lib/trpc.js` — initialize tRPC with:
   - Context that includes: prisma client, session (from NextAuth), Vercel KV client
   - A `protectedProcedure` that requires authentication
   - An `adminProcedure` that requires ADMIN role
   - Superjson transformer for Date serialization

2. Create `app/api/trpc/[trpc]/route.js` — tRPC HTTP handler for Next.js App Router

3. Create `lib/trpc-client.js` — client-side tRPC hooks setup with React Query

4. Create `components/providers.jsx` — wraps the app in:
   - SessionProvider (NextAuth)
   - QueryClientProvider (React Query)
   - tRPC Provider

5. Update `app/layout.jsx` to wrap children in the providers component

6. Create the following tRPC routers in `lib/routers/`:

   a. `accounts.js` — Account management router:
      - accounts.list — return all connected accounts for the current user (respecting AGENCY role scoping)
      - accounts.connect — initiate OAuth flow for X or Reddit (admin only)
      - accounts.disconnect — remove an account (admin only)
      - accounts.getMetrics — get AccountMetrics for a date range

   b. `posts.js` — Publishing router:
      - posts.list — list posts with filters (status, account, date range, platform)
      - posts.create — create a draft or scheduled post (validate with Zod schema)
      - posts.update — update a draft/scheduled post
      - posts.delete — delete a draft (cannot delete published)
      - posts.publish — publish immediately using the X or Reddit adapter from lib/
      - posts.publishThread — publish a thread (sequential tweets with reply chaining)
      - posts.schedule — set scheduledFor datetime, status = SCHEDULED
      - posts.getMetrics — get PostMetrics time series for a post

   c. `inbox.js` — Inbox router:
      - inbox.list — list inbox items with filters (read, platform, type)
      - inbox.markRead — mark item as read
      - inbox.archive — archive an item
      - inbox.reply — reply to a mention/comment (uses X or Reddit adapter)

   d. `listening.js` — Social listening router:
      - listening.topics.list — list all topics with hit counts
      - listening.topics.create — create a topic with initial queries
      - listening.topics.update — update topic or queries
      - listening.hits.list — paginated hits for a topic (with sentiment/relevance filters)
      - listening.hits.dismiss — dismiss a hit
      - listening.hits.routeToInbox — create an InboxItem from a hit

   e. `analytics.js` — Analytics router:
      - analytics.dashboard — aggregate metrics across all accounts (total followers, impressions, eng rate, WoW deltas)
      - analytics.accountBreakdown — per-account metrics table
      - analytics.postPerformance — post-level performance with sorting
      - analytics.engagementTrend — 30-day engagement rate time series
      - analytics.followerGrowth — 30-day follower growth time series
      - analytics.heatmap — engagement rate by day/hour
      - analytics.brandSentiment — aggregate sentiment from listening data

   f. `competitors.js` — Competitor tracking router:
      - competitors.list — list competitors with latest metrics
      - competitors.create — add a competitor (admin only)
      - competitors.getSOV — share of voice data over time
      - competitors.compare — side-by-side comparison

   g. `kol.js` — KOL tracking router:
      - kol.list — list KOLs with latest metrics and AI scores
      - kol.create — add a KOL
      - kol.getActivations — activations for a KOL with metric snapshots
      - kol.getCohorts — list cohorts with aggregate stats
      - kol.getMetricsHistory — weekly metrics time series

   h. `reports.js` — Reports router:
      - reports.list — list saved reports
      - reports.generate — generate a report using Claude AI (pass prompt + data context)
      - reports.getBenchmarks — historical benchmark data

   i. `admin.js` — Admin router:
      - admin.users.list — list all users with roles
      - admin.users.invite — invite a user (admin only)
      - admin.users.updateRole — change role (admin only)
      - admin.apiCosts — aggregate API call costs by provider and time period
      - admin.auditLog — paginated audit log

   j. `app.js` — Root router that merges all sub-routers

   All procedures should:
   - Use Zod for input validation
   - Check role-based permissions (AGENCY users only see assigned accounts)
   - Log sensitive actions to AuditLog
   - Return clean error messages

Reference prisma/schema.prisma for all model shapes. Reference lib/x-adapter.js and lib/reddit-adapter.js for the API adapter interfaces.
```

### Task 1.3 — OAuth Flows for X and Reddit

```
Implement the OAuth connection flows for connecting X and Reddit social accounts:

1. Create `app/api/connect/x/route.js`:
   - GET handler that initiates X OAuth 2.0 with PKCE
   - Scopes: tweet.read, tweet.write, users.read, offline.access
   - Redirect URI: /api/connect/x/callback
   - Store PKCE verifier in a secure HTTP-only cookie

2. Create `app/api/connect/x/callback/route.js`:
   - Exchange code for tokens
   - Fetch the authenticated user's profile from X API
   - Encrypt tokens using lib/encryption.js
   - Upsert into Account table (platform: X, platformUserId, username, etc.)
   - Log to AuditLog
   - Redirect to /admin with success message

3. Create `app/api/connect/reddit/route.js`:
   - GET handler that initiates Reddit OAuth 2.0
   - Scopes: identity, read, submit, privatemessages, mysubreddits
   - state parameter for CSRF protection (store in cookie)

4. Create `app/api/connect/reddit/callback/route.js`:
   - Exchange code for tokens
   - Fetch /api/v1/me for user profile
   - Encrypt tokens, upsert Account
   - Log to AuditLog
   - Redirect to /admin

5. Create `lib/token-refresh.js`:
   - refreshXToken(account) — refresh X OAuth token using refresh_token, update DB
   - refreshRedditToken(account) — refresh Reddit token (expires every 1h), update DB
   - getValidToken(account) — check expiry, refresh if needed, return valid access token
   - This should be called before any API adapter usage

6. Update lib/x-adapter.js and lib/reddit-adapter.js constructors to use getValidToken() so tokens are always fresh.
```

### Task 1.4 — Vercel Cron Jobs (Background Workers)

```
Vercel doesn't support long-running workers, so we use Vercel Cron Jobs for background tasks. Create the following API routes that Vercel will call on a cron schedule:

1. Create `vercel.json` with cron job definitions:
   - /api/cron/publish-scheduled — every 1 minute
   - /api/cron/poll-mentions — every 5 minutes
   - /api/cron/poll-metrics — every 15 minutes
   - /api/cron/poll-listening — every 10 minutes
   - /api/cron/daily-analytics — daily at 2am UTC
   - /api/cron/weekly-ai-insights — weekly Monday at 6am UTC
   - /api/cron/kol-activations — every 30 minutes

2. Create `app/api/cron/publish-scheduled/route.js`:
   - Query posts WHERE status = SCHEDULED AND scheduledFor <= now
   - For each: get valid token, call appropriate adapter (X or Reddit), update status to PUBLISHED or FAILED
   - For threads: publish sequentially with reply chaining
   - If approval required (agency posts): skip unless APPROVED
   - Log each publish to AuditLog

3. Create `app/api/cron/poll-mentions/route.js`:
   - For each active account: call getMentions via adapter
   - Dedupe against existing Mentions by platformMentionId
   - Create new Mention and InboxItem records
   - Check AlertRules for matches → trigger Slack webhook if configured

4. Create `app/api/cron/poll-metrics/route.js`:
   - Adaptive polling per spec §2.3:
     - Posts <2h old: always poll
     - Posts 2-48h: poll (they're within the 15min cycle)
     - Posts >48h but <7 days: poll only on the 6-hour cycle (check lastFetched)
     - Posts >7 days: skip
   - Create PostMetrics records with latest data
   - Compute engagementRate = engagements / impressions * 100

5. Create `app/api/cron/poll-listening/route.js`:
   - For each active ListeningTopic:
     - Get queries, run searches via X and Reddit adapters
     - Dedupe against existing ListeningHits
     - Compute heuristicScore based on: author followers, engagement, content relevance
     - Run sentiment analysis (for now: use a simple keyword-based approach; we'll add DistilBERT later)
     - If isActionable: create InboxItem
     - Check AlertRules

6. Create `app/api/cron/daily-analytics/route.js`:
   - For each active account: fetch follower count, compute daily deltas
   - Create AccountMetrics snapshot
   - For each account: fetch own-tweet detailed metrics via official OAuth (private analytics)
   - Aggregate competitor metrics (CompetitorMetrics snapshots)

7. Create `app/api/cron/weekly-ai-insights/route.js`:
   - Gather last 7 days of data: post performance, listening hits, mentions, competitor activity
   - Call Claude Haiku via @anthropic-ai/sdk to generate:
     - Weekly performance summary
     - Top content recommendations
     - Competitor movement analysis
     - Optimal posting schedule update
   - Store as AIInsight records

8. Create `app/api/cron/kol-activations/route.js`:
   - For each active KOL: search for mentions, retweets, quote tweets
   - Cross-match with listening hits
   - Create KOLActivation records
   - Schedule follow-up metric snapshots (24h, 48h, 7d)

All cron routes should:
- Verify the request comes from Vercel (check Authorization header with CRON_SECRET)
- Use try/catch with detailed error logging
- Track execution time and log to APICallLog
- Be idempotent (safe to re-run)
```

---

## Phase 2: Wire Frontend to Backend

### Task 2.1 — Replace Mock Data with tRPC Calls

```
The frontend prototype at components/SocialCommandCenter.jsx currently uses hardcoded mock data. Create a new version that fetches real data from the tRPC API:

1. Create `app/(dashboard)/layout.jsx` — authenticated dashboard layout with:
   - Top navigation bar with logo, account switcher (fetches from accounts.list), and user menu
   - The tab navigation (Dashboard, Composer, Calendar, Listening, KOL, Reports, Admin)
   - Wrap in tRPC/React Query providers

2. Create separate page files for each tab (all under app/(dashboard)/):
   - `page.jsx` — Dashboard (default tab)
   - `composer/page.jsx` — Composer
   - `calendar/page.jsx` — Calendar
   - `listening/page.jsx` — Social Listening
   - `kol/page.jsx` — KOL Tracking
   - `reports/page.jsx` — Reports
   - `admin/page.jsx` — Admin

3. For each page, extract the corresponding tab component from SocialCommandCenter.jsx and convert it to use tRPC queries instead of mock data:

   Dashboard:
   - trpc.analytics.dashboard.useQuery() for summary cards
   - trpc.analytics.accountBreakdown.useQuery() for per-account table
   - trpc.analytics.engagementTrend.useQuery() for charts
   - trpc.analytics.brandSentiment.useQuery() for sentiment panel

   Composer:
   - trpc.posts.create.useMutation() for saving/scheduling
   - trpc.posts.publish.useMutation() for immediate publish
   - trpc.posts.list.useQuery({ status: 'DRAFT' }) for drafts sidebar
   - trpc.posts.list.useQuery({ status: 'SCHEDULED' }) for queue sidebar

   Calendar:
   - trpc.posts.list.useQuery({ dateRange }) for calendar events

   Listening:
   - trpc.listening.hits.list.useQuery() for feed
   - trpc.listening.topics.list.useQuery() for topics
   - trpc.competitors.getSOV.useQuery() for SOV

   KOL:
   - trpc.kol.list.useQuery() for roster
   - trpc.kol.getActivations.useQuery() for detail view

   Reports:
   - trpc.reports.list.useQuery() for repository
   - trpc.reports.generate.useMutation() for AI report builder

   Admin:
   - trpc.admin.users.list.useQuery() for team management
   - trpc.admin.apiCosts.useQuery() for cost tracker
   - trpc.admin.auditLog.useQuery() for audit log

4. Keep all the existing UI/styling from the prototype — only replace the data source.

5. Add loading states (skeleton loaders) and error states for each query.

6. Add React Query's refetchInterval where appropriate:
   - Dashboard metrics: every 60 seconds
   - Listening feed: every 30 seconds
   - Inbox: every 15 seconds
```

---

## Phase 3: AI Pipeline

### Task 3.1 — Claude AI Integration

```
Implement the AI features using the Anthropic SDK (@anthropic-ai/sdk):

1. Create `lib/ai.js` with:
   - initAnthropic() — create Anthropic client using ANTHROPIC_API_KEY
   - generateInsight(type, context) — generic insight generator
   - Cost tracking: log every Claude call to APICallLog with token counts

2. Create `lib/ai/content-suggestions.js`:
   - analyzePostPerformance(posts) — find patterns in what works
   - generateContentIdeas(listeningData, postHistory) — suggest new content based on trending topics
   - optimizeThread(tweets) — suggest improvements to a thread draft
   - predictPerformance(content, platform, account) — predict engagement metrics

3. Create `lib/ai/sentiment.js`:
   - analyzeSentiment(text) — keyword-based sentiment for real-time (free, fast)
   - analyzeSentimentBatch(texts) — Claude Haiku for nuanced batch analysis
   - classifyIntent(text) — categorize: question, complaint, praise, opportunity, spam
   - extractThemes(texts) — identify recurring themes from a batch of posts

4. Create `lib/ai/reports.js`:
   - generateWeeklyReport(data) — structured weekly performance report
   - generateCompetitiveAnalysis(ourData, competitorData) — competitive intelligence
   - generateKOLScorecard(kol, activations, metrics) — A-F scoring with rationale
   - generateListeningSummary(hits, topics) — weekly landscape summary

5. Create `lib/ai/kol-scoring.js`:
   - scoreKOL(kol, activations, metrics) — generate A-F score
   - Uses: activation frequency, engagement quality, follower correlation, cost efficiency
   - Returns: { score, rationale, recommendations }

6. All Claude calls should use claude-3-5-haiku-20241022 model for cost efficiency.
   System prompts should be specific and include the data schema so Claude returns structured JSON.
   Use response_format where possible to ensure valid JSON output.

7. Update the tRPC reports.generate router to use lib/ai/reports.js
8. Update the weekly-ai-insights cron to use lib/ai/
9. Update the kol-activations cron to use lib/ai/kol-scoring.js
```

---

## Phase 4: Deployment

### Task 4.1 — Deploy to Vercel

```
Prepare the project for Vercel deployment:

1. Run `npx prisma generate` to ensure Prisma client is built
2. Run `next build` and fix any build errors
3. Make sure vercel.json has the cron definitions
4. Create a .vercelignore file (ignore: node_modules, .env.local, prisma/dev.db)

Then deploy:
- Run `npx vercel` and follow prompts
- In the Vercel dashboard, add all environment variables from .env.example:
  - Go to Settings → Environment Variables
  - Add each variable from .env.example
- Set up Vercel Postgres: Storage → Create → Postgres → connect to project
- Set up Vercel KV: Storage → Create → KV → connect to project
- Run `npx vercel env pull .env.local` to get the auto-populated DB/KV URLs
- Run `npx prisma db push` to create tables in Vercel Postgres
- Run `npx prisma db seed` to seed initial data
- Run `npx vercel --prod` for production deployment

Post-deploy verification:
- Visit the deployed URL — should redirect to /auth/signin
- Sign in with Google — should see the dashboard
- Check Vercel Logs for any cron job errors
```

---

## API Keys You'll Need to Provide

| Service | Where to Get It | Env Variable |
|---------|----------------|--------------|
| Google OAuth | [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| X (Twitter) API | [developer.x.com](https://developer.x.com) → Developer Portal → Projects & Apps | `X_OFFICIAL_CLIENT_ID`, `X_OFFICIAL_CLIENT_SECRET`, `X_OFFICIAL_BEARER_TOKEN` |
| TwitterAPI.io | [twitterapi.io](https://twitterapi.io) → Dashboard | `TWITTERAPI_IO_API_KEY` |
| Reddit API | [reddit.com/prefs/apps](https://reddit.com/prefs/apps) → Create App | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` |
| Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com) → API Keys | `ANTHROPIC_API_KEY` |
| Slack Webhook (optional) | [api.slack.com/apps](https://api.slack.com/apps) → Incoming Webhooks | `SLACK_WEBHOOK_URL` |

Generate `NEXTAUTH_SECRET` with: `openssl rand -base64 32`
Generate `TOKEN_ENCRYPTION_KEY` with: `openssl rand -hex 32`
Vercel will auto-populate `POSTGRES_*` and `KV_*` variables when you create the storage instances.

---

## Estimated Build Time

| Phase | Tasks | Claude Code Estimate |
|-------|-------|---------------------|
| 1.1 Bootstrap + Auth | Seed, NextAuth, sign-in page | ~15 min |
| 1.2 tRPC Setup | 10 routers, ~80 procedures | ~45 min |
| 1.3 OAuth Flows | X + Reddit connection | ~20 min |
| 1.4 Cron Jobs | 7 background workers | ~30 min |
| 2.1 Frontend Wiring | Replace mock data, loading states | ~40 min |
| 3.1 AI Pipeline | Sentiment, reports, KOL scoring | ~25 min |
| 4.1 Deploy | Build, push, verify | ~10 min |
| **Total** | | **~3 hours** |
