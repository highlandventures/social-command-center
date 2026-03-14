# Social Command Center

AI-powered social media management platform for Figure Technology Solutions (FIGR). Centralizes X (Twitter) publishing, social listening, competitor monitoring, KOL tracking, and AI-generated analytics into a single internal tool.

**Live:** [social-command-center-sand.vercel.app](https://social-command-center-sand.vercel.app)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js 14 (App Router)                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  9 Pages     │  │  10 tRPC     │  │  7 Vercel Crons  │  │
│  │  (React 18)  │  │  Routers     │  │  (1-30 min)      │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│  ┌──────┴─────────────────┴────────────────────┴─────────┐  │
│  │              Shared Services Layer                     │  │
│  │  ┌─────────┐ ┌────────┐ ┌─────────┐ ┌─────────────┐  │  │
│  │  │ X       │ │ Claude │ │ Vercel  │ │ Prisma ORM  │  │  │
│  │  │ Adapter │ │ AI (4) │ │ KV      │ │ (Neon PG)   │  │  │
│  │  └─────────┘ └────────┘ └─────────┘ └─────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Technology | Details |
|-------|-----------|---------|
| Frontend | Next.js 14, React 18, Tailwind CSS | App Router, custom component library (`components/ui.jsx`) |
| API | tRPC v10 | 10 routers, Zod validation, superjson serialization |
| Database | PostgreSQL (Neon) + Prisma | 30+ models, 700-line schema |
| Auth | NextAuth (CredentialsProvider) | Team password + RBAC (Admin/Internal/Agency) |
| AI | Claude Haiku (Anthropic SDK) | Reports, sentiment, KOL scoring, content suggestions |
| X Integration | Official API (writes) + TwitterAPI.io (reads) | Hybrid adapter, AES-256-GCM token encryption |
| Caching | Vercel KV (Redis) | TTL-based caching for API responses |
| Background | 7 Vercel Cron Jobs | Publish, mentions, metrics, listening, analytics, AI insights, KOL |
| Deployment | Vercel | Auto-deploy from main branch |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL database (or [Neon](https://neon.tech) account)
- X Developer account with OAuth 2.0 app
- [TwitterAPI.io](https://twitterapi.io) API key
- Anthropic API key
- Vercel KV store

### Setup

```bash
# Clone and install
git clone <repo-url>
cd social-command-center
npm install

# Configure environment
cp .env.example .env.local
# Fill in all required values (see Environment Variables below)

# Initialize database
npx prisma migrate dev --name init
npx prisma db seed          # Seeds initial data
node prisma/seed-kols.js    # Seeds 15 KOLs across 4 relationship types

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PRISMA_URL` | Yes | Pooled Postgres connection string |
| `POSTGRES_URL_NON_POOLING` | Yes | Direct Postgres connection (for migrations) |
| `NEXTAUTH_URL` | Yes | App URL (`http://localhost:3000` for dev) |
| `NEXTAUTH_SECRET` | Yes | Random secret for session encryption |
| `TEAM_PASSWORD` | Yes | Shared team login password |
| `X_OFFICIAL_CLIENT_ID` | Yes | X OAuth 2.0 app client ID |
| `X_OFFICIAL_CLIENT_SECRET` | Yes | X OAuth 2.0 app client secret |
| `TWITTERAPI_IO_API_KEY` | Yes | TwitterAPI.io key for read operations |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI features |
| `TOKEN_ENCRYPTION_KEY` | Yes | 32-byte hex key for AES-256-GCM token encryption |
| `KV_REST_API_URL` | Yes | Vercel KV endpoint |
| `KV_REST_API_TOKEN` | Yes | Vercel KV auth token |
| `CRON_SECRET` | Yes | Vercel cron job authentication |
| `X_READ_PROVIDER` | No | `third-party` (default) or `official` |
| `X_READ_FALLBACK_TO_OFFICIAL` | No | `true` (default) - fallback if third-party fails |
| `SLACK_WEBHOOK_URL` | No | Slack webhook for cron failure alerts |

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production (runs prisma generate first)
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Regenerate Prisma client
npm run db:push      # Push schema to database (no migration)
npm run db:migrate   # Create and run migration
npm run db:studio    # Open Prisma Studio (database browser)
npm run db:seed      # Run seed script
```

## Project Structure

```
app/
  (dashboard)/
    page.jsx              # Dashboard - metrics overview
    calendar/page.jsx     # Calendar - month/week post views
    composer/page.jsx     # Composer - create/schedule/publish posts
    listening/page.jsx    # Social Listening - AI-assisted topic monitoring
    kol/page.jsx          # KOL Tracking - AI-scored influencer management
    reports/page.jsx      # Reports - AI-generated performance reports
    admin/page.jsx        # Admin - settings, cost tracker, roadmap
    layout.jsx            # Shared nav + sidebar
  auth/signin/page.jsx    # Login page
  api/
    trpc/[trpc]/route.js  # tRPC HTTP handler
    auth/[...nextauth]/   # NextAuth endpoints
    connect/x/            # X OAuth initiation + callback
    cron/                 # 7 background cron jobs
components/
  ui.jsx                  # Shared component library (ErrorBoundary, Toast, etc.)
  providers.jsx           # App-wide providers (tRPC, React Query, Auth, Toast)
lib/
  routers/                # 10 tRPC routers
  ai/                     # AI modules (reports, sentiment, kol-scoring, content)
  ai.js                   # Claude client + generic generateInsight()
  x-adapter.js            # Hybrid X API adapter
  reddit-adapter.js       # Reddit adapter (deferred)
  db.js                   # Prisma client singleton
  redis.js                # Vercel KV client + cachedFetch
  encryption.js           # AES-256-GCM token encryption
  auth.js                 # NextAuth configuration
  trpc.js                 # tRPC server setup + auth middleware
prisma/
  schema.prisma           # Database schema (30+ models)
  seed.js                 # Base seed data
  seed-kols.js            # KOL seed data (15 KOLs)
```

## Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `publish-scheduled` | Every minute | Publishes posts with `scheduledFor` in the past |
| `poll-mentions` | Every 5 min | Detects new @mentions via TwitterAPI.io |
| `poll-metrics` | Every 15 min | Fetches post metrics (batch, up to 100/req) |
| `poll-listening` | Every 10 min | Runs listening queries against X/Reddit |
| `daily-analytics` | Daily 2 AM | Aggregates daily account metrics |
| `weekly-ai-insights` | Monday 6 AM | Generates AI insights from weekly data |
| `kol-activations` | Every 30 min | Detects KOL brand activations |

All cron jobs authenticate via `CRON_SECRET` header. Failures are logged to `APICallLog`.

## X API Routing

The `XPlatformAdapter` implements hybrid routing to optimize cost and rate limits:

- **Writes** (publish, delete, like) always use the Official X API (OAuth 2.0)
- **Reads** (search, timelines, mentions) route to TwitterAPI.io by default ($0.15/1K requests)
- **Own account analytics** use the Official API (for non-public metrics like impressions)
- **Fallback**: if TwitterAPI.io fails and fallback is enabled, routes to Official API

Rate limits are tracked in Vercel KV with 15-minute TTL.

## AI Pipeline

All AI features use Claude Haiku via a shared `generateInsight()` function that handles structured JSON schema enforcement, cost tracking per call, and graceful fallbacks on failure.

| Module | Purpose |
|--------|---------|
| `lib/ai/reports.js` | Weekly reports, competitive analysis, KOL scorecards, listening summaries |
| `lib/ai/sentiment.js` | Keyword-based fast sentiment + Claude batch analysis + intent classification |
| `lib/ai/kol-scoring.js` | A-F grading with 4 factor scores |
| `lib/ai/content-suggestions.js` | Performance analysis, content ideas, thread optimization |

## Deployment

```bash
# Via Vercel CLI
vercel --prod
```

Required Vercel configuration:

1. Set all environment variables in Vercel dashboard
2. Cron jobs are configured in `vercel.json`
3. Build command: `prisma generate && next build`
4. Node.js 18.x runtime

## Status

**Current Phase:** Phase 3 (Hardening & DX) | See Admin > Roadmap in the app for details.
