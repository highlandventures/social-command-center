# Pitfalls Research

**Domain:** Autonomous social listening intelligence — query expansion + SWT categorized insights
**Researched:** 2026-03-14
**Confidence:** HIGH (codebase reviewed directly; pitfalls derived from concrete code patterns + verified domain research)

---

## Critical Pitfalls

### Pitfall 1: Autonomous Queries Deleting Performance History

**What goes wrong:**
The existing `refineTopicQueries` mutation already has this bug in prod: when `save=true`, it does `deleteMany` + `createMany` to replace queries. All accumulated `totalHits`, `actionableHits`, `spamHits`, `dismissedHits`, and `avgHeuristic` counters are wiped. An autonomous expansion cron that calls the same pattern will silently erase months of health data that the query scoring system depends on to know which queries are performing.

**Why it happens:**
"Replace all queries" is the simplest implementation — delete old, insert new. Developers reach for it because managing diffs (which queries to keep vs. drop vs. add) requires more logic. Under manual use it's acceptable because a human is watching. Under autonomous operation, it runs unattended and the data loss is invisible.

**How to avoid:**
Implement query reconciliation instead of replace-all. For each expansion cycle:
- Match incoming AI-generated queries to existing ones by `(platform, queryString)` fingerprint
- `UPDATE` matched rows (preserving counters)
- `CREATE` genuinely new queries
- `UPDATE active=false` (not DELETE) queries being retired — preserve history for audit

Never call `deleteMany` on `ListeningQuery` from an autonomous process.

**Warning signs:**
- `totalHits` / `actionableHits` resets to 0 on all queries for a topic after an expansion cycle
- `queryPerformance` endpoint shows `INSUFFICIENT_DATA` on all queries after a scheduled run
- `lastEvaluatedAt` timestamps cluster around cron run times, not organic polling times

**Phase to address:**
Query expansion cron — design phase, before any code is written for the autonomous expansion job.

---

### Pitfall 2: Runaway Query Proliferation Drowning the Signal

**What goes wrong:**
An autonomous expansion system that adds queries every cycle without a hard ceiling will grow the query set unboundedly. Each new query fires on every poll cycle. With the current 10-minute X poll and 8-hour Reddit poll, even a modest 2x query growth doubles API call costs. Worse: many autonomous-generated queries will be near-duplicates or slightly broader variants that capture the same hits. The `ListeningHit` table fills with redundant data, `heuristicScore` distribution degrades, and the SWT analysis draws from an increasingly noisy corpus.

**Why it happens:**
AI query generators err toward completeness. When prompted to "find coverage gaps," the model will surface reasonable-sounding gaps even when coverage is already adequate. Without a hard stop, each expansion cycle adds more queries than it retires.

**How to avoid:**
- Enforce a hard query limit per topic (recommended: 8–12 active queries per topic per platform)
- Expansion cron must evaluate whether adding N new queries requires retiring N existing low-performers (`health === 'POOR'` with `totalHits >= 10`)
- New queries from autonomous expansion start `active=false` (staging) and only activate after a human or a quality gate approves them
- Rate-limit expansion: run at most once per week per topic, not on every cron cycle

**Warning signs:**
- `queryCount` per topic exceeds 15
- `noiseRate` trending up week-over-week across topics
- `spamHits` / `totalHits` ratio rising without corresponding new topic activity
- Vercel function duration approaching timeout on `poll-listening` cron

**Phase to address:**
Query expansion cron design — build the ceiling and staging mechanism from day one.

---

### Pitfall 3: SWT Categories Are Determined by Volume, Not Signal Quality

**What goes wrong:**
The most natural SWT implementation feeds raw hit counts into the LLM and lets it infer which bucket items belong to. But `POSITIVE` sentiment hits are not automatically Strengths and `NEGATIVE` hits are not automatically Weaknesses. A brand can have high-volume positive sentiment about a product that is being sunset (a Threat), or high-volume negative sentiment about pricing that is actually a strength if customers still pay it anyway. Classifying by volume without contextual weighting produces SWT outputs that feel authoritative but mislead.

**Why it happens:**
Sentiment already exists in the schema. It's tempting to map it directly: POSITIVE = Strength, NEGATIVE = Weakness/Threat. This works in demos but breaks in production because the categories encode strategic meaning, not just valence.

**How to avoid:**
- Feed the LLM content snippets and ask it to classify into SWT with explicit definitions:
  - **Strength**: Consumer perceives brand positively in a way that differentiates it
  - **Weakness**: Consumer perceives a gap or failure that the brand could address
  - **Threat**: External signal (competitor momentum, narrative, PR risk) that could harm the brand
- Separate the SWT analysis from sentiment data — let Claude read the actual content, not just sentiment labels
- Include engagement weight in sampling: prioritize high-`engagementCount` and high-`heuristicScore` hits for the analysis corpus, not random sampling
- Validate SWT output on a known dataset before deploying

**Warning signs:**
- SWT distribution is nearly identical to sentiment distribution (POSITIVE% ≈ Strength%, NEGATIVE% ≈ Weakness% + Threat%)
- Threats bucket is empty or contains only very-negative sentiment items
- Stakeholders report "this just looks like sentiment analysis with different labels"

**Phase to address:**
SWT analysis design — prompt engineering phase. Define the three categories precisely before writing any AI call.

---

### Pitfall 4: Vercel Cron Timeout Kills Autonomous Expansion Mid-Run

**What goes wrong:**
The existing `poll-listening` cron runs sequentially through all active topics and queries (see `listening-scanner.js` lines 313–601). This is tolerable for polling because each query is a fast API call. Autonomous query expansion requires calling Claude Sonnet (2–4 seconds per topic), writing to the DB, and potentially running for all brand + competitor topics in sequence. On a cold Vercel invocation with 15+ topics, this easily exceeds the default 300-second Pro plan limit, leaving the expansion partially applied — some topics expanded, others not, with no rollback.

**Why it happens:**
Developers design the happy path (one topic, fast AI call) and test it. The production path (all topics, cold start, variable Claude latency, DB write per topic) only fails under real load.

**How to avoid:**
- Do not expand all topics in a single cron invocation
- Process topics in batches of 3–5 per invocation, using Redis KV to track the "next batch index" between runs
- Set `maxDuration = 300` in the cron route's config export (Next.js App Router)
- Alternatively: run one expansion cron per brand topic (`/api/cron/expand-queries/figr`, `/api/cron/expand-queries/ondo`, etc.) and stagger them in `vercel.json` — simpler, no state management needed
- Add a timeout guard at the function level: if elapsed time > 240 seconds, exit cleanly and log which topics were not processed

**Warning signs:**
- Cron function logs show exit without processing all topics
- Some topics have `lastExpandedAt` updated, others do not, after the same run
- 504 errors in Vercel function logs for the expansion route

**Phase to address:**
Query expansion cron implementation — architect the batching strategy before writing the job.

---

### Pitfall 5: SWT Cache Stale on High-Volume Days

**What goes wrong:**
If SWT analysis results are cached (e.g., in `AIInsight` records with `dataRangeEnd` timestamps), a spike in listening hits on a particular day will not be reflected until the next scheduled SWT run. Users checking the dashboard during a PR event or competitor announcement will see analysis that doesn't include the breaking data — exactly the moment when up-to-date SWT is most needed.

**Why it happens:**
Batch/scheduled analysis is explicitly the right choice for cost control (per PROJECT.md). But the trade-off — stale analysis during spikes — is easy to miss in design.

**How to avoid:**
- Store `dataRangeEnd` and `hitCount` on every `AIInsight` record (the schema already supports `dataRangeEnd`)
- Surface the "as of X time, based on Y hits" timestamp prominently in the SWT UI — users can self-assess staleness
- Implement a lightweight "rerun SWT" manual trigger (TRPC mutation) that costs one Claude call and is only available to admins — for urgent situations without breaking the cost model
- Consider a "high-volume alert" that increments a counter: if new hits for a topic exceed 3× the trailing 7-day daily average in a 4-hour window, enqueue a priority SWT refresh

**Warning signs:**
- Users report "the SWT for [competitor] doesn't mention the thing that's trending right now"
- `AIInsight.dataRangeEnd` is consistently many hours or days behind current time when users are actively checking

**Phase to address:**
SWT analysis phase — build staleness transparency into the UI from the start; add the manual trigger before shipping.

---

### Pitfall 6: Competitor Coverage Parity Check Uses Wrong Source of Truth

**What goes wrong:**
The audit that checks competitor query coverage needs to compare against a canonical list of competitors and their known terms. The `Competitor` model has `CompetitorKeyword` records, but the current competitor-monitoring ListeningTopics use a naming convention (`Competitor: Securitize`) rather than a foreign key link. An autonomous parity check that reads from `ListeningTopic.name` string-matching will miss renamed topics, inconsistently named topics, or competitors added to the `Competitor` table but never given a topic.

**Why it happens:**
The `Competitor` model and the `ListeningTopic` model are structurally separate — there's no `competitorId` foreign key on `ListeningTopic`. An audit job that needs to reconcile both will either (a) assume the naming convention is always followed or (b) do a fuzzy match that introduces false positives/negatives.

**How to avoid:**
- Before building the parity audit, add a `competitorId String?` FK to `ListeningTopic` (optional, nullable for non-competitor topics)
- When creating competitor topics, always set this FK
- The parity audit then does a clean join: `Competitor LEFT JOIN ListeningTopic ON competitorId` — nulls on the right side are guaranteed coverage gaps
- Backfill existing competitor topics with the FK as a migration step

**Warning signs:**
- Parity audit reports no gaps even though a competitor has no active queries
- Adding a new competitor to the `Competitor` table does not trigger a gap detection
- Two topics with names like "Competitor: Ondo" and "Ondo Finance" both exist for the same competitor

**Phase to address:**
Schema migration phase — must happen before the parity audit cron is built.

---

### Pitfall 7: LLM Generates Plausible-but-Wrong Queries for Niche Financial Terms

**What goes wrong:**
The RWA tokenization space has niche tickers, protocols, and company names that are recent (post-2024 Claude training cutoff) or very low-frequency in training data. Autonomous query expansion for competitors like Tradable, Superstate, or new Figure products will produce syntactically valid boolean queries that look reasonable but capture the wrong conversations — or worse, confidently exclude important terms because the model doesn't recognize them.

This is distinct from general hallucination: the queries are structurally valid but semantically wrong for the specific domain.

**Why it happens:**
Claude Sonnet was trained before many of these entities were prominent. The model fills the gap with plausible-sounding but incorrect terminology. The existing `generateQueries` endpoint has a rich system prompt that compensates for this — but autonomous expansion will have less human-in-the-loop oversight to catch mistakes.

**How to avoid:**
- Maintain a `KNOWN_TERMS` canonical glossary (JSON or DB table) containing all brand names, product names, tickers, misspellings, and related terms for Figure and each competitor — sourced from human curation, not AI generation
- Inject this glossary into every autonomous expansion prompt: "Use only the following verified terms for this brand..."
- Require human review/approval for any query that introduces a new term not in the glossary
- Run new autonomous queries in `active=false` staging for one full poll cycle before activating

**Warning signs:**
- Autonomous queries reference tickers or product names that don't match the official glossary
- Expansion cycle introduces queries with `falsePositiveRisk: high` that no one reviewed
- Hit rate for autonomously-generated queries is materially lower than for manually-curated ones in the first week

**Phase to address:**
Query expansion design — glossary must be built and integrated into the expansion prompt before autonomous mode ships.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Extract SWT from sentiment labels instead of raw content | Saves one Claude call per topic | SWT outputs become meaningless sentiment rebranding | Never — SWT is the core value prop |
| deleteMany + createMany in expansion cron | Simple diff-free replacement | Destroys query performance history that drives health scoring | Never for autonomous use; acceptable for one-time manual migration |
| Single cron invocation for all topics | Simpler code | Vercel timeout at scale; partial expansion on failure | Only during early testing with <5 topics |
| Cache SWT indefinitely (no TTL) | No repeat AI costs | Stale during crises; users lose trust in the feature | Never — always surface the data range |
| Global search only on Reddit (no subreddit targeting) | Cheaper (1 credit) | Misses subreddit-specific nuance for niche RWA communities | Acceptable for brand terms; review for competitor terms |
| Reuse `extractThemes` for SWT | Faster to ship | extractThemes returns themes, not strategic categories — different schema, different prompt, different consumer | Never — build SWT as a separate endpoint |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Sonnet (query expansion) | Passing full query history (all queries for all topics) in one prompt, blowing token budget | Scope each call to one topic; pass only the relevant topic's queries and performance data |
| Claude Sonnet (SWT analysis) | Passing raw hit objects with all fields | Strip to `{content, sentiment, heuristicScore, engagementCount}` — reduce tokens, reduce hallucination surface |
| SociaVault Reddit API | Running autonomous expansion during poll cycles (double-hitting API) | Run expansion on a separate schedule, never during `poll-listening` window |
| TwitterAPI.io (X search) | New autonomous queries not inheriting `min_faves:2` quality filter | Enforce quality filter as a post-processing step in the expansion cron, not relying on the LLM to add it |
| Vercel KV (Redis) | Using KV to track complex expansion state (queues, locks) | Keep KV use minimal — only simple string timestamps; use DB for expansion job state |
| Prisma (batch operations) | Using `createMany` when you need to reference the just-created IDs | Use `create` in a loop or `createManyAndReturn` (Prisma 5.14+) if IDs are needed immediately |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-hit DB query for deduplication (`findFirst` inside hit loop) | `poll-listening` cron slows to >60s as hit volume grows | Batch-fetch all existing `platformPostId` values for the query before the loop; check against a Set | ~500+ new hits per poll cycle |
| SWT analysis fetching all hits without limit | Claude context window overflow or timeout; query hangs | Always cap the corpus: top 200 hits by `heuristicScore DESC` per topic per time window | Topics with >1000 hits in the analysis window |
| Running AI sentiment batch upgrade synchronously inside `poll-listening` | Total cron duration multiplies; timeout risk | The current code already has this risk at line 606 of `listening-scanner.js` — limit sentiment upgrade to 20 hits max, or move to a separate async job | Poll cycles with >30 new hits |
| Expansion cron calling Claude for topics with no recent hits | Wasted tokens; AI generates queries based on stale context | Gate: skip expansion for topics with `totalHits < 5` in last 30 days | Any expansion run on new or low-volume topics |
| `mentionMetrics` query loading all daily hits for trend aggregation (line 301 in listening.js) | Slow dashboard loads as hit table grows | Add a daily aggregation cron that writes pre-computed metrics; use those for the trend chart | >100K hits in the listening_hits table |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Autonomous expansion cron writes new queries without audit trail | Impossible to trace which queries were AI-generated vs. human-curated; undetectable if malformed query gets added | Log every autonomous write to `AuditLog` with `action: 'query_expansion_autonomous'`; the `generatedBy` field on `ListeningQuery` already supports this |
| SWT insights stored with `userId: null` (no ownership) | No accountability trail; can't attribute which analysis run produced which output | Always set `userId` to a system service account or the cron runner identity when creating `AIInsight` records autonomously |
| Expansion prompt includes full system prompt from `generateQueries` (with company context) in logs | Internal product roadmap and competitive intelligence context leaked to log aggregators | Redact system prompts from `APICallLog.endpoint` and any error reporting |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| SWT panel shows results without a "last updated" timestamp | Users don't know if the analysis is from today or last week; act on stale data | Always surface `dataRangeEnd` prominently: "Based on 234 hits from Mar 7–14" |
| Per-brand SWT filter defaults to "All Brands" aggregate | Team can't distinguish Figure Strengths from competitor Weaknesses; the core value of per-brand filtering is lost | Default filter to the primary owned brand; let users switch to competitors explicitly |
| Expansion cron adds queries silently; users see more hits without explanation | Users trust the feed less; can't tell if hit volume spike is real or query artifact | Show "Query expanded [date]: 3 new queries added for Figure Markets" in an activity log on the topic detail view |
| SWT categories use technical language ("Weaknesses", "Threats") without concrete examples | Team members unfamiliar with the framework don't know how to act | Display 2–3 representative hit excerpts under each SWT category heading |
| Query health dashboard shows `INSUFFICIENT_DATA` for all new autonomous queries | Dashboard looks broken; creates distrust in the system | Add a "Warming up" state with estimated time to sufficient data, rather than displaying a health grade too early |

---

## "Looks Done But Isn't" Checklist

- [ ] **Autonomous expansion:** Query history preserved — verify `totalHits` on an existing query is non-zero after an expansion cycle that keeps that query
- [ ] **SWT analysis:** Categories are distinct from sentiment — verify a POSITIVE-sentiment hit appears in Threats if the content is competitor-positive
- [ ] **Per-brand SWT filter:** Filters are mutually exclusive — verify selecting "Ondo Finance" shows zero Figure hits
- [ ] **Expansion staging:** New queries start `active=false` — verify they do not fire in the next `poll-listening` run before approval
- [ ] **Parity audit:** Detects a competitor that exists in `Competitor` table with no `ListeningTopic` — verify the audit returns it as a gap
- [ ] **Cost guard:** Expansion cron does not run more than once per topic per week — verify KV/DB timestamp is written and checked
- [ ] **Vercel timeout:** Expansion cron handles 15+ topics without timing out — verify end-to-end in production with all active topics

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Performance history wiped by replace-all expansion | HIGH | Restore from DB backup; re-establish baseline by counting hits from `ListeningHit.queryId` aggregate query; update counters manually |
| Query proliferation bloats API costs | MEDIUM | Deactivate all queries with `health === 'POOR'` and `totalHits >= 10`; audit remaining set for near-duplicates; reduce to 8 per topic |
| SWT mis-categorized due to bad prompt | LOW | Update system prompt; re-run SWT analysis for affected topics (costs ~1–2 Claude calls per topic); mark old `AIInsight` records `dismissed=true` |
| Autonomous query adds incorrect domain-specific term | MEDIUM | Deactivate the bad query; run `queryPerformance` to identify hits from that query; dismiss affected hits; add term to a blocklist for future expansion prompts |
| Vercel cron timed out mid-expansion | LOW | Check which topics have updated `lastExpandedAt`; manually trigger expansion for skipped topics via the TRPC mutation |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Performance history wiped (deleteMany) | Query expansion — schema + cron design | Confirm `totalHits` survives an expansion cycle on a test topic |
| Query proliferation | Query expansion — limits and staging design | Count active queries per topic after 3 expansion cycles |
| SWT = sentiment rebranding | SWT analysis — prompt engineering | Manually review 10 SWT outputs against raw hits; verify non-trivial categorization |
| Vercel timeout on expansion | Query expansion — batching architecture | Time a full expansion run against all prod topics in staging |
| SWT cache staleness | SWT analysis — UI design | Confirm `dataRangeEnd` is visible and accurate in the SWT panel |
| Competitor FK missing (parity audit) | Schema migration — before parity cron | Verify `competitorId` on all competitor `ListeningTopic` rows after migration |
| Niche term hallucination | Query expansion — glossary integration | Audit first 3 autonomous expansion outputs for unknown/unverified terms |

---

## Sources

- Direct codebase review: `/lib/listening-scanner.js`, `/lib/routers/listening.js`, `/prisma/schema.prisma`, `/app/api/cron/weekly-ai-insights/route.js`
- [State of Social Listening 2025 — The SILAB](https://www.thesilab.com/state-of-social-listening): practitioner survey on AI overtrust and query quality
- [Vercel Cron Jobs — Troubleshooting](https://vercel.com/kb/guide/troubleshooting-vercel-cron-jobs): timeout behavior and plan limits
- [Vercel Limits](https://vercel.com/docs/limits): function duration caps by plan
- [AI Model Drift in Production — Orq.ai](https://orq.ai/blog/model-vs-data-drift): LLM behavioral drift patterns
- [Structured Output AI Reliability — Cognitive Today](https://www.cognitivetoday.com/2025/10/structured-output-ai-reliability/): JSON schema enforcement, hallucination in structured outputs
- [Social Media Listening Trends 2025 — Websays](https://websays.com/en/social-listening-trends-stay-ahead-in-2025/): query design best practices
- [LLMs in Computational Social Science — Springer](https://link.springer.com/article/10.1007/s13278-025-01428-9): LLM annotation reliability and limits
- [Get Rid of Vercel Timeouts — Upstash Blog](https://upstash.com/blog/vercel-cost-workflow): batching strategies for long-running serverless jobs

---
*Pitfalls research for: Autonomous social listening intelligence (query expansion + SWT analysis)*
*Researched: 2026-03-14*
