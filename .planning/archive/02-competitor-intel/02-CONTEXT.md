# Phase 2: Competitor Intel - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning
**Source:** Direct user decisions

<domain>
## Phase Boundary

Build the Competitor Intel panel in the composer sidebar. Captures competitor post content (text, format, engagement) from X via TwitterAPI.io during the daily cron, runs AI theme/format extraction in batch mode, and surfaces insights in a sub-tabbed panel ("By Competitor" strategy cards + "Landscape" cross-competitor themes/formats).

Scope: X platform only. Reddit competitor content deferred. Uses existing `poll-competitors` cron as the capture and analysis point.

</domain>

<decisions>
## Implementation Decisions

### Data Capture (COMP-01)
- Expand existing `poll-competitors` cron to store actual tweet text, format, and per-tweet engagement — not just aggregate metrics
- Add a `CompetitorPost` Prisma model to store individual competitor tweets
- X only — Reddit competitor post capture is out of scope for this phase
- Use existing `twitterApiIoRequest()` helper and `/twitter/user/last_tweets` endpoint (already called, just not storing content)

### AI Analysis (COMP-02, COMP-03)
- AI theme and format extraction runs during the daily `poll-competitors` cron (batch mode)
- Results cached in AIInsight table with competitor-specific InsightType (COMPETITOR_STRATEGY)
- Claude Haiku for analysis (cost-efficient, consistent with Phase 1)
- tRPC procedures read from AIInsight cache, not compute live from CompetitorPost records

### Panel UI (COMP-02, COMP-03, COMP-04)
- Sub-tabs within the panel: "By Competitor" (strategy cards) and "Landscape" (cross-competitor themes + format breakdown)
- Per-competitor cards: posting cadence, top themes, format breakdown, engagement benchmarks vs our accounts
- Landscape view: themes with frequency counts across all competitors, format engagement correlation
- Benchmarking includes all: engagement rate, posting cadence, and follower counts
- Follow Phase 1 Intel panel pattern: self-contained component, own tRPC queries, staleTime caching

### Claude's Discretion
- CompetitorPost schema design (fields, indexes, retention policy)
- Format detection logic (thread vs single tweet vs reply)
- Theme clustering algorithm/prompt design
- How to calculate "vs our accounts" benchmarks
- Sub-tab interaction patterns and visual design

</decisions>

<specifics>
## Specific Ideas

- Existing cron already calls `/twitter/user/last_tweets` — tweet data is fetched but only aggregate metrics extracted. Storing full tweet content is minimal incremental work.
- 7 competitors tracked: Securitize, Ondo Finance, Centrifuge, Superstate, Tokeny Solutions, Goldfinch, Tradable
- CompetitorAccount model already links competitors to X usernames
- AIInsight table already has category field — use COMPETITOR_STRATEGY InsightType for cached analysis

</specifics>

<deferred>
## Deferred Ideas

- Reddit competitor post capture
- Real-time competitor alerts
- Competitor post sentiment analysis
- Head-to-head comparison tool (interactive competitor selection)

</deferred>

---

*Phase: 02-competitor-intel*
*Context gathered: 2026-03-15 via direct user decisions*
