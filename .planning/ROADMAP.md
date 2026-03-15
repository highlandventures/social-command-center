# Roadmap: Content Intelligence System

## Overview

Transform the composer from a publishing tool into an intelligence-driven content creation engine. Four phases follow the natural data dependency chain: first surface our own performance data (PostMetrics already exists), then capture and analyze competitor content, then extract audience questions from listening data, and finally wire all three intel sources into a conversational co-pilot that lives in the composer.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Performance Intel** - Surface our post performance data as actionable insight cards in the composer sidebar
- [ ] **Phase 2: Competitor Intel** - Capture competitor post content and extract strategic patterns via AI analysis
- [ ] **Phase 3: Audience Questions** - Extract, cluster, and score questions from listening hits as content opportunities
- [ ] **Phase 4: Content Co-Pilot** - Conversational AI agent in the composer with full context on performance, competitors, and audience

## Phase Details

### Phase 1: Performance Intel
**Goal**: Team can see what content works and why, directly in the composer where they make content decisions
**Depends on**: Nothing (uses existing PostMetrics data and analytics router)
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. Team can open a sidebar panel in the composer and see their published posts grouped into top / average / poor tiers with engagement metrics visible
  2. Team can see pattern callouts identifying which topics, formats (thread vs post vs article), and posting times correlate with high performance
  3. Team can see a sparkline next to each post showing its engagement trajectory over time
  4. Insight cards in the sidebar display reusable takeaways (e.g., "Threads about RWA outperform single posts by 3.2x") that persist across composer sessions
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Competitor Intel
**Goal**: Team can understand competitor content strategies -- what they post about, which formats work for them, and how we compare
**Depends on**: Phase 1 (composer sidebar pattern established; competitor post content capture pipeline needed)
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04
**Success Criteria** (what must be TRUE):
  1. System is capturing competitor post content (text, format, engagement) from X and Reddit on an automated schedule, stored alongside existing CompetitorMetrics
  2. Team can open a competitor intel panel in the composer and see AI-extracted themes with frequency counts showing what competitors talk about most
  3. Team can see which content formats competitors use and which formats drive their highest engagement
  4. Team can view a per-competitor strategy card showing posting cadence, top themes, and engagement benchmarks compared to our accounts
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Audience Questions
**Goal**: Team can discover what the audience wants to know and use those questions as content fuel
**Depends on**: Phase 1 (composer sidebar pattern established; uses existing ListeningHit data)
**Requirements**: AUDQ-01, AUDQ-02, AUDQ-03, AUDQ-04
**Success Criteria** (what must be TRUE):
  1. System extracts questions from listening hits using intent classification and surfaces them in a dedicated panel in the composer
  2. Questions are grouped into topic clusters (e.g., "tokenization", "staking", "Figure vs competitors") so the team sees themes, not a raw list
  3. Unanswered and recurring questions are highlighted as content opportunities the team has not yet addressed
  4. Each question cluster displays a content opportunity score based on question volume and associated engagement, so the team knows which topics to prioritize
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Content Co-Pilot
**Goal**: Team can co-create content with an AI agent that has full context on what works, what competitors do, and what the audience needs
**Depends on**: Phase 1, Phase 2, Phase 3 (co-pilot quality depends on all three intel sources being available)
**Requirements**: CPLT-01, CPLT-02, CPLT-03, CPLT-04, CPLT-05
**Success Criteria** (what must be TRUE):
  1. Team can open a chat interface in the composer and have multi-turn conversations to develop content ideas into publishable drafts
  2. Co-pilot responses reflect awareness of performance patterns, competitor themes, and audience questions -- referencing specific data when relevant
  3. Co-pilot writes in the brand voice learned from top-performing published posts, and the team can tell the difference from generic AI output
  4. Team can ask the co-pilot to predict how a draft will perform and receive an engagement estimate before publishing
  5. Team can click a button to insert co-pilot drafted content directly into the active composer editor
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Performance Intel | 0/0 | Not started | - |
| 2. Competitor Intel | 0/0 | Not started | - |
| 3. Audience Questions | 0/0 | Not started | - |
| 4. Content Co-Pilot | 0/0 | Not started | - |
