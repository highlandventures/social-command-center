# Roadmap: Social Command — Autonomous Listening Intelligence

## Overview

This milestone transforms social listening from a manual workflow into an autonomous intelligence system. The work spans three phases: first, hardening the data schema and upgrading the AI SDK so every subsequent phase has a reliable foundation; second, building the SWT (Strengths / Weaknesses / Threats) insight engine and surfacing it in the listening UI, which delivers immediate user value; third, closing the automation loop with the query expansion engine and coverage gap detection so the system continuously improves its own data collection without human initiation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Schema Foundation** - Prisma migration + SDK upgrade that all subsequent phases depend on
- [ ] **Phase 2: SWT Insight Engine** - Batch SWT analysis cron + UI panel for brand/competitor intelligence
- [ ] **Phase 3: Query Autonomy** - Coverage gap detection + auto-expansion + competitor parity audit

## Phase Details

### Phase 1: Schema Foundation
**Goal**: The database schema and AI SDK are ready to support both the SWT engine and the query expansion engine
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04
**Success Criteria** (what must be TRUE):
  1. The Anthropic SDK is upgraded to 0.78.0 and `zodOutputFormat()` can be called without errors
  2. `SWT_ANALYSIS` exists as a valid `InsightType` enum value in the Prisma schema and database
  3. `ListeningTopic` rows have a nullable `competitorId` FK that can be populated and queried
  4. `QueryExpansionLog` model exists in the schema and can accept insert operations
**Plans**: TBD

### Phase 2: SWT Insight Engine
**Goal**: Team can see structured Strengths / Weaknesses / Threats analysis per brand and competitor directly in the listening page — refreshed on a daily schedule
**Depends on**: Phase 1
**Requirements**: SWT-01, SWT-02, SWT-03, SWT-04, SWT-05, SWT-06, SWT-07
**Success Criteria** (what must be TRUE):
  1. A daily cron job runs SWT analysis and writes `AIInsight` records categorized as Strengths, Weaknesses, or Threats (not sentiment labels)
  2. The listening page shows a three-column SWT panel that the team can filter by individual brand or competitor
  3. Each SWT insight card displays a freshness timestamp ("based on N hits as of [date]") so the team knows when the analysis was last run
  4. A competitor-positive mention appears in Threats (not Strengths), confirming SWT categories are strategic rather than sentiment-based
**Plans**: TBD

### Phase 3: Query Autonomy
**Goal**: The system detects its own coverage gaps and generates new queries automatically — with an audit trail and hard limits preventing runaway expansion
**Depends on**: Phase 2
**Requirements**: QAUT-01, QAUT-02, QAUT-03, QAUT-04, QAUT-05, QAUT-06
**Success Criteria** (what must be TRUE):
  1. A nightly cron runs coverage gap detection, and new queries appear in the staging queue (`active=false`) without any human initiation
  2. Competitors with fewer active queries than owned brands are flagged and visible in the audit log
  3. A query whose health grade drops to POOR automatically triggers refinement (not deletion — existing hit counters remain intact)
  4. The per-topic query ceiling (8-12 active queries) is enforced and no topic exceeds it after an expansion run
  5. Every autonomous query change (creation, deactivation, refinement trigger) is logged with a rationale the team can review in the UI

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema Foundation | 0/TBD | Not started | - |
| 2. SWT Insight Engine | 0/TBD | Not started | - |
| 3. Query Autonomy | 0/TBD | Not started | - |
