# Listening Intelligence

## What This Is

An upgrade to Social Command's social listening engine that makes query management fully autonomous and transforms generic AI summaries into structured Strengths / Weaknesses / Threats (SWT) analysis. The system should maintain comprehensive brand and competitor coverage without manual intervention, and surface categorized insights that teams can filter per-brand and act on — especially for crisis monitoring and competitive intelligence.

## Core Value

Every relevant conversation about our brands and competitors is captured automatically, and the AI surfaces actionable patterns (strengths to amplify, weaknesses to address, threats to counter) — not just summaries.

## Requirements

### Validated

<!-- Existing capabilities that work and are relied upon -->

- ✓ Topic-based listening with boolean queries for X and Reddit — existing
- ✓ AI-assisted query generation via Claude (generateQueries endpoint) — existing
- ✓ AI-assisted query refinement with performance context (refineTopicQueries) — existing
- ✓ Heuristic scoring and relevance classification of hits — existing
- ✓ Sentiment analysis (POSITIVE/NEUTRAL/NEGATIVE) on listening hits — existing
- ✓ Query performance tracking (noise rate, actionable rate, health grade) — existing
- ✓ Generic theme extraction from recent hits (extractThemes) — existing
- ✓ Mention volume metrics with topic/sentiment/platform breakdown — existing
- ✓ Cron-based polling for listening topics (poll-listening) — existing
- ✓ Hit dismissal with feedback tracking (dismissed/spam counters) — existing
- ✓ Multi-select brand and platform filtering — existing
- ✓ Competitor tracking with Share of Voice — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] System autonomously detects query coverage gaps and expands/refines queries without human intervention
- [ ] System periodically audits all topic queries against known brand names, products, tickers, and common misspellings
- [ ] Competitor topic queries are as comprehensive as owned brand queries (parity)
- [ ] AI insights are categorized into Strengths, Weaknesses, and Threats (SWT) per brand/competitor
- [ ] Users can filter SWT analysis by individual brand or competitor
- [ ] Threats category surfaces crisis signals: negative narratives gaining traction, emerging competitors, PR risks
- [ ] Weaknesses category identifies consumer-perceived gaps and areas for improvement
- [ ] Strengths category identifies what consumers value most about each brand
- [ ] SWT analysis runs cost-efficiently (batched, cached, incremental — not per-hit)
- [ ] Query expansion runs cost-efficiently (scheduled, not on every poll cycle)

### Out of Scope

- Real-time alerting/push notifications for threats — defer to future milestone
- Automated response/counter-narrative generation — humans decide actions
- Custom SWT categories beyond Strengths/Weaknesses/Threats — keep it simple for v1
- Multi-language query support — English only for now

## Context

The social listening system already has strong bones: topic/query/hit pipeline, AI-assisted query generation, sentiment analysis, query performance tracking with noise/actionable metrics, and dismissal feedback loops. The main gaps are:

1. **Query management is manual.** Michelle currently works with Claude to generate and refine queries, then feeds them into the system. This is time-consuming and means queries drift as new products/terms emerge.

2. **AI insights are generic summaries.** The extractThemes endpoint pulls top themes but doesn't categorize them into actionable buckets (strengths vs weaknesses vs threats).

3. **Competitor coverage is inconsistent.** Some competitors have thorough queries, others are thin. No automated parity check exists.

The system uses Figure Technology Solutions' context (FIGR, Figure Markets, Provenance Blockchain, $HASH, $YLDS, etc.) and tracks competitors like Securitize, Ondo Finance, Centrifuge, Superstate, Tokeny, Goldfinch, and Tradable.

**Cost concerns:** Both API call costs (Claude for analysis, TwitterAPI.io/SociaVault for fetching) and human time for query curation are too high. The autonomous system must be cheaper than the current manual process.

## Constraints

- **API costs**: Query expansion and SWT analysis must be batched/scheduled (not real-time) to control Claude API spend
- **Existing schema**: Build on the current ListeningTopic/ListeningQuery/ListeningHit/Competitor models — don't rebuild
- **Platform**: Vercel serverless (cron jobs, no long-running processes)
- **AI model**: Claude Sonnet 4 for analysis tasks (already used in query generation)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SWT (not SWOT) | Opportunities are internal strategy, not derived from listening data — Threats covers external signals | — Pending |
| Fully autonomous query management | Manual curation doesn't scale and costs too much human time | — Pending |
| Per-brand SWT filtering | Team needs to see each brand/competitor individually, not just aggregate | — Pending |
| Batch/scheduled over real-time | Cost control — run analysis on accumulated data, not per-hit | — Pending |

---
*Last updated: 2026-03-14 after initialization*
