---
phase: 03-audience-questions
plan: 01
subsystem: api
tags: [prisma, trpc, claude-haiku, ai-insights, audience-questions, listening]

# Dependency graph
requires:
  - phase: 02-competitor-intel
    provides: "AIInsight cache pattern with InsightType enum and readCachedInsight helper"
provides:
  - "AUDIENCE_QUESTION InsightType enum value"
  - "analyzeAudienceQuestions() batch AI function in listening-scanner.js"
  - "audienceQuestionsRouter tRPC router with clusters and questions procedures"
affects: [03-audience-questions]

# Tech tracking
tech-stack:
  added: []
  patterns: ["AIInsight cache-read pattern extended to audience questions"]

key-files:
  created:
    - lib/routers/audience-questions.js
  modified:
    - prisma/schema.prisma
    - lib/listening-scanner.js
    - lib/routers/app.js

key-decisions:
  - "Single batch AI call extracts questions and clusters together for efficiency"
  - "Cache-read only tRPC procedures -- no live AI in API routes"
  - "Non-blocking question analysis -- failures do not break the listening scan"

patterns-established:
  - "AUDIENCE_QUESTION InsightType with separate questions/clusters data types in AIInsight cache"

requirements-completed: [AUDQ-01, AUDQ-02, AUDQ-03, AUDQ-04]

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 3 Plan 1: Audience Questions Backend Summary

**Batch AI question extraction from ListeningHit data with topic clustering, unanswered/recurring detection, opportunity scoring, and cache-read tRPC router**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-15T06:43:23Z
- **Completed:** 2026-03-15T06:45:07Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- AUDIENCE_QUESTION InsightType added to Prisma schema for cached AI analysis results
- analyzeAudienceQuestions() extracts questions from 30 days of ListeningHit data via Claude Haiku, clusters by topic, detects unanswered/recurring, and scores content opportunities
- audienceQuestionsRouter provides clusters and questions cache-read procedures registered in app.js

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AUDIENCE_QUESTION InsightType and batch AI analysis** - `3785d89` (feat)
2. **Task 2: Create audienceQuestions tRPC router and register it** - `57269d1` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added AUDIENCE_QUESTION to InsightType enum
- `lib/listening-scanner.js` - Added analyzeAudienceQuestions() function and integration into scanListeningTopics
- `lib/routers/audience-questions.js` - New tRPC router with clusters and questions cache-read procedures
- `lib/routers/app.js` - Registered audienceQuestionsRouter

## Decisions Made
- Single batch AI call extracts both questions and clusters in one generateInsight call for token efficiency
- Cache-read only tRPC procedures following competitor-intel.js pattern -- no live AI computation
- Non-blocking integration: question analysis failures do not break the listening scan cron
- Cross-references published posts (90 days) to detect unanswered questions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend data pipeline complete: questions extracted, clustered, and cached during poll-listening cron
- tRPC endpoints ready for frontend consumption via audienceQuestions.clusters and audienceQuestions.questions
- Ready for Plan 02: Audience Questions UI panel in composer sidebar

## Self-Check: PASSED

- FOUND: lib/routers/audience-questions.js
- FOUND: prisma/schema.prisma (AUDIENCE_QUESTION enum)
- FOUND: lib/listening-scanner.js (analyzeAudienceQuestions)
- FOUND: commit 3785d89 (Task 1)
- FOUND: commit 57269d1 (Task 2)

---
*Phase: 03-audience-questions*
*Completed: 2026-03-15*
