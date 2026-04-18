# Roadmap: Social Command Center

## Milestones

- ✅ **v1.0 Content Intelligence System** - Phases 1-4 (shipped 2026-03-15)
- ✅ **v1.1 Report Center** - Phases 5-8 (shipped 2026-03-17)
- 🚧 **v1.2 Email Campaigns + Polish** - Phases 9-14 (in progress)
- 📋 **v2.0 Intelligence Layer** - Phases 15-16 (planned)
- 📋 **v3.0 MCP + Unified Artifact Graph** - Phases 17-21 (planned; see `docs/specs/MCP-Artifact-Graph-PRD.md`)

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

### v2.0 Intelligence Layer (Planned)

**Milestone Goal:** Transform the hub from a data display into an intelligence system. Signals from all sources (listening, email, calendar, campaigns) are scored, classified, and surfaced as prioritized tasks. Users open the hub and see what matters — not what's new.

**Two tracks (can run in parallel):**
- **Track A (Phase 15):** Signal Intelligence — semantic relevance, author trust, actionability classification, role routing, platform expansion
- **Track B (Phase 16):** Weekly Intelligence → Task Engine — Monday briefing, auto-task generation, email intelligence, meeting prep, priority scoring, feedback loop

**Execution order (PM-recommended):**
- **Week 1:** Phase 15-01 + Phase 16-01 in parallel (signal quality + briefing/task model)
- **Week 2:** Phase 16-02 + Phase 15-02 in parallel (email intel + cross-source linking + role routing)
- **Week 3:** Phase 16-03 + Phase 16-04 in parallel (meeting intel + feedback loop)
- **Week 4+:** Phase 15-03 (platform expansion — LinkedIn + news)
- **v1.2 paused:** Phases 10-12 (email campaigns) resume after v2.0 core ships

**Rationale:** Intelligence layer transforms value of existing signals before expanding sources. Phase 16-01 can start with current signal data and improve when Phase 15-01 adds actionability tags.

- [ ] **Phase 15: Signal Intelligence** — Semantic content relevance, author trust scoring, actionability classification, cross-source linking, role-based routing, LinkedIn + news expansion
- [ ] **Phase 16: Weekly Intelligence → Task Engine** — Monday briefing, auto-task generation, email intelligence, meeting prep/follow-up, priority scoring, feedback loop

### Phase 15: Signal Intelligence
**Goal**: Every signal is scored for semantic relevance (not just keywords), classified by actionability (RESPOND/INTEL/OPPORTUNITY/CRISIS/FYI), and routed to the right user based on role
**Depends on**: Phase 13 (listening algorithm — complete)
**Requirements**: SGNL-01 through SGNL-06
**Success Criteria** (what must be TRUE):
  1. Semantically relevant hits surface even without keyword overlap
  2. Spam/bot accounts with bought followers score LOW
  3. Every MEDIUM+ hit has an actionability classification (RESPOND/INTEL/OPPORTUNITY/CRISIS/FYI)
  4. Related signals from different sources are linked into clusters
  5. Different roles see different priority orderings for the same signals
**Plans**: 3 plans

Plans:
- [ ] 15-01-PLAN.md — Semantic relevance (expand AI validation to all hits) + author trust scoring + actionability classification
- [ ] 15-02-PLAN.md — Cross-source signal linking + role-based routing
- [ ] 15-03-PLAN.md — Platform expansion (LinkedIn + news aggregators)

### Phase 16: Weekly Intelligence → Task Engine
**Goal**: Users open the hub on Monday morning and see a prioritized briefing that converts into tasks. Signals, emails, meetings, and campaigns all feed into one intelligent task inbox.
**Depends on**: Phase 15 Plan 1 (actionability classification)
**Requirements**: WTSK-01 through WTSK-06
**Success Criteria** (what must be TRUE):
  1. Monday morning briefing shows top 3-5 priorities with linked context
  2. High-priority signals auto-generate tasks without manual creation
  3. Emails needing reply surface as tasks; CC/FYI emails don't
  4. Meetings have prep context (30min before) and follow-up prompts (after)
  5. Task priority reflects time-sensitivity, impact, effort, and role relevance
  6. After 2 weeks of use, priority ordering improves based on user behavior
**Plans**: 4 plans

Plans:
- [ ] 16-01-PLAN.md — Monday briefing + task auto-generation from signals
- [ ] 16-02-PLAN.md — Email intelligence + priority scoring engine
- [ ] 16-03-PLAN.md — Meeting intelligence (prep + follow-up)
- [ ] 16-04-PLAN.md — Feedback loop / learning from user behavior

### v3.0 MCP + Unified Artifact Graph (Planned)

**Milestone Goal:** Collapse the transfer friction between Claude and figure.marketing. Ship a unified artifact graph (cross-module hierarchy + typed relationships) inside the hub and an internal, SSO-gated MCP server that lets Claude create, read, update, and link artifacts across Social, GTM, Email, and LC Review. Team-only, audit-logged, not a public MCP.

**Full spec:** `docs/specs/MCP-Artifact-Graph-PRD.md`

**Two tracks (Phase 17 must precede everything else):**
- **Track A (Phase 17):** Artifact Graph Foundation — schema, migration, `/api/artifacts/*`, RLS
- **Track B (Phases 18-21):** MCP rollout by module — Social → GTM + LC Review → Email + Graph UI → Hardening

**Execution order:**
- **Weeks 1-3:** Phase 17 (invisible groundwork — schema + migration + artifact API)
- **Weeks 4-6:** Phase 18 (Social Command MCP + pilot with 3 users + metrics-gap fixes bundled)
- **Weeks 7-9:** Phase 19 (GTM + LC Review MCP + meta-project / expand flows)
- **Weeks 10-11:** Phase 20 (Email MCP + web UI relationship panes)
- **Week 12:** Phase 21 (audit dashboards + token admin + team rollout)

**Rationale:** Every current and future module benefits from unified artifacts. The MCP is the team productivity wrapper on top; composite workflows (plan event in Claude → push project + tasks + owners in one click) are the north-star value.

- [ ] **Phase 17: Artifact Graph Foundation** — `artifacts` + `artifact_relationships` tables, module table FK backfill, `/api/artifacts/*` endpoints, RLS policies
- [ ] **Phase 18: Social Command MCP + Pilot** — MCP server scaffold, SSO/token flow, Social tools (read + write + composite), v1 prompt library, metrics-gap bug fixes, 3-user pilot
- [ ] **Phase 19: GTM + LC Review MCP** — GTM tools including `update_project`, `expand_project`, `publish_event_plan`, `build_meta_project`; LC Review file-from-draft; preview-before-write UX
- [ ] **Phase 20: Email MCP + Graph UI** — Email tool set; web UI Related / Children / Lineage panes on artifact detail views; cross-module prompts
- [ ] **Phase 21: Hardening + Team Rollout** — Audit log dashboards, token revocation UI, setup docs, team-wide rollout + training

### Phase 17: Artifact Graph Foundation
**Goal**: Every existing and new tracked object (project, task, post, email, LC ticket, asset) has an artifact row and queryable relationships; no user-visible change yet.
**Depends on**: Nothing (pure groundwork)
**Requirements**: ARTF-01 through ARTF-06
**Success Criteria** (what must be TRUE):
  1. `artifacts` and `artifact_relationships` tables live in Prisma schema
  2. Every existing Post, GtmProject, GtmTask, EmailCampaign, LcReviewTicket has a backfilled artifact row
  3. Module row creation + artifact row creation happen in the same transaction (no orphans possible)
  4. `/api/artifacts/*` endpoints serve get_tree, get_related, trace_lineage, link, unlink, update, reparent
  5. Authorization rules enforce module-level permissions on graph queries (application-layer today; portable to Postgres RLS via the declarative policy file in 17-02)
  6. Metrics-gap bugs (PRD §12) fixed before Phase 18 exposes `social.get_post_metrics` over MCP
**Plans**: 3 plans

Plans:
- [ ] 17-01-PLAN.md — Schema (`Artifact` + `ArtifactRelationship` + FKs on 7 module tables) + transactional `createWithArtifact` helper + idempotent backfill (`--dry-run`) + `@figure.com` domain lock on NextAuth
- [ ] 17-02-PLAN.md — `/api/artifacts/*` endpoints + `hub.*` tRPC router + declarative policy file (tRPC middleware today, Supabase RLS-portable)
- [ ] 17-03-PLAN.md — Metrics-gap fixes (PostMetrics.quotes, weighted-avg in report-engine, extended poll-metrics window) — moved up from Phase 18 per PRD §12

### Phase 18: Social Command MCP + Pilot
**Goal**: Three pilot users can draft, schedule, search, and report on social content via Claude, with metrics-gap bugs fixed before numbers are exposed.
**Depends on**: Phase 17
**Requirements**: MCPS-01 through MCPS-08
**Success Criteria** (what must be TRUE):
  1. MCP server deployed at `mcp.figure.marketing` with SSO-gated token issuance
  2. Social Command tool set live (draft_post, schedule_post, submit_for_review, publish_content_calendar, get_calendar, get_post_metrics, get_competitor_activity, search_listening, get_kols, get_report)
  3. v1 prompt library shipped (voice_check, draft_launch_thread, weekly_social_report, competitor_brief)
  4. Metrics-gap bugs fixed in Phase 17-03 (weighted avg, extended poll-metrics window, `quotes` on PostMetrics) — verified before `social.get_post_metrics` is enabled
  5. 3-user pilot runs for 2 weeks with feedback captured
  6. Every tool call audit-logged with user + args + affected artifacts
**Plans**: TBD

Plans:
- [ ] 18-01-PLAN.md — MCP server scaffold + SSO/token flow + admin token UI
- [ ] 18-02-PLAN.md — Social Command read tools + metrics-gap fixes
- [ ] 18-03-PLAN.md — Social Command write + composite tools + prompt library v1

### Phase 19: GTM + LC Review MCP
**Goal**: Team can plan events, kick off GTM projects, file LC review tickets, and build meta-projects spanning existing work — all from Claude, with preview-before-write on composite mutations.
**Depends on**: Phase 18 (MCP server + auth patterns established)
**Requirements**: MCPG-01 through MCPG-07
**Success Criteria** (what must be TRUE):
  1. GTM tool set live including update_project, create_sub_project, expand_project, publish_event_plan, generate_tasks_from_brief, build_meta_project, push_asset
  2. LC Review tool set live (file_ticket, file_from_draft, get_ticket_status, list_my_tickets)
  3. Preview UX: composite tools return a structured preview; user confirms before execution
  4. Prompts shipped: gtm_project_kickoff, expand_project, build_meta_project, compliance_file, post_from_news
  5. Publish and approval actions remain UI-only (enforced at MCP layer)
**Plans**: TBD

Plans:
- [ ] 19-01-PLAN.md — GTM tools + preview-before-write framework
- [ ] 19-02-PLAN.md — LC Review tools + hub.* graph tools (link, reparent, create_meta_project)
- [ ] 19-03-PLAN.md — Prompt library expansion + UI-only enforcement layer

### Phase 20: Email MCP + Graph UI
**Goal**: Email workflows reach parity with Social and GTM on the MCP; web UI gains relationship panes so the graph is visible, not just queryable.
**Depends on**: Phase 19
**Requirements**: MCPE-01 through MCPE-04
**Success Criteria** (what must be TRUE):
  1. Email tool set live (draft_campaign, build_campaign_from_draft, list_campaigns, get_campaign_metrics, search_templates, get_lists)
  2. Artifact detail views (project, task, post, email, LC ticket) show a Related / Children / Lineage pane
  3. Cross-module prompt `/figure.leadership_update` works end-to-end
  4. Search in web UI is graph-aware (filter by artifact type + relationship depth)
**Plans**: TBD

Plans:
- [ ] 20-01-PLAN.md — Email tools + composite build_campaign_from_draft
- [ ] 20-02-PLAN.md — Web UI relationship panes + graph-aware search

### Phase 21: Hardening + Team Rollout
**Goal**: The MCP is safe to expose to the full team — audit visibility, token hygiene, and enablement materials are in place.
**Depends on**: Phase 20
**Requirements**: MCPH-01 through MCPH-04
**Success Criteria** (what must be TRUE):
  1. Admin audit log dashboard live (filter by user, tool, artifact, time range)
  2. Admin token management UI live (list active tokens, one-click revoke)
  3. Setup doc published in Hub ("Connecting Claude to figure.marketing — 2 minutes")
  4. Team-wide rollout announcement + live training session run
  5. Success metrics baseline captured (transfer friction time, tool call volume, preview acceptance rate)
**Plans**: TBD

Plans:
- [ ] 21-01-PLAN.md — Audit log dashboard + token management UI
- [ ] 21-02-PLAN.md — Setup docs + rollout + metrics baseline

## Progress

**Execution Order:**
v1.2: Phases 9+13 parallel → 10 → 11 → 12+14 parallel
v2.0: Wk1 (15-01 + 16-01) → Wk2 (16-02 + 15-02) → Wk3 (16-03 + 16-04) → Wk4+ (15-03)

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
| 10. Template Builder + Campaigns | v1.2 | 1/2 | **Paused** (v2.0 priority) | - |
| 11. Send Pipeline + Tracking | v1.2 | 0/? | **Paused** | - |
| 12. Analytics + Hub Integration | v1.2 | 0/? | **Paused** | - |
| 13. Listening Algorithm | v1.2 | 2/2 | Complete | 2026-03-17 |
| 14. Mobile/Responsive + UX | v1.2 | 0/? | **Paused** | - |
| 15. Signal Intelligence | v2.0 | 0/3 | **Starting** — Week 1 | - |
| 16. Weekly Intelligence → Tasks | v2.0 | 0/4 | **Starting** — Week 1 | - |
| 17. Artifact Graph Foundation | v3.0 | 0/3 | Planned | - |
| 18. Social Command MCP + Pilot | v3.0 | 0/3 | Planned | - |
| 19. GTM + LC Review MCP | v3.0 | 0/3 | Planned | - |
| 20. Email MCP + Graph UI | v3.0 | 0/2 | Planned | - |
| 21. Hardening + Team Rollout | v3.0 | 0/2 | Planned | - |
