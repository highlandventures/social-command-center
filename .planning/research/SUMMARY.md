# Project Research Summary

**Project:** Social Command — Report Center v1.1
**Domain:** Social media report center — scheduled generation, PDF export, server-side charts, email/Slack distribution, conversational AI scoping
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

The Report Center milestone transforms an existing manual report builder into a fully automated reporting system with multi-channel delivery. The project is an additive layer on a well-established Next.js 14 / tRPC / Prisma / Vercel stack — no framework changes are needed, only new libraries and components. The recommended approach is to use `@react-pdf/renderer` for PDF generation (avoids Chromium's 50 MB bundle limit on Vercel serverless), QuickChart.io for all server-side chart rendering (Recharts requires a browser DOM and cannot run in API routes), and `@react-email/components` + `nodemailer` for email delivery. Slack delivery uses `@slack/webhook` with Incoming Webhooks and Block Kit — no full Slack App required. This four-library combination covers every new capability with no native dependencies, no microservices, and no infrastructure changes beyond `next.config.js`.

The key architectural insight is that QuickChart.io is the linchpin for every visual output channel. Chart images must be rendered server-side as PNG URLs before a report is persisted — the same stored URL then drives the in-app viewer, the PDF embed, the email CID attachment, and the Slack image block. This "chart-as-URL" pattern is the most important design decision in the milestone. The conversational ad hoc report scoping feature (Claude Sonnet multi-turn chat) is a genuine differentiator — no competitor offers a guided AI conversation for report scoping — but it must be built after the core report engine is proven, and conversation history must be persisted in the database (not React state) to survive page refreshes.

The top risks are Vercel serverless constraints that bite at scale: cron timeouts when generating multiple-brand reports, Vercel cron double-delivery creating duplicate reports, and benchmarking queries loading tens of thousands of raw `PostMetrics` rows into memory. All three are well-understood patterns with clear mitigations that must be designed in from day one. The email delivery surface also has two hard limits — Gmail clips HTML at 102 KB and Outlook's dual rendering engine requires table-based layouts — that must be architected for from the start, not retrofitted.

---

## Key Findings

### Recommended Stack

The milestone adds four net-new libraries to the existing stack. All critical stack decisions are HIGH confidence with verified version requirements. The `serverExternalPackages: ['@react-pdf/renderer']` config change to `next.config.js` is mandatory — without it, the react-pdf yoga-layout dependency inflates the Vercel function bundle past the 50 MB compressed limit and deployment fails silently. QuickChart.io requires no npm install; charts are generated via `fetch()` POST calls returning PNG buffers. All other infrastructure (`@vercel/blob`, `@vercel/kv`, `nodemailer`, Vercel Cron) is already installed and wired.

**Core technologies:**
- `@react-pdf/renderer@^4.3.2`: PDF generation — the only viable serverless PDF library; no Chromium, pure Node.js, ~5 MB bundle; requires `serverExternalPackages` config
- `QuickChart.io` (external API, no npm): Server-side chart images — browser-independent Chart.js renderer; free tier is 100K images/month (well above projected usage of ~50-200 charts/month)
- `@react-email/components@^1.0.8` + `@react-email/render@^2.0.4`: Email HTML templates — compiles to table-based inline-styled HTML; tested against Gmail, Outlook, Apple Mail
- `@slack/webhook@^7.0.7`: Slack delivery — official SDK for Incoming Webhooks; Block Kit `blocks` array support; no OAuth or bot token required

**Do not use:** Puppeteer (170 MB Chromium binary breaks Vercel deployment), `node-canvas` (native C++ bindings unavailable on serverless), Recharts server-side (requires browser DOM), `html-pdf`/`pdf-creator-node` (PhantomJS/wkhtmltopdf not available on Vercel).

### Expected Features

The primary gap to fill is automation, visual richness, and multi-channel distribution. Reports currently require manual triggering and produce text-only output with no scheduling or delivery. The competitor landscape (Sprout Social, Hootsuite, Brandwatch) sets clear table stakes for scheduled reports and PDF export, but this project has two genuine differentiators: conversational AI report scoping (no competitor offers this) and custom milestone benchmarking against user-defined event dates (not available in any SaaS tool surveyed).

**Must have (table stakes for v1):**
- Scheduled cadence report generation (weekly + monthly) — every serious tool auto-generates on schedule
- Comparison period deltas (WoW, MoM) — reports without deltas are meaningless snapshots
- Topline KPI section in every report — impressions, engagement rate, follower growth, top post
- AI executive summary (2-4 sentences) — already using Claude; primarily a prompt engineering task
- Inline charts via QuickChart.io — trend line + content type bar chart minimum per report
- PDF export — industry standard; every major competitor offers this
- Email delivery (scheduled + on-demand) — scheduled sends to configured recipient list; manual share from report detail page
- Slack delivery (scheduled + on-demand) — Block Kit highlight digest to configured channel; manual push from report detail page

**Should have (differentiators — v1.x after core pipeline is running):**
- Conversational ad hoc report scoping — Claude Sonnet multi-turn conversation to scope custom reports; genuine competitive advantage with no analog in any competitor
- Custom milestone benchmarking — `Milestone` model for user-defined event anchors (product launch, campaign start); not available in any competitor
- Quarterly and yearly scheduled cadences — additive to weekly/monthly after those are stable
- Side-by-side benchmark comparison UI — two-column before/after layout with color-coded deltas

**Defer (v2+):**
- Real-time dashboard — infrastructure mismatch with Vercel serverless; not suited for WebSocket-style live updates
- PPTX export — explicitly deferred in PROJECT.md; PDF covers stakeholder presentation use cases
- Custom report builder UI (drag-and-drop widgets) — conversational scoping is a better first approach
- White-label client-facing portal — agency SaaS feature; out of scope for internal tool

### Architecture Approach

The architecture is a clean pipeline of independent modules called by two entry points: Vercel Cron (automated) and tRPC mutations (user-triggered). A central `lib/report-engine.js` orchestrator owns data aggregation, Claude AI generation, and chart spec building. It is consumed by both the `generate-scheduled-reports` cron and the `reports.generate` tRPC mutation — following the "shared logic module" pattern already established in the codebase with `lib/listening-scanner.js`. Charts are rendered once at generation time and stored as URLs in `Report.chartUrls[]`; all display surfaces (in-app, PDF, email, Slack) reference these stored URLs rather than re-rendering. See `.planning/research/ARCHITECTURE.md` for detailed data flow diagrams and the recommended build order.

**Major components:**
1. `lib/report-engine.js` — Core orchestrator: data aggregation, benchmark deltas, Claude Haiku generation, chart spec building; called by both cron and tRPC
2. `lib/chart-renderer.js` — All QuickChart.io communication; renders chart specs as PNG buffers/Blob URLs in parallel via `Promise.all()`
3. `lib/pdf-exporter.js` — `@react-pdf/renderer` document assembly from structured report content + pre-rendered base64 chart images; outputs PDF buffer to Vercel Blob
4. `lib/distributor.js` — Email (nodemailer with CID-inline chart PNGs) and Slack (Block Kit with hosted chart URLs); writes `ReportDelivery` audit log rows
5. `lib/report-chat.js` — Stateless multi-turn Claude Sonnet conversation; chat history persisted in `ReportConversation` DB model; returns structured `ReportSpec` when complete
6. `lib/report-scheduler.js` — Queries due `ReportSchedule` records per cron invocation; single weekly cron covers all cadences via `nextRunAt` field checking

**New schema additions:**
- `ReportSchedule` — cadence config (WEEKLY/MONTHLY/QUARTERLY/YEARLY), auto-distribution settings, email recipients, Slack webhook
- `ReportDelivery` — per-send audit log (channel, status, sentAt, error message)
- Extended `Report` — adds `chartUrls`, `pdfUrl`, `coveragePeriod`, `benchmarkPeriod`, `scheduleId`
- `ReportConversation` — chat history persistence for ad hoc scoping conversations (v1.x)
- `Milestone` — user-defined event anchors for custom benchmarking (v1.x)

### Critical Pitfalls

The pitfalls research (HIGH confidence, verified against official docs and direct codebase review) identifies 11 pitfalls. The top 5 by implementation risk:

1. **Cron timeout with multi-brand scheduled generation** — Set `export const maxDuration = 800` in every scheduled-report cron route from day one; split generation and delivery into separate phases using `GENERATING` → `READY` status; never generate all brands in a single sequential chain.

2. **Duplicate reports from Vercel cron double-delivery** — Vercel explicitly documents that cron events may be delivered more than once. Implement both a KV lock (`report-gen:{cadence}:lock` with 10-minute TTL, using existing `lib/redis.js`) AND a DB deduplication check (`findFirst` by `reportType + dataRangeStart`) before creating any report record. Both mechanisms are required.

3. **QuickChart GET URL failures for complex charts in email** — Never embed raw QuickChart GET URLs in email HTML. Complex multi-series charts exceed 2,000-character URL limits and break silently in email clients. Use POST endpoint server-side to receive PNG buffers, upload to Vercel Blob, and use blob URLs in CID-attached email images.

4. **Benchmarking queries loading full PostMetrics table into memory** — At 15-minute polling across 3 brands, `PostMetrics` accumulates ~10,000+ rows per month. A quarterly benchmark query without `take` limits causes Vercel function OOM. Add `take: 5000` safety cap to all existing benchmarks queries immediately; implement a nightly `aggregate-benchmarks` cron before adding cross-period delta comparisons.

5. **AI context token bloat from raw Prisma rows** — Monthly/quarterly reports silently multiply Claude input tokens. Always pre-aggregate before building the Claude context (top 5 posts, aggregated sentiment, last 50 listening hits by heuristic score). Add a `JSON.stringify(context).length > 50_000` guard that triggers automatic payload reduction.

---

## Implications for Roadmap

The research resolves all major technical decisions and reveals a clear dependency chain. The recommended phase structure follows the build order identified in ARCHITECTURE.md, with pitfall prevention baked into the phase structure.

### Phase 1: Foundation — Schema + Chart Infrastructure

**Rationale:** QuickChart.io is the linchpin for every downstream visual feature. PDF, email, and Slack all depend on server-renderable chart URLs. Schema migrations unblock all other work. These must be built and validated first before any higher-level feature can be verified end-to-end.

**Delivers:** Prisma schema additions (`ReportSchedule`, `ReportDelivery`, `Report` extensions), `lib/chart-renderer.js` with QuickChart.io POST integration and Vercel Blob upload, and comparison period delta calculation utilities. A standalone test confirming chart PNG generation from QuickChart in a Vercel Preview deployment.

**Addresses:** "Inline charts in reports" (table stakes), "Comparison period deltas" (required for reports to be meaningful)

**Avoids:** QuickChart GET URL pitfall — establish POST-first pattern as the standard from day one. Benchmarking query OOM — add `take: 5000` safety caps to existing `getBenchmarks` queries as part of the migration step.

**Research flag:** Skip — chart rendering is well-documented, QuickChart POST API is straightforward, no additional research needed.

---

### Phase 2: Report Generation Engine

**Rationale:** With chart infrastructure ready and schema in place, the core report engine can be built and tested via the existing `reports.generate` tRPC mutation before adding scheduling complexity. This validates the full content pipeline (data aggregation → benchmark deltas → Claude Haiku → chart specs → `Report` record) without cron infrastructure.

**Delivers:** `lib/report-engine.js` orchestrator, enriched report content schema (KPI blocks, benchmark deltas, executive summary), updated `reports.generate` tRPC mutation producing reports with inline chart URLs, and a `ReportViewer` frontend component showing rich reports with embedded charts.

**Uses:** `lib/chart-renderer.js` (Phase 1), existing `generateInsight()` Claude Haiku wrapper, existing `PostMetrics`/`AccountMetrics`/`CompetitorMetrics` queries

**Avoids:** AI context token bloat — establish pre-aggregation contract (summarized context objects, not raw rows) as the standard pattern before writing any new report generation functions.

**Research flag:** Skip — established patterns; Claude integration and Prisma queries are already working in the codebase.

---

### Phase 3: PDF Export

**Rationale:** PDF export is table stakes (every competitor offers it) and is fully self-contained once the report engine produces rich content with chart URLs. Build before distribution to validate the full report artifact before routing it through email and Slack channels.

**Delivers:** `lib/pdf-exporter.js` using `@react-pdf/renderer`, `app/api/reports/export-pdf/route.js` with `maxDuration = 60`, PDF upload to Vercel Blob, download URL returned to client, and "Export PDF" button wired into the report detail UI.

**Uses:** `@react-pdf/renderer@^4.3.2` (new install), `@vercel/blob` (already installed), chart base64 URIs from chart-renderer

**Avoids:** Puppeteer bundle size failure — react-pdf is the correct choice; add `serverExternalPackages: ['@react-pdf/renderer']` to `next.config.js` before installing the package. Validate font loading in a Vercel Preview deployment before building the full PDF template.

**Research flag:** Skip — `@react-pdf/renderer` is well-documented with confirmed Next.js 14 compatibility. The `serverExternalPackages` config requirement is clearly documented in official react-pdf and Next.js docs.

---

### Phase 4: Email Distribution

**Rationale:** Email delivery (both scheduled and on-demand) is the primary distribution channel. Must be built before Slack to validate the distributor architecture. Email has the most rendering constraints (Outlook compatibility, Gmail 102 KB limit) that must be solved before anything else is wired to the distribution engine.

**Delivers:** `lib/distributor.js` (email path), `ReportEmailTemplate` using `@react-email/components`, CID-inline chart attachment pattern via nodemailer, `reports.distribute` tRPC mutation (email channel), on-demand "Share via Email" UI on report detail page, and `ReportDelivery` audit log writes.

**Uses:** `@react-email/components@^1.0.8`, `@react-email/render@^2.0.4` (new installs), `nodemailer@^7.0.13` (already installed)

**Avoids:** Outlook rendering breakage — React Email produces table-based inline-styled HTML; test against both Outlook Word engine and new Chromium Outlook before shipping. Gmail 102 KB clip — design email as "KPI summary + View Full Report CTA" from day one; add `Buffer.byteLength(html) < 81920` assertion. QuickChart GET URL in email — use CID-attached PNG buffers, not direct chart URLs.

**Research flag:** Consider a focused sub-research phase on email template design and Litmus/cross-client compatibility testing strategy, particularly for the Outlook dual rendering engine (Word + Chromium coexistence through 2027-2028). The technical approach is clear; the template layout decisions warrant validation.

---

### Phase 5: Slack Distribution

**Rationale:** Slack delivery follows the same distributor pattern as email. Build after email is validated so the `lib/distributor.js` architecture is proven. Slack has different constraints (publicly accessible URLs required for `image` blocks; 1 MB payload limit; 3,000 char text truncation) that require separate design decisions.

**Delivers:** Slack delivery path in `lib/distributor.js`, Block Kit payload builder (highlight digest format: header + 3 KPIs + 1 hero chart + 2-sentence summary + "View Full Report" button), `@slack/webhook` integration, on-demand "Share to Slack" UI, and `ReportDelivery` log entries for Slack sends.

**Uses:** `@slack/webhook@^7.0.7` (new install), publicly readable Vercel Blob chart URLs (stored with `access: 'public'` in Phase 1)

**Avoids:** Slack 1 MB payload rejection — design as highlight digest, not full report; validate `JSON.stringify(blocks).length < 900_000`. Text truncation — cap executive summary at 2,900 chars before including in Block Kit section block.

**Research flag:** Skip — Block Kit is thoroughly documented; the digest-not-full-report design decision is clear from pitfalls research.

---

### Phase 6: Scheduled Report Generation

**Rationale:** Scheduling is built last among the core v1 features because it is autonomous — bugs in early iterations affect all brands simultaneously and are harder to debug than manually triggered failures. The report engine, distribution, PDF, and delivery logging must all be working correctly before the scheduler fans out to multiple brands automatically.

**Delivers:** `lib/report-scheduler.js`, `app/api/cron/generate-scheduled-reports/route.js` with `maxDuration = 800`, `ReportSchedule` CRUD tRPC procedures, `ReportScheduleManager` UI component, and a single new `vercel.json` cron entry (Monday 7 AM UTC, covering all cadences via `nextRunAt` field checking).

**Avoids:** Cron timeout — phased generation architecture + `maxDuration = 800` from day one. Duplicate reports from double-delivery — KV lock + DB deduplication check; both required before first cron ships. Per-cadence cron proliferation — one cron route checks all due schedules.

**Research flag:** Skip — the scheduling pattern is clear; the single-cron-checks-all-schedules approach follows existing codebase patterns (`vercel.json` already has 10 cron entries using this convention).

---

### Phase 7: Conversational Ad Hoc Report Scoping (v1.x)

**Rationale:** Builds on a proven report engine. This is the highest-complexity feature and the biggest differentiator — no competitor offers a conversational scoping flow. Deferring to v1.x (after the core pipeline is in production use) ensures report generation output quality is validated before adding a conversational frontend to it. Iteration on prompt engineering is also more effective with real usage data.

**Delivers:** `lib/report-chat.js`, `reports.chat` tRPC procedure (stateless; full conversation history sent each turn), `ReportConversation` DB model for durable history persistence, `ReportChatInterface` UI component in the Builder tab, Claude Sonnet multi-turn conversation producing a confirmed `ReportSpec` that feeds into `reports.generate`.

**Avoids:** Conversation state loss on refresh — DB persistence is mandatory; React state is not durable across page loads. Context window overflow — truncate to last 20 turns before building the Claude `messages` array.

**Research flag:** The conversation mechanics pattern is clear. A focused sub-research phase on prompt engineering for extracting structured `ReportSpec` parameters from open-ended user input is recommended before implementation.

---

### Phase 8: Custom Milestone Benchmarking (v1.x)

**Rationale:** The `Milestone` model is a new schema entity that unlocks event-anchored benchmarking — a genuine competitive differentiator with no analog in any surveyed competitor tool. Depends on comparison period delta calculation (Phase 1) being robust. Build after conversational scoping is working, since milestones integrate naturally into the ad hoc report conversation ("benchmark against our product launch in February").

**Delivers:** `Milestone` Prisma model (name, date, description, createdBy), milestone creation/management UI, milestone-anchored benchmark comparison in report generation, and side-by-side before/after comparison UI with color-coded deltas.

**Avoids:** Benchmarking query OOM — pre-aggregation from Phase 1 (`BenchmarkSnapshot` or KV cache) handles this; the milestone comparison query reads from aggregated data, not raw `PostMetrics` rows.

**Research flag:** Skip — the Milestone model is a straightforward schema addition; the benchmarking query patterns are established in earlier phases.

---

### Phase Ordering Rationale

- **Dependencies drive the order:** QuickChart.io integration (Phase 1) must exist before any visual output (Phases 2-6). The report engine (Phase 2) must produce complete reports before distribution channels can be validated (Phases 3-5). Distribution channels must work before the scheduler fans them out autonomously (Phase 6).
- **Risk isolation:** PDF and email are built before scheduling to ensure bugs are caught in manual, user-triggered flows before they propagate to autonomous cron runs affecting all brands.
- **Differentiators are late-stage:** Conversational scoping (Phase 7) and milestone benchmarking (Phase 8) are built after the core pipeline is in production use, so both the report generation quality and the prompt engineering can be refined with real usage data.
- **Pitfall-driven phase boundaries:** The benchmarking query safety cap (Phase 1) and the email content architecture decision (Phase 4) are explicitly made early in their respective phases — before templates or queries are built — to prevent expensive retrofitting.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Email Distribution):** Template design and cross-client compatibility testing strategy. The Outlook dual-rendering engine (Word + new Chromium Outlook, coexisting through 2027-2028) may require specific React Email component choices. Recommend a focused research sub-phase on the specific email template structure and Litmus testing strategy before building `ReportEmailTemplate`.
- **Phase 7 (Conversational Scoping):** Prompt engineering for structured parameter extraction (`ReportSpec` from open-ended conversation). Recommend a prompt validation sub-phase using a sample of real production report requests.

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1 (Foundation):** QuickChart POST API and Prisma migrations are thoroughly documented; patterns are straightforward.
- **Phase 2 (Report Engine):** Established patterns; existing Claude integration and Prisma queries are the blueprint.
- **Phase 3 (PDF Export):** react-pdf is well-documented with confirmed Next.js 14.2+ compatibility and clear serverless workarounds.
- **Phase 5 (Slack):** Block Kit is thoroughly documented; the digest design decision is clear from pitfalls research.
- **Phase 6 (Scheduling):** Cron patterns follow existing codebase conventions (`vercel.json` already has 10 entries using the same model).
- **Phase 8 (Milestone Benchmarking):** Straightforward schema and query work building on patterns established in earlier phases.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library versions verified via npm registry and official docs; Vercel serverless constraints confirmed against official docs and community-validated GitHub issues; version compatibility matrix confirmed for Next.js 14.2+ |
| Features | HIGH | Verified against Sprout Social, Hootsuite, Brandwatch, and Buffer official support docs; feature prioritization based on multiple 2025-2026 sources; competitor analysis covers the five key feature dimensions |
| Architecture | HIGH | Derived from direct codebase analysis + official service docs; build order is logically derived from the dependency graph; component patterns match established codebase conventions (`lib/listening-scanner.js` as the precedent) |
| Pitfalls | HIGH | 11 pitfalls verified against official docs (Vercel, Slack, QuickChart, Gmail, Outlook) and community-validated GitHub issues; cron double-delivery and PDF bundle size failures are explicitly documented by Vercel and react-pdf maintainers respectively |

**Overall confidence:** HIGH

### Gaps to Address

- **QuickChart.io free tier rate limits:** Two conflicting figures appear in QuickChart docs (60 vs 120 req/min). At projected usage (~50-200 charts/month) this is not a concern for v1, but confirm the actual limit before building batch chart generation for reports with many concurrent schedules. Validate in a Vercel staging deployment.
- **SMTP transport configuration:** `nodemailer` is installed but no SMTP credentials are configured. Email delivery requires a decision on the SMTP provider (SendGrid SMTP, AWS SES, or Gmail OAuth2). This is a configuration/infrastructure decision, not a code decision, but it must be resolved before Phase 4 can be tested end-to-end.
- **Slack Webhook URL availability:** `SLACK_WEBHOOK_URL` env var is referenced in architecture docs but may not be configured. Confirm with the team that a Slack workspace Incoming Webhook URL exists before starting Phase 5.
- **Outlook testing access:** Pitfalls research flags Outlook (Word engine) as a critical compatibility concern for email templates. Access to a real Outlook inbox (not just Gmail) is needed to validate email rendering before shipping Phase 4.
- **BenchmarkSnapshot vs KV cache:** ARCHITECTURE.md suggests either a `BenchmarkSnapshot` Prisma model or Vercel KV for pre-aggregated benchmarks. Recommend the DB model: it is more queryable, more durable, and avoids KV TTL expiration risks. Make this decision explicit in Phase 1 planning.

---

## Sources

### Primary (HIGH confidence)
- [react-pdf.org compatibility docs](https://react-pdf.org/compatibility) — Next.js 14.1.1+ requirement, `serverExternalPackages` workaround, React 18/19 support
- [npm: @react-pdf/renderer v4.3.2](https://www.npmjs.com/package/@react-pdf/renderer) — current version confirmed, pure Node.js, no Chromium
- [QuickChart.io documentation](https://quickchart.io/documentation/) — POST API, Chart.js v4, PNG output, short URLs
- [npm: @react-email/components v1.0.8](https://www.npmjs.com/package/@react-email/components) — email-client compatibility, React 18/19 support
- [React Email docs: Nodemailer integration](https://react.email/docs/integrations/nodemailer) — `render()` + `transporter.sendMail()` pattern
- [npm: @slack/webhook v7.0.7](https://www.npmjs.com/package/@slack/webhook) — Block Kit support, Node.js 18+ requirement (published 13 days ago)
- [Slack Block Kit docs](https://docs.slack.dev/block-kit/) — `image` block type, fallback `text` requirement, Block Kit Builder
- [Vercel Function Duration docs](https://vercel.com/docs/functions/configuring-functions/duration) — Fluid Compute 800s max on Pro, `maxDuration` syntax
- [Vercel serverless size limit KB](https://vercel.com/kb/guide/troubleshooting-function-250mb-limit) — 250 MB unzipped / 50 MB compressed limit confirmed
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — duplicate delivery explicitly documented, production-only execution
- [Nodemailer Embedded Images](https://nodemailer.com/message/embedded-images/) — CID attachment pattern
- Codebase analysis: `package.json`, `vercel.json`, `prisma/schema.prisma`, `lib/routers/reports.js`, `lib/ai/reports.js`, `lib/redis.js`, `app/api/cron/` — confirmed installed versions, 10 existing cron routes, established patterns

### Secondary (MEDIUM confidence)
- Sprout Social, Hootsuite, Brandwatch, Buffer official support docs — competitor feature analysis; HIGH confidence on features documented in official docs
- [QuickChart rate limits community](https://community.quickchart.io/t/rate-limits-for-quickchart-free-plan/722) — free tier is 60 req/min (conflicting figure of 120 req/min in a separate doc; needs staging validation)
- [Gmail 102 KB clipping guide](https://www.maildesigner365.com/common-email-rendering-issues-and-fixes/) — Gmail and Yahoo clip thresholds
- [Outlook dual rendering engine 2025](https://mailsoftly.com/blog/why-does-my-outlook-look-different/) — Word engine vs new Chromium Outlook coexistence through 2027-2028
- react-pdf font loading GitHub issues (#409, #2675, #2460) — relative path failures on Vercel, variable font incompatibility, silent failures

### Tertiary (LOW confidence / needs validation)
- QuickChart free tier image count (100K/month vs 60 req/min) — two different limit types from different docs; validate before building batch chart generation at scale
- SMTP provider selection — not researched; team infrastructure decision required

---

*Research completed: 2026-03-15*
*Ready for roadmap: yes*
