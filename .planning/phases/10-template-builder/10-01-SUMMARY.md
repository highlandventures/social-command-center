---
phase: 10-template-builder
plan: 01
subsystem: api
tags: [trpc, prisma, email, templates, campaigns, ai, scheduling]

# Dependency graph
requires:
  - phase: 09-email-data-layer
    provides: EmailTemplate, EmailCampaign, EmailSend Prisma models and email-lists/email-subscribers routers
provides:
  - emailTemplatesRouter with 6 CRUD procedures (list, getById, create, update, delete, duplicate)
  - emailCampaignsRouter with 8 procedures (list, getById, create, update, delete, preview, suggestContent, schedule)
  - 4 starter email templates (newsletter, announcement, product_update, event_invite)
  - AI-powered subject line and body copy suggestions via generateInsight
  - Race-safe campaign scheduling with DRAFT status guard
affects: [10-02-campaign-ui, 11-send-engine, 12-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [updateMany with status guard for race protection, AI content suggestions via generateInsight]

key-files:
  created:
    - apps/social/lib/routers/email-templates.js
    - apps/social/lib/routers/email-campaigns.js
    - apps/social/prisma/seed-email-templates.js
    - apps/social/__tests__/lib/email/email-templates.test.js
    - apps/social/__tests__/lib/email/email-campaigns.test.js
  modified:
    - apps/social/lib/routers/app.js

key-decisions:
  - "updateMany/deleteMany with status: DRAFT guard for race-safe campaign operations"
  - "AI suggestions use generateInsight with email_content_suggestions type and 512 max tokens"
  - "Seed templates use deterministic IDs (starter-newsletter, etc.) with upsert for idempotency"
  - "Campaign schedule creates EmailSend QUEUED records only for immediate sends (not scheduled)"

patterns-established:
  - "DRAFT-only mutation pattern: updateMany where {id, status: DRAFT} then check count === 0 for CONFLICT"
  - "AI integration in routers: strip HTML, create context JSON, call generateInsight with typed system prompt"

requirements-completed: [ETPL-01, ETPL-02, ETPL-03, ECMP-01, ECMP-02, ECMP-03]

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 10 Plan 01: Template Builder + Campaign CRUD Summary

**Email templates CRUD with 4 branded starter templates, campaign management with AI subject/body suggestions, and race-safe scheduling via updateMany DRAFT guard**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-17T04:33:35Z
- **Completed:** 2026-03-17T04:40:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- emailTemplatesRouter with 6 procedures: list, getById, create, update, delete, duplicate
- emailCampaignsRouter with 8 procedures: list, getById, create, update, delete, preview, suggestContent, schedule
- 4 starter templates with branded HTML (600px, #5B56F5 purple header, Helvetica/Arial, template variables)
- AI content suggestions returning 5 subject line variants and body copy via generateInsight
- Race-safe campaign scheduling with DRAFT status guard preventing double-sends
- 22 new tests (10 template, 12 campaign) all passing, full suite 284 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Email templates router + seed** - `136551d` (test) -> `02c170f` (feat)
2. **Task 2: Email campaigns router + app.js registration** - `66e0da7` (test) -> `c4ac5ec` (feat)

_TDD: RED (failing tests) then GREEN (implementation) for both tasks_

## Files Created/Modified
- `apps/social/lib/routers/email-templates.js` - Template CRUD tRPC router with 6 procedures
- `apps/social/lib/routers/email-campaigns.js` - Campaign CRUD tRPC router with 8 procedures including AI and scheduling
- `apps/social/prisma/seed-email-templates.js` - 4 starter templates with branded HTML and idempotent upsert
- `apps/social/lib/routers/app.js` - Registered emailTemplates and emailCampaigns routers
- `apps/social/__tests__/lib/email/email-templates.test.js` - 10 template router tests
- `apps/social/__tests__/lib/email/email-campaigns.test.js` - 12 campaign router tests

## Decisions Made
- Used updateMany/deleteMany with status: DRAFT guard for race-safe campaign mutations (prevents editing/deleting campaigns already in flight)
- AI suggestions call generateInsight with email_content_suggestions type and 512 max tokens
- Seed templates use deterministic IDs (starter-newsletter, starter-announcement, etc.) for idempotent upsert
- Campaign immediate send creates EmailSend QUEUED records; scheduled sends defer to cron (Phase 11)
- HTML content stripped of tags before sending to AI (first 500 chars as context snippet)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- API layer complete and ready for Phase 10 Plan 02 (campaign UI frontend)
- Starter templates can be seeded via `node apps/social/prisma/seed-email-templates.js`
- Campaign scheduling sets up QUEUED records ready for Phase 11 (send engine)

---
*Phase: 10-template-builder*
*Completed: 2026-03-16*
