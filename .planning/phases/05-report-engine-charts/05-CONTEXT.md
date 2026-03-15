# Phase 5: Report Engine + Charts - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Rich report generation with topline KPIs, AI executive summaries, inline charts, sentiment themes, and comparison deltas — replacing the current text-only output. Reports are stored as structured JSON with data arrays (for in-app Recharts) and chart image URLs (for PDF/email). This phase delivers the report engine and visual output; export, distribution, scheduling, and benchmarking are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Report Visual Layout
- Document-style layout: scrolling sections with headers, not a dashboard grid
- Hero KPI bar at top: 5 large stat cards (Impressions, Engagement Rate, Follower Delta, Top Post, Sentiment) with big numbers, delta arrows, and sparkline trends
- Strategic narrative executive summary: 2-3 paragraphs — what happened, what's notable, what to do next. Written for C-suite (VP/CMO audience with 60 seconds to read)
- Adaptive sections by report type: weekly emphasizes engagement trends + top content, monthly adds growth + competitive positioning, competitive leads with share of voice. AI decides which sections to include
- Top 3 performing posts with content snippet, key metrics, and 1-line AI explanation of why each worked
- Prioritized recommendations section: 3-5 action items ranked by impact with expected outcome and effort level (HIGH/MEDIUM/LOW color-coded)
- Forward-looking "Week Ahead Outlook" section: 1 paragraph on what to watch
- Brief competitor pulse in cadence reports: 1-2 sentences on notable competitor activity with key metric changes
- Branded header: report title, date range, report type badge, generated timestamp, comparison period label
- Prominent period header: clear date range label and explicit "vs [comparison period]" on every delta
- Full-page detail view at /reports/[id] with sticky table of contents (left sidebar with section links)
- Fixed action toolbar at top of detail page: Back, Export PDF, Email, Share, Re-run (Phase 6+ features as disabled placeholders)
- WYSIWYG builder preview: AI Builder tab shows the exact same rich visual layout after generation
- Enhanced repository table: report type badge, date range column, status indicator (Draft/Final), remove unused columns (Pages, AI %, Downloads)

### Chart Types & Styling
- 3-chart default set for performance reports: 1) Engagement trend line (daily over period), 2) Content type breakdown (donut: threads vs posts vs articles), 3) Sentiment distribution (horizontal bar: positive/neutral/negative)
- Clean corporate visual style: indigo (#4F46E5) primary, sky blue (#0EA5E9) secondary, emerald (#10B981) accent, white background, no gridlines, clean axis labels, 8px border radius
- Dual rendering: interactive Recharts in-app (tooltips, hover) + QuickChart.io static images for export channels. Report JSON stores both data arrays and chart image URLs
- Full-width charts at 280px height, one chart per section
- Chart images generated at report creation time and stored as URLs

### Comparison Deltas
- Display format: percentage change + directional arrow + color coding (green up = positive, red down = negative)
- Show both percentage change and absolute change on KPI cards (e.g., "+18% (+3,700)")
- Each delta includes temporal context label ("vs prior week")
- Auto-match comparison cadence: weekly→WoW, monthly→MoM, quarterly→QoQ, yearly→YoY, custom→equivalent prior period
- Deltas appear in three places: KPI hero cards (visual), executive summary (narrative prose), chart overlays (dashed comparison line)
- Flat threshold: <2% change shows gray horizontal dash with "Stable" label and exact change value
- When prior period data is unavailable, omit delta (don't show "N/A")

### Sentiment Themes
- Grouped by polarity: "Top Positive Drivers" and "Top Negative Drivers" subsections, 3-5 bulleted themes each
- Each theme includes: theme name, hit count, brief explanation, and 1 representative quote from listening data with attribution
- Emerging topics callout: separate subsection for 1-3 new or sharply rising topics, tagged with "New" or "Rising" badge
- Ad hoc/milestone reports use event-focused framing: "Reception Summary" with sentiment trajectory (pre-event → during → post-event) instead of positive/negative grouping

### Claude's Discretion
- Loading skeleton design and transitions
- Exact spacing, typography sizing, and responsive breakpoints
- Chart axis formatting and data point density
- Error state handling when report generation fails
- How to handle reports with insufficient data for certain sections

</decisions>

<specifics>
## Specific Ideas

- Reports should be optimized for a C-suite executive audience — everything should answer "so what?" and "what should we do?"
- KPI cards should be the first thing visible — answer "how are we doing?" in 2 seconds
- Executive summary should highlight inflection points and strategic implications, not just recap metrics
- Competitor pulse keeps every report in competitive context — execs always want to know relative positioning
- Recommendations should feel actionable: specific enough to assign, not vague advice
- The existing reports page has 3 tabs (AI Builder, Repository, Benchmarks) — enhance this structure, don't replace it

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/ai/reports.js`: Existing report generators (generateWeeklyReport, generateCompetitiveAnalysis, generateKOLScorecard, generateListeningSummary) — these return structured JSON. Need to enhance output schema to include chart data arrays and comparison deltas
- `lib/routers/reports.js`: Existing tRPC router with `list`, `generate`, and `getBenchmarks` procedures — extend with `getById` for detail view and enhanced `generate` that produces chart images
- `lib/ai.js`: `generateInsight(type, context, options)` helper using Claude Haiku — reuse for report AI generation
- `components/ui`: TabButton, SectionTitle, Skeleton, useChartColors — all reusable in report detail view
- Recharts already installed and used in reports page (AreaChart) and analytics — reuse for in-app interactive charts

### Established Patterns
- tRPC protectedProcedure for all authenticated endpoints
- Report model stores content as JSON blob — extend schema shape, not model structure
- `generateInsight()` pattern: system prompt with JSON schema → structured output → stored in DB
- Existing benchmark chart pattern: ResponsiveContainer + Recharts at 280px height with useChartColors

### Integration Points
- `/reports` page (`app/(dashboard)/reports/page.jsx`) — enhance existing AI Builder and Repository tabs, add click-through to detail view
- New route: `/reports/[id]` detail page for full report view
- Report model in Prisma (`prisma/schema.prisma:720`) — may need new fields for period metadata, comparison data, chart URLs
- QuickChart.io API (decided in v1.1 research) — new integration for server-side chart image generation
- `lib/routers/app.js` — register any new router procedures

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-report-engine-charts*
*Context gathered: 2026-03-15*
