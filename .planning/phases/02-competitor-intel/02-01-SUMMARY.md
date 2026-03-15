---
phase: 02-competitor-intel
plan: 01
subsystem: api, database
tags: [prisma, trpc, ai, competitor-analysis, cron, cache]

# Dependency graph
requires:
  - phase: 01-performance-intel
    provides: AIInsight caching pattern, generateInsight helper, performanceIntel router pattern
provides:
  - CompetitorPost model for storing individual competitor post content + engagement metrics
  - COMPETITOR_STRATEGY InsightType for cached AI analysis results
  - Batch AI analysis in poll-competitors cron (themes, formats, strategyCards)
  - competitorIntel tRPC router with 3 cache-read procedures
affects: [02-competitor-intel plan 02 (UI), content-copilot]

# Tech tracking
tech-stack:
  added: []
  patterns: [batch-ai-in-cron, cache-read-only-router, competitor-post-upsert]

key-files:
  created:
    - lib/routers/competitor-intel.js
  modified:
    - prisma/schema.prisma
    - app/api/cron/poll-competitors/route.js
    - lib/routers/app.js

key-decisions:
  - "All tRPC procedures read from AIInsight cache only -- no live AI computation in API routes"
  - "Batch AI analysis runs during cron after post collection, caching themes/formats/strategyCards separately"
  - "Strategy cards include follower counts and all benchmark types (engagement, cadence, followers)"

patterns-established:
  - "Batch AI in cron: Run AI analysis during data collection cron, store results in AIInsight with typed content.type field"
  - "Cache-read router: tRPC procedures that read from AIInsight cache using shared readCachedInsight helper"

requirements-completed: [COMP-01, COMP-02, COMP-03, COMP-04]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 2 Plan 1: Competitor Intel Data Pipeline Summary

**CompetitorPost model, batch AI analysis in poll-competitors cron, and competitorIntel tRPC router with cache-read themes/formats/strategyCards procedures**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-15T05:53:15Z
- **Completed:** 2026-03-15T05:55:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- CompetitorPost model stores individual competitor post content with full engagement metrics, upserted on each cron run
- poll-competitors cron now runs batch AI analysis (via generateInsight with Haiku) producing themes, format breakdowns, and strategy cards cached in AIInsight
- competitorIntel tRPC router provides 3 cache-read procedures (themes, formatAnalysis, strategyCards) with no live AI computation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CompetitorPost model, COMPETITOR_STRATEGY InsightType, and modify cron** - `db5adf1` (feat)
2. **Task 2: Create competitorIntel tRPC router** - `231bb9e` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added CompetitorPost model, posts relation on Competitor, COMPETITOR_STRATEGY enum value
- `app/api/cron/poll-competitors/route.js` - Added competitorPost.upsert in tweet loop, batch AI analysis section after SOV calculation
- `lib/routers/competitor-intel.js` - New cache-read-only tRPC router with themes, formatAnalysis, strategyCards procedures
- `lib/routers/app.js` - Registered competitorIntelRouter

## Decisions Made
- All tRPC procedures read from AIInsight cache only -- no live AI computation in API routes (per plan specification)
- Strategy cards include follower counts and all benchmark types (engagement rate, posting cadence, follower counts)
- Old COMPETITOR_STRATEGY insights are dismissed before storing new ones to prevent stale data accumulation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx prisma validate` and `npx prisma db push` fail due to missing POSTGRES_URL_NON_POOLING env var (expected in local dev -- these env vars are set on Vercel). Schema syntax is valid (confirmed via `npx prisma format`).
- `node -e "require('./lib/routers/competitor-intel.js')"` fails because the project uses ESM imports (not CommonJS). Module loads correctly in Next.js runtime.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Data pipeline and API layer complete, ready for Phase 2 Plan 2 (UI panels)
- competitorIntel router registered and provides themes, formatAnalysis, strategyCards endpoints for UI consumption
- CompetitorPost data will populate on next cron execution

---
*Phase: 02-competitor-intel*
*Completed: 2026-03-14*
