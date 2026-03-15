# Architecture Research

**Domain:** Autonomous Query Management + Structured SWT Insight Engine (Listening Intelligence)
**Researched:** 2026-03-14
**Confidence:** HIGH — derived directly from codebase analysis + existing pipeline understanding

---

## System Overview

The existing listening pipeline is a 3-tier cron-driven pipeline: platform APIs fetch raw posts → scanner scores and deduplicates → hits land in the database. The two new systems — Query Expansion Engine and SWT Insight Engine — are additive layers that plug in at different points without disrupting the existing flow.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SCHEDULED CRONS (Vercel Cron, vercel.json)                             │
│                                                                         │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────────┐ │
│  │ poll-listening      │  │ expand-queries (NEW) │  │ swt-analysis  │ │
│  │ every 10 min        │  │ nightly / weekly     │  │ (NEW) daily   │ │
│  └────────┬────────────┘  └──────────┬───────────┘  └───────┬────────┘ │
│           │                          │                       │          │
└───────────┼──────────────────────────┼───────────────────────┼──────────┘
            │                          │                       │
            ▼                          ▼                       │
┌───────────────────────────────────────────────────────┐      │
│  LISTENING PIPELINE (existing lib/listening-scanner)  │      │
│                                                       │      │
│  X / Reddit APIs → raw hits                           │      │
│         ↓                                             │      │
│  Dedup + negative keyword filter                      │      │
│         ↓                                             │      │
│  Heuristic score (60% content, 25% engagement,        │      │
│                   15% followers)                      │      │
│         ↓                                             │      │
│  Sentiment (keyword heuristic → Claude upgrade)       │      │
│         ↓                                             │      │
│  ListeningHit written to DB                           │      │
│         ↓                                             │      │
│  High-score hits → InboxItem                          │      │
└───────────────────────────────────────────────────────┘      │
            │                                                   │
            ▼                                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│  DATABASE (Vercel Postgres / Prisma)                                  │
│                                                                       │
│  ListeningTopic → ListeningQuery → ListeningHit (existing)            │
│  Competitor → CompetitorKeyword (existing)                            │
│  AIInsight (existing, insightType enum — needs SWT_ANALYSIS added)    │
│  QueryExpansionLog (NEW — tracks autonomous query changes)            │
└───────────────────────────────────────────────────────────────────────┘
            │                                                   │
            ▼                                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│  tRPC API LAYER (lib/routers/listening.js — existing)                 │
│                                                                       │
│  Existing: topics.list, hits.list, queryPerformance, extractThemes    │
│  New procedures to add:                                               │
│  - listening.swtInsights (read latest per-brand SWT)                  │
│  - listening.queryExpansionLog (audit trail for autonomous changes)   │
└───────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  FRONTEND (app/(dashboard)/listening/page.jsx)                        │
│                                                                       │
│  Existing: hits feed, topic list, query performance panel             │
│  New UI surfaces:                                                     │
│  - SWT insight panel (per-brand tabs: Strengths / Weaknesses /        │
│    Threats, with representative hit excerpts)                         │
│  - Query expansion changelog (what was auto-added/retired, why)       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### Component 1: Query Expansion Engine

**What it owns:** Autonomous detection of query coverage gaps across all active topics. Adds missing queries, retires high-noise queries, ensures competitor topic parity with owned-brand topics.

**What it does NOT own:** Polling (that stays in `listening-scanner.js`). It only modifies `ListeningQuery` rows.

**Location:** `app/api/cron/expand-queries/route.js` + shared logic in `lib/query-expander.js`

**Communicates with:**
- `prisma.listeningTopic` (reads all active topics + their queries)
- `prisma.listeningQuery` (reads performance metrics; creates/deactivates queries)
- `prisma.competitor` + `prisma.competitorKeyword` (reads known competitor terms for parity checks)
- `lib/ai.js` → `generateInsight()` (calls Claude Sonnet 4 with performance context)
- `prisma.queryExpansionLog` (NEW — writes audit trail of every autonomous change)

**Trigger:** Vercel Cron, once daily at off-peak (e.g., 01:00 UTC). Does NOT run every poll cycle.

**Inputs to Claude:**
- Topic name + description
- Existing queries with performance counters (totalHits, actionableRate, noiseRate, health grade)
- Known brand/product/ticker vocabulary (same company context already in `generateQueries`)
- Competitor keyword list from `CompetitorKeyword` table
- Instruction: identify gaps, propose additions, flag retirements

**Output from Claude:**
- `queriesToAdd[]` — new query objects (same schema as existing `ListeningQuery`)
- `queriesToRetire[]` — query IDs that should be deactivated (high noise, zero hits)
- `rationale` — human-readable explanation per change (written to expansion log)

---

### Component 2: SWT Insight Engine

**What it owns:** Categorized AI analysis of accumulated listening hits. Produces per-brand/competitor Strengths / Weaknesses / Threats analysis stored in `AIInsight`.

**What it does NOT own:** Fetching hits (scanner does that), displaying hits (frontend does that).

**Location:** `app/api/cron/swt-analysis/route.js` + shared logic in `lib/swt-analyzer.js`

**Communicates with:**
- `prisma.listeningHit` (reads recent high-quality hits, grouped by topicId)
- `prisma.listeningTopic` (maps topicId → brand/competitor name)
- `lib/ai.js` → `generateInsight()` (calls Claude Sonnet 4 with batched hit summaries)
- `prisma.aIInsight` (writes new records with `insightType: 'SWT_ANALYSIS'`)

**Trigger:** Vercel Cron, once daily (e.g., 03:30 UTC, after `poll-competitors` at 03:00). Can also be triggered on-demand via tRPC mutation for the admin panel.

**Data window:** Last 7 days of hits per topic (configurable), filtered to non-dismissed hits with `aiRelevance` of HIGH or MEDIUM. Minimum threshold of 10 qualifying hits before generating analysis (avoids noise-only outputs).

**Inputs to Claude:**
- Topic name + brand context
- Up to 60 hit excerpts (content + sentiment + heuristicScore), top-scored first
- Instruction: categorize patterns into Strengths / Weaknesses / Threats with evidence

**Output structure (stored in `AIInsight.content`):**
```json
{
  "topicId": "...",
  "topicName": "Figure Markets",
  "dataWindow": { "from": "...", "to": "...", "hitCount": 42 },
  "strengths": [
    { "theme": "...", "evidence": "...", "hitCount": 8, "confidence": "HIGH" }
  ],
  "weaknesses": [...],
  "threats": [
    { "theme": "...", "evidence": "...", "hitCount": 3, "confidence": "MEDIUM", "urgency": "HIGH" }
  ]
}
```

**Caching:** Latest SWT record per topic is cached in Vercel KV (TTL 24h) keyed by `swt:topic:{topicId}`. The tRPC read procedure checks KV before hitting Postgres.

---

### Component 3: Schema Additions (Prisma)

**New enum value:** Add `SWT_ANALYSIS` to `InsightType` enum.

**New model:** `QueryExpansionLog` — audit trail for all autonomous query changes.

```
QueryExpansionLog {
  id             String   (cuid)
  topicId        String   → ListeningTopic
  action         String   ("ADD_QUERY" | "RETIRE_QUERY" | "ADD_TOPIC")
  queryId        String?  → ListeningQuery (for retirements)
  queryString    String?  (for additions — before creation)
  platform       Platform?
  rationale      String
  generatedBy    String   @default("auto-expand")
  createdAt      DateTime
}
```

**No other schema changes.** Existing `ListeningQuery` fields (`generatedBy`, `active`, performance counters) are already sufficient for the expansion engine to read and write.

---

### Component 4: tRPC Procedure Additions

**`listening.swtInsights`** — Returns latest SWT analysis per topic. Checks KV cache first. Input: optional `topicIds[]` for filtering.

**`listening.triggerSwtAnalysis`** — Admin-only on-demand trigger. Calls `lib/swt-analyzer.js` directly (same pattern as `triggerScan`).

**`listening.queryExpansionLog`** — Paginated read of expansion history. Shows what was auto-added/retired and why.

**`listening.triggerExpansion`** — Admin-only on-demand trigger for query expansion.

These are additive to `lib/routers/listening.js`. No existing procedures need modification.

---

### Component 5: Frontend SWT Panel

**Location:** Extension of `app/(dashboard)/listening/page.jsx`

**What it adds:**
- SWT tab or section alongside the existing hits feed
- Brand/competitor selector (reuses existing multi-select filter pattern)
- Three columns: Strengths | Weaknesses | Threats
- Each column shows 2-5 themes with evidence snippets and hit counts
- "Last analyzed" timestamp + "Analyze now" button (calls `triggerSwtAnalysis`)

**What it reads:** `trpc.listening.swtInsights.useQuery({ topicIds })` — React Query handles caching client-side.

---

## Data Flow

### Flow 1: Autonomous Query Expansion (nightly)

```
Vercel Cron (01:00 UTC)
    ↓
app/api/cron/expand-queries/route.js
    ↓
lib/query-expander.js
    ↓ reads
prisma.listeningTopic (all active, with queries + hit counters)
prisma.competitor + competitorKeyword (brand vocabulary)
    ↓ calls
generateInsight('auto-expand', { topics, vocabulary, competitors }, { model: claude-sonnet-4 })
    ↓ returns
{ queriesToAdd[], queriesToRetire[], rationale }
    ↓ writes
prisma.listeningQuery.create() for each addition
prisma.listeningQuery.update({ active: false }) for each retirement
prisma.queryExpansionLog.create() for each change (audit trail)
```

**Cost:** 1 Claude call per expansion run, batching ALL topics into a single prompt. At ~3K tokens input + ~1K output per run, this costs ~$0.02/day. Token budget managed by summarizing query performance data rather than sending raw hit content.

---

### Flow 2: SWT Analysis (daily)

```
Vercel Cron (03:30 UTC)
    ↓
app/api/cron/swt-analysis/route.js
    ↓
lib/swt-analyzer.js
    ↓ reads
prisma.listeningTopic (all active topics)
For each topic:
  prisma.listeningHit (last 7d, non-dismissed, aiRelevance IN ['HIGH','MEDIUM'], take: 60)
    ↓ if >= 10 qualifying hits
generateInsight('swt-analysis/{topicName}', { hits, topicContext }, { model: claude-sonnet-4 })
    ↓ returns
{ strengths[], weaknesses[], threats[] }
    ↓ writes
prisma.aIInsight.create({ insightType: 'SWT_ANALYSIS', content: {...} })
kv.set('swt:topic:{topicId}', result, { ex: 86400 })  ← cache for 24h
```

**Cost control:** One Claude call per topic with qualifying hits. ~10 topics × ~$0.03/call = ~$0.30/day. Hit content is truncated to 150 chars per excerpt to limit token usage. Topics with < 10 qualifying hits are skipped (no Claude call).

---

### Flow 3: User Views SWT Insights

```
User loads listening page → selects brand filter
    ↓
trpc.listening.swtInsights.useQuery({ topicIds: ['...'] })
    ↓
Server: check kv.get('swt:topic:{topicId}')
    → HIT: return cached result (< 1ms)
    → MISS: query prisma.aIInsight (latest by generatedAt per topicId)
              → return + populate KV cache
```

---

### Flow 4: Query Expansion Log Read

```
User opens "Query Health" panel → clicks "Expansion History"
    ↓
trpc.listening.queryExpansionLog.useQuery({ topicId?, limit: 20 })
    ↓
prisma.queryExpansionLog.findMany({ orderBy: { createdAt: 'desc' } })
    ↓
Rendered as timeline: date / action / query string / rationale
```

---

## Build Order

Dependencies between components dictate this order:

**1. Schema first** — Add `SWT_ANALYSIS` to `InsightType` enum and create `QueryExpansionLog` model. This unblocks everything else. One migration.

**2. SWT Analyzer next** — The `lib/swt-analyzer.js` module + `swt-analysis` cron is the highest-value deliverable and has zero dependencies on the expansion engine. Build and validate it in isolation before touching query management.

**3. tRPC read procedures** — Once the analyzer cron can write `AIInsight` records, add `listening.swtInsights` and cache layer so the frontend can read them.

**4. Frontend SWT panel** — Once the tRPC procedure returns real data, build the UI. This can be stubbed with mock data during development.

**5. Query Expansion Engine** — Build `lib/query-expander.js` + cron last, because it depends on the existing query performance data being reliable. It also carries more risk (autonomous writes), so having SWT working first means the milestone delivers value even if expansion needs more tuning.

**6. Expansion log UI** — Lowest priority, cosmetic. Add after expansion engine is validated.

---

## Patterns to Follow

### Pattern 1: Shared Logic Module (existing)

**What:** Core logic in `lib/*.js` module, called by both the cron handler and a tRPC trigger.

**Why:** The cron runs autonomously; the tRPC trigger lets admins test on-demand. Same code, two entry points.

**Existing example:** `lib/listening-scanner.js` called by both `app/api/cron/poll-listening/route.js` and `trpc.listening.triggerScan`.

**Apply to:** `lib/swt-analyzer.js` (called by cron + `triggerSwtAnalysis`), `lib/query-expander.js` (called by cron + `triggerExpansion`).

---

### Pattern 2: Batch-then-Persist (existing for weekly-ai-insights)

**What:** Accumulate data window → single AI call → persist result. Never call AI per-hit.

**Why:** Costs $0.02-$0.30/day instead of $5-$50/day if called per-hit.

**Apply to:** Both SWT analyzer (batch hits per topic) and expansion engine (batch all topics).

---

### Pattern 3: KV Cache for AI Results (existing for platform reads)

**What:** AI outputs are expensive and change slowly. Cache for 24h. Invalidate when a new analysis runs.

**Why:** SWT reads happen every time the listening page loads. Hitting Postgres (or worse, Claude) on every page load is wasteful. KV read is ~1ms.

**Key pattern:**
```javascript
const cached = await kv.get(`swt:topic:${topicId}`);
if (cached) return cached;
const fresh = await prisma.aIInsight.findFirst(...);
await kv.set(`swt:topic:${topicId}`, fresh, { ex: 86400 });
return fresh;
```

---

### Pattern 4: Minimum Data Gate Before AI Call

**What:** Check hit count before calling Claude. Skip analysis if insufficient data.

**Why:** Claude returns poor quality output on 2-3 hits. The minimum threshold (10 hits) prevents noise masquerading as insight.

**Apply to:** SWT analyzer skips topics with < 10 qualifying hits. Query expander skips topics with no performance data (generatedBy='manual', zero hits — can't assess if queries need refinement).

---

### Pattern 5: Audit Log for Autonomous Writes

**What:** Every time the expansion engine modifies `ListeningQuery`, write a `QueryExpansionLog` record explaining why.

**Why:** Autonomous systems that silently modify data erode operator trust. The log creates an auditable "AI did X because Y" trail.

**Fields that matter:** `action`, `queryString`, `rationale`, `createdAt`. Human-readable rationale from Claude's output must be preserved verbatim (not truncated).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Per-Hit SWT Classification

**What people do:** Call Claude for each new `ListeningHit` to classify it as S/W/T on ingestion.

**Why it's wrong:** At 50-200 hits/day across all topics, this costs $5-$50/day in Claude calls. More importantly, individual hits rarely have enough context to classify — the S/W/T signal emerges from patterns across many hits.

**Do this instead:** Batch analysis on accumulated hits (7-day window), run once daily. Classification is post-hoc, not inline.

---

### Anti-Pattern 2: Running Expansion on Every Poll Cycle

**What people do:** Check for query gaps every time the scanner runs (every 10 minutes).

**Why it's wrong:** Query gaps don't change at 10-minute intervals. Running Claude every 10 minutes on query quality is 144 calls/day instead of 1. The existing query performance counters only become meaningful after hundreds of hits, which takes days.

**Do this instead:** Nightly cron, off-peak. Expansion engine reads the last 7-day performance window, not the last 10 minutes.

---

### Anti-Pattern 3: Replacing All Queries on Each Expansion Run

**What people do:** Delete all queries for a topic and regenerate fresh.

**Why it's wrong:** Destroys `totalHits`, `actionableHits`, `spamHits`, and `avgHeuristic` counters that the health scoring depends on. Also loses manually curated queries.

**Do this instead:** Additive-only expansion (create new queries with `generatedBy: 'auto-expand'`). Retirements set `active: false` — never delete. Performance counters accumulate indefinitely.

---

### Anti-Pattern 4: Single Monolithic SWT Prompt for All Topics

**What people do:** Send all topics' hits in one giant prompt to save API calls.

**Why it's wrong:** At 60 hits × 150 chars × 10+ topics, the context window becomes enormous, costs more, and the per-brand analysis quality degrades as Claude tries to separate signal for each brand.

**Do this instead:** One Claude call per topic with qualifying data. The loop cost is trivially parallelizable with `Promise.all()` and total daily cost remains low (each call is small).

---

### Anti-Pattern 5: SWT Stored Only in KV (not Postgres)

**What people do:** Write SWT results only to Redis, no Postgres record.

**Why it's wrong:** KV is ephemeral and has no history. Can't show trend ("threats increased this week"), can't audit what the AI said, can't recover from KV eviction without re-running expensive Claude call.

**Do this instead:** Always write to `AIInsight` (Postgres, permanent) first, then populate KV cache as a read-acceleration layer. KV miss → Postgres → repopulate KV.

---

## Integration Points

### External Services

| Service | Integration | Notes |
|---------|-------------|-------|
| Claude Sonnet 4 | `lib/ai.js` → `generateInsight()` | Existing wrapper handles cost logging, JSON parsing, retries |
| Vercel Cron | `vercel.json` crons array | Add two new entries: `expand-queries` (daily) and `swt-analysis` (daily) |
| Vercel KV | `lib/redis.js` → `kv.get/set` | Already used for platform rate limits and Reddit scan throttle |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Expansion Engine ↔ Listening Scanner | Shared DB (ListeningQuery) | Expansion writes queries; scanner reads them. No direct coupling. |
| SWT Analyzer ↔ Listening Scanner | Shared DB (ListeningHit) | Analyzer reads hits scanner wrote. No direct coupling. |
| SWT Analyzer ↔ tRPC | Shared DB (AIInsight) + KV | Cron writes; tRPC reads. KV decouples read latency. |
| Expansion Engine ↔ tRPC | Shared DB (QueryExpansionLog) | Cron writes; tRPC reads audit log. |
| Both new crons ↔ lib/ai.js | Direct import | Use existing `generateInsight()` wrapper — no new Claude client setup. |

---

## Scaling Considerations

| Concern | Current scale (~10 topics) | If topics grow to 50+ |
|---------|---------------------------|----------------------|
| SWT analysis cost | ~$0.30/day | ~$1.50/day — still acceptable |
| SWT analysis duration | ~30s total | ~2-3 min — still within Vercel 5-min cron limit |
| Expansion engine | 1 batched call/day | May need per-topic calls if prompt gets too large |
| Hit volume per topic | 10-100/day | May need tighter hit selection (top 30 by heuristic instead of 60) |
| Vercel function timeout | 30s default | Both crons should use `maxDuration: 300` in route config |

**First bottleneck:** Vercel's 30s default function timeout if topic count grows and SWT runs sequentially. Mitigation: set `export const maxDuration = 300` in the cron route handlers (already used by other crons in the codebase).

---

## Sources

- Codebase: `/lib/listening-scanner.js` — existing pipeline, scoring, and Reddit throttle patterns
- Codebase: `/lib/routers/listening.js` — existing tRPC procedures, `generateQueries`, `refineTopicQueries`
- Codebase: `/app/api/cron/weekly-ai-insights/route.js` — existing pattern for batch AI + AIInsight persistence
- Codebase: `/prisma/schema.prisma` — existing data model constraints
- Codebase: `/vercel.json` — cron scheduling slots and timing
- Codebase: `/lib/ai.js` — `generateInsight()` wrapper used by all AI calls

---

*Architecture research for: Autonomous Query Management + SWT Insight Engine on Social Command*
*Researched: 2026-03-14*
