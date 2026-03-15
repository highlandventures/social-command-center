---
phase: 03-audience-questions
verified: 2026-03-14T00:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 3: Audience Questions Verification Report

**Phase Goal:** Team can discover what the audience wants to know and use those questions as content fuel
**Verified:** 2026-03-14
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

#### From Plan 03-01 (Backend)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | System extracts questions from listening hits via AI classification during poll-listening cron | VERIFIED | `analyzeAudienceQuestions()` called at end of `scanListeningTopics()` in `lib/listening-scanner.js` (line 767). Fetches up to 500 ListeningHit records, calls `generateInsight('audience_questions', ...)` with Haiku. |
| 2 | Questions are clustered into topic groups with labels | VERIFIED | AI context instructs Claude to return `clusters` array with `label`, `description`, `questionIndices`. Stored as separate AIInsight record with `type: 'clusters'`. |
| 3 | Unanswered and recurring questions are flagged as content opportunities | VERIFIED | AI prompt explicitly instructs cross-referencing against published posts for `isUnanswered`, and counting appearances for `isRecurring` (3+ times). Fields present in questions schema. |
| 4 | Each cluster has a content opportunity score based on volume and engagement | VERIFIED | Prompt defines `opportunityScore` formula: `normalize(totalVolume * 0.4 + totalEngagement * 0.4 + recurringCount * 0.2) scaled 0-100`. |
| 5 | tRPC router returns cached question clusters to the frontend | VERIFIED | `audienceQuestionsRouter` with `clusters` and `questions` procedures reads from `prisma.aIInsight` via `readCachedInsight()` — no live AI computation in tRPC layer. |

#### From Plan 03-02 (Frontend)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Team can see question clusters ranked by opportunity score in the composer sidebar | VERIFIED | `sortedClusters` sorted by `opportunityScore` descending (line 79 of AudienceQuestionsPanel.jsx). Rendered in composer Intel tab (composer/page.jsx line 911). |
| 7 | Team can expand a cluster to see individual questions | VERIFIED | `expandedCluster` state + click handler on cluster card toggling expanded state (lines 86-96). Expanded questions rendered via `questionIndices` lookup (lines 87-89). |
| 8 | Unanswered and recurring questions are visually highlighted | VERIFIED | Amber "Unanswered" badge (`bg-amber-50 text-amber-700`) and red "Recurring" badge (`bg-red-50 text-red-700`) rendered conditionally on `q.isUnanswered` and `q.isRecurring`. |
| 9 | Each cluster displays its opportunity score | VERIFIED | Score badge rendered: `Score: {cluster.opportunityScore}` with `bg-emerald-50 text-emerald-700` styling. |
| 10 | Panel shows loading, error, and empty states | VERIFIED | All three states implemented: Skeleton cards for loading, red error text, gray-50 box with empty-state message. |

**Score: 10/10 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | AUDIENCE_QUESTION InsightType enum value | VERIFIED | `AUDIENCE_QUESTION` present at line 663 of schema, after COMPETITOR_STRATEGY |
| `lib/listening-scanner.js` | Batch AI analysis for question extraction, clustering, and scoring | VERIFIED | `analyzeAudienceQuestions()` exported at line 273, integrated at line 767 in `scanListeningTopics`. 383 lines of substantive implementation. |
| `lib/routers/audience-questions.js` | audienceQuestions tRPC router with cache-read procedures | VERIFIED | 57-line file, exports `audienceQuestionsRouter` with `clusters` and `questions` protectedProcedures. |
| `lib/routers/app.js` | Router registration | VERIFIED | Imported line 14, registered as `audienceQuestions: audienceQuestionsRouter` at line 30. |
| `components/AudienceQuestionsPanel.jsx` | Self-contained panel with cluster cards and expandable questions | VERIFIED | 144 lines (exceeds 80-line min). Fetches from both tRPC endpoints, renders all states. |
| `app/(dashboard)/composer/page.jsx` | AudienceQuestionsPanel rendered in Intel tab | VERIFIED | Imported line 9, rendered line 911 after CompetitorIntelPanel with `border-t border-border pt-3` divider pattern. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/listening-scanner.js` | `lib/ai.js` | generateInsight call for question extraction | VERIFIED | `generateInsight('audience_questions', aiContext, { model: 'claude-3-5-haiku-20241022', ... })` at line 345 |
| `lib/listening-scanner.js` | `prisma.aIInsight` | cache results with AUDIENCE_QUESTION type | VERIFIED | `prisma.aIInsight.updateMany` (dismiss old) + two `prisma.aIInsight.create` calls with `insightType: 'AUDIENCE_QUESTION'` at lines 352-370 |
| `lib/routers/audience-questions.js` | `prisma.aIInsight` | readCachedInsight reads AUDIENCE_QUESTION cache | VERIFIED | `prisma.aIInsight.findMany({ where: { insightType: 'AUDIENCE_QUESTION', dismissed: false } })` in `readCachedInsight()` |
| `components/AudienceQuestionsPanel.jsx` | `audienceQuestions.clusters` | trpc.audienceQuestions.clusters.useQuery | VERIFIED | `trpc.audienceQuestions.clusters.useQuery({ days: 30 }, { staleTime: 5 * 60 * 1000 })` at line 11 |
| `components/AudienceQuestionsPanel.jsx` | `audienceQuestions.questions` | trpc.audienceQuestions.questions.useQuery | VERIFIED | `trpc.audienceQuestions.questions.useQuery({ days: 30 }, { staleTime: 5 * 60 * 1000 })` at line 17 |
| `app/(dashboard)/composer/page.jsx` | `components/AudienceQuestionsPanel.jsx` | import and render in Intel tab | VERIFIED | Import at line 9, render at line 911 inside Intel tab conditional block |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUDQ-01 | 03-01, 03-02 | System extracts questions from listening hits (filtering interrogative intent) | SATISFIED | `analyzeAudienceQuestions()` instructs AI to "identify content that contains a question (interrogative intent)" and skip statements/announcements |
| AUDQ-02 | 03-01, 03-02 | Questions are clustered by topic | SATISFIED | AI returns `clusters` array with `label`, `description`, `questionIndices`; router caches and returns them; frontend renders sorted cluster cards |
| AUDQ-03 | 03-01, 03-02 | Unanswered/recurring questions surfaced as content opportunities | SATISFIED | `isUnanswered` via post cross-reference, `isRecurring` via count threshold, both displayed with visual badges in the UI |
| AUDQ-04 | 03-01, 03-02 | Each question cluster has a content opportunity score | SATISFIED | `opportunityScore` computed by AI using volume + engagement + recurring formula; displayed as `Score: {value}` badge; clusters sorted by score descending |

**All 4 requirements SATISFIED. No orphaned requirements — AUDQ-01 through AUDQ-04 are the only requirements mapped to Phase 3 in REQUIREMENTS.md.**

---

## Anti-Patterns Found

No anti-patterns detected across phase artifacts:

- No TODO/FIXME/HACK comments in any phase files
- No placeholder return values (`return null`, `return {}`, `return []`)
- No stub handlers (empty arrow functions, console.log-only implementations)
- No static mock data returned from API procedures
- All tRPC procedures perform real database reads

---

## Human Verification Required

### 1. End-to-end panel render in composer sidebar

**Test:** Start dev server, navigate to Composer, click Intel tab, scroll to Audience Questions panel
**Expected:** Panel renders below CompetitorIntelPanel with emerald left-border cluster cards (or empty state if cron has not run yet); no console errors from tRPC queries
**Why human:** Visual layout and absence of runtime errors cannot be verified statically

### 2. Cluster expand/collapse interaction

**Test:** If data is present after a cron run, click a cluster card
**Expected:** Individual questions expand below the card with unanswered (amber) and recurring (red) badges where applicable; clicking again collapses
**Why human:** Interactive state behavior requires a live browser

### 3. Cron trigger — full data pipeline

**Test:** Trigger poll-listening cron manually or wait for scheduled run with active ListeningHit data present
**Expected:** `analyzeAudienceQuestions()` runs after scan completes; AIInsight records created with `type: 'questions'` and `type: 'clusters'`; panel populates data on next page load
**Why human:** Requires live cron execution and database inspection

---

## Commit Verification

All four commits documented in SUMMARY files were verified against git log:

| Commit | Description |
|--------|-------------|
| `3785d89` | feat(03-01): add AUDIENCE_QUESTION InsightType and batch AI analysis in listening scanner |
| `57269d1` | feat(03-01): create audienceQuestions tRPC router and register in app |
| `caa5213` | feat(03-02): create AudienceQuestionsPanel component |
| `3e46668` | feat(03-02): wire AudienceQuestionsPanel into composer Intel tab |

---

## Summary

Phase 3 goal is fully achieved. All 10 observable truths verified, all 6 artifacts substantive and wired, all 5 key links confirmed, all 4 requirements satisfied. No anti-patterns or stub implementations found.

The backend pipeline is complete: `analyzeAudienceQuestions()` runs non-blocking after each listening scan, fetches up to 500 recent hits + 100 published posts, calls Claude Haiku for question extraction and clustering, and caches two AIInsight records (questions + clusters). The tRPC router reads from cache with no live AI computation. The frontend panel renders in the correct position in the Intel tab with all required visual states and interactions wired.

Three items are flagged for human verification (visual render, interaction, and cron pipeline) as they require a live environment.

---

_Verified: 2026-03-14_
_Verifier: Claude (gsd-verifier)_
