# Roadmap: Social Command Center

## Milestones

- ✅ **v1.0 Content Intelligence System** - Phases 1-4 (shipped 2026-03-15)
- 🚧 **v1.1 Report Center** - Phases 5-8 (in progress)

## Phases

<details>
<summary>v1.0 Content Intelligence System (Phases 1-4) - SHIPPED 2026-03-15</summary>

- [x] **Phase 1: Performance Intel** - Surface post performance data as actionable insight cards in the composer sidebar
- [x] **Phase 2: Competitor Intel** - Capture competitor post content and extract strategic patterns via AI analysis
- [x] **Phase 3: Audience Questions** - Extract, cluster, and score questions from listening hits as content opportunities
- [x] **Phase 4: Content Co-Pilot** - Conversational AI co-pilot in composer sidebar with streaming chat, intel context, brand voice, predictions, and draft insertion (completed 2026-03-16)

### Phase 1: Performance Intel
**Goal**: Team can see what content works and why, directly in the composer where they make content decisions
**Depends on**: Nothing
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. Team can open a sidebar panel in the composer and see their published posts grouped into top / average / poor tiers with engagement metrics visible
  2. Team can see pattern callouts identifying which topics, formats, and posting times correlate with high performance
  3. Team can see a sparkline next to each post showing its engagement trajectory over time
  4. Insight cards in the sidebar display reusable takeaways that persist across composer sessions
**Plans**: 2 plans (complete)

Plans:
- [x] 01-01: Backend API -- performanceIntel tRPC router
- [x] 01-02: Frontend UI -- PerformanceIntelPanel component

### Phase 2: Competitor Intel
**Goal**: Team can understand competitor content strategies
**Depends on**: Phase 1
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04
**Success Criteria** (what must be TRUE):
  1. System captures competitor post content from X on an automated schedule
  2. Team can see AI-extracted themes with frequency counts
  3. Team can see which content formats competitors use and which drive highest engagement
  4. Team can view per-competitor strategy cards with benchmarks vs our accounts
**Plans**: 2 plans (complete)

Plans:
- [x] 02-01: Backend -- CompetitorPost schema, cron, competitorIntel tRPC router
- [x] 02-02: Frontend -- CompetitorIntelPanel component

### Phase 3: Audience Questions
**Goal**: Team can discover what the audience wants to know and use those questions as content fuel
**Depends on**: Phase 1
**Requirements**: AUDQ-01, AUDQ-02, AUDQ-03, AUDQ-04
**Success Criteria** (what must be TRUE):
  1. System extracts questions from listening hits using intent classification
  2. Questions are grouped into topic clusters
  3. Unanswered and recurring questions are highlighted as content opportunities
  4. Each question cluster displays a content opportunity score
**Plans**: 2 plans (complete)

Plans:
- [x] 03-01: Backend -- audienceQuestions tRPC router
- [x] 03-02: Frontend -- AudienceQuestionsPanel component

### Phase 4: Content Co-Pilot
**Goal**: Team can co-create content with an AI assistant in the composer sidebar that leverages performance data, competitor intel, and audience questions
**Depends on**: Phase 3
**Requirements**: CPLT-01, CPLT-02, CPLT-03, CPLT-04, CPLT-05
**Success Criteria** (what must be TRUE):
  1. Team can open a chat interface in the composer sidebar and have multi-turn conversations with an AI co-pilot
  2. Co-pilot has access to all 3 intel sources (performance patterns, competitor themes, audience questions) as context
  3. Co-pilot learns brand voice from top-performing published posts and adapts per account
  4. Co-pilot can predict performance of drafted content with inline score cards
  5. Co-pilot can insert drafted content directly into the composer editor in the active post mode
**Plans**: 3 plans

Plans:
- [x] 04-00-PLAN.md -- Wave 0 test scaffolds (copilot lib module stubs)
- [x] 04-01-PLAN.md -- Backend: schema, deps, copilot lib modules, tRPC router, streaming API route
- [x] 04-02-PLAN.md -- Frontend: CopilotPanel, message renderer, input, suggestion chips, prediction card, composer integration

</details>

### v1.1 Report Center (In Progress)

**Milestone Goal:** Transform the Report Center from a manual text-only report builder into a fully automated reporting system with rich visuals, PDF export, email distribution, scheduled cadence reports, conversational ad hoc reports, and flexible benchmarking.

**Phase Numbering:**
- Integer phases (5, 6, 7, 8): Planned milestone work
- Decimal phases (e.g., 6.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 5: Report Engine + Charts** - Rich report generation with inline charts, KPI stats, executive summaries, and comparison deltas (completed 2026-03-15)
- [x] **Phase 6: Export + Distribution** - PDF export and email delivery with full visual content inline (completed 2026-03-16)
- [x] **Phase 7: Scheduling + Ad Hoc Reports** - Automated cadence reports and conversational AI report scoping (completed 2026-03-16)
- [ ] **Phase 8: Benchmarking** - Period-over-period comparisons and custom milestone benchmarking

## Phase Details

### Phase 5: Report Engine + Charts
**Goal**: Team can generate reports with rich visual content -- topline KPIs, AI executive summaries, inline charts, sentiment themes, and comparison deltas -- replacing the current text-only output
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: RCNT-01, RCNT-02, RCNT-03, RCNT-04, RCNT-05, RCNT-06, RCNT-07
**Success Criteria** (what must be TRUE):
  1. Team can trigger report generation and see topline KPI stats (impressions, engagement rate, follower delta, top post, sentiment) displayed prominently at the top of the report
  2. Every generated report includes an AI-written executive summary explaining what happened, what is notable, and what to do next
  3. Reports display inline charts (engagement trend line, content type breakdown, sentiment distribution) rendered as images within the report body
  4. Reports show comparison deltas vs the previous equivalent period with directional trend arrows (up/down/flat)
  5. Report content is stored as structured JSON with both data arrays (for in-app rendering) and chart image URLs (for PDF and email), so all downstream channels render from a single source of truth
**Plans**: 3 plans

Plans:
- [x] 05-01: Foundation -- Prisma schema extension, QuickChart.io chart renderer, report content schema
- [x] 05-02: Report engine orchestrator -- KPIs, comparison deltas, AI summary, sentiment themes, tRPC wiring
- [x] 05-03: Frontend -- ReportViewer component, KPI cards, inline charts, report detail page

### Phase 6: Export + Distribution
**Goal**: Team can export any report as a formatted PDF and distribute reports via email with full visual content inline
**Depends on**: Phase 5
**Requirements**: EXPT-01, EXPT-02, DIST-02, DIST-04
**Success Criteria** (what must be TRUE):
  1. Team can click "Export PDF" on any report and download a formatted PDF containing KPI cards, executive summary, chart images, and recommendations
  2. Team can send any report via email with branded HTML content inline (KPI summary, executive summary, View Full Report CTA) and PDF attached
  3. Every delivery (email send, PDF export) is logged with status (sent/failed), recipient, and timestamp, visible in the report detail UI
**Plans**: 3 plans

Plans:
- [x] 06-00-PLAN.md -- Wave 0 test scaffolds (pdf-renderer + email-sender stubs)
- [x] 06-01-PLAN.md -- PDF export: branded PDF renderer, API route, Export PDF button
- [x] 06-02-PLAN.md -- Email distribution: email template, sender, recipient modal, delivery tracking UI

### Phase 7: Scheduling + Ad Hoc Reports
**Goal**: Reports generate automatically on configured cadences without manual intervention, and team can create custom ad hoc reports through a guided AI conversation
**Depends on**: Phase 6
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04, DIST-01, DIST-03, ADHC-01, ADHC-02, ADHC-03, ADHC-04, ADHC-05
**Success Criteria** (what must be TRUE):
  1. Team can create a report schedule selecting weekly, monthly, quarterly, or yearly cadence, and reports auto-generate at that cadence without manual intervention
  2. Team can view, enable/disable, edit, and delete report schedules, and see schedule status showing next run, last run, and a link to the latest generated report
  3. Team can open an in-app chat, describe what they want a report to cover, and the AI asks clarifying questions to scope the report before generating it
  4. Ad hoc reports support snapshot re-runs (re-check metrics at configured intervals) and manual re-trigger via a "Re-run" button
  5. Chat conversation state for ad hoc report scoping persists across page refreshes
**Plans**: 3 plans

Plans:
- [x] 07-00-PLAN.md -- Wave 0 test scaffolds (scheduling + ad hoc report stubs)
- [x] 07-01-PLAN.md -- Scheduling: Prisma schema, tRPC CRUD, cron route, email delivery, management UI
- [x] 07-02-PLAN.md -- Ad hoc reports: Prisma schema, AI chat scoping, param extraction, re-runs, snapshots, UI

### Phase 8: Benchmarking
**Goal**: Team can compare report metrics against previous time periods and custom milestones to understand performance trends and event impact
**Depends on**: Phase 5 (comparison delta infrastructure), Phase 7 (scheduling for auto-benchmarks)
**Requirements**: BNCH-01, BNCH-02, BNCH-03, BNCH-04
**Success Criteria** (what must be TRUE):
  1. Team can compare any report's metrics against a previous equivalent period (week-over-week, month-over-month, quarter-over-quarter, year-over-year)
  2. Team can create named milestones (product launches, campaigns, events) with start and end dates
  3. Team can benchmark a report against any named milestone's time period to see how current performance compares to the milestone period
  4. All benchmark comparisons display absolute values and percentage deltas with directional indicators (green up arrows, red down arrows)
**Plans**: 3 plans

Plans:
- [ ] 08-00-PLAN.md -- Wave 0 test scaffolds (milestone + benchmark comparison stubs)
- [ ] 08-01-PLAN.md -- Backend: Milestone model, milestones tRPC CRUD, benchmark comparison logic, compareBenchmark endpoint
- [ ] 08-02-PLAN.md -- Frontend: MilestoneManager, BenchmarkSelector, report detail integration, navigation

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 5.1 -> 6 -> 6.1 -> 7 -> 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Performance Intel | v1.0 | 2/2 | Complete | 2026-03-14 |
| 2. Competitor Intel | v1.0 | 2/2 | Complete | 2026-03-14 |
| 3. Audience Questions | v1.0 | 2/2 | Complete | 2026-03-15 |
| 4. Content Co-Pilot | v1.0 | 3/3 | Complete | 2026-03-16 |
| 5. Report Engine + Charts | v1.1 | 3/3 | Complete | 2026-03-15 |
| 6. Export + Distribution | v1.1 | 3/3 | Complete | 2026-03-16 |
| 7. Scheduling + Ad Hoc Reports | v1.1 | 3/3 | Complete | 2026-03-16 |
| 8. Benchmarking | v1.1 | 0/3 | Not started | - |
