# Phase 5: Report Engine + Charts - Research

**Researched:** 2026-03-15
**Domain:** Server-side chart rendering, structured report generation with KPIs/deltas/AI summaries, enriched report content schema
**Confidence:** HIGH

## Summary

Phase 5 transforms the existing text-only report generation pipeline into a rich visual report engine. The current system (`lib/routers/reports.js` + `lib/ai/reports.js`) already generates AI reports via Claude Haiku with structured JSON output (executive summary, key metrics, top content, recommendations). The phase adds three new capabilities on top of this foundation: (1) topline KPI stat blocks with comparison deltas vs prior periods, (2) server-side chart rendering via QuickChart.io POST API producing persistent image URLs, and (3) sentiment theme extraction for cadence and ad hoc reports. All report content must be stored as structured JSON containing both raw data arrays (for in-app Recharts rendering) and chart image URLs (for downstream PDF/email consumers in Phase 6).

The architecture is additive -- no existing code needs to be replaced. The existing `reports.generate` tRPC mutation and `generateWeeklyReport`/`generateCompetitiveAnalysis`/`generateListeningSummary` AI generators continue to work. A new `lib/report-engine.js` orchestrator wraps the existing generators, adding data aggregation for KPIs, benchmark delta calculation, chart spec building, and QuickChart.io rendering. A new `lib/chart-renderer.js` module handles all QuickChart.io communication. The enriched `Report.content` JSON schema becomes the single source of truth for all display surfaces.

**Primary recommendation:** Build `lib/chart-renderer.js` (QuickChart.io integration) first, then `lib/report-engine.js` orchestrator wrapping existing AI generators, then extend the Report schema and tRPC mutation, then build the frontend `ReportViewer` component. Schema migration should happen early to unblock all work.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RCNT-01 | Every report displays topline KPI stats (impressions, engagement rate, follower delta, top post, sentiment) | KPI data already available via PostMetrics, AccountMetrics, ListeningHit queries in existing `reports.generate`. Report engine adds structured KPI block extraction with formatting. |
| RCNT-02 | Every report includes an AI-generated executive summary (what happened, what's notable, what to do next) | Already implemented in `generateWeeklyReport` via `executiveSummary` field. Needs prompt refinement to add "what to do next" section consistently. |
| RCNT-03 | Every report includes comparison deltas vs previous period (WoW, MoM, QoQ, YoY) with trend arrows | New capability. Report engine fetches prior period data using same queries with shifted date range. Delta calculation is pure arithmetic. Trend arrow direction derived from sign of delta. |
| RCNT-04 | Reports include inline charts (engagement trend line, content type breakdown, sentiment distribution) | QuickChart.io POST API renders Chart.js configs as PNG. `lib/chart-renderer.js` builds specs, POSTs to QuickChart, stores results in Vercel Blob. Report stores chart URLs in `content.charts[]`. |
| RCNT-05 | Cadence reports include key sentiment themes with bulleted details | Listening hits already queried in report generation. AI prompt needs extension to extract top positive/negative themes, emerging topics, notable shifts from sentiment data. |
| RCNT-06 | Ad hoc reports include a sentiment/reception summary for the milestone or event period | Same sentiment extraction as RCNT-05 but scoped to a custom date range. Report engine accepts arbitrary `dateStart`/`dateEnd` params. |
| RCNT-07 | Report content stored as structured JSON with data arrays (in-app charts) and chart image URLs (export/email) | New `content` schema includes both `kpis[]`, `charts[].data` (raw arrays for Recharts), and `charts[].imageUrl` (QuickChart PNG URL for PDF/email). Single source of truth. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| QuickChart.io | External API (Chart.js v4) | Server-side chart rendering as PNG images | Only viable option for browser-independent chart rendering on Vercel serverless. No npm install needed -- pure HTTP POST. Free tier: 100K images/month. |
| Recharts | ^2.12.0 (already installed) | In-app interactive chart rendering | Already used in reports page benchmarks tab. Continues for in-app display; QuickChart handles server-side rendering. |
| @vercel/blob | ^0.23.0 (already installed) | Chart image storage | Already installed. Charts stored as public Blob URLs for persistence across sessions and downstream consumers. |
| @anthropic-ai/sdk | ^0.24.0 (already installed) | AI executive summaries, sentiment themes | Already used via `lib/ai.js` `generateInsight()` wrapper. Claude Haiku for batch generation. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vercel/kv | ^2.0.0 (already installed) | Deduplication locks for chart rendering | Prevent duplicate chart renders if report generation retries. Optional but recommended. |
| zod | ^3.23.0 (already installed) | Report content schema validation | Validate enriched report content JSON before persisting. Catches malformed AI output. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| QuickChart.io | node-canvas | node-canvas requires native C++ bindings unavailable on Vercel serverless. Not viable. |
| QuickChart.io | Recharts server-side | Recharts requires browser DOM (`window`, `document`). Cannot run in API routes. |
| Storing chart URLs in Blob | Storing base64 in DB | Base64 chart images bloat the Report.content JSON field (30-50KB per chart). Blob URLs are ~100 bytes each. DB stays lean. |

**Installation:**
```bash
# No new packages needed for Phase 5
# QuickChart.io is an external HTTP API (no npm install)
# All other dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
  report-engine.js       # NEW: Orchestrator -- data aggregation, AI, chart specs, delta calc
  chart-renderer.js      # NEW: QuickChart.io POST integration, Blob upload, returns URLs
  ai/
    reports.js           # EXTEND: Add generateCadenceReport() with richer prompt schemas
  routers/
    reports.js           # EXTEND: Enrich reports.generate mutation output

app/
  (dashboard)/
    reports/
      page.jsx           # EXTEND: Add ReportViewer for rich report display
      [id]/
        page.jsx          # NEW: Individual report detail page with full viewer

components/
  ReportViewer.jsx        # NEW: KPI cards, inline charts, executive summary, deltas
  KPICard.jsx             # NEW: Reusable KPI stat card with delta arrow
  DeltaArrow.jsx          # NEW: Trend arrow component (up/down/flat with color)
```

### Pattern 1: Report Engine Orchestrator
**What:** `lib/report-engine.js` is a single function that takes a report spec (type, date range, optional benchmark config) and returns a fully enriched report content object with KPIs, AI narrative, chart specs, and deltas.
**When to use:** Every report generation path (manual trigger via tRPC, future cron trigger).
**Example:**
```javascript
// lib/report-engine.js
// Source: Follows existing lib/listening-scanner.js shared-logic pattern
export async function generateEnrichedReport({ reportType, dateStart, dateEnd, benchmarkPeriod }) {
  // 1. Aggregate KPI data from existing models
  const [posts, accountMetrics, listeningHits] = await Promise.all([
    prisma.post.findMany({ where: { status: 'PUBLISHED', publishedAt: { gte: dateStart, lte: dateEnd } }, include: { metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 } } }),
    prisma.accountMetrics.findMany({ where: { date: { gte: dateStart, lte: dateEnd } } }),
    prisma.listeningHit.findMany({ where: { detectedAt: { gte: dateStart, lte: dateEnd } } }),
  ]);

  // 2. Calculate KPI stats
  const kpis = calculateKPIs(posts, accountMetrics, listeningHits);

  // 3. Calculate comparison deltas if benchmark period provided
  const deltas = benchmarkPeriod
    ? await calculateDeltas(kpis, benchmarkPeriod)
    : null;

  // 4. Generate AI executive summary with pre-aggregated context
  const aiContent = await generateInsight('reports/enriched', buildAIContext(kpis, deltas, posts, listeningHits), {
    systemPrompt: ENRICHED_REPORT_PROMPT,
    maxTokens: 3000,
  });

  // 5. Build chart specs and render via QuickChart
  const chartSpecs = buildChartSpecs(kpis, posts, listeningHits);
  const charts = await renderCharts(chartSpecs); // lib/chart-renderer.js

  return { kpis, deltas, aiContent, charts };
}
```

### Pattern 2: Chart-as-URL (Not Chart-as-Component)
**What:** Charts rendered server-side once at generation time. Stored as Vercel Blob URLs. In-app viewer shows `<img src={url}>` alongside raw data arrays for optional Recharts interactive rendering.
**When to use:** Every chart in every report.
**Example:**
```javascript
// lib/chart-renderer.js
// Source: QuickChart.io documentation -- POST endpoint
export async function renderChart(spec) {
  const response = await fetch('https://quickchart.io/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chart: spec.config,    // Chart.js config object
      width: spec.width || 600,
      height: spec.height || 300,
      backgroundColor: 'white',
      format: 'png',
      version: 4,            // Chart.js v4
    }),
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  // Store in Vercel Blob for persistent URL
  const blob = await put(`reports/charts/${spec.id}.png`, buffer, { access: 'public', contentType: 'image/png' });
  return { specId: spec.id, imageUrl: blob.url, buffer };
}

export async function renderCharts(specs) {
  return Promise.all(specs.map(renderChart));
}
```

### Pattern 3: Dual-Format Content Storage (RCNT-07)
**What:** Report content JSON includes both raw data arrays (for in-app Recharts interactive charts) and pre-rendered chart image URLs (for PDF/email).
**When to use:** Every persisted report.
**Example:**
```javascript
// Report.content JSON structure
{
  kpis: [
    { label: 'Impressions', value: 24300, delta: 15.2, direction: 'up', period: 'WoW' },
    { label: 'Engagement Rate', value: 4.2, delta: -0.3, direction: 'down', period: 'WoW' },
    // ...
  ],
  executiveSummary: '...', // AI-generated
  sentimentThemes: {
    positive: [{ theme: '...', detail: '...', volume: 12 }],
    negative: [{ theme: '...', detail: '...', volume: 5 }],
    emerging: [{ topic: '...', signals: '...' }],
  },
  charts: [
    {
      id: 'engagement-trend',
      label: 'Engagement Trend',
      type: 'line',
      data: { labels: ['Mon','Tue',...], datasets: [...] }, // Raw data for Recharts
      imageUrl: 'https://xyz.blob.vercel-storage.com/reports/charts/...png', // Pre-rendered
    },
    // ...
  ],
  recommendations: [...], // AI-generated
  topContent: [...],       // Top performing posts
  coveragePeriod: { start: '...', end: '...' },
  benchmarkPeriod: { start: '...', end: '...' }, // null if no comparison
}
```

### Pattern 4: Delta Calculation
**What:** Comparison deltas computed by fetching the same KPI queries for a prior period and computing percentage change.
**When to use:** Every report with RCNT-03 requirement.
**Example:**
```javascript
// lib/report-engine.js -- delta calculation
function calculateDelta(current, previous) {
  if (previous === 0 || previous == null) return { value: null, direction: 'flat' };
  const pctChange = ((current - previous) / Math.abs(previous)) * 100;
  return {
    value: parseFloat(pctChange.toFixed(1)),
    direction: pctChange > 1 ? 'up' : pctChange < -1 ? 'down' : 'flat',
  };
}

// Determine previous period based on cadence
function getPreviousPeriod(dateStart, dateEnd, cadence) {
  const duration = dateEnd - dateStart;
  return { start: new Date(dateStart - duration), end: new Date(dateStart) };
}
```

### Anti-Patterns to Avoid
- **Recharts in API routes:** Recharts requires browser DOM. Never import Recharts in `lib/` modules. Use QuickChart.io for all server-side chart rendering.
- **Raw Prisma rows in AI context:** Monthly reports with raw PostMetrics rows can blow past Claude's context window. Always pre-aggregate before building AI context (top 5 posts, summarized metrics, sentiment counts).
- **QuickChart GET URLs for complex charts:** GET URLs encode chart config as query params. Complex multi-dataset charts exceed URL length limits. Always use POST endpoint.
- **Storing chart PNGs as base64 in the database:** A 600x300 PNG is ~30KB base64. Five charts per report adds 150KB+ to the JSON field. Store URLs in Blob, reference by URL.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server-side chart rendering | Custom canvas/SVG renderer | QuickChart.io POST API | Chart.js v4 rendering is complex. QuickChart handles axis labels, legends, responsive sizing, anti-aliasing. Free tier is more than sufficient. |
| Chart image hosting | File system or DB blob storage | Vercel Blob (`@vercel/blob`) | Already installed. Public URLs work everywhere (in-app, email, Slack). No CDN config needed. |
| AI JSON parsing | Custom regex extraction | Existing `parseAIJSON()` in `lib/ai.js` | Already handles markdown fences, nested braces, and fallback to raw text. Battle-tested in 6 completed plans. |
| Percentage delta calculation | Manual period math | Utility function with `getPreviousPeriod()` | Edge cases: zero denominators, null values, period boundary alignment. Build once, test thoroughly, reuse everywhere. |

**Key insight:** Phase 5 is primarily an orchestration and data transformation layer. The hard problems (AI generation, chart rendering, blob storage) are solved by existing libraries. The engineering challenge is clean data flow and schema design.

## Common Pitfalls

### Pitfall 1: AI Context Token Bloat
**What goes wrong:** Monthly or quarterly reports include hundreds of PostMetrics rows in the Claude context, causing high token usage, slow responses, and potential context window overflow.
**Why it happens:** The existing `reports.generate` mutation passes all posts with metrics to `generateWeeklyReport`. At monthly scale, this could be 100+ posts with full metrics objects.
**How to avoid:** Pre-aggregate before building AI context. Pass only: top 5 posts by engagement, total KPI summary stats, sentiment distribution counts, top 3 listening themes. Add a `JSON.stringify(context).length > 50000` guard that triggers automatic payload reduction.
**Warning signs:** AI generation taking more than 15 seconds, Claude API costs spiking, truncated AI responses.

### Pitfall 2: QuickChart POST Failures Without Fallback
**What goes wrong:** QuickChart.io is an external service. Network errors, rate limits, or malformed chart configs cause chart rendering to fail, which blocks the entire report generation.
**Why it happens:** No error handling or fallback for chart rendering failures.
**How to avoid:** Wrap each chart render in a try/catch. If a chart fails, log the error and continue with `imageUrl: null` for that chart. The report viewer should gracefully handle missing chart images by showing the raw data table instead. Never let a single chart failure block report creation.
**Warning signs:** Reports saved with empty `charts[]` array, QuickChart 429 responses in logs.

### Pitfall 3: Benchmarking Queries Loading Full PostMetrics Table
**What goes wrong:** The existing `getBenchmarks` query (`lib/routers/reports.js` line 126-138) fetches ALL PostMetrics for 6 months with no `take` limit. At 15-minute polling across multiple accounts, this table grows fast.
**Why it happens:** `prisma.postMetrics.findMany()` with only a date filter returns potentially thousands of rows.
**How to avoid:** Add `take: 5000` safety cap to the existing `getBenchmarks` query immediately. For delta calculations in the report engine, use aggregated queries (sum/avg via Prisma `aggregate()`) rather than fetching individual rows.
**Warning signs:** Slow report generation, Vercel function memory warnings, getBenchmarks query taking more than 5 seconds.

### Pitfall 4: Inconsistent Report Content Schema
**What goes wrong:** Different report types (weekly, monthly, competitive, listening) return different JSON shapes from AI generators. The frontend ReportViewer must handle every variation, leading to complex conditional rendering.
**Why it happens:** Each `generate*` function in `lib/ai/reports.js` uses a different schema in its system prompt.
**How to avoid:** Define a canonical enriched report content schema in a shared constant. All report types produce the same top-level structure: `{ kpis[], executiveSummary, sentimentThemes, charts[], recommendations[], topContent[], coveragePeriod, benchmarkPeriod }`. Type-specific fields are nested under a `typeSpecific` key.
**Warning signs:** Frontend crashes on certain report types, undefined property access in ReportViewer.

### Pitfall 5: Chart Spec Configs That Look Good Locally But Break in QuickChart
**What goes wrong:** Chart.js configs that work in the browser (via Recharts or raw Chart.js) produce different or broken output in QuickChart.io because QuickChart uses a specific Chart.js v4 build.
**Why it happens:** QuickChart supports Chart.js v4 but not all plugins. Custom tooltip formatters, animation configs, or plugin-dependent features don't work server-side.
**How to avoid:** Keep chart specs simple -- standard chart types (line, bar, doughnut), no custom plugins, no animations, no JavaScript callbacks in config. Use QuickChart's `version: 4` parameter. Test each chart type in QuickChart's Sandbox (https://quickchart.io/sandbox/) before coding the spec builder.
**Warning signs:** Charts rendering as blank white images, QuickChart returning 400 errors.

## Code Examples

### QuickChart.io POST API Call
```javascript
// Source: QuickChart.io documentation -- POST endpoint
// Verified: 2026-03-15
const response = await fetch('https://quickchart.io/chart', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chart: {
      type: 'line',
      data: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [{
          label: 'Engagement Rate (%)',
          data: [3.2, 3.8, 4.1, 4.5],
          borderColor: '#4F46E5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          fill: true,
        }],
      },
      options: {
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true } },
      },
    },
    width: 600,
    height: 300,
    backgroundColor: 'white',
    format: 'png',
    version: 4,
  }),
});
// response.body is a PNG binary buffer
const buffer = Buffer.from(await response.arrayBuffer());
```

### KPI Stat Calculation from Existing Data Models
```javascript
// Source: Derived from existing reports.generate and getBenchmarks patterns
function calculateKPIs(posts, accountMetrics, listeningHits) {
  const postsWithMetrics = posts.filter(p => p.metrics?.[0]);
  const totalImpressions = postsWithMetrics.reduce((sum, p) => sum + (p.metrics[0]?.impressions || 0), 0);
  const totalEngagements = postsWithMetrics.reduce((sum, p) => sum + (p.metrics[0]?.engagements || 0), 0);
  const avgEngRate = postsWithMetrics.length > 0
    ? postsWithMetrics.reduce((sum, p) => sum + (p.metrics[0]?.engagementRate || 0), 0) / postsWithMetrics.length
    : 0;

  // Follower delta from AccountMetrics
  const sortedAM = [...accountMetrics].sort((a, b) => a.date - b.date);
  const followerDelta = sortedAM.length >= 2
    ? (sortedAM[sortedAM.length - 1].followers || 0) - (sortedAM[0].followers || 0)
    : 0;

  // Top post by engagement rate
  const topPost = postsWithMetrics.sort((a, b) => (b.metrics[0]?.engagementRate || 0) - (a.metrics[0]?.engagementRate || 0))[0];

  // Sentiment from listening hits
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  listeningHits.forEach(h => { sentimentCounts[h.sentiment?.toLowerCase()] = (sentimentCounts[h.sentiment?.toLowerCase()] || 0) + 1; });
  const totalSentiment = Object.values(sentimentCounts).reduce((a, b) => a + b, 0);
  const sentimentScore = totalSentiment > 0 ? Math.round((sentimentCounts.positive / totalSentiment) * 100) : null;

  return [
    { label: 'Impressions', value: totalImpressions, format: 'number' },
    { label: 'Engagement Rate', value: parseFloat(avgEngRate.toFixed(2)), format: 'percent' },
    { label: 'Follower Growth', value: followerDelta, format: 'delta' },
    { label: 'Top Post', value: topPost?.content?.substring(0, 80) || 'N/A', format: 'text', subValue: `${topPost?.metrics?.[0]?.engagementRate?.toFixed(1)}% eng` },
    { label: 'Sentiment', value: sentimentScore, format: 'percent' },
  ];
}
```

### Enriched Report Schema (Prisma Extension)
```prisma
// Additions to existing Report model in prisma/schema.prisma
model Report {
  // ... existing fields ...
  chartUrls       Json?     // Array of { id, label, imageUrl }
  coveragePeriod  Json?     // { start: DateTime, end: DateTime }
  benchmarkPeriod Json?     // { start: DateTime, end: DateTime } -- null if no comparison
  status          ReportStatus @default(READY)
}

enum ReportStatus {
  GENERATING
  READY
  FAILED
}
```

### ReportViewer Frontend Component Pattern
```jsx
// components/ReportViewer.jsx
// Source: Extends existing report preview pattern from reports/page.jsx
function ReportViewer({ report }) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* KPI Stats Row */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {report.content.kpis?.map((kpi, i) => (
          <KPICard key={i} label={kpi.label} value={kpi.value} delta={kpi.delta} direction={kpi.direction} format={kpi.format} />
        ))}
      </div>

      {/* Executive Summary */}
      <section className="mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider mb-2">Executive Summary</h3>
        <p className="text-sm leading-relaxed">{report.content.executiveSummary}</p>
      </section>

      {/* Inline Charts */}
      {report.content.charts?.map((chart) => (
        <section key={chart.id} className="mb-6">
          <h4 className="text-sm font-semibold mb-2">{chart.label}</h4>
          {chart.imageUrl ? (
            <img src={chart.imageUrl} alt={chart.label} className="w-full rounded-lg" />
          ) : chart.data ? (
            <InteractiveChart data={chart.data} type={chart.type} /> /* Recharts fallback */
          ) : null}
        </section>
      ))}

      {/* Sentiment Themes */}
      {report.content.sentimentThemes && (
        <SentimentThemesSection themes={report.content.sentimentThemes} />
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text-only AI report generation | Structured JSON with KPIs + charts + deltas | Phase 5 (this phase) | Reports become visually rich and export-ready |
| Recharts for all chart rendering | Recharts for in-app only; QuickChart.io for server-side | Phase 5 (this phase) | Charts work in PDF, email, Slack -- not just browser |
| Flat Report.content JSON | Canonical enriched schema with typed sections | Phase 5 (this phase) | Frontend can render any report type consistently |
| No period comparison | WoW/MoM/QoQ/YoY deltas with trend arrows | Phase 5 (this phase) | Reports show context, not just snapshots |

**Deprecated/outdated:**
- The existing `generateWeeklyReport` return schema (`executiveSummary`, `keyMetrics`, `topContent`, `audienceInsights`, `recommendations`, `outlook`) will be preserved but wrapped inside the new canonical schema under `typeSpecific`. This ensures backward compatibility with any existing reports in the DB.

## Open Questions

1. **Chart style consistency with app theme**
   - What we know: The app uses Tailwind with dark mode support. Recharts charts use `useChartColors()` hook for theme-aware colors.
   - What's unclear: QuickChart renders static PNGs. Should charts use a fixed light-background style (for PDF/email readability) or match the current app theme?
   - Recommendation: Use fixed white background with the app's indigo/blue brand colors for all QuickChart charts. This ensures readability in all output channels (PDF, email, in-app). Do not attempt dark-mode chart variants.

2. **Report detail page routing**
   - What we know: Currently, clicking "View" on a report in the repository table does nothing functional. The report preview only shows in the builder tab after generation.
   - What's unclear: Should Phase 5 include a dedicated report detail page (`/reports/[id]`) or enhance the existing builder tab preview?
   - Recommendation: Create a dedicated `/reports/[id]` page with the full ReportViewer component. This is needed for sharing report URLs and will be the target for "View Full Report" links from Phase 6 emails.

3. **Existing report backward compatibility**
   - What we know: Reports already exist in the DB with the current `content` JSON schema from `generateWeeklyReport`.
   - What's unclear: Should existing reports be migrated to the new schema, or should the viewer handle both formats?
   - Recommendation: Handle both formats in the viewer. Check for `content.kpis` (new format) vs `content.keyMetrics` (old format). No data migration needed. Old reports display with the old layout; new reports display with the enriched layout.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.js` (exists, `__tests__/**/*.test.{js,jsx}` pattern) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RCNT-01 | KPI calculation returns correct stats from post/account/listening data | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "KPI" -x` | No -- Wave 0 |
| RCNT-02 | AI executive summary generation called with pre-aggregated context | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "summary" -x` | No -- Wave 0 |
| RCNT-03 | Delta calculation produces correct percentages and directions | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "delta" -x` | No -- Wave 0 |
| RCNT-04 | Chart renderer POSTs to QuickChart and returns imageUrl | unit | `npx vitest run __tests__/lib/chart-renderer.test.js -x` | No -- Wave 0 |
| RCNT-05 | Sentiment themes extracted from listening hits with positive/negative/emerging | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "sentiment" -x` | No -- Wave 0 |
| RCNT-06 | Ad hoc report accepts custom date range and produces sentiment summary | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "ad hoc" -x` | No -- Wave 0 |
| RCNT-07 | Report content JSON contains both data arrays and chart imageUrls | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "content schema" -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/lib/report-engine.test.js` -- covers RCNT-01, RCNT-02, RCNT-03, RCNT-05, RCNT-06, RCNT-07
- [ ] `__tests__/lib/chart-renderer.test.js` -- covers RCNT-04
- [ ] Mock for QuickChart.io HTTP calls (avoid external API calls in tests)
- [ ] Mock for `generateInsight()` (avoid Claude API calls in tests)

## Sources

### Primary (HIGH confidence)
- Codebase: `lib/routers/reports.js` -- existing tRPC procedures, data query patterns, getBenchmarks implementation
- Codebase: `lib/ai/reports.js` -- existing report generators, JSON schemas, context preparation patterns
- Codebase: `lib/ai.js` -- `generateInsight()` wrapper, `parseAIJSON()`, Claude Haiku model usage
- Codebase: `prisma/schema.prisma` -- Report model (line 720-741), PostMetrics, AccountMetrics, ListeningHit models
- Codebase: `app/(dashboard)/reports/page.jsx` -- existing UI tabs, Recharts usage, report preview component
- Codebase: `package.json` -- confirms Recharts 2.12, @vercel/blob 0.23, @anthropic-ai/sdk 0.24 installed
- Codebase: `next.config.js` -- empty config, will need `serverExternalPackages` in Phase 6
- Codebase: `vitest.config.js` -- test infrastructure exists, `__tests__/` pattern
- [QuickChart.io documentation](https://quickchart.io/documentation/) -- POST API, Chart.js v4, PNG output, parameter reference
- `.planning/research/SUMMARY.md` -- project-level research with stack decisions and pitfalls
- `.planning/research/ARCHITECTURE.md` -- component boundaries, data flow diagrams, build order

### Secondary (MEDIUM confidence)
- QuickChart.io sandbox testing -- chart config compatibility verified against their live renderer

### Tertiary (LOW confidence)
- QuickChart.io free tier rate limit (60 vs 120 req/min conflict) -- not blocking at projected usage but needs staging validation before Phase 7 scheduling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed or well-documented external APIs, no new dependencies needed
- Architecture: HIGH -- follows established codebase patterns (shared logic module, tRPC router extension), architecture research already completed
- Pitfalls: HIGH -- verified against codebase analysis and official docs, specific mitigations identified
- Schema: HIGH -- simple additive changes to existing Report model, no breaking changes

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- no fast-moving dependencies)
