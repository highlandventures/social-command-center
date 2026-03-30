# Phase 8: Benchmarking - Research

**Researched:** 2026-03-16
**Domain:** Period-over-period comparison engine + milestone CRUD + benchmark UI
**Confidence:** HIGH

## Summary

Phase 8 completes the v1.1 Report Center milestone by adding period-over-period benchmarking and custom milestone management. The codebase already has substantial infrastructure for this: the report engine (`lib/report-engine.js`) contains working `calculateDelta()`, `getPreviousPeriod()`, and `generateEnrichedReport()` functions that accept a `benchmarkPeriod` parameter. The Prisma schema stores `benchmarkPeriod` JSON on each Report record. The `KPICard` and `DeltaArrow` UI components already render delta values with directional indicators. What is missing is: (1) a way for users to select comparison periods on existing reports, (2) a Milestone Prisma model for named events/campaigns, (3) tRPC CRUD for milestones, and (4) a UI for milestone management and benchmark selection.

The key architectural insight is that this phase is mostly **wiring and UI** -- the heavy computation (KPI calculation, delta math, chart rendering) already exists. The report engine's `generateEnrichedReport()` already computes deltas when `benchmarkPeriod` is provided. For existing reports, we need a re-generation or overlay approach: either re-run the engine with a new benchmark period, or compute deltas client-side from stored KPI snapshots.

**Primary recommendation:** Add a `Milestone` Prisma model, create a milestones tRPC router for CRUD, add a benchmark comparison selector to the report detail page, and extend the report generation flow to accept milestone-based benchmark periods. Reuse all existing delta infrastructure -- do not rebuild calculation logic.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BNCH-01 | Team can compare report metrics against a previous equivalent period (WoW, MoM, QoQ, YoY) | Existing `getPreviousPeriod()` and `calculateDelta()` in report-engine.js. `generateEnrichedReport()` already accepts `benchmarkPeriod` param. Need UI selector for comparison period type and a re-compare mutation. |
| BNCH-02 | Team can create named milestones (product launches, events) with start/end dates | Need new `Milestone` Prisma model and tRPC CRUD router. No existing model -- must add via migration. |
| BNCH-03 | Team can benchmark a report against a named milestone's time period | Combine milestone lookup (date range) with existing `generateEnrichedReport({ benchmarkPeriod })`. Need tRPC endpoint that resolves milestone ID to date range and triggers comparison. |
| BNCH-04 | Benchmark comparisons show absolute values and percentage deltas with directional indicators | Existing `KPICard` component renders `delta`, `direction` props. `DeltaArrow` shows green up / red down / flat. Already implemented in Phase 5. Need to ensure all benchmark paths populate these fields. |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | In project | ORM, schema migrations | Already used for all models |
| tRPC v10 | In project | Type-safe API routes | All routers follow this pattern |
| Zod | In project | Input validation | Used in every tRPC procedure |
| React (Next.js App Router) | In project | Frontend framework | Client components with 'use client' |
| recharts | In project | Chart rendering | Already used for benchmark trend charts on reports page |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query (via tRPC) | In project | Data fetching/caching | All tRPC queries use this |
| date-fns or native Date | N/A | Date manipulation | Schedule helpers use native UTC Date methods -- follow same pattern |

### No New Dependencies Needed
This phase requires zero new npm packages. All infrastructure exists.

## Architecture Patterns

### Recommended Project Structure (New Files)
```
prisma/
  schema.prisma          # Add Milestone model
lib/
  routers/
    milestones.js        # New: Milestone CRUD tRPC router
    app.js               # Register milestones router
  report-engine.js       # Minor: export helper for benchmark-from-milestone
components/
  MilestoneManager.jsx   # New: Milestone CRUD UI (list, create, edit, delete)
  BenchmarkSelector.jsx  # New: Period picker + milestone picker for comparison
app/(dashboard)/reports/
  [id]/page.jsx          # Extend: add benchmark selector to report detail
  page.jsx               # Extend: add "Milestones" tab to reports sub-nav
  milestones/page.jsx    # New: dedicated milestones management page
__tests__/lib/
  milestones.test.js     # New: milestone router tests
  benchmark-compare.test.js  # New: benchmark comparison logic tests
```

### Pattern 1: tRPC Router with Prisma CRUD
**What:** Standard CRUD router pattern used throughout the project
**When to use:** All new data operations
**Example (from existing code):**
```javascript
// Source: lib/routers/schedules.js -- exact pattern to follow
export const milestonesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.milestone.findMany({
      orderBy: { startDate: 'desc' },
    });
  }),
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      startDate: z.string(), // ISO date
      endDate: z.string(),   // ISO date
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.milestone.create({
        data: {
          name: input.name,
          description: input.description || null,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          createdById: ctx.user.id,
        },
      });
    }),
  // update, delete follow same pattern as schedules.js
});
```

### Pattern 2: Report Benchmark Comparison via Re-generation
**What:** Use existing `generateEnrichedReport()` with explicit `benchmarkPeriod` to compute deltas
**When to use:** When user selects a comparison period for an existing report
**Example:**
```javascript
// The engine already supports this -- just pass the right benchmarkPeriod
const content = await generateEnrichedReport({
  reportType: report.reportType,
  dateStart: new Date(report.coveragePeriod.start),
  dateEnd: new Date(report.coveragePeriod.end),
  benchmarkPeriod: { start: milestoneStart, end: milestoneEnd },
});
```

### Pattern 3: Period Selector Component
**What:** UI component for selecting WoW/MoM/QoQ/YoY or a named milestone
**When to use:** On report detail page to trigger re-comparison
**Key design:** Two modes -- (a) standard period offset (uses `getPreviousPeriod`-style logic with cadence multiplier), (b) milestone lookup (resolves milestone ID to date range).

### Anti-Patterns to Avoid
- **Client-side delta calculation from raw data:** Do not fetch two periods of raw post/metrics data to the client and compute deltas in React. Always compute on the server via the report engine.
- **Duplicating calculateDelta logic:** The function exists in `report-engine.js`. Import it, do not rewrite.
- **Creating a separate benchmark report type:** Benchmarking is a mode/overlay on any existing report, not a new report type. The `ReportType` enum should not be extended.
- **Storing benchmarks as separate Report records:** Benchmark comparison is an attribute of a report render, not a separate entity. The `benchmarkPeriod` JSON field on Report already handles this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delta percentage calculation | Custom math | `calculateDelta()` from report-engine.js | Handles 0/null edge cases, 1% flat threshold |
| Previous period date range | Custom date subtraction | `getPreviousPeriod()` from report-engine.js | Handles duration-based mirroring |
| Cadence-based date ranges | Manual date math | `computeDateRange()` from schedule-helpers.js | Handles W/M/Q/Y cadence with UTC |
| KPI rendering with arrows | Custom delta display | `KPICard` + `DeltaArrow` from components/ui.jsx | Green/red/flat arrows already styled |
| Chart rendering | New chart code | Existing QuickChart.io via `renderCharts()` | Already integrated and tested |

**Key insight:** This phase is 80% wiring existing infrastructure together. The delta engine, KPI calculations, chart rendering, and directional UI indicators all exist. The new work is: Milestone model, milestone CRUD, comparison period selection UI, and connecting the selection to the engine.

## Common Pitfalls

### Pitfall 1: Re-generating full reports for every comparison
**What goes wrong:** User selects "compare to last month" and the system regenerates the entire report (AI summary, charts, everything) instead of just computing deltas.
**Why it happens:** The `generateEnrichedReport` function does everything -- KPIs, AI summary, charts, deltas -- in one call.
**How to avoid:** For comparison-only operations, either (a) extract a lightweight `compareBenchmarkPeriods()` function that only computes KPIs + deltas without AI/charts, or (b) accept the full regeneration cost (it takes ~15-30s with AI). Option (a) is recommended for interactive use; option (b) works for one-time setup.
**Warning signs:** User clicks "Compare" and waits 30 seconds for what should be instant delta math.

### Pitfall 2: Milestone date range validation
**What goes wrong:** User creates a milestone with end date before start date, or a milestone in the future with no data.
**Why it happens:** Missing input validation.
**How to avoid:** Validate `endDate > startDate` in the Zod schema. Warn (but don't block) when milestone period has no data available.

### Pitfall 3: Comparison period with no data returns all nulls
**What goes wrong:** User compares against a period where no posts exist. All deltas show as "flat" (null previous = flat in `calculateDelta`).
**Why it happens:** The `calculateDelta` function returns `{ value: null, direction: 'flat' }` when previous is 0 or null.
**How to avoid:** Show a clear "No data available for comparison period" message instead of misleading "flat" indicators. Check if previous KPIs are all zero before displaying delta badges.

### Pitfall 4: Period comparison type mismatch
**What goes wrong:** A weekly report is compared year-over-year, making the comparison meaningless (7 days vs 365 days).
**Why it happens:** No guidance on which comparison periods make sense for which report types.
**How to avoid:** Suggest appropriate comparison periods based on report coverage duration. Show a warning if the comparison period length differs significantly from the report period length.

## Code Examples

### Prisma Milestone Model
```prisma
// Add to prisma/schema.prisma in a new MILESTONES section
model Milestone {
  id          String   @id @default(cuid())
  name        String
  description String?
  startDate   DateTime @db.Date
  endDate     DateTime @db.Date
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([startDate, endDate])
  @@map("milestones")
}
```

### Lightweight Benchmark Comparison (Recommended)
```javascript
// Source: Pattern derived from existing report-engine.js
// Extract from generateEnrichedReport -- KPIs + deltas only, no AI/charts
export async function computeBenchmarkDeltas(coveragePeriod, benchmarkPeriod) {
  const [currentData, previousData] = await Promise.all([
    fetchPeriodData(coveragePeriod.start, coveragePeriod.end),
    fetchPeriodData(benchmarkPeriod.start, benchmarkPeriod.end),
  ]);

  const currentKPIs = calculateKPIs(currentData.posts, currentData.accountMetrics, currentData.listeningHits);
  const previousKPIs = calculateKPIs(previousData.posts, previousData.accountMetrics, previousData.listeningHits);

  // Merge deltas (same logic as generateEnrichedReport line 318-329)
  for (let i = 0; i < currentKPIs.length; i++) {
    if (['number', 'percent', 'delta'].includes(currentKPIs[i].format)) {
      const delta = calculateDelta(
        typeof currentKPIs[i].value === 'number' ? currentKPIs[i].value : 0,
        typeof previousKPIs[i].value === 'number' ? previousKPIs[i].value : 0
      );
      currentKPIs[i].delta = delta.value;
      currentKPIs[i].direction = delta.direction;
    }
  }

  return {
    kpis: currentKPIs,
    previousKpis: previousKPIs,
    benchmarkPeriod: {
      start: benchmarkPeriod.start.toISOString(),
      end: benchmarkPeriod.end.toISOString(),
    },
  };
}
```

### Comparison Period Resolution
```javascript
// Resolve comparison type to concrete date range
// Uses existing getPreviousPeriod for standard offsets
import { getPreviousPeriod } from '../report-engine';
import { computeDateRange } from '../scheduling/schedule-helpers';

export function resolveComparisonPeriod(coverageStart, coverageEnd, comparisonType, milestoneId) {
  if (comparisonType === 'MILESTONE') {
    // Caller must resolve milestoneId to { startDate, endDate } first
    return null; // handled by tRPC procedure
  }

  // Standard offset: WoW, MoM, QoQ, YoY
  const cadenceMap = { WoW: 'WEEKLY', MoM: 'MONTHLY', QoQ: 'QUARTERLY', YoY: 'YEARLY' };
  const cadence = cadenceMap[comparisonType];

  if (cadence) {
    // Use getPreviousPeriod for same-duration comparison
    return getPreviousPeriod(new Date(coverageStart), new Date(coverageEnd));
  }

  return null;
}
```

### BenchmarkSelector Component Pattern
```jsx
// Follows existing project UI patterns from ReportViewer, EmailReportModal
'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

export default function BenchmarkSelector({ reportId, coveragePeriod, onCompare }) {
  const [mode, setMode] = useState('period'); // 'period' | 'milestone'
  const [periodType, setPeriodType] = useState('WoW');
  const [milestoneId, setMilestoneId] = useState('');

  const milestonesQ = trpc.milestones.list.useQuery();
  const compareMutation = trpc.reports.compareBenchmark.useMutation({
    onSuccess: (data) => onCompare(data),
  });

  const handleCompare = () => {
    compareMutation.mutate({
      reportId,
      comparisonType: mode === 'period' ? periodType : 'MILESTONE',
      milestoneId: mode === 'milestone' ? milestoneId : undefined,
    });
  };

  return (
    <div className="bg-white dark:bg-surface-card rounded-lg border border-border p-4">
      {/* Toggle: Period vs Milestone */}
      {/* Period: WoW/MoM/QoQ/YoY buttons */}
      {/* Milestone: dropdown of named milestones */}
      {/* Compare button */}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No comparison | `benchmarkPeriod` on Report model, `calculateDelta()` in engine | Phase 5 (2026-03-15) | Delta infrastructure is ready, just needs UI wiring |
| Hardcoded comparison period | Dynamic via `getPreviousPeriod()` | Phase 5 | Any report can be compared against any period |
| No milestone tracking | N/A (this phase adds it) | Phase 8 | New concept for the codebase |

**Key infrastructure already in place:**
- `Report.benchmarkPeriod` JSON field (Prisma schema)
- `generateEnrichedReport({ benchmarkPeriod })` (report-engine.js)
- `calculateDelta(current, previous)` with 1% flat threshold (report-engine.js)
- `getPreviousPeriod(dateStart, dateEnd)` (report-engine.js)
- `computeDateRange(cadence, referenceDate)` (schedule-helpers.js)
- `KPICard` with delta/direction props (components/ui.jsx)
- `DeltaArrow` with green up / red down / flat styling (components/ui.jsx)
- `Cadence` enum: WEEKLY, MONTHLY, QUARTERLY, YEARLY (Prisma schema)

## Open Questions

1. **Should benchmark comparison update the stored report or be ephemeral?**
   - What we know: The `Report.benchmarkPeriod` field already stores a benchmark period. `generateEnrichedReport` produces content with deltas baked in.
   - What's unclear: Should clicking "Compare WoW" permanently update the report record, or should it be a transient overlay that doesn't persist?
   - Recommendation: Make it ephemeral by default (compute deltas on-the-fly, display in UI without saving). Add a "Save comparison" option that updates the report record. This avoids cluttering reports with comparison artifacts.

2. **Where should Milestones live in the navigation?**
   - What we know: Reports page has sub-tabs: AI Report Builder, Report Repository, Historical Benchmarks, Schedules, Ad Hoc.
   - What's unclear: Should milestones be a new tab, or embedded in the Historical Benchmarks tab?
   - Recommendation: Add a "Milestones" tab to the reports sub-navigation (consistent with Schedules and Ad Hoc having their own tabs). Keep it lightweight -- a simple CRUD table.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | vitest.config.js |
| Quick run command | `npx vitest run __tests__/lib/milestones.test.js __tests__/lib/benchmark-compare.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BNCH-01 | Period comparison resolves correct date ranges and computes deltas | unit | `npx vitest run __tests__/lib/benchmark-compare.test.js -x` | Wave 0 |
| BNCH-02 | Milestone CRUD: create, list, update, delete with validation | unit | `npx vitest run __tests__/lib/milestones.test.js -x` | Wave 0 |
| BNCH-03 | Benchmark against milestone resolves milestone dates and passes to engine | unit | `npx vitest run __tests__/lib/benchmark-compare.test.js -x` | Wave 0 |
| BNCH-04 | Delta display: KPIs include delta/direction fields, null previous handled | unit | `npx vitest run __tests__/lib/report-engine.test.js -x` | Exists (tests calculateDelta) |

### Sampling Rate
- **Per task commit:** `npx vitest run __tests__/lib/milestones.test.js __tests__/lib/benchmark-compare.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/lib/milestones.test.js` -- covers BNCH-02 (milestone CRUD router tests)
- [ ] `__tests__/lib/benchmark-compare.test.js` -- covers BNCH-01, BNCH-03 (period resolution, delta computation, milestone-based comparison)

*(Existing `__tests__/lib/report-engine.test.js` already covers `calculateDelta`, `getPreviousPeriod`, and `generateEnrichedReport` with benchmarkPeriod -- no gap for BNCH-04 core logic.)*

## Sources

### Primary (HIGH confidence)
- Project codebase -- direct inspection of all relevant files:
  - `lib/report-engine.js` -- `calculateDelta()`, `getPreviousPeriod()`, `generateEnrichedReport()`
  - `lib/report-content-schema.js` -- `ENRICHED_REPORT_SCHEMA` with `benchmarkPeriod` field
  - `lib/scheduling/schedule-helpers.js` -- `computeDateRange()`, `computeNextRun()`
  - `lib/routers/reports.js` -- `reports.generate` mutation with benchmark period handling
  - `lib/routers/schedules.js` -- CRUD router pattern to follow
  - `lib/routers/benchmarks.js` -- existing universe benchmarks (different from report benchmarks)
  - `prisma/schema.prisma` -- Report model with `benchmarkPeriod Json?`
  - `components/ui.jsx` -- `KPICard`, `DeltaArrow` components
  - `components/ReportViewer.jsx` -- report rendering with coverage/benchmark period display
  - `app/(dashboard)/reports/page.jsx` -- sub-tab navigation, Historical Benchmarks tab
  - `app/(dashboard)/reports/[id]/page.jsx` -- report detail page (extension target)
  - `__tests__/lib/report-engine.test.js` -- existing test patterns
  - `__tests__/lib/benchmarks.test.js` -- existing router test patterns
  - `vitest.config.js` -- test configuration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - extends existing patterns (tRPC CRUD, report engine, UI components)
- Pitfalls: HIGH - identified from direct code inspection of edge cases in calculateDelta and report generation flow

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- this is project-internal infrastructure)
