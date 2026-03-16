---
phase: 04-content-co-pilot
plan: 01
subsystem: api
tags: [ai-sdk, anthropic, streaming, trpc, prisma, copilot, chat]

requires:
  - phase: 01-performance-intel
    provides: AIInsight PERFORMANCE_PATTERN data for intel context
  - phase: 02-competitor-intel
    provides: AIInsight COMPETITOR_STRATEGY data for intel context
  - phase: 03-audience-questions
    provides: AIInsight AUDIENCE_QUESTION data for intel context
provides:
  - CopilotThread and CopilotMessage Prisma models for conversation persistence
  - Streaming chat endpoint at /api/copilot/chat using Vercel AI SDK + Claude Sonnet
  - Dynamic system prompt builder with intel context and per-account brand voice
  - tRPC copilot router with thread CRUD, daily usage tracking, suggestion chips
  - Draft content detection heuristic for composer insertion
  - Performance prediction score card formatter
affects: [04-02-copilot-ui, composer-page]

tech-stack:
  added: [ai, "@ai-sdk/anthropic", react-markdown, remark-gfm]
  patterns: [vercel-ai-sdk-streaming, hybrid-trpc-plus-api-route, dynamic-system-prompt]

key-files:
  created:
    - lib/copilot/intel-context.js
    - lib/copilot/brand-voice.js
    - lib/copilot/draft-detector.js
    - lib/copilot/prediction.js
    - lib/copilot/system-prompt.js
    - lib/routers/copilot.js
    - app/api/copilot/chat/route.js
  modified:
    - prisma/schema.prisma
    - lib/api-costs.js
    - lib/routers/app.js
    - package.json

key-decisions:
  - "Hybrid approach: streaming via plain API route, CRUD via tRPC (tRPC v10 lacks SSE)"
  - "Sonnet cost constants added separately from Haiku for accurate copilot cost tracking"
  - "Thread auto-titled from first user message content (truncated to 100 chars)"

patterns-established:
  - "Vercel AI SDK streamText + toDataStreamResponse for LLM streaming in Next.js API routes"
  - "System prompt pipeline: parallel fetch intel + brand voice, assemble with mode awareness"
  - "onFinish callback for post-stream message persistence and cost logging"

requirements-completed: [CPLT-01, CPLT-02, CPLT-03, CPLT-04]

duration: 5min
completed: 2026-03-16
---

# Phase 4 Plan 01: Content Co-Pilot Backend Summary

**Streaming chat endpoint with Vercel AI SDK, dynamic system prompt with intel context + brand voice, tRPC copilot router, and Prisma thread/message persistence**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T17:42:00Z
- **Completed:** 2026-03-16T17:47:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- CopilotThread and CopilotMessage Prisma models pushed to database with proper indexes
- 5 copilot library modules: intel-context, brand-voice, draft-detector, prediction, system-prompt
- Streaming chat endpoint at /api/copilot/chat with auth, system prompt, message persistence, cost logging
- tRPC copilot router with getRecentThread, createThread, getDailyUsage, getSuggestionChips
- Full test suite passes (169 tests green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, deps, and copilot library modules** - `e91407e` (feat)
2. **Task 2: tRPC copilot router and streaming chat endpoint** - `136dfe1` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added CopilotThread and CopilotMessage models with User relation
- `lib/api-costs.js` - Added CLAUDE_SONNET_INPUT/OUTPUT_PER_TOKEN constants
- `lib/copilot/intel-context.js` - Condensed intel summary from AIInsight cache (3 types)
- `lib/copilot/brand-voice.js` - Top posts per account sorted by engagement rate
- `lib/copilot/draft-detector.js` - Heuristic pattern matching for draft content in messages
- `lib/copilot/prediction.js` - Format prediction data into score card objects
- `lib/copilot/system-prompt.js` - Dynamic system prompt with intel + voice + mode awareness
- `lib/routers/copilot.js` - tRPC router for thread CRUD, usage, suggestion chips
- `lib/routers/app.js` - Registered copilotRouter
- `app/api/copilot/chat/route.js` - Streaming POST handler with Vercel AI SDK

## Decisions Made
- Hybrid architecture: streaming via plain API route (Vercel AI SDK), CRUD via tRPC -- tRPC v10 does not support SSE natively
- Thread auto-titled from first user message (truncated to 100 chars) for easy identification
- Sonnet cost constants kept separate from Haiku constants for accurate per-model tracking

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Prisma db push required explicit env vars (POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING) -- resolved by passing them directly

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend fully ready for Plan 02 (Co-Pilot UI): useChat can connect to /api/copilot/chat, tRPC copilot.* procedures available
- ANTHROPIC_API_KEY env var must be set for streaming to work in production

---
*Phase: 04-content-co-pilot*
*Completed: 2026-03-16*
