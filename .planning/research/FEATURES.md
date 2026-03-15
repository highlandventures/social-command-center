# Feature Research

**Domain:** Social listening intelligence — autonomous query management + structured SWT insight categorization (fintech/RWA/blockchain)
**Researched:** 2026-03-14
**Confidence:** HIGH (enterprise tool patterns verified via multiple current sources; SWT framing is project-specific interpretation of established SWOT-via-listening patterns)

---

## Context Note

This is a subsequent milestone on an existing system. "Table stakes" here means features required for the autonomous query management + SWT analysis milestone to feel complete — not requirements for social listening in general. Several general social listening table stakes (sentiment analysis, query builder, hit feed, dismissal, Share of Voice) already exist and are marked with [EXISTING].

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist for this milestone. Missing = the autonomous system feels half-built.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Scheduled query audit cron | Autonomous systems need a heartbeat to check coverage gaps | MEDIUM | Vercel cron; run on a non-polling cycle (e.g., daily or weekly) to avoid cost spikes |
| Coverage gap detection for known brand terms | System should catch when FIGR, $HASH, $YLDS, Provenance, etc. have no active query | MEDIUM | Compare brand entity list against active queries; emit a gap report or trigger generation |
| Auto-generate queries for detected gaps | If a gap is detected, the system generates queries — no human required | MEDIUM | Calls existing `generateQueries` logic; new queries go into staging or auto-activate depending on risk tolerance |
| Competitor parity check | Users expect owned brands and tracked competitors to have equivalent query depth | MEDIUM | Count active queries per entity; flag competitors below threshold (e.g., fewer than N queries vs. brand average) |
| SWT-categorized insight output | Every brand and competitor should show Strengths, Weaknesses, Threats — not just a generic theme list | HIGH | Core deliverable; replaces `extractThemes` with a structured Claude prompt |
| Per-brand SWT filtering in UI | Users expect to filter insights by Figure / Figure Markets / Provenance / $HASH / competitor name | MEDIUM | Filter at query level; UI switch to scope the SWT panel |
| Threats surface negative signals prominently | A Threats section that doesn't highlight crisis-level signals (volume spikes, negative sentiment surges) feels useless | MEDIUM | Weight recent negative hits more heavily in Threats prompt; use existing sentiment + noise data |
| Batch + scheduled SWT analysis (not per-hit) | Enterprise tools all batch analysis; per-hit AI calls are cost-prohibitive and expected to be controlled | MEDIUM | Cron job accumulates hits since last run; passes batch to Claude for categorization |
| Query performance input to refinement | Existing noise/actionable/health metrics should inform whether queries get auto-refined or flagged | LOW | Connect `refineTopicQueries` to automated trigger when health grade drops below threshold |
| [EXISTING] Boolean query builder for X + Reddit | Already present | — | Already validated |
| [EXISTING] Sentiment analysis on hits | Already present | — | Already validated |
| [EXISTING] Query performance tracking | Already present | — | Already validated |

### Differentiators (Competitive Advantage)

Features that go beyond what enterprise tools like Brandwatch or Sprinklr provide out of the box for a fintech niche context.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Fintech/crypto-aware query vocabulary | Generic tools miss ticker symbols ($HASH, $YLDS, FIGR), RWA terminology, and blockchain-specific discourse patterns | MEDIUM | Seed the audit/generation prompts with a maintained entity glossary (tickers, product names, misspellings, community slang) |
| Misspelling + variant coverage audit | Autonomous detection of missing common misspellings (e.g., "Provenence", "Figure Fintech") that users would never manually add | MEDIUM | Include variant generation as part of the coverage gap detection step; this is the main differentiator over manual query curation |
| SWT-by-entity vs. aggregate-only | Most tools give aggregate brand health; per-entity SWT (per brand + per competitor) with filtering is genuinely uncommon at this tier | HIGH | Requires clean entity tagging on ListeningHit rows; filtering logic must be entity-aware not topic-aggregate |
| Competitor weakness pipeline | Automatically surfacing what competitors' users complain about — structured as Weaknesses in their SWT — creates a direct competitive intelligence feed without analyst effort | HIGH | Competitor SWT analysis using the same batch pipeline, with competitor-specific prompts emphasizing pain points and sentiment drivers |
| Query health → auto-refinement loop | Closing the loop: poor-performing queries trigger refinement automatically rather than waiting for manual review | HIGH | Depends on: performance tracking (existing), refinement logic (existing), and a scheduler that wires them together |
| Cost-per-insight tracking | Showing operators the Claude API cost attributed to each SWT analysis run gives visibility that most internal tools lack | LOW | Extend existing `APICallLog` model; tag with `analysisType: 'SWT'` and accumulate per-run cost |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time SWT updates on every new hit | "I want the latest possible analysis" | Per-hit Claude calls are 10-50x more expensive than batched analysis; also creates noisy, low-signal outputs when individual hits lack context | Batch on a 4-12 hour cadence; show "last analyzed at" timestamp so users understand freshness |
| Auto-publishing counter-narratives | "If threats are detected, respond automatically" | Brand voice and crisis response require human judgment; automated responses to threats can escalate crises | Surface threats clearly so humans can act; keep AI in the analysis loop only |
| Custom SWT categories (SWOT, PESTLE, etc.) | Power users will ask for this | v1 complexity explosion; maintaining prompts for multiple frameworks multiplies testing surface area | Deliver SWT well first; add extensibility only after SWT is validated and adopted |
| Full NLP entity extraction from hits (named entity recognition) | "Automatically tag what every hit is about" | NLP entity extraction at hit ingestion time is expensive and often inaccurate for niche fintech/Web3 terms | Use entity affinity scoring at query level (each query is already scoped to an entity/topic) rather than per-hit extraction |
| Per-hit sentiment override UI | "Let me correct wrong sentiment classifications" | Scope creep that delays core autonomous features; low ROI for the milestone goal | Use dismissal + feedback tracking (existing) as the correction mechanism; retrain via prompt adjustment |
| Autonomous query deletion | "Old queries should be cleaned up automatically" | Deleting queries removes historical hit associations; gaps in historical data are worse than noisy queries | Auto-deactivate (set `active: false`) rather than delete; let humans confirm cleanup via a review queue |

---

## Feature Dependencies

```
Coverage Gap Detection
    └──requires──> Entity Glossary (brand names, tickers, variants)
                       └──requires──> Static config or DB table of known entities

Auto-Generate Queries for Gaps
    └──requires──> Coverage Gap Detection
    └──requires──> generateQueries (EXISTING)

Competitor Parity Check
    └──requires──> Coverage Gap Detection (same audit loop)
    └──requires──> Competitor entity list (EXISTING Competitor model)

SWT-Categorized Insights
    └──requires──> Batch hit accumulation logic
    └──requires──> Entity tagging on hits (which brand/competitor each hit relates to)
    └──requires──> Claude prompt for SWT classification

Per-Brand SWT Filtering (UI)
    └──requires──> SWT-Categorized Insights
    └──requires──> Entity tags on SWT output rows

Query Health → Auto-Refinement Loop
    └──requires──> Query performance tracking (EXISTING)
    └──requires──> refineTopicQueries (EXISTING)
    └──requires──> Scheduler that reads health grades and triggers refinement

Cost-Per-Insight Tracking
    └──requires──> APICallLog (EXISTING)
    └──enhances──> SWT batch pipeline (tag calls with analysis type)

Competitor Weakness Pipeline
    └──requires──> SWT-Categorized Insights (same mechanism, competitor-scoped)
    └──enhances──> Per-Brand SWT Filtering
```

### Dependency Notes

- **Entity Glossary is foundational:** Both coverage gap detection and SWT categorization depend on a structured list of known entities (brand names, tickers, product names, variants). Without this, the autonomous system has no way to know what it should be covering or how to attribute SWT findings to a specific brand. This must be built first.
- **Entity tagging on hits enables per-brand filtering:** SWT analysis can only be filtered per-brand if each insight (or the hits feeding it) carries an entity attribution. The existing topic structure gives partial signal (each topic is already brand-scoped), but cross-topic aggregation per-entity requires this link.
- **Auto-refinement requires all three existing pieces to wire together:** Query performance tracking exists, refinement logic exists — what's missing is the scheduler that connects them automatically. The dependency is orchestration, not capability.
- **Competitor parity and brand gap detection can share the same audit cron:** Running two separate cron jobs is wasteful; the audit loop should handle both owned brands and competitors in a single pass.

---

## MVP Definition

### Launch With (v1)

Minimum viable product for this milestone — enough to make query management autonomous and insights actionable.

- [ ] Entity glossary (config-driven) — brands, tickers, products, key competitors with name variants; foundational for everything else
- [ ] Coverage gap detection cron — daily audit comparing entity list against active queries; logs gaps
- [ ] Auto-generate queries for detected gaps — call existing generation logic; new queries activate after a brief review window (or auto-activate if confidence threshold met)
- [ ] Competitor parity check — same audit loop; flag competitors below coverage threshold
- [ ] Batch SWT analysis cron — runs on accumulated hits (4h or 12h cadence); outputs categorized Strengths/Weaknesses/Threats per entity
- [ ] Per-brand SWT filter in UI — switch/selector to view SWT panel scoped to one brand or competitor

### Add After Validation (v1.x)

Add once v1 is running and producing output that users interact with.

- [ ] Query health → auto-refinement trigger — connect performance grades to automated refinement; add when users trust auto-generated queries enough to also trust auto-refinement
- [ ] Misspelling + variant coverage audit — extend entity glossary to include common misspellings; add after base glossary proves stable
- [ ] Cost-per-insight tracking — tag SWT cron runs in APICallLog; add when cost visibility becomes operationally relevant

### Future Consideration (v2+)

Defer until SWT and autonomous queries are validated and adopted.

- [ ] Real-time threat alerting (push/email) — valuable but explicitly out of scope per PROJECT.md; add only after SWT baseline proves reliable enough that alerts won't create noise fatigue
- [ ] Predictive trend forecasting — requires more historical data accumulation than v1 will have; premature without 3-6 months of SWT data
- [ ] Multi-language query support — English-only is correct constraint for v1 given Figure's primary market

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Entity glossary (config) | HIGH | LOW | P1 |
| Coverage gap detection cron | HIGH | MEDIUM | P1 |
| Auto-generate queries for gaps | HIGH | MEDIUM | P1 |
| Competitor parity check | HIGH | LOW | P1 |
| Batch SWT analysis cron | HIGH | HIGH | P1 |
| Per-brand SWT filter in UI | HIGH | MEDIUM | P1 |
| Query health → auto-refinement | MEDIUM | MEDIUM | P2 |
| Misspelling/variant audit | MEDIUM | MEDIUM | P2 |
| Cost-per-insight tracking | LOW | LOW | P2 |
| Real-time threat alerting | HIGH | HIGH | P3 |
| Predictive trend forecasting | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone to deliver its stated value
- P2: Should have once core loop is working
- P3: Future milestone material

---

## Competitor Feature Analysis

How leading enterprise tools approach the two core problems (query management and structured insights) vs. this project's approach.

| Feature | Brandwatch | Sprinklr | This Project |
|---------|------------|----------|--------------|
| Query generation | AI-assisted (Iris); still largely manual initiation | AI Copilot for natural language queries | Fully autonomous cron-driven gap detection + generation |
| Query maintenance | Manual; analysts update Boolean strings | Manual + AI suggestions | Automated health-grade trigger → refine or deactivate |
| Insight categorization | Emotion clustering, theme surfacing; no SWT framing | AI summaries, anomaly detection; no SWT framing | Explicit SWT categories per entity — structured for competitive intelligence |
| Per-entity filtering | Yes, by brand/topic | Yes, by brand/workspace | Yes — per brand + per competitor with same pipeline |
| Crisis/threat detection | Real-time anomaly detection (Iris React Score) | 10B predictions/day; proactive crisis alerts | Threats category in SWT batch; real-time alerting deferred to future milestone |
| Competitor coverage parity | Manual setup; no auto-audit | Manual setup | Automated parity check — flagging competitors below coverage threshold |
| Fintech/crypto vocabulary | Generic; requires manual customization | Generic; requires manual customization | Entity glossary seeded with Figure-specific terms, tickers, RWA vocabulary |
| Cost model | Per-seat SaaS ($thousands/month) | Enterprise custom pricing | Per-run Claude API costs (batched); tracked in-system |

---

## Sources

- [G2: Best Enterprise Social Media Listening Tools 2026](https://www.g2.com/categories/social-media-listening-tools/enterprise)
- [Meltwater: Top 13 Social Listening Tools 2026](https://www.meltwater.com/en/blog/top-social-listening-tools)
- [Brandwatch: Top 12 Social Listening Tools 2026](https://www.brandwatch.com/blog/social-listening-tools/)
- [Sprinklr: Social Listening Guide 2025](https://www.sprinklr.com/blog/social-listening/)
- [Sprout Social: Competitive Analysis via Social Listening 2025](https://sproutsocial.com/insights/strengthen-competitive-analysis-strategy-social-listening/)
- [Talkwalker: Boolean Operators Guide](https://www.talkwalker.com/blog/boolean-operators)
- [Revuze: Why Boolean Queries Are Breaking Social Listening](https://www.revuze.it/blog/boolean-queries-social-listening/)
- [Infegy: What's Wrong With Modern Social Listening — Query Writing](https://www.infegy.com/blog/whats-wrong-with-social-listening)
- [Talkwalker: Next-Generation AI Social Listening](https://www.talkwalker.com/blog/next-generation-social-listening-ai)
- [Influencer Marketing Hub: Social Media Listening in 2025](https://influencermarketinghub.com/social-media-listening-report/)
- [The Social Intelligence Lab: State of Social Listening 2025](https://www.thesilab.com/state-of-social-listening)
- [Pulsar: Social Listening for Fintech](https://www.pulsarplatform.com/guides/social-listening-fintech)
- [thecmo.com: Social Listening Trends 2026](https://thecmo.com/demand-generation/social-listening-trends/)

---

*Feature research for: Social Listening Intelligence — Autonomous Query Management + SWT Analysis*
*Researched: 2026-03-14*
