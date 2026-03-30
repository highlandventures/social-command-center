# Phase 7: Scheduling + Ad Hoc Reports - Research

**Researched:** 2026-03-16
**Domain:** Cron scheduling, conversational AI chat, Vercel serverless constraints
**Confidence:** HIGH

## Summary

Phase 7 has two distinct halves: (1) a scheduling system for automated report generation and email delivery, and (2) a conversational AI chat interface for ad hoc report scoping. Both build heavily on existing infrastructure -- the report engine (Phase 5), email sender (Phase 6), and the copilot streaming chat (Phase 4) are all already implemented and proven.

The scheduling system requires new Prisma models (`ReportSchedule`, `AdHocReport`, `AdHocReportChat`), a new Vercel cron route that checks `nextRunAt`, and CRUD UI for managing schedules. The ad hoc chat reuses the Phase 4 streaming pattern (Vercel AI SDK `streamText` + `useChat`) with a report-scoping system prompt instead of the copilot system prompt. Chat persistence uses a new model rather than extending the existing `CopilotThread`/`CopilotMessage` models, since the conversation context and lifecycle differ significantly.

The key architectural decision from Phase 5 research (already locked in STATE.md) is: "Single Vercel cron checks all due schedules via nextRunAt field." This means one cron route queries for all schedules where `nextRunAt <= now() AND enabled = true`, generates reports, sends emails, and advances `nextRunAt`. This pattern is already used by 11 existing cron routes in the project.

**Primary recommendation:** Implement scheduling as a single cron route + tRPC CRUD, and ad hoc chat as a separate streaming API route mirroring the Phase 4 copilot pattern. Store ad hoc chat state server-side in the database (not localStorage) to satisfy the persistence-across-refresh requirement.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHED-01 | Create report schedule with weekly/monthly/quarterly/yearly cadence | ReportSchedule Prisma model with `cadence` enum, tRPC `schedules.create` mutation |
| SCHED-02 | Scheduled reports auto-generate at configured cadence | Vercel cron route `/api/cron/run-schedules` queries `nextRunAt <= now()`, calls `generateEnrichedReport()`, advances `nextRunAt` |
| SCHED-03 | Enable/disable, edit, delete report schedules | tRPC CRUD mutations (`schedules.update`, `schedules.delete`, `schedules.toggle`) |
| SCHED-04 | View schedule status (next run, last run, link to latest report) | tRPC `schedules.list` query returning all fields including `lastReportId` for link |
| DIST-01 | Scheduled reports auto-deliver via email | Cron route calls existing `sendReportEmail()` after generation, using per-schedule recipients |
| DIST-03 | Configure email recipients per schedule | `recipients` JSON field on ReportSchedule model, editable in schedule form |
| ADHC-01 | Create ad hoc reports through in-app chat interface | New streaming API route `/api/adhoc-report/chat` with report-scoping system prompt |
| ADHC-02 | AI asks clarifying questions to scope report | System prompt instructs AI to ask about time range, metrics focus, comparison baseline before generating |
| ADHC-03 | Snapshot re-runs at configured intervals | `snapshotIntervals` JSON field on AdHocReport, cron checks for pending snapshots |
| ADHC-04 | Manual re-trigger via "Re-run" button | tRPC `adhocReports.rerun` mutation calls `generateEnrichedReport()` with stored params |
| ADHC-05 | Chat conversation state persists across page refreshes | `AdHocReportChat` model stores messages server-side, loaded on mount via tRPC query |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vercel Cron | N/A (platform) | Scheduled execution | Already used by 11 cron routes in project |
| @ai-sdk/anthropic | ^3.0.58 | Claude API for chat | Already used by copilot (Phase 4) |
| ai | ^6.0.116 | `streamText` + `useChat` | Already used by copilot streaming |
| nodemailer | ^7.0.13 | Email sending | Already used by Phase 6 email-sender |
| @react-email/components | ^1.0.9 | Email templates | Already used by Phase 6 |
| zod | ^3.23.0 | Input validation | Already used throughout project |
| zustand | ^4.5.0 | Client state management | Already installed, unused for this -- stick with React state + tRPC |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @trpc/server | ^10.45.0 | API layer | All CRUD operations for schedules and ad hoc reports |
| @prisma/client | ^5.14.0 | Database ORM | New models for schedules and ad hoc reports |

### No New Dependencies Required
This phase requires zero new npm installations. All needed libraries are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
prisma/
  schema.prisma              # Add ReportSchedule, AdHocReport, AdHocReportChat models
app/api/
  cron/
    run-schedules/route.js   # NEW: Cron route for scheduled report generation
  adhoc-report/
    chat/route.js            # NEW: Streaming chat API for ad hoc scoping
lib/
  routers/
    schedules.js             # NEW: tRPC router for schedule CRUD
    adhoc-reports.js         # NEW: tRPC router for ad hoc report CRUD
  adhoc/
    system-prompt.js         # NEW: System prompt for ad hoc report scoping AI
    param-extractor.js       # NEW: Extract report params from completed conversation
app/(dashboard)/
  reports/
    schedules/page.jsx       # NEW: Schedule management UI
    adhoc/page.jsx           # NEW: Ad hoc report chat UI
```

### Pattern 1: Vercel Cron with nextRunAt Polling
**What:** A single cron route runs on a fixed schedule (e.g., every 15 minutes), queries for all ReportSchedule rows where `nextRunAt <= now() AND enabled = true`, processes them, and advances `nextRunAt`.
**When to use:** For all scheduled report generation.
**Example:**
```javascript
// app/api/cron/run-schedules/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { generateEnrichedReport } from '@/lib/report-engine';
import { sendReportEmail } from '@/lib/email-sender';
import { renderReportPDF } from '@/lib/pdf-renderer.jsx';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min for Pro plan

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const dueSchedules = await prisma.reportSchedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
  });

  const results = { processed: 0, errors: [] };

  for (const schedule of dueSchedules) {
    try {
      // Compute date range from cadence
      const { dateStart, dateEnd } = computeDateRange(schedule.cadence, now);
      const benchmarkPeriod = getPreviousPeriod(dateStart, dateEnd);

      // Generate report using existing engine
      const content = await generateEnrichedReport({
        reportType: cadenceToReportType(schedule.cadence),
        dateStart,
        dateEnd,
        benchmarkPeriod,
      });

      // Save report
      const report = await prisma.report.create({
        data: {
          title: `${schedule.name} - ${now.toLocaleDateString()}`,
          reportType: cadenceToReportType(schedule.cadence),
          content,
          aiPct: 95,
          createdById: schedule.createdById,
          status: 'READY',
          chartUrls: content.charts?.map(c => ({ id: c.id, label: c.label, imageUrl: c.imageUrl })) || [],
          coveragePeriod: content.coveragePeriod,
          benchmarkPeriod: content.benchmarkPeriod,
        },
      });

      // Auto-email if recipients configured
      const recipients = schedule.recipients || [];
      if (recipients.length > 0) {
        const pdfBuffer = await renderReportPDF(report);
        await sendReportEmail({
          report,
          recipients,
          pdfBuffer,
          appUrl: process.env.NEXTAUTH_URL || 'https://app.socialcommand.com',
        });

        await prisma.reportDelivery.create({
          data: { reportId: report.id, channel: 'EMAIL', recipients: JSON.stringify(recipients), status: 'SENT' },
        });
      }

      // Advance nextRunAt
      await prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          lastReportId: report.id,
          nextRunAt: computeNextRun(schedule.cadence, now),
        },
      });

      results.processed++;
    } catch (err) {
      results.errors.push({ scheduleId: schedule.id, error: err.message });
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
```

### Pattern 2: Streaming Chat for Ad Hoc Report Scoping
**What:** Reuse the Phase 4 copilot streaming pattern (`streamText` + `useChat`) with a report-focused system prompt that guides the AI through clarifying questions before generating a report.
**When to use:** For the ad hoc report chat interface.
**Example:**
```javascript
// app/api/adhoc-report/chat/route.js
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ADHOC_SYSTEM_PROMPT } from '@/lib/adhoc/system-prompt';

export const maxDuration = 60;

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messages, chatId } = await req.json();

  // Persist messages to AdHocReportChat
  let activeChatId = chatId;
  // ... (same thread creation pattern as copilot)

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: ADHOC_SYSTEM_PROMPT,
    messages,
    maxTokens: 2048,
    async onFinish({ text }) {
      await prisma.adHocReportChat.create({
        data: { chatId: activeChatId, role: 'assistant', content: text },
      });
    },
  });

  return result.toDataStreamResponse();
}
```

### Pattern 3: Server-Side Chat Persistence (ADHC-05)
**What:** Store ad hoc chat messages in the database (not localStorage) and load them on page mount. The `useChat` hook from `ai/react` accepts an `initialMessages` prop.
**When to use:** To satisfy the "persists across page refreshes" requirement.
**Example:**
```javascript
// Frontend: load existing messages, pass to useChat
const chatMessagesQ = trpc.adhocReports.getChatMessages.useQuery({ chatId });

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/adhoc-report/chat',
  initialMessages: chatMessagesQ.data || [],
  body: { chatId },
});
```

### Pattern 4: nextRunAt Computation
**What:** Pure function that computes the next run timestamp from cadence and current time.
**When to use:** When advancing schedule after execution and when creating/editing a schedule.
**Example:**
```javascript
export function computeNextRun(cadence, fromDate = new Date()) {
  const next = new Date(fromDate);
  switch (cadence) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}
```

### Anti-Patterns to Avoid
- **node-cron / setInterval in serverless:** Never use in-process schedulers on Vercel. The process dies after each request. Use Vercel's built-in cron via vercel.json.
- **Storing chat in localStorage for persistence:** Would not work across devices, could be cleared by browser, and violates server-as-source-of-truth pattern. Use DB-backed persistence.
- **Single cron per schedule:** Do not create a separate vercel.json cron entry per user schedule. Use one polling cron that checks all due schedules.
- **Blocking cron with long AI generation:** If a single report takes 30+ seconds, processing multiple schedules sequentially could timeout. Process in batches and consider parallel execution with `Promise.allSettled`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron expression parsing | Custom cron parser | Simple `cadence` enum + `computeNextRun()` | Users select from fixed cadences, not arbitrary cron expressions |
| Chat streaming | Custom SSE implementation | Vercel AI SDK `streamText` + `useChat` | Already proven in Phase 4, handles reconnection, parsing |
| Email delivery | Custom SMTP handling | Existing `sendReportEmail()` from Phase 6 | Already handles PDF attachment, React Email templates, error logging |
| Report generation | New report engine | Existing `generateEnrichedReport()` from Phase 5 | Already handles KPIs, charts, AI summary, delta calculation |
| PDF rendering | New PDF renderer | Existing `renderReportPDF()` from Phase 6 | Already handles chart images as base64, branded layout |

**Key insight:** Phase 7 is primarily about orchestration and UI. Almost all heavy lifting (report generation, PDF, email, AI streaming) is already implemented. The new code is mostly Prisma models, tRPC CRUD, a cron route, and React UI components.

## Common Pitfalls

### Pitfall 1: Vercel Cron Timeout on Multiple Schedules
**What goes wrong:** If 5+ schedules are due simultaneously and each report takes 30-60 seconds to generate (AI + charts), the cron function hits the 300-second timeout.
**Why it happens:** Sequential processing of multiple heavy operations.
**How to avoid:** Process schedules with `Promise.allSettled` for parallelism, but cap concurrency (e.g., max 3 concurrent) to avoid rate-limiting QuickChart.io (60-120 req/min). If more are due, process remaining on next cron invocation by only taking first N.
**Warning signs:** Cron invocation logs showing 504 timeout errors.

### Pitfall 2: Cron Idempotency / Double Execution
**What goes wrong:** Vercel can deliver the same cron event twice, generating duplicate reports.
**Why it happens:** Vercel's event-driven system can occasionally deliver duplicate events.
**How to avoid:** Use `lastRunAt` timestamp check -- if `lastRunAt` is within the cron interval, skip. Or use a simple lock: set a `processing` flag on the schedule before starting, clear on finish.
**Warning signs:** Duplicate reports appearing at the same timestamp.

### Pitfall 3: Ad Hoc Chat Not Persisting on Navigation
**What goes wrong:** User navigates away from ad hoc page and loses conversation.
**Why it happens:** React state is destroyed on unmount. `useChat` state is ephemeral.
**How to avoid:** Save every message to DB in `onFinish` callback (assistant) and before streaming call (user). Load from DB on mount via `initialMessages`.
**Warning signs:** User refreshes page and sees empty chat.

### Pitfall 4: Hobby Plan Cron Frequency
**What goes wrong:** On Hobby plan, cron jobs can only run once per day, so report scheduling frequency is limited.
**Why it happens:** Vercel Hobby tier restriction.
**How to avoid:** For Pro plan, set cron to `*/15 * * * *` (every 15 minutes). For Hobby, set to `0 6 * * *` (daily). Document this limitation. The `nextRunAt` pattern still works -- daily cron catches up on all overdue schedules.
**Warning signs:** Deployment fails with "Hobby accounts are limited to daily cron jobs."

### Pitfall 5: Snapshot Re-run Scheduling
**What goes wrong:** Ad hoc report snapshot re-runs (24h, 48h marks) need to be checked somewhere.
**Why it happens:** Re-runs need a trigger mechanism.
**How to avoid:** Piggyback on the same `run-schedules` cron. Query for `AdHocReport` rows where `nextSnapshotAt <= now()`. Process alongside regular schedules.
**Warning signs:** Snapshot re-runs never fire.

## Code Examples

### Prisma Schema Extension
```prisma
// New models for Phase 7

enum Cadence {
  WEEKLY
  MONTHLY
  QUARTERLY
  YEARLY
}

model ReportSchedule {
  id           String   @id @default(cuid())
  name         String
  cadence      Cadence
  reportType   ReportType @default(WEEKLY_PERFORMANCE)
  enabled      Boolean  @default(true)
  recipients   Json     @default("[]") // JSON array of email strings
  createdById  String
  nextRunAt    DateTime
  lastRunAt    DateTime?
  lastReportId String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([enabled, nextRunAt])
  @@map("report_schedules")
}

model AdHocReport {
  id                String    @id @default(cuid())
  title             String?
  reportId          String?   // Link to generated Report
  status            String    @default("SCOPING") // SCOPING, GENERATING, READY, FAILED
  reportParams      Json?     // { dateStart, dateEnd, metricsScope, comparisonBaseline }
  snapshotIntervals Json?     // [24, 48] hours or null
  nextSnapshotAt    DateTime?
  createdById       String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  messages AdHocReportMessage[]

  @@index([createdById, updatedAt])
  @@map("adhoc_reports")
}

model AdHocReportMessage {
  id          String   @id @default(cuid())
  adHocId     String
  role        String   // 'user' | 'assistant'
  content     String
  createdAt   DateTime @default(now())

  adHocReport AdHocReport @relation(fields: [adHocId], references: [id], onDelete: Cascade)

  @@index([adHocId, createdAt])
  @@map("adhoc_report_messages")
}
```

### Ad Hoc Report System Prompt
```javascript
export const ADHOC_SYSTEM_PROMPT = `You are a report scoping assistant for a social media analytics team. Your job is to help the user define exactly what report they need.

## Your Process
1. When the user describes what they want, ask clarifying questions about:
   - Time range (last week? last month? specific dates?)
   - Metrics focus (engagement? sentiment? followers? all?)
   - Comparison baseline (vs previous period? vs a specific event?)
   - Report type (performance overview? competitive analysis? sentiment deep-dive?)
2. Ask ONE round of clarifying questions (2-3 questions max), then confirm your understanding
3. When the user confirms, output a JSON block with the final parameters:

\`\`\`json
{"action":"generate","params":{"title":"...","dateStart":"YYYY-MM-DD","dateEnd":"YYYY-MM-DD","reportType":"WEEKLY_PERFORMANCE|MONTHLY_SUMMARY|CUSTOM","metricsScope":"all|engagement|sentiment|growth","comparisonBaseline":"previous_period|none"}}
\`\`\`

## Guidelines
- Be concise and direct -- this is a scoping conversation, not a creative writing exercise
- If the user's request is already specific enough, skip clarifying questions and confirm directly
- Always include the JSON block when ready to generate -- the frontend detects this to trigger generation
- If the user changes their mind, update the parameters and re-confirm`;
```

### computeDateRange Helper
```javascript
export function computeDateRange(cadence, referenceDate = new Date()) {
  const end = new Date(referenceDate);
  const start = new Date(referenceDate);

  switch (cadence) {
    case 'WEEKLY':
      start.setDate(start.getDate() - 7);
      break;
    case 'MONTHLY':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'QUARTERLY':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'YEARLY':
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return { dateStart: start, dateEnd: end };
}
```

### vercel.json Addition
```json
{ "path": "/api/cron/run-schedules", "schedule": "*/15 * * * *" }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-cron in process | Vercel platform cron | 2023 | Only option for serverless |
| Arbitrary cron expressions | Fixed cadence enum | N/A (design choice) | Simpler UX, easier nextRunAt computation |
| localStorage chat persistence | DB-backed messages with `initialMessages` | Vercel AI SDK v3+ | Reliable cross-device persistence |
| Custom SSE streaming | Vercel AI SDK `streamText` | 2024-2025 | Handles edge cases, reconnection, token counting |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | vitest.config.js |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHED-01 | Schedule creation with cadence enum | unit | `npx vitest run __tests__/lib/schedules.test.js -t "create"` | Wave 0 |
| SCHED-02 | Cron finds due schedules, generates reports, advances nextRunAt | unit | `npx vitest run __tests__/lib/schedule-runner.test.js -t "process due"` | Wave 0 |
| SCHED-03 | Toggle enable/disable, edit, delete | unit | `npx vitest run __tests__/lib/schedules.test.js -t "toggle\|edit\|delete"` | Wave 0 |
| SCHED-04 | List returns status fields (nextRunAt, lastRunAt, lastReportId) | unit | `npx vitest run __tests__/lib/schedules.test.js -t "list"` | Wave 0 |
| DIST-01 | Cron sends email after generation | unit | `npx vitest run __tests__/lib/schedule-runner.test.js -t "email"` | Wave 0 |
| DIST-03 | Recipients stored per schedule | unit | `npx vitest run __tests__/lib/schedules.test.js -t "recipients"` | Wave 0 |
| ADHC-01 | Chat creates ad hoc report record | unit | `npx vitest run __tests__/lib/adhoc-reports.test.js -t "create"` | Wave 0 |
| ADHC-02 | System prompt includes clarifying question instructions | unit | `npx vitest run __tests__/lib/adhoc/system-prompt.test.js` | Wave 0 |
| ADHC-03 | Snapshot re-run scheduling and execution | unit | `npx vitest run __tests__/lib/adhoc-reports.test.js -t "snapshot"` | Wave 0 |
| ADHC-04 | Re-run mutation regenerates report | unit | `npx vitest run __tests__/lib/adhoc-reports.test.js -t "rerun"` | Wave 0 |
| ADHC-05 | Messages persist and load from DB | unit | `npx vitest run __tests__/lib/adhoc-reports.test.js -t "persist"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/lib/schedules.test.js` -- covers SCHED-01, SCHED-03, SCHED-04, DIST-03
- [ ] `__tests__/lib/schedule-runner.test.js` -- covers SCHED-02, DIST-01 (cron logic)
- [ ] `__tests__/lib/adhoc-reports.test.js` -- covers ADHC-01, ADHC-03, ADHC-04, ADHC-05
- [ ] `__tests__/lib/adhoc/system-prompt.test.js` -- covers ADHC-02

## Open Questions

1. **Cron frequency on current Vercel plan**
   - What we know: Pro allows every-minute crons, Hobby only daily. Project already has 11 cron routes at various frequencies (1min, 5min, etc.) suggesting Pro plan.
   - What's unclear: Exact plan tier. The existing vercel.json has `* * * * *` (every minute) which would fail on Hobby.
   - Recommendation: Assume Pro plan (evidence supports it). Use `*/15 * * * *` for the schedule runner.

2. **Maximum concurrent report generations per cron invocation**
   - What we know: Each report generation involves AI call (10-30s) + chart rendering (2-5s). QuickChart.io has 60-120 req/min free tier limit.
   - What's unclear: How many schedules could realistically be due simultaneously.
   - Recommendation: Cap at 3 concurrent, process rest on next invocation. Log when schedules are deferred.

## Sources

### Primary (HIGH confidence)
- Project codebase: `lib/report-engine.js`, `lib/email-sender.js`, `app/api/copilot/chat/route.js` -- existing patterns
- Project codebase: `prisma/schema.prisma` -- current schema structure
- Project codebase: `vercel.json` -- existing cron configuration (11 routes)
- Project codebase: `lib/cron-auth.js` -- existing cron authentication pattern

### Secondary (MEDIUM confidence)
- [Vercel Cron Jobs Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- Plan limits, frequency restrictions
- [Vercel Cron Jobs Docs](https://vercel.com/docs/cron-jobs) -- Configuration, idempotency, concurrency warnings
- [Vercel Function Timeouts](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out) -- maxDuration limits per plan

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and used in project
- Architecture: HIGH - scheduling pattern already decided in STATE.md, chat pattern proven in Phase 4
- Pitfalls: HIGH - Vercel cron limitations well-documented, patterns verified against existing codebase

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable patterns, no fast-moving dependencies)
