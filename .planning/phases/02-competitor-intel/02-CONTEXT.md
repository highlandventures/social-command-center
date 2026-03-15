# Phase 2: Competitor Intel - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning
**Source:** discuss-phase interactive session

<domain>
## Phase Boundary

Build the Competitor Intel panel in the composer sidebar. Captures competitor post content (text, format, engagement) from X via TwitterAPI.io, runs AI theme/format extraction during the daily cron, and surfaces insights in a dual-view panel (per-competitor cards + cross-competitor themes toggle).

Scope: X platform only. Reddit competitor content deferred. Uses existing `poll-competitors` cron as the capture point.

</domain>

<decisions>
## Implementation Decisions

### Data Capture (COMP-01)
- Expand existing `poll-competitors` cron to store actual tweet text, format, and per-tweet engagement — not just aggregate metrics
- Add a `CompetitorPost` Prisma model to store individual competitor tweets (text, format detection, engagement metrics, date)
- X only — Reddit competitor post capture is out of scope for this phase
- Use existing `twitterApiIoRequest()` helper and `/twitter/user/last_tweets` endpoint (already called, just not storing content)

### AI Analysis (COMP-02, COMP-03)
- AI theme extraction runs during the daily `poll-competitors` cron (batch mode), same pattern as Phase 1 insight cards
- Results cached in AIInsight table with competitor-specific category
- Claude Haiku for analysis (cost-efficient, consistent with Phase 1 decision)
- Extract: themes with frequency, content formats with engagement correlation, posting cadence

### Panel UI (COMP-02, COMP-03, COMP-04)
- Dual-view panel with toggle: per-competitor strategy cards AND cross-competitor themes view
- Per-competitor cards: posting cadence, top themes, format breakdown, engagement benchmarks vs our accounts
- Cross-competitor themes: topic-level view across all competitors showing who talks about what
- All 7 competitors displayed equally, sorted by relevance/engagement
- Follow Phase 1 Intel panel pattern: self-contained component, own tRPC queries, staleTime caching

### Claude's Discretion
- CompetitorPost schema design (fields, indexes, retention policy)
- Format detection logic (thread vs single tweet vs reply)
- Theme clustering algorithm/prompt design
- How to calculate "vs our accounts" benchmarks
- Panel tab placement and interaction patterns within the dual-view toggle
- How many days of competitor posts to analyze (window size)

</decisions>

<specifics>
## Specific Ideas

- Existing cron already calls `twitterApiIoRequest('GET', '/twitter/user/last_tweets?userName=...')` — the tweet data is fetched but only aggregate metrics extracted. Storing the full tweet objects is minimal incremental work.
- 7 competitors tracked: Securitize, Ondo Finance, Centrifuge, Superstate, Tokeny Solutions, Goldfinch, Tradable
- CompetitorAccount model already links competitors to X usernames
- AIInsight table already has category field — can use categories like `competitor_themes`, `competitor_formats` for cached analysis
- Phase 1 established the Intel panel pattern: self-contained data-fetching component with no props

</specifics>

<deferred>
## Deferred Ideas

- Reddit competitor post capture (requires SociaVault API integration or new scraping)
- Real-time competitor alerts (use scheduled cron per project constraints)
- Competitor post sentiment analysis (could layer on later)
- Head-to-head comparison tool (interactive competitor selection)

</deferred>

---

*Phase: 02-competitor-intel*
*Context gathered: 2026-03-14 via discuss-phase*
