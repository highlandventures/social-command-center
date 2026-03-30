# Pitfalls Research

**Domain:** Report center — scheduled report generation, server-side charts, PDF export, email/Slack delivery, conversational AI, benchmarking queries. Adding to an existing Next.js + tRPC + Prisma + Vercel serverless app.
**Researched:** 2026-03-15
**Confidence:** HIGH (verified against Vercel docs, QuickChart docs, Slack docs, react-pdf GitHub issues, direct codebase review)

---

## Critical Pitfalls

### Pitfall 1: Scheduled Report Generation Exceeds Vercel Function Duration Mid-Run

**What goes wrong:**
The existing `weekly-ai-insights` cron already loads all posts, mentions, listening hits, and account metrics for 7 days, then calls Claude once. A scheduled report generation cron for weekly/monthly/quarterly/yearly cadence must do more: fetch data for multiple accounts, compute benchmarking deltas against prior periods, render chart URLs, generate an executive summary, write the `Report` record, and then trigger email + Slack delivery. On Pro plan the function limit is 800 seconds (with Fluid Compute) but cold start + multi-account Prisma queries + Claude latency + downstream HTTP calls (QuickChart, email API, Slack webhook) makes it easy to blow past 300 seconds without Fluid Compute. The function is killed silently — no partial report is created, the user sees nothing.

**Why it happens:**
Developers test the cron route with a single account and a small date range in development. Production has multiple brands (Figure, HastraFi, ProvenanceFoundation), months of accumulated `PostMetrics`, `ListeningHit`, and `CompetitorMetrics` rows, and cold Vercel invocations add 1–3 seconds before any work begins. The chain of dependencies (data queries → AI call → chart generation → delivery) is designed sequentially and only breaks at scale.

**How to avoid:**
- Set `export const maxDuration = 800;` in every scheduled-report cron route (requires Fluid Compute on Pro plan). Do this from day one — it is a one-liner.
- Split report generation into two phases: a **data assembly + AI generation phase** (write a `Report` record with `status: 'GENERATING'`) and a **delivery phase** (a separate webhook or tRPC call that emails/Slacks the completed report). This decouples the timeout-sensitive AI call from the delivery HTTP calls.
- Do not generate all cadence reports in a single cron invocation. One cron route per cadence type (weekly, monthly, quarterly, yearly) is simpler and easier to debug than a single fan-out job.
- Add an elapsed-time guard: if `Date.now() - startTime > 720_000` (12 minutes), write a `status: 'FAILED'` record and return 200 — never let Vercel kill the function without a DB record showing failure.

**Warning signs:**
- Cron function logs show function execution stopping without a success response
- `Report` records with `status: 'GENERATING'` that are never updated to `status: 'COMPLETE'`
- Vercel function log shows 504/Gateway timeout for the cron route
- Reports only generate for one account but not others after a scheduled run

**Phase to address:**
Scheduled report generation phase — architect the phased generation pattern and set `maxDuration` before writing a single line of cron logic.

---

### Pitfall 2: Vercel Cron Fires Twice — Report Duplicated or Data Double-Counted

**What goes wrong:**
Vercel's event system can deliver the same cron invocation twice. A report generation cron without idempotency protection creates duplicate `Report` records for the same period (e.g., two "Weekly Report — Mar 10–16" entries). Worse: if the delivery phase also double-fires, users get two emails with the same report. The existing `weekly-ai-insights` cron has no idempotency guard at all, which is acceptable because AIInsight records accumulate. A Report record, however, is a user-visible artifact — duplicates directly degrade trust.

**Why it happens:**
Vercel explicitly documents that cron events may be delivered more than once. The `CRON_SECRET` auth check already present in the codebase prevents unauthorized calls, but it does not prevent Vercel's own legitimate duplicate delivery.

**How to avoid:**
- Use Vercel KV (already wired in `lib/redis.js`) to store a lock key per cadence type: `report-gen:{cadence}:lock` with a TTL equal to the generation window (e.g., 10-minute TTL for weekly reports). Check the lock before starting work; set it at the start.
- Use a uniqueness constraint approach: before creating a `Report` record, check if one with the same `reportType` and `dataRangeStart` already exists for the current period (`findFirst` with a period overlap filter). Return early if found.
- Both mechanisms are needed — the KV lock handles the concurrent race case; the DB check handles the "lock expired but report exists" case.

**Warning signs:**
- Two `Report` records with identical `reportType`, `title`, and nearly identical `createdAt` timestamps
- Users reporting receiving duplicate emails or Slack messages
- `Report` table growing unexpectedly fast without a corresponding increase in scheduled cadences

**Phase to address:**
Scheduled report generation — implement both the KV lock and DB deduplication check before the first cron route ships.

---

### Pitfall 3: QuickChart GET Requests Fail for Multi-Series Charts With Many Data Points

**What goes wrong:**
QuickChart renders charts via a URL-encoded Chart.js config. Simple bar or line charts with 4–8 data points fit in a GET URL without issue. A monthly trend chart showing 12 months of data across 3 brands, or a benchmarking delta chart with 6 metrics and comparison bars, produces a Chart.js config that is 1,500–3,000 characters when URL-encoded. Some browsers and proxies truncate URLs at 2,000 characters. More critically, the email delivery pipeline (Resend/SendGrid) embeds this URL in an `<img>` tag — email clients often refuse to load images from excessively long URLs, displaying broken image icons instead.

**Why it happens:**
Developers test with simple charts (a 4-bar performance chart) that work fine in GET mode. The complex multi-series charts required for executive summaries — benchmarking comparisons, engagement rate vs. impressions over time — only fail under production conditions where more data points are needed.

**How to avoid:**
- Always use QuickChart's **POST endpoint** (`POST https://quickchart.io/chart`) server-side to generate charts, get back a PNG binary, and upload that PNG to Vercel Blob or a public URL before embedding in emails. This eliminates the URL length issue entirely.
- Alternatively, use QuickChart's `/chart/create` endpoint to generate a short URL (6-month expiry on paid plan). Short URLs are safe to embed in email `<img>` tags.
- Never embed raw QuickChart GET URLs directly in email HTML — this is the single biggest chart-in-email failure mode.
- Set a hard limit of 500 characters on any chart URL embedded in HTML; use POST + short URL for anything longer.

**Warning signs:**
- Charts render correctly in the in-app report view but appear as broken images in email previews
- Slack image blocks show blank/missing chart images despite valid-looking URLs
- Chart rendering fails intermittently for reports with more than 6 data series

**Phase to address:**
Charts + report rendering phase — establish the POST-then-host pattern as the standard from the first chart implementation; never ship a GET-embedded chart to email.

---

### Pitfall 4: HTML Email Breaks in Outlook Because of Non-Table Layouts or Missing Inline Styles

**What goes wrong:**
The existing codebase has no email HTML generation. When the first email template is built, modern CSS layout patterns (flexbox, CSS grid, CSS custom properties) will be used because they work everywhere else in the Next.js app. Outlook desktop (used heavily in corporate/B2B contexts like Figure Technology's stakeholder audience) still renders HTML with Microsoft Word's engine — flexbox is ignored entirely, CSS grid is unsupported, `padding` on divs fails, and `background-color` on elements other than `<td>` is unreliable.

The 2025–2026 "dual Outlook" transition (legacy Word engine + new Chromium-based Outlook) means you must now code defensively for both simultaneously.

**Why it happens:**
All other templates in the app are React components with Tailwind CSS. The first email template will naturally follow the same pattern. There is no linter or CI check that catches email HTML incompatibilities.

**How to avoid:**
- Use React Email (`react-email` or `@react-email/components`) or MJML as the templating layer. Both compile to table-based, inline-styled HTML that is email-client safe. MJML has the more mature Outlook compatibility story.
- If rolling bespoke HTML: use `<table>`, `<tr>`, `<td>` for every layout structure. Never use `<div>` for layout. Apply all styles inline — no `<style>` blocks, no external stylesheets.
- Explicitly set `background-color` on every `<td>`, not on container divs.
- Test in both Outlook (Word engine) and new Outlook (Chromium) before shipping. Litmus or Email on Acid for CI-level testing; manually send to a test Gmail and Outlook inbox before first production send.

**Warning signs:**
- Charts or KPI blocks render correctly in Gmail preview but collapse to a single column in Outlook preview
- Background colors disappear in Outlook dark mode
- Executive summary text appears as unstyled monospace in Outlook
- Report email looks fine locally (macOS Mail / Gmail web) but stakeholders report broken layout

**Phase to address:**
Email delivery phase — choose the email templating technology (MJML or React Email) before writing a single line of email HTML.

---

### Pitfall 5: Gmail Clips the Report Email at 102 KB

**What goes wrong:**
A rich report email with an executive summary, multiple KPI metric blocks, 3–5 embedded chart images (as `<img>` tags pointing to URLs), and styled sections easily exceeds 102 KB of raw HTML. Gmail silently clips anything over 102 KB and shows a "Message clipped — [View entire message]" link. Users never see the call-to-action, the Slack share button, or the report download link at the bottom. Yahoo Mail clips at 100 KB.

**Why it happens:**
Email HTML is verbose — table-based layouts require deeply nested tags, every style is inlined (doubling the character count), and long chart URLs add hundreds of characters each. A report with 5 charts and 500 words of AI-generated summary reaches 102 KB faster than expected.

**How to avoid:**
- Keep email HTML under 80 KB as a hard budget (20 KB headroom before the 102 KB Gmail limit).
- Use a "key metrics summary + link to full report" email pattern instead of embedding the entire report. Show 3 top-line KPIs, 1 chart, a short executive summary excerpt, and a prominent "View Full Report" CTA linking to the in-app report.
- If full-content email is required, split into multipart/alternative with a plain-text part that contains all the key metrics as text, and an HTML part kept under 80 KB.
- Check rendered HTML size before sending: `Buffer.byteLength(htmlString, 'utf8') < 80000`.

**Warning signs:**
- Gmail shows "Message clipped" on test sends
- `Buffer.byteLength(htmlContent)` exceeds 80,000 during development
- Email has more than 4 embedded chart URLs and multi-section KPI layout

**Phase to address:**
Email delivery phase — define the email content architecture (summary-with-link vs. full-embed) before building templates, and add a byte-length assertion to the report email generation function.

---

### Pitfall 6: Slack Incoming Webhook Rejects Report Messages Over 1 MB Payload

**What goes wrong:**
Slack webhooks have a 1 MB total payload limit. A Block Kit report message with 5+ section blocks, multiple image blocks, and rich context blocks can easily exceed this if chart image URLs are long or if the AI-generated executive summary text is verbose. Slack returns `invalid_payload` with no indication of which block caused the failure.

**Why it happens:**
Block Kit messages are designed for interactive notifications, not report delivery. Treating Slack as a full report channel (including all KPIs, all charts, full executive summary text) produces payloads that exceed what the API was designed for.

**How to avoid:**
- Design Slack reports as **highlight digests**, not full reports. A Slack report message should be: brand name + period header, 3 key metrics as a context block, 1 "hero" chart image, a 2-sentence AI summary, and a "View Full Report" button block. This easily stays under 50 KB.
- Never put multi-paragraph AI-generated text in a single `mrkdwn` text block — Slack truncates text fields that exceed 3,000 characters without warning.
- Validate payload size before sending: `JSON.stringify(blocks).length < 900_000` (with headroom below the 1 MB limit).
- Use the Block Kit Builder (https://app.slack.com/block-kit-builder) to prototype messages before implementing the code generation logic.

**Warning signs:**
- Slack webhook returns HTTP 400 with `invalid_payload` body
- Long AI-generated summaries appear truncated in Slack without explicit truncation code
- Slack message shows "This message can't be shown in full here" in certain views

**Phase to address:**
Slack delivery phase — define the Slack message structure as a highlight digest before writing any Block Kit code. The design decision (full report vs. digest) must be made before implementation.

---

### Pitfall 7: PDF Generation Fails or Times Out Due to Puppeteer Bundle Size on Vercel

**What goes wrong:**
Puppeteer includes a full Chromium binary (~170 MB compressed). Vercel serverless functions have a 50 MB unzipped size limit. Installing Puppeteer to generate PDFs causes the deployment to fail with "Serverless Function has exceeded the unzipped maximum size of 250 MB." Even with `@sparticuz/chromium-min` (a stripped Chromium for Lambda), the package size approaches the limit and cold start latency increases by 2–4 seconds. On the Hobby plan's 10-second function timeout, this is fatal. On Pro, cold starts with Chromium routinely consume 8–10 seconds before the PDF render even begins.

**Why it happens:**
PDF generation with faithful HTML-to-PDF fidelity is a Chromium problem. Every solution that preserves your existing HTML/CSS styles requires a headless browser. The allure of "just use Puppeteer like we do locally" is strong.

**How to avoid:**
- Use `@react-pdf/renderer` (react-pdf) for PDF generation — it renders PDFs from a React component tree without Chromium. Bundle size is ~5 MB. No cold start penalty.
- Caveat: react-pdf does not render HTML. You must build a separate PDF template as a React component using react-pdf's primitives (`<Document>`, `<Page>`, `<View>`, `<Text>`, `<Image>`). This means the PDF design is a separate implementation from the email/web report design. Budget this time explicitly.
- Alternative: generate PDFs client-side using `@react-pdf/renderer`'s browser bundle. The user triggers PDF generation in their browser, avoiding the serverless constraint entirely. This is the lowest-risk approach for this project given the small internal user base.
- If the exact HTML-to-PDF fidelity is required, use an external service (HTMLCSStoImage.com, WeasyPrint Cloud, or a dedicated containerized microservice on Fly.io) called from the Vercel function via HTTP. Accept the external dependency trade-off.

**Warning signs:**
- Vercel build logs show "Serverless Function has exceeded the unzipped maximum size" when Puppeteer is installed
- Local PDF generation works but deploy fails
- Cold start logs show >5 seconds before the PDF route handler begins executing

**Phase to address:**
PDF export phase — decide client-side vs. react-pdf vs. external service before installing any PDF library. The react-pdf route is strongly preferred for a serverless-first project.

---

### Pitfall 8: react-pdf Font Loading Breaks on Vercel (Relative Path Resolution)

**What goes wrong:**
`react-pdf` requires custom fonts to be registered with `Font.register()`. Locally, relative font paths (`../fonts/Inter.ttf`) resolve correctly. On Vercel serverless, the working directory is different — relative paths fail silently or throw `ENOENT`. When a font fails to load, react-pdf falls back to Helvetica, but this failure is silent: the PDF generates successfully with the wrong font. Custom fonts using OpenType Variable format (e.g., Inter Variable) are unsupported by the PDF 2.0 spec and will silently fail.

**Why it happens:**
Font loading works on the developer's machine because the Node process runs from the project root. Vercel bundles the function differently and the working directory at runtime is not the project root.

**How to avoid:**
- Use absolute paths via `path.join(process.cwd(), 'public/fonts/Inter-Regular.ttf')` — `process.cwd()` is reliable in the Vercel runtime.
- Place font files in `/public/fonts/` so they are always bundled. Do not reference fonts from `node_modules`.
- Alternatively, use `Font.register({ family: 'Inter', src: 'https://yourcdn.com/fonts/Inter-Regular.ttf' })` with a CDN URL — this works in all environments consistently.
- Only use static TTF/OTF font files — never variable fonts.
- Add an assertion in the PDF route: fetch the font URL and check `response.ok` before generating the PDF. Surface a clear error if the font is unreachable.

**Warning signs:**
- PDF generates without errors but text is in Helvetica instead of the intended font
- `Font.register()` call produces no error in serverless but produces wrong output
- PDF generation times out intermittently (font fetch hitting a cold CDN)

**Phase to address:**
PDF export phase — validate font loading in a staging deployment before building the full PDF template.

---

### Pitfall 9: Conversational AI Report Scoping Loses Context Between Vercel Function Invocations

**What goes wrong:**
The ad hoc report creation feature requires a multi-turn AI conversation: "What period should this cover?" → user responds → "Which brands?" → user responds → "Should I include benchmarking?" → etc. Vercel serverless functions are stateless — each tRPC mutation call is a new function invocation with no shared memory. If conversation history is stored only in React component state on the client, a page refresh loses all context. If history is stored in the Claude API call as a `messages` array but never persisted to the database, resuming the conversation from a different browser tab is impossible.

**Why it happens:**
Multi-turn chat is natural in a browser-only context where state persists in memory. Developers build the conversation flow working locally, where it "just works," then discover in production that Vercel's stateless model breaks any assumption of in-process state.

**How to avoid:**
- Persist conversation history in the database immediately. Add a `ReportConversation` model with `{ id, reportId?, messages: Json, phase: String, createdAt, updatedAt }`. Write each turn before calling Claude.
- The tRPC mutation for each conversation turn receives `conversationId` and `userMessage`, loads full message history from DB, appends the new message, calls Claude, appends Claude's response, writes back to DB, returns the response.
- Do not rely on client-side state as the source of truth for conversation history. The DB is the source of truth; the client reflects it.
- Cap stored conversation history at the last 20 turns (truncate oldest) before building the Claude `messages` array to prevent context window overflow.

**Warning signs:**
- Refreshing the report creation modal loses all conversation progress
- The AI "forgets" what the user said in turn 2 when responding in turn 5
- `messages` array passed to Claude grows unbounded across a long conversation
- Error logs show `context_length_exceeded` from the Anthropic API

**Phase to address:**
Conversational AI report creation phase — design the `ReportConversation` DB model before writing any chat UI.

---

### Pitfall 10: Benchmarking Queries Load All PostMetrics Rows Into Memory

**What goes wrong:**
The existing `reports.getBenchmarks` query loads all `PostMetrics` rows for 6 months without a row limit. Currently this is tolerable because the table is small. A benchmarking report that compares WoW, MoM, QoQ, and YoY deltas for 3 brands fetches data from `PostMetrics`, `CompetitorMetrics`, `AccountMetrics`, and `ListeningHit` simultaneously. With 15-minute polling on `PostMetrics`, a 3-brand setup accumulates ~8,000–12,000 rows per month. A quarterly benchmark fetches ~25,000–35,000 rows in a single query. At this scale, the Prisma query returns a JSON object of several MB, the Vercel function hits its memory ceiling (512 MB default), and the function times out.

**Why it happens:**
The existing `getBenchmarks` pattern (load-all-and-aggregate-in-JS) is correct for the current 6-month × single-brand scope. The report center milestone extends this to multi-brand, multi-period comparisons. The `for` loop aggregation approach does not scale to larger datasets.

**How to avoid:**
- Move all benchmark aggregation to the database layer using Prisma raw queries or `$queryRaw` with `GROUP BY`. Pre-aggregate at the `YYYY-MM` (monthly) or `YYYY-WW` (weekly) level. Return ~12–52 rows per metric per brand, not 30,000 individual metric snapshots.
- Create a `BenchmarkSnapshot` model or use Vercel KV to cache pre-aggregated monthly benchmarks. A nightly `aggregate-benchmarks` cron (add to `vercel.json`) computes and stores these; the report endpoint reads from the cache, not raw tables.
- For the existing `getBenchmarks` query in `lib/routers/reports.js`: add `take: 5000` as a safety limit immediately, before the report center work begins. This prevents a runaway query from causing an outage on the existing benchmarks page.

**Warning signs:**
- `getBenchmarks` query response time increases week-over-week
- Vercel function memory warnings in logs for the reports router
- Report generation times out specifically on the benchmarking step
- `postMetrics` or `accountMetrics` Prisma queries return more than 10,000 rows

**Phase to address:**
Benchmarking phase — implement the pre-aggregation cron and `BenchmarkSnapshot` model (or KV cache) before adding cross-period delta comparisons.

---

### Pitfall 11: AI Report Context Stuffed With Raw Rows Instead of Pre-Aggregated Summaries

**What goes wrong:**
The current `generateWeeklyReport` in `lib/ai/reports.js` passes raw `PostMetrics`, `mentions`, and `listeningHits` arrays to Claude. For a weekly report with modest data this is fine. A monthly report covering 30 days of 3 brands produces hundreds of post objects and thousands of listening hits. Passing raw rows as JSON context bloats the Claude API call to 50,000+ input tokens on Claude Haiku (≈$0.05/call for context alone), degrades output quality (model struggles with very long unstructured context), and risks hitting the 200K context window with no graceful degradation.

**Why it happens:**
The existing pattern works for the current weekly cadence and single-brand scope. The report center milestone requires monthly, quarterly, and yearly reports that cover far more data. The natural extension is to increase the date range in the same query — this silently multiplies the context size.

**How to avoid:**
- Pre-aggregate data before building the Claude context. Pass summaries, not rows: `{ totalImpressions: 1240000, topPost: { content: '...', impressions: 45000 }, sentimentBreakdown: { positive: 62, neutral: 28, negative: 10 } }` instead of 200 post objects.
- For the AI context object, cap: top 5 posts by engagement, last 50 listening hits by `heuristicScore`, aggregated competitor metrics (not individual `CompetitorMetrics` rows). Add explicit slicing before every `generateInsight` call.
- Add a token estimate guard: `JSON.stringify(context).length > 50_000` should trigger a warning log and automatic reduction of the context payload.

**Warning signs:**
- Claude API call logs show input token counts above 20,000 for a single report
- AI-generated executive summaries repeat the same data points verbatim instead of synthesizing
- Report generation costs increase significantly without a proportional increase in report quality
- `context_length_exceeded` error from the Anthropic API on quarterly/yearly reports

**Phase to address:**
Report generation phase — establish the pre-aggregation contract (what summarized shape goes into each report type's Claude context) before writing any new report generation functions.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Embed QuickChart GET URLs directly in email `<img>` tags | Fast to ship, no CDN needed | Breaks for charts with >6 data series; chart images missing in many email clients | Never — use POST + short URL or POST + host PNG from day one |
| Generate PDFs with Puppeteer/Chromium on Vercel | Pixel-perfect HTML-to-PDF output | Bundle size exceeds 50 MB limit; deployment fails | Never on Vercel serverless; only acceptable if moving to a dedicated container |
| Persist AI conversation state in React component state only | Zero DB schema changes | Page refresh loses conversation; no cross-device resume | Only in a throwaway demo, never in production |
| Load all PostMetrics rows for benchmarking and aggregate in JS | Simpler query code | OOM on Vercel function at scale; query timeouts | Only for datasets <1,000 rows; add `take` limit immediately |
| Skip idempotency guard on scheduled report cron | Fewer KV dependencies | Duplicate reports on double-delivery; duplicate emails to users | Never — Vercel documents double-delivery as possible |
| Email full report HTML (5 charts + full summary) without size check | Complete information in email | Gmail clips at 102 KB; stakeholders see broken email | Only if all stakeholders are confirmed Apple Mail / non-Gmail users |
| Store full message history in KV instead of DB | Simpler schema | KV TTLs evict conversation history; hard to query conversation state | Never for user-visible conversation state that must be durable |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| QuickChart.io | Embed GET chart URL directly in email HTML | POST chart config server-side, receive PNG, upload to Vercel Blob or use `/chart/create` short URL |
| QuickChart.io | Use JavaScript function strings in Chart.js config via GET request | JavaScript functions in Chart.js config require POST with chart as a `string` (not JSON object) — GET requests cannot execute JS |
| QuickChart.io free plan | Assume no rate limits for report batch generation | Free plan: 120 requests/minute. A monthly report with 8 charts sent to 3 recipients = 24 chart renders. Batching multiple reports simultaneously can hit the cap. Use a paid plan or serialize chart generation. |
| Slack Incoming Webhook | Post full report text (AI summary + all KPIs) in a single message | AI summaries > 3,000 chars are silently truncated. Use `text.substring(0, 2900)` and always provide a "View Full Report" button. |
| Slack Incoming Webhook | Use `color` parameter from legacy attachments in Block Kit message | `color` has no Block Kit equivalent. Use header blocks with emoji or section-level visual differentiation instead. |
| Resend / SendGrid email API | Embed chart PNG as base64 inline in email HTML | Base64 blows up email size by 33%, triggering Gmail's 102 KB clip. Host chart PNGs at a public URL and reference via `<img src="...">`. |
| react-pdf `Font.register()` | Pass relative font path (`./fonts/Inter.ttf`) | Use `path.join(process.cwd(), 'public/fonts/Inter-Regular.ttf')` or a CDN URL. Relative paths fail on Vercel serverless. |
| Anthropic SDK (report generation) | Pass raw Prisma result arrays as Claude context | Always pre-aggregate before building the `context` object. Raw rows produce token bloat and degrade output quality. |
| Vercel KV | Use KV TTL as the only idempotency mechanism for report generation | KV can have outages or cold misses. Combine KV lock with a DB `findFirst` deduplication check. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `PostMetrics` full-table scan for benchmarking | Report generation times out; Vercel function OOM | Add `take` limit now; implement nightly `BenchmarkSnapshot` cron before adding multi-period comparisons | ~10,000+ rows (roughly 1 brand × 3 months with 15-min polling) |
| Generating all scheduled reports in a single cron invocation | Some brands get reports, others do not; function times out | One cron route per cadence type; never fan out to all brands inside a single invocation | >2 brands or >monthly cadence |
| Sequential chart generation (8 charts × 200ms QuickChart latency = 1.6s) | Report generation bottleneck; approaches function timeout with many charts | Use `Promise.all()` to generate all charts in parallel; cap at 8 concurrent requests to QuickChart | Any report with >3 charts on a slow network |
| Context window grows unbounded in long AI conversations | `context_length_exceeded` from Anthropic API | Truncate to last 20 turns before building the `messages` array; summarize older turns into a compact string | Conversations with >15 exchanges (common if user is iterating on report scope) |
| Benchmark delta computation re-fetches base period data on every report view | Report detail page slow to load; repeated DB queries for the same historical data | Cache computed deltas (WoW, MoM) in the `Report.content` JSON at generation time, not at view time | Any report viewed more than once |
| `listeningHit.findMany` without `take` limit in report data assembly | Query returns tens of thousands of rows; Node.js heap pressure | Always add `take: 200, orderBy: { heuristicScore: 'desc' }` when fetching listening hits for reports | Topics with >1,000 hits in the report window |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Scheduled report cron endpoint lacks `CRON_SECRET` check | Any unauthenticated caller can trigger report generation, burning Claude API quota and creating junk reports | Follow the existing `verifyCronAuth(request)` pattern from `lib/cron-auth.js` — every new cron route must call this before doing any work |
| Report email delivery endpoint accessible without auth | Attacker can trigger email sends to arbitrary recipients | All delivery tRPC mutations must use `protectedProcedure`; email recipient list must be read from `User` table, never from client-provided input |
| PDF export route exposes report to unauthenticated users | Any user with a report ID URL can download the PDF | Add session check in the PDF route handler; do not use predictable sequential IDs for reports (CUID is already the default) |
| AI conversation stores full user message history in plaintext JSON | Conversation content may include sensitive business information not intended for logging | Apply the same redaction policy to `ReportConversation.messages` as to `APICallLog` — flag as sensitive, restrict admin access |
| Slack webhook URL stored in environment variable without rotation | Compromised webhook URL allows attacker to post to team Slack | Store webhook URL in `SLACK_WEBHOOK_URL` env var (already standard); add a `enabled: true` check to prevent accidental sends in preview deployments |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Report generation cron completes silently — user has no idea a new report was created | Team misses scheduled reports; defeats the purpose of automation | Show an in-app notification or unread badge on the Reports page whenever a new scheduled report is created; consider a Slack notification even if email is disabled |
| AI conversation for ad hoc report has no progress indicator | User submits a scoping request, sees nothing for 3–8 seconds while Claude responds | Show a typing indicator immediately on user submit; stream Claude's response if using the streaming API variant |
| Benchmark comparison shows delta numbers ("+14%") without context | User does not know if +14% is good, bad, or neutral without prior period labels | Always display delta with both values: "Engagement Rate: 3.2% vs 2.8% last month (+14%)" — never delta-only |
| PDF export button triggers a slow server-side generation with no feedback | User clicks PDF export, nothing happens for 4–10 seconds, then either PDF downloads or an error appears | Disable the button immediately on click, show "Generating PDF..." spinner, and handle error state explicitly |
| Scheduled reports delivered to email without a "Manage Preferences" link | Recipients cannot opt out; may have left the team | Always include an in-app "Manage report subscriptions" link in every scheduled email; use `User.id` as the identifier, not email address |

---

## "Looks Done But Isn't" Checklist

- [ ] **Scheduled report generation:** Test with all 3 brands active simultaneously — verify one `Report` record per brand per cadence is created, not one shared report
- [ ] **Cron idempotency:** Trigger the same cron route twice within 30 seconds — verify only one `Report` record is created (not two)
- [ ] **Chart-in-email:** Send a test report email to a real Gmail account and a real Outlook account — verify charts appear as images (not broken `<img>` tags)
- [ ] **Email size:** Assert `Buffer.byteLength(emailHtml, 'utf8') < 81920` (80 KB) in CI before a report email is sent
- [ ] **Slack delivery:** Post a report message to a real Slack channel — verify all blocks render and image blocks show chart images (not loading spinners)
- [ ] **PDF generation:** Trigger PDF export in a Vercel preview deployment (not local) — verify fonts render correctly (not default Helvetica fallback)
- [ ] **AI conversation persistence:** Start a scoping conversation, refresh the page, return to the conversation — verify all prior turns are shown and Claude responds with full context
- [ ] **Benchmarking query safety:** Add `take: 5000` safety cap to all raw `PostMetrics` and `ListeningHit` queries used in report generation — verify this is present before shipping
- [ ] **Cron not running in Preview:** Confirm scheduled reports do NOT fire on Vercel Preview deployments (Vercel only runs crons on Production)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate reports from double-fired cron | LOW | Identify duplicates by `reportType + createdAt` clustering; soft-delete duplicates via admin mutation; add idempotency guard before next run |
| Chart images broken in delivered emails | MEDIUM | Re-send affected reports via the manual "Share report" flow with corrected chart URLs; no data fix needed |
| Benchmarking query caused Vercel OOM | MEDIUM | Add `take: 5000` to the offending query immediately; roll back to the last deploy; add a nightly aggregation cron before re-enabling the feature |
| react-pdf font failure (wrong font in PDF) | LOW | Update font registration to use CDN URL or `process.cwd()` absolute path; re-trigger PDF generation for affected reports |
| AI conversation history lost (page refresh) | MEDIUM | If `ReportConversation` DB model not yet built: implement it; retroactively these sessions are unrecoverable — notify affected users they must restart the conversation |
| Slack webhook URL accidentally sent to wrong channel | LOW | Rotate the webhook URL in Slack admin; update `SLACK_WEBHOOK_URL` env var in Vercel; verify no messages sent to incorrect channel after rotation |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cron timeout mid-generation | Scheduled report cron — architecture | Time a full multi-brand generation run in staging with `maxDuration` set; confirm all brands produce reports |
| Duplicate report from double-fired cron | Scheduled report cron — idempotency | Trigger the cron route twice within 1 minute; confirm only 1 report created |
| QuickChart GET URL breaks in email | Chart integration — POST-first pattern | Send test email with 6-series chart to Gmail; verify image renders |
| Outlook email layout breaks | Email delivery — MJML/React Email choice | Send to Outlook (Word engine) and new Outlook (Chromium); both must render correctly |
| Gmail 102 KB clip | Email delivery — content architecture | Assert email HTML byte count < 80 KB in a test before shipping |
| Slack payload over 1 MB | Slack delivery — digest design | Validate `JSON.stringify(blocks).length < 900_000` in the delivery function |
| Puppeteer bundle size error | PDF export — library selection | Deploy to Vercel staging with the chosen PDF library before building the PDF template |
| react-pdf font path failure | PDF export — font configuration | Generate a PDF in a Vercel Preview deployment; verify font is correct before building full template |
| Conversation state lost on refresh | AI conversation — DB persistence | Refresh the conversation UI mid-conversation; verify all turns survive |
| Benchmarking query OOM | Benchmarking phase — pre-aggregation | Load test the benchmarks query with 90 days of PostMetrics data (can be seeded) |
| AI context token bloat | Report generation — context contracts | Log input token count for each report type; assert < 20,000 tokens in CI |

---

## Sources

- Direct codebase review: `lib/routers/reports.js`, `lib/ai/reports.js`, `lib/redis.js`, `app/api/cron/weekly-ai-insights/route.js`, `vercel.json`, `prisma/schema.prisma`
- [Vercel Function Timeouts — What Can I Do About Timeouts?](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out): maxDuration, Fluid Compute, plan limits
- [Vercel Limits](https://vercel.com/docs/limits): function size cap (50 MB unzipped), memory, duration by plan
- [Vercel Cron Jobs — Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs): duplicate delivery, idempotency, CRON_SECRET
- [Vercel Cron Troubleshooting](https://vercel.com/kb/guide/troubleshooting-vercel-cron-jobs): force-dynamic, production-only execution, no redirect support
- [Upstash Blog — Get Rid of Vercel Timeouts](https://upstash.com/blog/vercel-cost-workflow): batching strategies for long-running serverless jobs
- [QuickChart POST Endpoint documentation](https://quickchart.io/documentation/usage/post-endpoint/): POST vs GET, JS function string requirement
- [QuickChart URL Length GitHub Issue #102](https://github.com/typpo/quickchart/issues/102): browser URL length limitations documented
- [QuickChart Short URLs](https://quickchart.io/documentation/usage/short-urls-and-templates/): 6-month expiry, `/chart/create` endpoint
- [Slack Block Kit Reference — Blocks](https://docs.slack.dev/reference/block-kit/blocks/): 50-block limit, table-only-one-per-message, `plain_text`-only fields
- [Slack Formatting Message Text](https://docs.slack.dev/messaging/formatting-message-text/): mrkdwn character limits, HTML entity escaping
- [Slack Incoming Webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/): 1 MB payload limit
- [Gmail 102 KB Clipping — Email Rendering Issues](https://www.maildesigner365.com/common-email-rendering-issues-and-fixes/): Gmail and Yahoo clip thresholds
- [Outlook Dual Rendering Engine — Why Does My Outlook Look Different? (2025)](https://mailsoftly.com/blog/why-does-my-outlook-look-different/): Word engine vs Chromium Outlook coexistence through 2027–2028
- [Dark Mode Email — Complete Guide (2026)](https://dev.to/aoifecarrigan/the-complete-guide-to-email-client-rendering-differences-in-2026-243f): Gmail partial inversion, Outlook color inversion, Apple Mail WebKit behavior
- [Litmus — Ultimate Guide to Dark Mode for Email](https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers): transparent logo inversion
- [Vercel + Puppeteer bundle size — DEV Community](https://dev.to/harshvats2000/creating-a-nextjs-api-to-convert-html-to-pdf-with-puppeteer-vercel-compatible-16fc): 50 MB unzipped limit, @sparticuz/chromium-min approach
- [react-pdf font loading GitHub issues #409, #2675, #2460](https://github.com/diegomura/react-pdf/issues/409): relative path failures on Vercel, variable font incompatibility, silent font loading failures
- [PDFKit Helvetica.afm missing in Next.js — GitHub Issue #1549](https://github.com/foliojs/pdfkit/issues/1549): virtual file system font resolution failures
- [Multi-Turn AI Accuracy Degradation — eesel.ai practical guide](https://www.eesel.ai/blog/multi-turn-ai-conversations): 95% single-turn accuracy → collapse in multi-turn chained flows
- [Conversational AI State Management — Building Multi-Turn Agents (2026)](https://medium.com/ai-simplified-in-plain-english/building-multi-turn-conversations-with-ai-agents-the-2026-playbook-45592425d1db): stateless serverless architecture incompatibility with conversation context

---
*Pitfalls research for: Report Center v1.1 — scheduled reports, server-side charts, PDF export, email/Slack delivery, conversational AI, benchmarking on Vercel serverless*
*Researched: 2026-03-15*
