# Project Research Summary

**Project:** Social Command — Autonomous Listening Intelligence Milestone
**Domain:** Autonomous social listening query management + structured SWT (Strengths / Weaknesses / Threats) insight categorization (fintech/RWA/blockchain)
**Researched:** 2026-03-14
**Confidence:** HIGH

## Executive Summary

This is an additive milestone on an existing, production Next.js 14 / Prisma 5.14 / tRPC 10 / Vercel platform. The core problem is that query management and insight generation are both manual today: operators hand-curate Boolean queries and receive generic AI theme summaries. The milestone replaces both with autonomous systems — a nightly Query Expansion Engine that detects coverage gaps and generates/retires queries without human initiation, and a daily SWT Insight Engine that categorizes accumulated listening hits into Strengths, Weaknesses, and Threats per brand and competitor. The infrastructure backbone (cron jobs, AI wrapper, performance counters, KV cache) is already in place; the work is building the two new modules on top of it.

The recommended approach is batch-first, additive-writes-only, and audit-trailed. Every design decision points to the same constraint: autonomous systems that silently modify data or call AI too frequently erode operator trust and blow cost budgets. The expansion engine should run once nightly (not per poll cycle), write only new queries (never delete history), and log every change with a rationale. The SWT engine should batch hits per topic in a 7-day window, run one Claude Haiku 4.5 call per topic per day, and always surface a "based on N hits as of [date]" freshness timestamp. The only required package change is upgrading `@anthropic-ai/sdk` from 0.24.0 to 0.78.0 to access structured outputs.

The two highest risks are architectural, not technical. First: the existing `refineTopicQueries` mutation already uses a delete-and-recreate pattern that would destroy query performance history if replicated in the autonomous cron — this must be caught at design time, not discovered in production. Second: SWT categories are strategic, not sentiment labels — an implementation that maps POSITIVE → Strength and NEGATIVE → Weakness will ship a feature that looks complete but is analytically worthless. Both risks are fully preventable with clear prompt engineering and a no-delete policy enforced from day one.

---

## Key Findings

### Recommended Stack

The existing stack requires only one change: upgrade `@anthropic-ai/sdk` from 0.24.0 to 0.78.0. This unlocks `client.messages.parse()` and `zodOutputFormat()` for schema-guaranteed structured outputs — critical for SWT where a missing `category` field breaks the UI filter. Everything else (Zod, Prisma, Vercel KV, Vercel Cron) is already installed and correctly versioned.

For model selection: use Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for scheduled batch SWT analysis (~5x cheaper than Sonnet, adequate quality for categorical classification of aggregated hit data) and keep Claude Sonnet 4.6 for the expansion engine's query generation where higher output quality justifies the cost.

**Core technologies:**
- `@anthropic-ai/sdk@^0.78.0`: structured outputs via `zodOutputFormat()` — only package requiring upgrade
- `claude-haiku-4-5-20251001`: batch SWT analysis — $1/MTok input, 200k context, structured output support confirmed
- `claude-sonnet-4-6` (existing): query expansion generation — higher quality output for query strings that affect data collection
- `zod@^3.23.0` (existing): schema definition for `SWTAnalysis` output — already at correct version
- `Prisma@^5.14.0` (existing): `createMany` with `skipDuplicates: true` for gap record insertion; no version change needed
- `@vercel/kv` (existing): distributed lock + SWT result cache keyed by `swt:topic:{topicId}` with 24h TTL

See `.planning/research/STACK.md` for full analysis including what NOT to use (LangChain, streaming responses, per-hit classification).

### Expected Features

This milestone's table stakes are scoped to making autonomous query management and SWT analysis feel complete — not general social listening features (which already exist).

**Must have (table stakes):**
- Entity glossary (config-driven) — brands, tickers, products, competitor name variants; foundational for everything else; without it, the audit has no source of truth
- Coverage gap detection cron — daily audit comparing entity list against active queries per topic
- Auto-generate queries for detected gaps — calls existing `generateQueries` logic; new queries start `active=false` for review
- Competitor parity check — same audit loop flags competitors below coverage threshold; shares entity glossary
- Batch SWT analysis cron — 7-day hit window, one Claude call per qualifying topic, structured S/W/T output
- Per-brand SWT filter in UI — brand/competitor selector scoping the SWT panel; defaults to primary owned brand

**Should have (competitive):**
- Query health → auto-refinement trigger — wire existing `refineTopicQueries` to a scheduler that fires when health grade drops; add after users trust auto-generated queries
- Misspelling + variant coverage audit — extend entity glossary to include common misspellings after base glossary proves stable
- Cost-per-insight tracking — tag SWT cron runs in `APICallLog` with `analysisType: 'SWT'`; add when cost visibility becomes operationally relevant
- Fintech/crypto-aware query vocabulary — glossary seeded with tickers (`$HASH`, `$YLDS`), RWA terminology, and community slang that generic tools miss

**Defer (v2+):**
- Real-time threat alerting (push/email) — depends on SWT baseline being reliable enough that alerts won't create noise fatigue
- Predictive trend forecasting — requires 3-6 months of SWT data history; premature for v1
- Custom framework support (SWOT, PESTLE) — defer until SWT is validated and adopted; multiple frameworks multiply testing surface area

See `.planning/research/FEATURES.md` for full feature dependency graph and competitor analysis vs. Brandwatch/Sprinklr.

### Architecture Approach

The two new systems — Query Expansion Engine and SWT Insight Engine — are additive modules that plug into the existing 3-tier pipeline without modifying it. The expansion engine reads `ListeningQuery` performance counters and writes back new/deactivated queries plus an audit log. The SWT engine reads `ListeningHit` records and writes structured `AIInsight` records cached in Vercel KV. Both are orchestrated by new Vercel Cron entries and expose tRPC triggers for on-demand admin use. The shared logic module pattern (one `lib/*.js` file called by both cron handler and tRPC trigger) is already established in the codebase and should be followed for both new components.

**Major components:**
1. **Schema additions** — Add `SWT_ANALYSIS` to `InsightType` enum; add `QueryExpansionLog` model; add nullable `competitorId` FK to `ListeningTopic` (required for parity audit correctness)
2. **Query Expansion Engine** (`lib/query-expander.js` + `app/api/cron/expand-queries/route.js`) — nightly at 01:00 UTC; reads all active topics + competitor keywords; calls Claude Sonnet once (batch all topics); writes new queries, deactivates retirements, logs every change
3. **SWT Insight Engine** (`lib/swt-analyzer.js` + `app/api/cron/swt-analysis/route.js`) — daily at 03:30 UTC; one Claude Haiku call per qualifying topic (>= 10 hits in 7-day window); writes to `AIInsight` + caches in KV
4. **tRPC procedures** — `listening.swtInsights` (KV-cached read), `listening.queryExpansionLog` (audit trail), `listening.triggerSwtAnalysis`, `listening.triggerExpansion` (admin on-demand triggers)
5. **Frontend SWT panel** — Extension of `app/(dashboard)/listening/page.jsx`; three-column Strengths/Weaknesses/Threats view with brand filter and "last analyzed" timestamp

**Build order (dependency-driven):** Schema → SWT Analyzer → tRPC reads → Frontend SWT panel → Query Expansion Engine → Expansion log UI.

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, cost projections (~$0.30/day at current scale), and scaling considerations.

### Critical Pitfalls

1. **Autonomous expansion wiping query performance history** — The existing `refineTopicQueries` mutation already uses a delete-and-recreate pattern. Never call `deleteMany` from an autonomous process. Implement query reconciliation: match by `(platform, queryString)` fingerprint, preserve counters on matched rows, create genuinely new rows, set `active=false` on retirements. Verify by checking `totalHits` is non-zero on kept queries after a full expansion cycle.

2. **SWT categories becoming sentiment rebranding** — Do not map POSITIVE → Strength, NEGATIVE → Weakness. Feed raw content snippets to Claude with explicit category definitions (Strength = perceived differentiation; Weakness = addressable gap; Threat = external risk signal). Validate by checking that a competitor-positive hit appears in Threats, not Strengths. If SWT distribution mirrors sentiment distribution, the prompt is wrong.

3. **Query proliferation without a ceiling** — AI errs toward completeness when asked to find gaps. Enforce a hard limit (8–12 active queries per topic per platform). New autonomous queries start `active=false` staging. Rate-limit expansion to once per topic per week using a KV timestamp check.

4. **Vercel cron timeout on full expansion run** — At 15+ topics with Claude calls, sequential processing easily exceeds the 300-second Pro limit. Architect batching from day one: process 3–5 topics per invocation using KV to track progress, or use per-brand cron routes staggered in `vercel.json`. Set `export const maxDuration = 300` in all new cron route handlers.

5. **Competitor parity audit using wrong source of truth** — `Competitor` and `ListeningTopic` have no FK link; the audit cannot reliably reconcile them by name-matching. Add `competitorId String?` FK to `ListeningTopic` as part of the schema migration, backfill existing rows, and use a LEFT JOIN for the parity check before building the audit cron.

6. **Niche term hallucination in autonomous queries** — Post-2024 RWA/fintech terms are underrepresented in Claude's training data. Build a `KNOWN_TERMS` canonical glossary from human curation (not AI generation) and inject it into every expansion prompt. Require human review for any query introducing an unverified term.

See `.planning/research/PITFALLS.md` for full pitfall analysis, technical debt patterns, integration gotchas, and a "looks done but isn't" checklist.

---

## Implications for Roadmap

Based on combined research, the architecture's prescribed build order and the pitfall dependency mapping align on a clear 5-phase structure.

### Phase 1: Schema Foundation + Entity Glossary
**Rationale:** Everything in this milestone depends on two things that don't exist yet: a correct data schema (including the `competitorId` FK that makes the parity audit reliable) and a canonical entity glossary (which makes both coverage gap detection and SWT attribution possible). Without these, every subsequent phase is building on sand.
**Delivers:** Prisma migration with `SWT_ANALYSIS` enum value, `QueryExpansionLog` model, and `competitorId` FK on `ListeningTopic`; entity glossary seeded with Figure brands, tickers, competitor names, and key variants
**Addresses:** Entity glossary (P1 feature), schema readiness for all downstream work
**Avoids:** Competitor FK pitfall (Pitfall 6), niche term hallucination (Pitfall 7 — glossary is the prevention)

### Phase 2: SWT Insight Engine (Batch Analysis + Cron)
**Rationale:** SWT is the highest-value deliverable and has zero dependencies on the expansion engine. Building it first means the milestone delivers concrete user value even if query expansion requires more tuning. The SWT prompt engineering is also the most design-sensitive work — it needs iteration time before the UI is built on top of it.
**Delivers:** `lib/swt-analyzer.js` module, `app/api/cron/swt-analysis/route.js`, Claude Haiku structured output integration, `AIInsight` records with `SWT_ANALYSIS` type, KV cache layer
**Uses:** `@anthropic-ai/sdk@^0.78.0` upgrade, `zodOutputFormat()` for schema-guaranteed JSON, Claude Haiku 4.5 for cost efficiency
**Implements:** SWT Insight Engine (Architecture Component 2)
**Avoids:** SWT = sentiment rebranding (Pitfall 3), per-hit classification anti-pattern, SWT stored only in KV (Pitfall 5)

### Phase 3: SWT UI + tRPC Read Layer
**Rationale:** Once the analyzer cron can write real `AIInsight` records, the UI can be built against actual data. The tRPC procedures are the interface contract between backend and frontend and should be finalized before the component is implemented. The "last analyzed" timestamp and "Analyze now" admin trigger are required in this phase (not deferred) to address the cache staleness pitfall.
**Delivers:** `listening.swtInsights` tRPC procedure with KV cache, `listening.triggerSwtAnalysis` admin trigger, SWT panel in `app/(dashboard)/listening/page.jsx` with brand filter and freshness timestamp
**Implements:** tRPC procedure additions (Architecture Component 4), Frontend SWT panel (Architecture Component 5)
**Avoids:** SWT cache staleness UX pitfall, default-to-all-brands anti-pattern (default to primary owned brand)

### Phase 4: Query Expansion Engine (Cron + Audit Log)
**Rationale:** Building expansion after SWT is working means the milestone has shipped demonstrable value before touching the higher-risk autonomous write path. The expansion engine modifies `ListeningQuery` records, which directly affects data collection — this deserves its own phase with targeted testing. The batching architecture must be designed upfront (not retrofitted) to avoid the cron timeout pitfall.
**Delivers:** `lib/query-expander.js` module, `app/api/cron/expand-queries/route.js`, query reconciliation logic (no delete-and-recreate), per-topic expansion limits, `active=false` staging for new queries, `QueryExpansionLog` writes
**Uses:** Existing `generateQueries`/`refineTopicQueries` logic wired into autonomous context; `generatedBy: 'auto-expand'` field already supported on `ListeningQuery`
**Implements:** Query Expansion Engine (Architecture Component 1)
**Avoids:** Performance history deletion (Pitfall 1 — highest severity), query proliferation (Pitfall 2), Vercel timeout (Pitfall 4)

### Phase 5: Coverage Gap Detection + Competitor Parity Audit
**Rationale:** This phase closes the automation loop: the expansion engine generates queries, but something must detect which topics need expansion and which competitors have insufficient coverage. This depends on Phase 4's expansion engine being stable and the Phase 1 `competitorId` FK being correctly backfilled. Running both owned-brand and competitor parity in a single audit loop avoids duplicated cron overhead.
**Delivers:** Coverage gap detection algorithm (compare entity glossary against active queries per platform), competitor parity check (LEFT JOIN on `competitorId`), expansion log UI (timeline of autonomous changes with rationale), `listening.queryExpansionLog` tRPC procedure
**Addresses:** Coverage gap detection (P1), competitor parity check (P1), query expansion log UI
**Avoids:** Parity audit using string-matching instead of FK join (Pitfall 6)

### Phase Ordering Rationale

- Schema first because `competitorId` FK and `QueryExpansionLog` model are required by Phase 4 and 5 respectively — building either without the schema is impossible
- SWT before expansion because SWT has no write-side risk (only reads `ListeningHit`, writes to `AIInsight`), delivers immediate user value, and allows the AI integration pattern to be validated before the more sensitive query-modifying work begins
- UI after backend because the SWT panel needs real data to be useful; stubbing with mock data is possible but wastes iteration cycles
- Expansion before parity because gap detection is meaningless without the expansion engine to act on detected gaps — the audit outputs feed directly into expansion triggers
- Expansion log UI last because it is purely cosmetic; the system works correctly without it and it can be added incrementally

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (SWT prompt engineering):** The prompt design for SWT categories is the most critical correctness risk in the milestone. The distinction between Strength/Weakness/Threat requires precise definitions that may need iteration against real hit data before they stabilize. Plan for a prompt validation sub-phase with a sample of actual production hits.
- **Phase 4 (Expansion batching architecture):** The specific strategy for batching topics across Vercel invocations (per-brand cron routes vs. KV-tracked batch index) should be decided at design time, not during implementation. Both approaches are viable; the choice affects the `vercel.json` structure and the cron route file organization.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Schema migration):** Prisma migrations are well-understood; the specific additions (`SWT_ANALYSIS` enum, `QueryExpansionLog` model, nullable FK) are straightforward. No research needed.
- **Phase 3 (SWT UI):** Extends an existing page with an established component pattern (multi-select filter already present). Standard React Query + tRPC pattern.
- **Phase 5 (Gap detection algorithm):** The core algorithm (compare entity list against active query set, LEFT JOIN for competitor gaps) is pure database logic with no novel patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Single package upgrade (`@anthropic-ai/sdk`); everything else confirmed installed and version-compatible. Anthropic SDK 0.78.0 structured output API verified against official docs. |
| Features | HIGH | Features derived from direct codebase review of existing capabilities + validated enterprise tool comparisons (Brandwatch, Sprinklr). Table stakes are clearly bounded by what already exists vs. what doesn't. |
| Architecture | HIGH | Architecture derived directly from codebase analysis — existing patterns (`lib/listening-scanner.js`, `weekly-ai-insights`, `lib/redis.js`) are the blueprint. Component boundaries are concrete, not speculative. |
| Pitfalls | HIGH | Pitfalls sourced from direct code review (the delete-and-recreate bug already exists in `refineTopicQueries`; this is not hypothetical). Vercel timeout behavior verified against official docs. LLM categorization risks verified against structured output reliability research. |

**Overall confidence:** HIGH

### Gaps to Address

- **SWT prompt quality:** The research defines what SWT categories should mean and how to avoid mapping them to sentiment, but the specific prompt wording and few-shot examples need to be written and validated against real production hits during implementation. No amount of research pre-validates a prompt — it must be tested empirically.
- **Entity glossary content:** The glossary is architecturally straightforward (config file or DB table) but its contents (all brand names, product names, tickers, competitor terms, misspellings) require human curation from the Figure team. This is a content dependency, not a technical one, but it is blocking for Phase 1.
- **Expansion staging approval workflow:** The research recommends that autonomous queries start `active=false` and activate after a quality gate. Whether that gate is "human reviews in a UI" or "automated quality check after N poll cycles" is a product decision not resolved in research. Needs clarification from stakeholders before Phase 4 is specced.
- **Haiku 4.5 SWT output quality:** The model selection research recommends Haiku for cost reasons but notes that if categorical output quality proves insufficient in staging, upgrading to Sonnet is the fallback. This is a test-and-decide gap, not a research gap — verify Haiku quality on real hits in Phase 2 before committing to it for production.

---

## Sources

### Primary (HIGH confidence)
- [Anthropic Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — `output_config.format`, `zodOutputFormat` API shape, supported models
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — model IDs, pricing per MTok, Haiku 4.5 structured output support
- [Anthropic SDK npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — current version 0.78.0 confirmed
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — invocation behavior, plan limits, function duration
- [Prisma createMany docs](https://www.prisma.io/docs/orm/prisma-client/queries/crud) — `skipDuplicates` PostgreSQL support
- Codebase direct review — `lib/listening-scanner.js`, `lib/routers/listening.js`, `lib/ai.js`, `prisma/schema.prisma`, `app/api/cron/weekly-ai-insights/route.js`, `vercel.json`

### Secondary (MEDIUM confidence)
- [G2: Best Enterprise Social Media Listening Tools 2026](https://www.g2.com/categories/social-media-listening-tools/enterprise) — competitive feature landscape
- [The Social Intelligence Lab: State of Social Listening 2025](https://www.thesilab.com/state-of-social-listening) — AI overtrust patterns, query quality practitioner findings
- [Upstash: Get Rid of Vercel Timeouts](https://upstash.com/blog/vercel-cost-workflow) — batching strategies for long-running serverless jobs
- [Cognitive Today: Structured Output AI Reliability](https://www.cognitivetoday.com/2025/10/structured-output-ai-reliability/) — JSON schema enforcement, hallucination in structured outputs

### Tertiary (LOW confidence)
- [LLMs in Computational Social Science — Springer](https://link.springer.com/article/10.1007/s13278-025-01428-9) — LLM annotation reliability limits (context for SWT categorization quality expectations)

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
