---
phase: 07-scheduling-ad-hoc-reports
plan: 02
subsystem: api, ui, database
tags: [adhoc-reports, streaming-chat, prisma, trpc, useChat, ai-sdk, cron]

# Dependency graph
requires:
  - phase: 07-00
    provides: "Wave 0 test scaffolds for ad hoc report modules"
  - phase: 05-report-engine
    provides: "generateEnrichedReport function for report generation"
  - phase: 04-copilot
    provides: "Streaming chat pattern (useChat, streamText, onFinish persistence)"
  - phase: 06-export-distribution
    provides: "PDF renderer and email sender for scheduled delivery"
provides:
  - "AdHocReport and AdHocReportMessage Prisma models"
  - "ADHOC_SYSTEM_PROMPT for conversational report scoping"
  - "extractReportParams utility for detecting generation params in messages"
  - "adhocReportsRouter tRPC router with CRUD, generate, rerun, configureSnapshots"
  - "Streaming chat endpoint at /api/adhoc-report/chat"
  - "Ad hoc snapshot processing in run-schedules cron"
  - "Frontend list page at /reports/adhoc and chat/detail page at /reports/adhoc/[id]"
affects: [08-benchmarking]

# Tech tracking
tech-stack:
  added: []
  patterns: [conversational-report-scoping, param-extraction-from-chat, snapshot-cron-piggyback]

key-files:
  created:
    - lib/adhoc/system-prompt.js
    - lib/adhoc/param-extractor.js
    - lib/routers/adhoc-reports.js
    - app/api/adhoc-report/chat/route.js
    - app/(dashboard)/reports/adhoc/page.jsx
    - app/(dashboard)/reports/adhoc/[id]/page.jsx
  modified:
    - prisma/schema.prisma
    - lib/routers/app.js
    - app/api/cron/run-schedules/route.js
    - app/(dashboard)/reports/page.jsx
    - __tests__/lib/adhoc-report/adhoc-chat.test.js

key-decisions:
  - "System prompt limits to ONE round of clarifying questions (2-3 max) for fast scoping"
  - "Param extraction via regex for both code-fenced and raw JSON with action:generate"
  - "Ad hoc snapshots piggyback on existing run-schedules cron (no separate cron route)"
  - "useChat from @ai-sdk/react (matching copilot panel convention, not ai/react)"

patterns-established:
  - "Conversational report scoping: AI asks clarifying questions then outputs structured JSON params"
  - "Param extraction pattern: regex for code-fenced + raw JSON, tryParse with action validation"
  - "Snapshot re-runs: cron queries nextSnapshotAt <= now, regenerates with stored reportParams"

requirements-completed: [ADHC-01, ADHC-02, ADHC-03, ADHC-04, ADHC-05]

# Metrics
duration: 10min
completed: 2026-03-16
---

# Phase 7 Plan 02: Ad Hoc Reports Summary

**Conversational AI report scoping with streaming chat, param extraction, re-runs, and snapshot scheduling via cron**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-16T18:51:47Z
- **Completed:** 2026-03-16T19:01:41Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Full ad hoc report pipeline from chat interface through AI scoping to report generation
- Chat messages persist server-side and reload on page refresh (ADHC-05)
- Re-run button regenerates reports with stored params (ADHC-04)
- Snapshot re-runs processed by existing cron route (ADHC-03)
- 10 unit tests passing for system prompt and param extractor

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED+GREEN): System prompt and param extractor** - `c8d6593` (test)
2. **Task 1 (continued): Backend - Prisma, tRPC, chat endpoint, cron** - `92cea08` (feat)
3. **Task 2: Frontend - list page, chat/detail page, navigation** - `5822394` (feat)

_Note: Task 1 was TDD with test-first commit then implementation commit_

## Files Created/Modified
- `lib/adhoc/system-prompt.js` - ADHOC_SYSTEM_PROMPT constant for conversational scoping
- `lib/adhoc/param-extractor.js` - extractReportParams utility parsing JSON from chat messages
- `lib/routers/adhoc-reports.js` - tRPC router: list, get, create, saveMessage, generate, rerun, configureSnapshots
- `app/api/adhoc-report/chat/route.js` - Streaming chat endpoint mirroring copilot pattern
- `app/api/cron/run-schedules/route.js` - Added ad hoc snapshot processing alongside schedule runs
- `prisma/schema.prisma` - AdHocReport and AdHocReportMessage models
- `lib/routers/app.js` - Registered adhocReportsRouter
- `app/(dashboard)/reports/adhoc/page.jsx` - Ad hoc reports list with status badges
- `app/(dashboard)/reports/adhoc/[id]/page.jsx` - Chat/detail page with useChat, generate card, re-run, snapshots
- `app/(dashboard)/reports/page.jsx` - Added "Ad Hoc" tab to reports navigation
- `__tests__/lib/adhoc-report/adhoc-chat.test.js` - Un-skipped and wrote real assertions for prompt + extractor

## Decisions Made
- System prompt limits to ONE round of clarifying questions (2-3 max) for fast scoping
- Param extraction uses regex for both code-fenced and raw JSON with action:"generate" pattern
- Ad hoc snapshots piggyback on existing run-schedules cron route (no separate cron)
- Used @ai-sdk/react for useChat (matching existing copilot panel convention)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed useChat import path**
- **Found during:** Task 2 (Frontend build)
- **Issue:** Plan specified `ai/react` but project uses `@ai-sdk/react` (ai package doesn't export /react)
- **Fix:** Changed import to `@ai-sdk/react` matching CopilotPanel.jsx convention
- **Files modified:** app/(dashboard)/reports/adhoc/[id]/page.jsx
- **Verification:** Build passes
- **Committed in:** 5822394 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor import path correction. No scope creep.

## Issues Encountered
None beyond the import path fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ad hoc report system complete, ready for Phase 8 (Benchmarking)
- All scheduling and ad hoc report features in Phase 7 are now implemented
- Full test suite green (190 passed, 0 failed)

---
*Phase: 07-scheduling-ad-hoc-reports*
*Completed: 2026-03-16*
