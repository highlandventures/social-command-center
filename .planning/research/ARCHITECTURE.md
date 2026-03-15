# Architecture Research

**Domain:** Report Center — scheduled generation, conversational scoping, server-side charts, PDF export, multi-channel distribution
**Researched:** 2026-03-15
**Confidence:** HIGH — derived from direct codebase analysis, official Vercel/QuickChart/Slack/Nodemailer docs, and community-verified patterns

---

## System Overview

The report center is an additive layer on an existing Next.js 14 / tRPC / Prisma / Vercel pipeline. Four new subsystems must integrate with the existing `Report` model, `reports` tRPC router, and cron infrastructure. None replace existing pieces — they extend them.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  TRIGGERS                                                                    │
│                                                                              │
│  ┌─────────────────────────┐   ┌───────────────────────────────────────┐    │
│  │  Vercel Cron (vercel.json)│  │  User Action (tRPC mutation / button) │    │
│  │  weekly / monthly /      │  │  "Send now" / "Export PDF"            │    │
│  │  quarterly / yearly       │  │  / "Save to repository"               │    │
│  └────────────┬─────────────┘  └───────────────────┬───────────────────┘    │
│               │                                    │                        │
└───────────────┼────────────────────────────────────┼────────────────────────┘
                │                                    │
                ▼                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  REPORT GENERATION ENGINE  (lib/report-engine.js — new)                     │
│                                                                              │
│  1. Data Aggregation  →  pulls PostMetrics, CompetitorMetrics,               │
│                          ListeningHit, AccountMetrics from Prisma            │
│  2. Benchmark Comparison  →  WoW / MoM / QoQ / YoY deltas                   │
│  3. Claude AI (Haiku)  →  executive summary, KPI narrative, recommendations  │
│  4. Chart Spec Builder  →  builds Chart.js config objects for each chart     │
│                                                                              │
│  Called by: cron routes + reports.generate tRPC mutation                    │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  CHART RENDERING  (lib/chart-renderer.js — new)                             │
│                                                                              │
│  QuickChart.io HTTP API  →  POST Chart.js config  →  receive PNG buffer      │
│  Returns: { chartId, imageUrl, base64 } per chart spec                      │
│                                                                              │
│  Used by: PDF builder + email distributor + report persistence               │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────────┐
                    ▼            ▼                ▼
┌─────────────┐  ┌──────────┐  ┌──────────────────────────────────────────────┐
│  PDF EXPORT │  │  DB      │  │  DISTRIBUTION ENGINE  (lib/distributor.js)   │
│             │  │  Persist │  │                                              │
│ @react-pdf/ │  │          │  │  ┌──────────────┐  ┌───────────────────────┐ │
│ renderer    │  │  Report  │  │  │ Email         │  │ Slack                 │ │
│             │  │  row     │  │  │ (nodemailer) │  │ (Incoming Webhooks)   │ │
│ Server-side │  │  updated │  │  │ CID-inlined  │  │ Block Kit + image     │ │
│ PDF stream  │  │  with    │  │  │ chart PNGs   │  │ blocks                │ │
│ Vercel Blob │  │  charts  │  │  └──────────────┘  └───────────────────────┘ │
│ storage     │  │  stored  │  │                                              │
└─────────────┘  └──────────┘  └──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  DATABASE (Prisma / Vercel Postgres)                                        │
│                                                                              │
│  Report (existing — needs schema additions)                                  │
│  ReportSchedule (new — cadence config: weekly/monthly/quarterly/yearly)     │
│  ReportDelivery  (new — per-send log: channel, status, sentAt, error)       │
│                                                                              │
│  PostMetrics / CompetitorMetrics / ListeningHit / AccountMetrics (existing) │
└──────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  tRPC API LAYER  (lib/routers/reports.js — existing, extended)              │
│                                                                              │
│  Existing: reports.list, reports.generate, reports.getBenchmarks            │
│  New:                                                                        │
│  - reports.createSchedule / listSchedules / deleteSchedule                  │
│  - reports.chat (streaming, multi-turn AI scoping conversation)             │
│  - reports.exportPdf (returns Blob URL or stream)                           │
│  - reports.distribute (manual send → email + Slack)                         │
│  - reports.getWithCharts (enriched report with rendered chart URLs)         │
└──────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (app/(dashboard)/reports/page.jsx — existing, enhanced)          │
│                                                                              │
│  Existing tabs: AI Report Builder | Report Repository | Historical Benchmarks│
│  New/enhanced:                                                               │
│  - Conversational scoping chat interface (in Builder tab)                   │
│  - Scheduled reports management (new sub-tab or modal)                      │
│  - Rich report viewer with inline charts                                    │
│  - PDF export button (triggers reports.exportPdf)                           │
│  - Email/Slack distribution controls                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### Component 1: Report Generation Engine (`lib/report-engine.js`)

**What it owns:** Orchestration of all data gathering, AI generation, and chart spec building. This is the single reusable function called by both cron routes and the tRPC `generate` mutation.

**What it does NOT own:** Chart rendering (that's `chart-renderer.js`), PDF serialization, email or Slack delivery.

**Communicates with:**
- `lib/db.js` (Prisma) — reads PostMetrics, AccountMetrics, CompetitorMetrics, ListeningHit within the report's time window
- `lib/ai.js` → `generateInsight()` — calls Claude Haiku with batched data context
- `lib/chart-renderer.js` — receives chart specs, returns PNG buffers/URLs
- `prisma.report` — creates/updates the Report row on completion

**Key input:** `{ reportType, dateStart, dateEnd, benchmarkConfig, scheduleId? }`
**Key output:** `{ reportId, content: { executiveSummary, keyMetrics, topContent, recommendations, charts[] }, chartUrls[] }`

---

### Component 2: Chart Renderer (`lib/chart-renderer.js`)

**What it owns:** All communication with QuickChart.io. Converts Chart.js config objects into PNG image buffers or hosted URLs. Handles error fallback (no chart vs broken chart).

**What it does NOT own:** Report data, AI narratives, PDF structure, delivery.

**Communicates with:**
- QuickChart.io HTTPS API (POST to `https://quickchart.io/chart`) — external HTTP
- `@vercel/blob` — optionally stores rendered PNGs for persistent URLs in PDFs/emails

**Pattern:** Accepts an array of chart specs. Renders in parallel via `Promise.all()`. Returns array of `{ specId, buffer, dataUri }`.

**Constraint:** Free tier is 100,000 images/month. At ~5 charts/report and an estimated 50-200 reports/month, this comfortably fits the free tier. Professional tier ($40/month) adds dedicated infrastructure if needed.

**API shape used:**
```javascript
// POST https://quickchart.io/chart
{
  chart: { type: 'bar', data: { labels: [...], datasets: [...] } },
  width: 600,
  height: 300,
  backgroundColor: 'white',
  format: 'png',
  version: 4  // Chart.js v4
}
// Returns: PNG binary buffer
```

---

### Component 3: PDF Exporter (`lib/pdf-exporter.js`)

**What it owns:** Assembling a `@react-pdf/renderer` document from a report's structured content and pre-rendered chart images (as base64 data URIs). Returning a PDF buffer or stream.

**What it does NOT own:** Chart rendering (passes base64 from chart-renderer), delivery.

**Key constraint on Vercel:** `@react-pdf/renderer` is pure Node.js with no Chromium dependency. Works natively in serverless functions. Puppeteer/Chromium is explicitly excluded — the 50MB Lambda limit and cold start behavior make it unsuitable for on-demand PDF generation.

**For chart embedding:** `@react-pdf/renderer`'s `<Image>` component accepts base64 data URIs directly. The chart renderer returns `{ dataUri }` per chart; the PDF assembler passes these as `<Image src={chart.dataUri} />`.

**Function configuration:**
```javascript
// app/api/reports/export-pdf/route.js
export const maxDuration = 60; // PDFs are fast with @react-pdf/renderer
```

**Output:** PDF Buffer written to Vercel Blob, returns a temporary signed URL valid for download.

---

### Component 4: Distribution Engine (`lib/distributor.js`)

**What it owns:** Sending completed reports via email (nodemailer) and Slack (Incoming Webhooks). Writing `ReportDelivery` rows for each send attempt.

**What it does NOT own:** Report generation, chart rendering, PDF creation.

**Communicates with:**
- `nodemailer` (already installed) — sends HTML email with CID-referenced inline chart PNGs
- Slack Incoming Webhook URL (from env var `SLACK_WEBHOOK_URL`) — POSTs Block Kit payload
- `prisma.reportDelivery` — writes per-send logs with status, timestamp, error message

**Email pattern:** Each chart PNG is attached with a unique `cid` and referenced as `<img src="cid:chart-engagement@report">` in HTML. This avoids base64-in-src (blocked by email clients) and external URL blocking.

**Slack pattern:** Block Kit `section` blocks for text + KPI stats; `image` blocks for charts using QuickChart-hosted URLs. Charts sent to Slack must be externally accessible URLs — use the QuickChart hosted URL (not a local buffer). If report chart URLs are stored in Vercel Blob, those work too.

---

### Component 5: Conversational AI Scoping (`lib/report-chat.js` + tRPC streaming)

**What it owns:** Multi-turn Claude Sonnet conversation that collects report parameters from the user. Produces a structured `ReportSpec` when the user confirms.

**What it does NOT own:** Report generation (passes spec to report-engine).

**Pattern:** Stateless from the server's perspective. Chat history is maintained client-side (React state) and sent with each turn. Server calls Claude Sonnet with the accumulated conversation + system prompt that knows the available metrics, date ranges, and report types.

**Trigger for generation:** When Claude determines the spec is complete (or user says "generate"), the procedure returns `{ done: true, spec: ReportSpec }`. The client then calls `reports.generate` with the spec.

**Model selection:** Claude Sonnet (not Haiku) for the scoping conversation — this is interactive, quality matters more than cost. Haiku for the actual batch report generation where cost scales with cron frequency.

---

### Component 6: Scheduler (`lib/report-scheduler.js` + Vercel Cron)

**What it owns:** Determining which `ReportSchedule` records are due for a given cron invocation and triggering report generation for each.

**Communicates with:**
- `prisma.reportSchedule` — reads schedules, writes `lastRunAt`
- `lib/report-engine.js` — calls `generateReport(spec)` for each due schedule
- `lib/distributor.js` — calls `distributeReport(reportId)` after generation if `autoDistribute: true`

**Cron schedule for the scheduler cron:**
```json
// vercel.json addition
{ "path": "/api/cron/generate-scheduled-reports", "schedule": "0 7 * * 1" }
```
A weekly Monday morning run covers all cadences. The route checks each `ReportSchedule` and generates only those due (weekly every run, monthly on 1st, quarterly on first of quarter month, yearly on Jan 1).

**Timeout handling:** Report generation per schedule can take 15-30 seconds (data fetch + Claude + QuickChart). With up to 10 schedules, total cron duration could reach 5 minutes. Use `export const maxDuration = 300` (confirmed working in existing `backfill-history` cron).

---

### Component 7: Schema Additions (Prisma)

**Additions to existing `Report` model:**
```
scheduleId      String?           -- FK to ReportSchedule (null for manual)
chartUrls       Json?             -- Array of { specId, url, label }
pdfUrl          String?           -- Vercel Blob URL for exported PDF
coveragePeriod  Json?             -- { start, end } explicit date range
benchmarkPeriod Json?             -- { start, end } comparison period
```

**New `ReportSchedule` model:**
```
id              String    (cuid)
cadence         Enum      (WEEKLY | MONTHLY | QUARTERLY | YEARLY)
reportType      ReportType
title           String
autoDistribute  Boolean   @default(false)
emailRecipients String[]
slackWebhook    String?
lastRunAt       DateTime?
nextRunAt       DateTime
createdById     String
createdAt       DateTime
active          Boolean   @default(true)
```

**New `ReportDelivery` model:**
```
id              String    (cuid)
reportId        String    → Report
channel         Enum      (EMAIL | SLACK)
recipient       String    -- email address or slack channel name
status          Enum      (SENT | FAILED | PENDING)
sentAt          DateTime?
error           String?
createdAt       DateTime
```

---

## Data Flow

### Flow 1: Scheduled Report Auto-Generation

```
Vercel Cron (Monday 7 AM UTC)
    ↓
app/api/cron/generate-scheduled-reports/route.js
    ↓
lib/report-scheduler.js
    ↓ reads
prisma.reportSchedule.findMany({ where: { active: true, nextRunAt: { lte: now } } })
    ↓ for each due schedule
lib/report-engine.js (generateReport(spec))
    ↓ parallel
  [1] prisma queries: PostMetrics, AccountMetrics, CompetitorMetrics, ListeningHit
  [2] benchmark queries: same tables for prior period
    ↓
generateInsight() → Claude Haiku → { executiveSummary, keyMetrics, recommendations }
    ↓
lib/chart-renderer.js
    ↓ parallel via Promise.all()
  QuickChart.io POST per chart spec → PNG buffer
  @vercel/blob.put(buffer) → hosted URL
    ↓
prisma.report.create({ content, chartUrls, scheduleId })
    ↓ if autoDistribute
lib/distributor.js
    ↓ parallel
  nodemailer.send() → HTML email with CID charts
  fetch(slackWebhookUrl, Block Kit payload with chart image URLs)
    ↓
prisma.reportDelivery.createMany([...email, ...slack logs])
    ↓
prisma.reportSchedule.update({ lastRunAt: now, nextRunAt: computed })
```

---

### Flow 2: Conversational Ad Hoc Report Creation

```
User opens Report Builder tab → types message
    ↓
trpc.reports.chat.mutate({ messages: [...], context: { availableMetrics, dateRange } })
    ↓
lib/report-chat.js
    ↓
Claude Sonnet (multi-turn with accumulated history)
    → returns { reply, done: false } if still clarifying
    → returns { reply, done: true, spec: ReportSpec } when complete
    ↓
Client: show AI reply in chat UI
    → if done=false: show next message input
    → if done=true: show "Generate Report" CTA button with confirmed spec
    ↓ (user clicks Generate)
trpc.reports.generate.mutate(spec)
    ↓
lib/report-engine.js (same path as scheduled generation)
    ↓
Report created → displayed in report preview
```

---

### Flow 3: PDF Export

```
User clicks "Export PDF" on a saved report
    ↓
trpc.reports.exportPdf.mutate({ reportId })
    ↓ (or GET /api/reports/export-pdf?reportId=...)
lib/pdf-exporter.js
    ↓
prisma.report.findUnique() → content + chartUrls
    ↓ for each chartUrl
fetch(chartUrl) → ArrayBuffer → base64 dataUri
    ↓
@react-pdf/renderer: renderToBuffer(<ReportDocument content={...} charts={...} />)
    ↓
@vercel/blob.put('reports/{id}.pdf', pdfBuffer)  → signed URL
    ↓
prisma.report.update({ pdfUrl })
    ↓
return { downloadUrl: signedUrl }
Client: window.open(downloadUrl)
```

---

### Flow 4: Manual Distribution

```
User clicks "Send via Email" or "Share to Slack"
    ↓
trpc.reports.distribute.mutate({ reportId, channels: ['email', 'slack'], recipients: [...] })
    ↓
lib/distributor.js
    ↓
prisma.report.findUnique() → content + chartUrls
    ↓ parallel
  Email path:
    for each chartUrl: fetch() → Buffer
    nodemailer.sendMail({
      html: renderEmailHtml(report, charts),
      attachments: charts.map(c => ({ cid: c.id, content: c.buffer, contentType: 'image/png' }))
    })
  Slack path:
    fetch(SLACK_WEBHOOK_URL, { method: 'POST', body: buildBlockKit(report) })
    // Block Kit uses hosted chartUrls directly (no buffer needed)
    ↓
prisma.reportDelivery.createMany([delivery records])
    ↓
return { sent: true, deliveries: [...] }
```

---

## Recommended Project Structure

```
lib/
├── report-engine.js        # Core orchestrator: data → AI → chart specs → Report row
├── chart-renderer.js       # QuickChart.io integration, returns PNG buffers + hosted URLs
├── pdf-exporter.js         # @react-pdf/renderer document assembly, Blob upload
├── distributor.js          # nodemailer email + Slack Block Kit dispatch
├── report-chat.js          # Multi-turn Claude Sonnet scoping conversation
├── report-scheduler.js     # Checks which schedules are due, calls report-engine
│
├── routers/
│   └── reports.js          # Extended: chat, exportPdf, distribute, createSchedule, getWithCharts
│
└── ai/
    └── reports.js          # Extended: generateCadenceReport() for scheduled types

app/
└── api/
    ├── cron/
    │   └── generate-scheduled-reports/route.js  # New cron handler
    └── reports/
        └── export-pdf/route.js                  # PDF generation endpoint (maxDuration=60)

components/
├── ReportViewer.jsx         # Rich report display with inline charts (server-rendered imgs)
├── ReportChatInterface.jsx  # Multi-turn conversation UI
└── ReportScheduleManager.jsx# CRUD for ReportSchedule records
```

---

## Architectural Patterns

### Pattern 1: Shared Logic Module (existing codebase pattern)

**What:** Core logic lives in `lib/*.js` module, called by both the cron route handler and a tRPC procedure.

**Why:** Cron runs autonomously on schedule; tRPC procedure lets users trigger on-demand. Same generation code, two entry points. No duplication.

**Existing precedent:** `lib/listening-scanner.js` called by both `app/api/cron/poll-listening/route.js` and `trpc.listening.triggerScan`.

**Apply to:** `lib/report-engine.js` called by `generate-scheduled-reports` cron AND `reports.generate` tRPC mutation.

---

### Pattern 2: Chart-as-URL, Not Chart-as-Component

**What:** All chart rendering happens server-side via HTTP to QuickChart.io before the report is persisted. Charts are stored as URLs (Vercel Blob) in `Report.chartUrls[]`. The frontend displays `<img src={chartUrl}>` — no Recharts rendering needed in reports.

**Why:** Recharts requires a browser DOM for rendering. Server-side reports (PDFs, emails, Slack) cannot use Recharts. QuickChart.io provides a browser-independent Chart.js renderer. Storing URLs instead of raw chart data means the rendered chart is consistent across every viewer (in-app, email, PDF, Slack).

**Trade-off:** QuickChart.io is a dependency (external service). Mitigated by free tier being generous and the fallback being a text-only report if chart rendering fails.

---

### Pattern 3: CID-Inline Images for Email

**What:** For email delivery, chart PNG buffers are attached with unique `cid` values and referenced in HTML as `<img src="cid:chart-eng-rate@report">`.

**Why:** Raw base64 in HTML `src` is blocked by most email clients. External URLs require the recipient to "load images." CID-inline attachments travel inside the email and display immediately without network requests.

**How nodemailer handles it:**
```javascript
attachments: [
  { filename: 'engagement-chart.png', content: chartBuffer, cid: 'engagement-chart@report' }
]
// In HTML body:
// <img src="cid:engagement-chart@report" width="600" alt="Engagement Rate">
```

---

### Pattern 4: Block Kit for Slack, Not Plain Text

**What:** Slack messages use Block Kit with `header`, `section`, `divider`, and `image` blocks. KPI stats go in `section` fields (two-column layout). Charts go in `image` blocks with the QuickChart-hosted URL.

**Why:** Plain text Slack messages feel like error logs. Block Kit makes reports visually scannable with headers, dividers, and inline images. Incoming Webhooks support the full `blocks` array — no bot token required.

**Constraint:** Slack `image` blocks require a publicly accessible URL. Use Vercel Blob URLs (publicly readable) or the QuickChart-hosted short URL (`https://quickchart.io/chart/render/...`). Do not pass PNG buffers — Slack cannot accept binary payloads in webhook messages.

---

### Pattern 5: Stateless Chat, Client-Maintained History

**What:** The `reports.chat` tRPC procedure receives the full message history with each call. Server is stateless — no session storage needed.

**Why:** Vercel serverless functions have no persistent in-process state between invocations. Storing chat history in Redis adds a dependency. The report scoping conversation is short (3-7 turns) — sending the full history each turn is negligible overhead at this scale.

---

## Integration Points with Existing Codebase

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| QuickChart.io | `fetch()` POST to `https://quickchart.io/chart` with Chart.js config JSON | Free tier: 100K images/month. Returns PNG binary. No SDK needed. |
| Claude Haiku (Anthropic) | Existing `lib/ai.js` → `generateInsight()` wrapper | No change to AI call pattern. Use `claude-3-5-haiku-20241022` for batch generation. |
| Claude Sonnet (Anthropic) | Existing `lib/ai.js` → `generateInsight()` | Use Sonnet for chat scoping only (interactive, quality matters). |
| nodemailer | Already installed (`nodemailer@^7.0.13`). Create transporter in `lib/distributor.js` using `SMTP_HOST/USER/PASS` env vars. | Configure via Vercel env vars. Transport is instantiated per send (serverless — no persistent connections). |
| Slack Incoming Webhooks | `fetch(process.env.SLACK_WEBHOOK_URL, { method: 'POST', body: JSON.stringify(blockKit) })` | No SDK needed. Webhook URL is workspace-specific. Block Kit supports `image` blocks with external URLs. |
| Vercel Blob | `@vercel/blob` already installed. Use `put('reports/{id}/chart-{n}.png', buffer, { access: 'public' })` for chart PNGs and `put('reports/{id}.pdf', pdfBuffer, { access: 'public' })` for PDFs. | Blob URLs are publicly readable by default — safe for Slack image blocks. |

---

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `report-engine.js` ↔ `reports` tRPC router | Direct import | Engine is called from both tRPC mutation and cron handler |
| `report-engine.js` ↔ `chart-renderer.js` | Direct import | Engine builds chart specs; renderer calls QuickChart and returns buffers |
| `chart-renderer.js` ↔ Vercel Blob | Direct import (`@vercel/blob`) | Renderer optionally stores PNGs to Blob for persistent URLs |
| `pdf-exporter.js` ↔ `chart-renderer.js` | Receives pre-fetched base64 from engine output | Exporter does not call QuickChart directly |
| `distributor.js` ↔ existing `Report` row | Reads from DB by `reportId` | Distributor fetches chart URLs from `Report.chartUrls` |
| New cron ↔ `vercel.json` | Add one new cron entry | Follows existing pattern of 10 cron entries in vercel.json |
| New tRPC procedures ↔ `lib/routers/app.js` | `reportsRouter` already registered | No change to `appRouter` needed — extend `reportsRouter` only |

---

## Build Order

Dependencies between components dictate this order:

**1. Schema migrations first** — Add `ReportSchedule`, `ReportDelivery`, and extend `Report` model with `chartUrls`, `pdfUrl`, `coveragePeriod`, `benchmarkPeriod`. One migration unblocks all downstream work.

**2. Chart Renderer** — `lib/chart-renderer.js` has no dependencies on other new components. Build and verify with a standalone test (POST to QuickChart.io, receive PNG) before integrating. This is the most externally-dependent piece — validate it works in Vercel's network before building on top of it.

**3. Report Engine (core)** — Extend `lib/ai/reports.js` with richer content schemas (inline KPI blocks, benchmark deltas). Build `lib/report-engine.js` orchestrator calling existing data queries + Claude + chart renderer. Wire into the existing `reports.generate` tRPC mutation first to validate end-to-end before adding scheduling.

**4. Distribution Engine** — `lib/distributor.js` with email and Slack. Build email first (nodemailer is already installed; it's lower risk). Add Slack after email is validated. Test against real Slack webhook before wiring into the cron.

**5. PDF Exporter** — `lib/pdf-exporter.js` using `@react-pdf/renderer`. This requires charts to be rendered as base64 first (depends on step 2). Validate PDF output in an isolated API route before integrating the export button.

**6. Conversational Chat** — `reports.chat` tRPC procedure with `lib/report-chat.js`. Can be built in parallel with distribution (no dependencies between them). Connect to the frontend chat UI last.

**7. Scheduler and Cron** — `lib/report-scheduler.js` + `generate-scheduled-reports` cron. This depends on the report engine working correctly. Build last because it's autonomous — bugs in early iterations won't affect manually-triggered reports.

**8. Frontend enrichment** — Enhance `reports/page.jsx` with `ReportViewer`, chat interface, schedule management. Can be layered on as each backend piece completes.

---

## Vercel Serverless Constraints

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| Default function timeout (Fluid Compute enabled) | 300s default on Pro | Report generation (data + AI + charts) typically completes in 20-40s. Well within limit. |
| Scheduled cron generating 10 reports | Could approach 5 min | Use `export const maxDuration = 300` (already used in `backfill-history`). Run charts in `Promise.all()`. |
| No persistent in-process state | Can't keep chat sessions in memory | Client sends full message history each turn. Stateless server. |
| Serverless function cold starts | First PDF request after idle period may be slow | `@react-pdf/renderer` has no Chromium download on cold start — cold start is fast (~200ms). Puppeteer would have a cold start penalty of 2-10s; it is excluded for this reason. |
| Vercel Blob public access | Chart PNGs stored in Blob must be publicly accessible for Slack | Use `access: 'public'` in Blob `put()` calls for chart images. PDF files can use signed URLs. |
| No shared filesystem | Cannot write chart PNGs to `/tmp` and read from another function | Use Vercel Blob as the shared layer. All function instances read from the same Blob store. |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Puppeteer/Chromium for PDF Generation

**What people do:** Use Puppeteer to render a Next.js page as HTML and screenshot it to PDF.

**Why it's wrong for this project:** The Lambda limit for Vercel is 50MB; Chromium binaries are 30-40MB. `@sparticuz/chromium` strips it down but still adds cold start penalty (2-10s Chromium launch). For an internal tool doing at most ~200 PDFs/month, `@react-pdf/renderer` produces higher-quality typographic output at zero marginal infra cost with no cold start.

**Do this instead:** `@react-pdf/renderer` with charts pre-rendered as base64 data URIs from QuickChart.io. The PDF layout is code-defined, not HTML-captured.

---

### Anti-Pattern 2: Recharts in Server-Side Reports

**What people do:** Try to render Recharts components in API routes or emails to generate chart images.

**Why it's wrong:** Recharts requires `window`, `document`, and canvas APIs. These do not exist in Node.js serverless functions. Using `jsdom` or `canvas` as shims adds complexity and produces lower-quality output.

**Do this instead:** Keep Recharts for the interactive in-app benchmarks view (where it already works). Use QuickChart.io for all server-side chart rendering — it is browser-independent.

---

### Anti-Pattern 3: Base64 Images Directly in Email HTML

**What people do:** Embed chart images as `<img src="data:image/png;base64,...">` in email HTML bodies.

**Why it's wrong:** Gmail, Outlook, and most enterprise email clients strip or block inline base64 images. The recipient sees broken image placeholders.

**Do this instead:** Use CID-referenced attachments via Nodemailer. The chart PNG travels as an attachment with `cid: 'chart-id@report'`, and the HTML references `<img src="cid:chart-id@report">`. Widely supported across all email clients.

---

### Anti-Pattern 4: External Image URLs in Emails

**What people do:** Use QuickChart.io direct chart URLs in email HTML (`<img src="https://quickchart.io/chart?c=...">`).

**Why it's wrong:** Many corporate email clients block external images by default. The recipient sees a "click to load images" prompt, which most users ignore. Report charts never appear.

**Do this instead:** CID-inline the charts (see above). The PNG is fetched at send time (not at view time) and attached to the message.

---

### Anti-Pattern 5: Per-Report Cron Jobs

**What people do:** Create one cron entry per report schedule (e.g., one cron for weekly, one for monthly, one per account).

**Why it's wrong:** The vercel.json cron limit is 100 per project; 11 are already used. More importantly, per-report crons can't share data fetching, making each run independently expensive.

**Do this instead:** One `generate-scheduled-reports` cron runs on the most frequent cadence (weekly). The cron queries `ReportSchedule` records to determine what is due. All data fetching for co-located schedules can share Prisma queries.

---

### Anti-Pattern 6: Chat History Stored Server-Side (Redis)

**What people do:** Persist conversation state in Redis with a session key, allowing short-lived stateless payloads.

**Why it's wrong for this use case:** The scoping conversation is 3-7 turns and completes within a single user session. Adding Redis as session storage introduces a dependency that's not needed — the client already has the full message history in React state. Sending history with each request is idiomatic for LLM APIs.

**Do this instead:** Client maintains message history in React state. Each `reports.chat` call receives the full array of `[{role, content}]`. Server is stateless.

---

## Scaling Considerations

| Concern | Current scale (~10 schedules) | If scale grows to 100+ reports/month |
|---------|-------------------------------|--------------------------------------|
| QuickChart.io free tier | 100K images/month; at 5 charts × 10 reports = 50 images/month — 0.05% of limit | Still within free tier at 500 images/month. Professional tier ($40/mo) if needed. |
| Cron duration | 10 reports × ~30s each = 300s — at the limit | Parallelize generations with `Promise.all()`. With parallel execution, 10 reports × ~30s concurrently fits in 60-90s wall time. |
| Claude API costs | Haiku at ~$0.05/report × 10 schedules = $0.50/week | Still cheap at 100 reports. |
| Vercel Blob storage | Each report: 5 charts × ~30KB + 1 PDF × ~200KB = ~350KB. 10 reports/week = ~3.5MB/week | Implement retention policy: delete Blob files after 90 days. Reports older than 90 days → generate on-demand from DB content. |
| PDF export contention | One PDF per user click — low volume | PDF generation is on-demand, not queued. No bottleneck until concurrent users exceed ~10. |

---

## Sources

- Codebase: `lib/routers/reports.js` — existing tRPC procedures, data query patterns
- Codebase: `lib/ai.js` — `generateInsight()` wrapper, cost logging
- Codebase: `app/api/cron/weekly-ai-insights/route.js` — cron pattern with `force-dynamic`, cron auth
- Codebase: `app/api/cron/backfill-history/route.js` — `export const maxDuration = 300` precedent
- Codebase: `prisma/schema.prisma` — Report model, existing data models
- Codebase: `vercel.json` — 10 existing cron entries, scheduling patterns
- Codebase: `package.json` — confirms `nodemailer@7.0.13`, `@vercel/blob@0.23.0` already installed
- [QuickChart.io Documentation](https://quickchart.io/documentation/) — POST API, Chart.js v4 support, PNG output
- [QuickChart.io Pricing](https://quickchart.io/pricing) — 100K free images/month, $40/mo Professional
- [Vercel Function Duration](https://vercel.com/docs/functions/configuring-functions/duration) — 800s max with Fluid Compute on Pro
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) — no retries, same timeout as functions
- [Nodemailer Embedded Images](https://nodemailer.com/message/embedded-images/) — CID attachment pattern
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) — v4.3.2, React 18/19 compatible, pure Node.js
- [react-pdf Next.js 14 integration](https://benhur-martins.medium.com/nextjs-14-and-react-pdf-integration-ccd38b1fd515) — `serverComponentsExternalPackages` config if needed
- [Slack Incoming Webhooks docs](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/) — Block Kit support, image blocks require external URLs
- [Slack Block Kit layouts](https://api.slack.com/messaging/composing/layouts) — modern block types, deprecation of attachments

---

*Architecture research for: Report Center milestone — scheduled generation, conversational scoping, server-side charts, PDF export, email + Slack distribution on Next.js/tRPC/Prisma/Vercel*
*Researched: 2026-03-15*
