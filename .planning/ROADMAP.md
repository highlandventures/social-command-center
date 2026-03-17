# Roadmap: Social Command Center

## Milestones

- ✅ **v1.0 Content Intelligence System** - Phases 1-4 (shipped 2026-03-15)
- ✅ **v1.1 Report Center** - Phases 5-8 (shipped 2026-03-17)
- 🚧 **v1.2 Email Campaigns + Polish** - Phases 9-14 (in progress)

## Phases

<details>
<summary>v1.0 Content Intelligence System (Phases 1-4) - SHIPPED 2026-03-15</summary>

- [x] **Phase 1: Performance Intel** - Surface post performance data as actionable insight cards in the composer sidebar (completed 2026-03-14)
- [x] **Phase 2: Competitor Intel** - Capture competitor post content and extract strategic patterns via AI analysis (completed 2026-03-14)
- [x] **Phase 3: Audience Questions** - Extract, cluster, and score questions from listening hits as content opportunities (completed 2026-03-15)
- [x] **Phase 4: Content Co-Pilot** - Conversational AI co-pilot in composer sidebar with streaming chat, intel context, brand voice, predictions, and draft insertion (completed 2026-03-16)

</details>

<details>
<summary>v1.1 Report Center (Phases 5-8) - SHIPPED 2026-03-17</summary>

- [x] **Phase 5: Report Engine + Charts** - Rich report generation with inline charts, KPI stats, executive summaries, and comparison deltas (completed 2026-03-15)
- [x] **Phase 6: Export + Distribution** - PDF export and email delivery with full visual content inline (completed 2026-03-16)
- [x] **Phase 7: Scheduling + Ad Hoc Reports** - Automated cadence reports and conversational AI report scoping (completed 2026-03-16)
- [x] **Phase 8: Benchmarking** - Period-over-period comparisons and custom milestone benchmarking (completed 2026-03-17)

</details>

### v1.2 Email Campaigns + Polish (In Progress)

**Milestone Goal:** Stand up the hub's second live module — a full email campaigns system with list management, template builder, batched sending, open/click tracking, and analytics. Simultaneously polish Social Command with listening algorithm upgrades, responsive design, and UX fixes.

**Two tracks:**
- **Track A (Phases 9-12):** Email Campaigns — data layer, templates, send pipeline, analytics
- **Track B (Phases 13-14):** Social Polish — listening algo, mobile/responsive, UX bugs

**Execution order:**
- Phase 9 + 13 in parallel (independent)
- Phase 10 → 11 → 12 sequential (Track A chain)
- Phase 14 last (benefits from email pages existing)

- [x] **Phase 9: Email Data Layer + List Management** - Prisma models, subscriber/list CRUD, CSV import, email section layout
- [ ] **Phase 10: Template Builder + Campaign CRUD** - Starter templates, HTML editor, campaign builder, AI content suggestions
- [ ] **Phase 11: Send Pipeline + Event Tracking** - Batched cron sending, open/click tracking, bounces, unsubscribe
- [ ] **Phase 12: Campaign Analytics + Hub Integration** - Performance dashboard, campaign detail analytics, hub card activation
- [x] **Phase 13: Social Listening Algorithm Improvements** - AI semantic relevance, topic-adaptive weights, financial sentiment, engagement velocity
- [ ] **Phase 14: Mobile/Responsive + UX Polish** - Responsive design pass, routing bug fix, loading/error/empty states

### Phase 9: Email Data Layer + List Management
**Goal**: Team can create email lists, import subscribers via CSV, and manage subscriber status — the data foundation for all email features
**Depends on**: Nothing
**Requirements**: EMAL-01, EMAL-02, EMAL-03, EMAL-04, EHUB-02
**Success Criteria** (what must be TRUE):
  1. Team can create, edit, and delete named email lists
  2. Team can import subscribers from a CSV file with duplicate detection and validation
  3. Team can view, search, and filter subscribers within a list with status indicators
  4. Email section has its own layout with sidebar navigation and back-to-hub link
**Plans**: 2 plans

Plans:
- [x] 09-01-PLAN.md — Prisma email models (all 6) + tRPC routers for list CRUD and subscriber management
- [x] 09-02-PLAN.md — Email section layout, list management page, subscriber detail page with CSV import

### Phase 10: Template Builder + Campaign CRUD
**Goal**: Team can create email templates, build campaigns with content editing and preview, and schedule sends
**Depends on**: Phase 9
**Requirements**: ETPL-01, ETPL-02, ETPL-03, ECMP-01, ECMP-02, ECMP-03
**Success Criteria** (what must be TRUE):
  1. System provides 4 starter email templates that render correctly across email clients
  2. Team can create custom templates with HTML editor and live preview
  3. AI suggests subject line variants and body copy when prompted
  4. Team can build a campaign (select list, choose template, edit content, set subject/from) and schedule it
  5. Team can preview the rendered email before sending
**Plans**: 2 plans

Plans:
- [x] 10-01-PLAN.md — tRPC routers for template CRUD and campaign CRUD, 4 starter template seeds, AI content suggestions, campaign scheduling
- [ ] 10-02-PLAN.md — Template gallery, split-pane HTML editor with preview, campaign list, multi-step campaign builder with AI and scheduling

### Phase 11: Send Pipeline + Event Tracking
**Goal**: Campaigns send reliably in batches via cron, with full open/click/bounce/unsubscribe tracking
**Depends on**: Phase 10
**Requirements**: ECMP-04, ETRK-01, ETRK-02, ETRK-03, ETRK-04
**Success Criteria** (what must be TRUE):
  1. Scheduled campaigns send in batches via cron without blocking Vercel serverless (50 emails/min)
  2. Email opens are tracked via tracking pixel and logged as events
  3. Link clicks are tracked via redirect and logged with the specific URL clicked
  4. Bounced emails are detected and subscribers marked as bounced
  5. Every email includes a working one-click unsubscribe link
**Plans**: TBD

Plans:
- [ ] 11-01: TBD
- [ ] 11-02: TBD

### Phase 12: Campaign Analytics + Hub Integration
**Goal**: Team can see campaign performance metrics and the Email Campaigns module is live on the hub
**Depends on**: Phase 11
**Requirements**: EANL-01, EANL-02, EANL-03, EHUB-01
**Success Criteria** (what must be TRUE):
  1. Campaign detail page shows open rate, click rate, bounce rate, unsubscribe rate
  2. Email dashboard shows aggregate stats across all campaigns
  3. Campaign detail shows link click breakdown and open/click timeline chart
  4. Hub landing page shows Email Campaigns as an active module (not "Coming Soon")
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD

### Phase 13: Social Listening Algorithm Improvements
**Goal**: Listening scanner produces higher-quality, more relevant hits through hybrid AI+heuristic scoring, topic-adaptive weights, and financial context awareness
**Depends on**: Nothing
**Requirements**: SLST-01, SLST-02, SLST-03, SLST-04, SLST-05
**Success Criteria** (what must be TRUE):
  1. High-scoring hits are validated through Claude Haiku for semantic relevance
  2. Scoring weights adapt based on topic type (KOL, competitor, brand monitoring)
  3. Financial/crypto terms are scored with domain-specific context
  4. Engagement velocity (per-hour rate) influences scoring alongside absolute counts
  5. Same post doesn't appear in multiple queries for the same topic
**Plans:** 2 plans

Plans:
- [x] 13-01-PLAN.md — Pure scoring helpers: topic-adaptive weights, financial sentiment, engagement velocity, cross-query dedup key generation
- [x] 13-02-PLAN.md — AI batch validation + wire all 5 improvements into scan loop

### Phase 14: Mobile/Responsive + UX Polish
**Goal**: All pages render correctly on mobile/tablet/desktop, routing bugs are fixed, and UX is polished with proper loading/error/empty states
**Depends on**: Phase 12 (email pages should exist for responsive pass)
**Requirements**: MPOL-01, MPOL-02, MPOL-03
**Success Criteria** (what must be TRUE):
  1. Dashboard, composer, reports, email pages all render correctly at 375px, 768px, and 1024px+
  2. No unexpected redirects when navigating between pages via client-side routing
  3. All data-fetching pages have skeleton loaders, error boundaries, and helpful empty states
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD

## Progress

**Execution Order:**
Phases 9+13 parallel → 10 → 11 → 12+14 parallel

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Performance Intel | v1.0 | 2/2 | Complete | 2026-03-14 |
| 2. Competitor Intel | v1.0 | 2/2 | Complete | 2026-03-14 |
| 3. Audience Questions | v1.0 | 2/2 | Complete | 2026-03-15 |
| 4. Content Co-Pilot | v1.0 | 3/3 | Complete | 2026-03-16 |
| 5. Report Engine + Charts | v1.1 | 3/3 | Complete | 2026-03-15 |
| 6. Export + Distribution | v1.1 | 3/3 | Complete | 2026-03-16 |
| 7. Scheduling + Ad Hoc Reports | v1.1 | 3/3 | Complete | 2026-03-16 |
| 8. Benchmarking | v1.1 | 3/3 | Complete | 2026-03-17 |
| 9. Email Data Layer + Lists | v1.2 | 2/2 | Complete | 2026-03-16 |
| 10. Template Builder + Campaigns | v1.2 | 1/2 | In progress | - |
| 11. Send Pipeline + Tracking | v1.2 | 0/? | Not started | - |
| 12. Analytics + Hub Integration | v1.2 | 0/? | Not started | - |
| 13. Listening Algorithm | v1.2 | 2/2 | Complete | 2026-03-17 |
| 14. Mobile/Responsive + UX | v1.2 | 0/? | Not started | - |
