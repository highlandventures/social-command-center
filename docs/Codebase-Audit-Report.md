# Social Command Center — Codebase Audit Report

**Date:** March 30, 2026
**Scope:** Full repo — app code, root files, env config, planning docs, scripts, cron routes

---

## Executive Summary

The codebase is **architecturally sound** — lib modules are well-separated, routers don't duplicate each other, and cron routes are distinct. The main issues are **organizational clutter**: orphaned docs at the repo root, leftover temp files, one-off migration scripts that should be archived, and completed planning phases still in the active directory.

**By the numbers:**
- 12 root-level files to relocate or delete
- 7 one-off prisma/scripts to archive
- 8 completed planning phases to archive
- 3 temp/dead files to delete
- 2 minor code improvements (dead exports, token refresh consolidation)
- 1 unused package to remove (`packages/shared/`)

---

## 1. DELETE — Dead / Temp Files

These serve no purpose and should be removed immediately.

| File | Why |
|------|-----|
| `.env.prod.tmp` | Leftover from Mar 14 deployment attempt |
| `.env.vercel.tmp` | Leftover from Mar 14 deployment attempt |
| `apps/social/.env.local.save` | Manual backup; `.env.local` is the live version |
| `CLAUDE.md` (root) | Empty file, 0 bytes — unused |
| `packages/shared/` (entire dir) | Boilerplate — `@mcc/shared` is never imported anywhere |

---

## 2. ARCHIVE or DELETE — Root-Level Doc Clutter

These files sit in the repo root but aren't referenced by app code. The `.planning/` system has superseded most of them.

| File | Size | Recommendation | Reason |
|------|------|----------------|--------|
| `Marketing-Command-Center-Strategy.docx` | 20 KB | DELETE | Superseded by `.planning/PROJECT.md` |
| `Marketing-Command-Center-Architecture.html` | 30 KB | DELETE | Superseded by `.planning/codebase/ARCHITECTURE.md` |
| `Social Command Center — PRD v1.0.docx` | 22 KB | ARCHIVE → `docs/` | Original PRD, historical reference only |
| `Social Command Center — Build Tracker.xlsx` | 14 KB | ARCHIVE → `docs/` | GSD system is now source of truth |
| `Social Listening - Audit & Remediation Plan.docx` | 19 KB | ARCHIVE → `docs/` | Sprint-specific, completed |
| `Social_Listening_Query_Audit_Report.docx` | 19 KB | ARCHIVE → `docs/` | Point-in-time report |
| `Sprint-6-Remediation-Plan.docx` | 18 KB | ARCHIVE → `docs/` | Sprint-specific, completed |
| `slack_tickets.docx` | 37 KB | ARCHIVE → `docs/` | Output from slack logger script |

---

## 3. MOVE — Docs That Belong in `docs/`

Active setup guides and specs that should be organized, not scattered at root.

| File | Move To |
|------|---------|
| `Google-Drive-Scope-Setup.md` | `docs/integrations/` |
| `Hub-Integrations-PRD-Drive-Notion.md` | `docs/specs/` |
| `Notion-Integration-Setup.md` | `docs/integrations/` |
| `Vercel-QA-Report-2026-03-13.md` | `docs/reports/` |
| `setup_guide.md` | `docs/automation/` |
| `pm-outbox.md` | `docs/` (or keep at root if actively updated) |
| `slack_ticket_logger.py` | `tools/slack-ticket-logger/` |

---

## 4. MOVE — Standalone Files at Root

| File | Issue | Move To |
|------|-------|---------|
| `marketing-tasks-mock.jsx` | Not imported by app; appears to be a WIP prototype | `apps/social/components/` if active; DELETE if dead |

**Decision needed:** Is `marketing-tasks-mock.jsx` a feature in development or a discarded prototype?

---

## 5. ARCHIVE — One-Off Prisma & Script Files

All marked "one-off" or "one-time" in their comments. Data migrations are complete.

**Prisma backfill scripts → `prisma/archive/`:**
- `backfill-kol-activations.js`
- `backfill-kol-profiles.js`
- `backfill-metrics.js`
- `backfill-posted-at-from-id.js`
- `backfill-posted-at.js`
- `backfill-sentiment.js`
- `enrich-kol-profiles.js`

**App scripts → `scripts/archive/`:**
- `scripts/backfill-followers.js` (keep accessible for emergencies)

**Keep active:**
- All 4 seed scripts (`seed.js`, `seed-competitors.js`, `seed-email-templates.js`, `seed-kols.js`) — idempotent, used in `db:seed`
- `scripts/check-followers.js` and `scripts/diagnose-followers.js` — active diagnostic tools
- `scripts/backfill-from-csv.js` — manual utility that may be re-used

---

## 6. ARCHIVE — Completed Planning Phases

Phases 01-08 shipped with v1.0 (Mar 15) and v1.1 (Mar 17). They're valuable history but clutter the active working directory.

**Move to `.planning/archive/`:**
- `phases/01-performance-intel/`
- `phases/02-competitor-intel/`
- `phases/03-audience-questions/`
- `phases/04-content-co-pilot/`
- `phases/05-report-engine-charts/`
- `phases/06-export-distribution/`
- `phases/07-scheduling-ad-hoc-reports/`
- `phases/08-benchmarking/`
- `research/` (5 files — v1.1 architecture research, complete)

**Keep active:** Phases 09-16 (in-progress or near-term work)

---

## 7. CODE QUALITY — Minor Improvements

### 7a. Dead Exports in `lib/ai.js`
`getAnthropic()` and `parseAIJSON()` are exported but only used internally within the same file. Should be made private (remove from exports).

### 7b. Token Refresh Duplication
`lib/token-refresh.js` (X + Reddit) and `lib/google-token-refresh.js` use nearly identical patterns — encrypted token, 5-min expiry check, refresh call. Could be unified into a generic `refreshOAuthToken()` utility. Low priority but cleaner.

### 7c. Reddit Adapter Documentation
`lib/reddit-adapter.js` (official OAuth) and `lib/late-reddit.js` (Late API proxy) serve different use cases but the routing logic between them isn't documented. Adding a comment explaining when each is used would help.

### 7d. Cron Auth Inconsistency
`api/cron/generate-briefing` uses inline auth (`authHeader !== Bearer ${CRON_SECRET}`) instead of the shared `verifyCronAuth()` function used by other routes. Minor inconsistency worth aligning.

---

## 8. WHAT'S WORKING WELL

These areas are clean and well-organized — no changes needed:

- **lib/ai.js + lib/ai/*.js** — Clean parent/child pattern, no overlap
- **lib/google-apis.js vs lib/google-drive.js** — Correctly separated (Gmail/Calendar vs Drive)
- **lib/notion-adapter.js vs lib/notion-tasks.js** — Different purposes (Zapier bridge vs local DB)
- **lib/twitter-api.js vs lib/x-adapter.js** — Complementary (utility vs unified interface)
- **routers/competitors.js vs routers/competitor-intel.js** — CRUD vs analytics, correctly split
- **routers/tasks.js vs routers/notion-tasks.js** — Different data sources, no overlap
- **All 17 cron routes** — Active, distinct purposes, no duplicates
- **Test setup** — Vitest configured with coverage on lib/

---

## Proposed Cleanup Order

1. **Quick wins (5 min):** Delete temp files, empty CLAUDE.md, unused `packages/shared/`
2. **Organize docs (10 min):** Create `docs/` folder, move scattered docs and guides
3. **Archive scripts (5 min):** Create `prisma/archive/` and `scripts/archive/`, move one-off migrations
4. **Archive planning (5 min):** Create `.planning/archive/`, move phases 01-08 and research
5. **Code fixes (15 min):** Clean up dead exports, align cron auth, add Reddit adapter docs
6. **Decision point:** Clarify `marketing-tasks-mock.jsx` — keep or kill?
