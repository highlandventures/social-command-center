# Stack Research

**Domain:** Autonomous social listening query management + structured SWT insight categorization
**Researched:** 2026-03-14
**Confidence:** HIGH (Anthropic SDK: HIGH via official docs; Prisma patterns: HIGH; Vercel cron: HIGH; structured outputs: HIGH via official docs)

---

## Context

This is an additive milestone on an existing Next.js 14 / Prisma 5.14 / tRPC 10 / Vercel platform. No framework changes are needed. The research question is: **what specific libraries, APIs, and patterns are needed for the two new capabilities** — autonomous query coverage auditing and SWT-categorized AI insights — that do not yet exist in the codebase?

The existing system already has:
- `@anthropic-ai/sdk@^0.24.0` (needs upgrade — see below)
- `generateInsight()` in `lib/ai.js` as the central AI call wrapper
- `lib/ai/sentiment.js` with `extractThemes()` that produces generic summaries
- `AIInsight` model in Prisma with `InsightType` enum
- Cron infrastructure via Vercel (cron jobs in `vercel.json`, pattern already used by 8+ routes)
- `ListeningTopic`, `ListeningQuery`, `ListeningHit` schema — no schema changes blocked by missing tech

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@anthropic-ai/sdk` | `^0.78.0` | Structured AI outputs for SWT analysis and query generation | Current version (0.78.0 vs installed 0.24.0) adds `client.messages.parse()`, `zodOutputFormat()` helper, and `output_config.format` (the non-deprecated API shape). These are required for schema-guaranteed SWT JSON — without this, the current `parseAIJSON()` workaround is the only option, which is fragile for structured categorical data. HIGH confidence — verified via official Anthropic docs and npm registry. |
| Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | n/a | Query coverage gap analysis and SWT categorization of batched hits | $1/MTok input, $5/MTok output — ~5x cheaper than the Sonnet 4 model already in use for `generateQueries`. Haiku 4.5 has a 200k context window, sufficient to process 50–100 summarized hit texts. Use Haiku for: scheduled cron analysis that runs on accumulated data. Keep Sonnet 4 for user-facing interactive query generation where quality matters more than cost. HIGH confidence — verified against Anthropic model pricing page. |
| Claude Sonnet 4.6 (`claude-sonnet-4-6`) | n/a | (Current default for query generation) — no change needed | The codebase already uses `claude-sonnet-4-20250514` for `generateQueries` and `refineTopicQueries`. Sonnet 4.6 is the current latest; migration is optional, not required for this milestone. |
| `zod` | `^3.23.0` (already installed) | Schema definition for structured SWT output | Already in the project at the correct version. Use Zod schemas with `zodOutputFormat()` from the upgraded SDK to define `SWTAnalysis` schema — eliminates the current `parseAIJSON()` fallback chain. No new install needed. HIGH confidence. |
| Prisma | `^5.14.0` (already installed) | Schema migrations for new `SWTInsight` model and `InsightType` enum extension | `createMany` with `skipDuplicates: true` is the correct pattern for deduplicating query coverage gap records. Postgres is already the database — `skipDuplicates` is fully supported. No version upgrade needed. HIGH confidence — verified via official Prisma docs. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vercel/kv` | `^2.0.0` (already installed) | Distributed lock / last-run timestamp for cron deduplication | Use to store `swt-analysis:last-run` and `query-audit:last-run` keys with TTL. Prevents double-execution when Vercel delivers a cron event twice (documented behavior). Already wired in `lib/redis.js`. No new install needed. |
| Native `Date` / `Date.now()` | n/a | Time-windowing for batched hit aggregation | Already the pattern across all existing cron routes. Do not introduce a date library (no `date-fns`, no `dayjs`) — the existing approach of `new Date(Date.now() - N * 86400000)` is sufficient and consistent. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `prisma migrate dev` | Schema migration for new SWT models | Already used — no change to workflow. Run after adding `SWTInsight` model and extending `InsightType` enum. |
| Vitest (already installed) | Unit tests for SWT prompt logic and query gap detection | Write tests for the gap-detection algorithm (which topics are missing queries, which queries score POOR health) before implementing — these are pure functions testable without DB. |

---

## Installation

The only package that needs upgrading is `@anthropic-ai/sdk`. Everything else is already installed.

```bash
# Upgrade Anthropic SDK to get structured outputs support
npm install @anthropic-ai/sdk@^0.78.0
```

Verify the upgrade with:
```bash
node -e "const a = require('@anthropic-ai/sdk'); console.log(a.VERSION)"
```

No other new packages are required for this milestone.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Native Anthropic structured outputs via `client.messages.parse()` | Continue with `parseAIJSON()` workaround | Only if the SDK upgrade is blocked by a breaking change elsewhere. `parseAIJSON()` works but requires testing the fallback path and cannot guarantee schema shape — acceptable for lower-stakes summaries, not for SWT where missing a `category` field breaks the UI filter. |
| Claude Haiku 4.5 for scheduled SWT analysis | Claude Sonnet 4.6 for everything | If SWT quality with Haiku is insufficient during testing. Run Haiku first in staging; upgrade to Sonnet only if the categorical output quality is demonstrably worse. Sonnet is ~3-5x more expensive per token. |
| Vercel KV for distributed lock | Prisma-based lock (a `JobLock` table) | Only if the project moved off Vercel KV. KV is already used in `lib/redis.js` and is the lowest-friction option. |
| Prisma `createMany` + `skipDuplicates` for coverage gap records | Upsert loop | `createMany` with `skipDuplicates: true` is a single DB roundtrip vs N roundtrips for N upserts. Use for inserting batches of detected gap records. Use individual `upsert` only when you need to update an existing row (e.g., updating a query's `generatedBy` field). |
| Extend existing `AIInsight` model with new `InsightType` values | Create a separate `SWTInsight` model | A separate model gives cleaner querying (no `WHERE insightType IN (...)` filter required) and allows per-brand foreign keys. However, extending `AIInsight` with `topicId` nullable field + new enum values is lower migration risk for a first version. Start with extension; extract to separate model if query complexity grows. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `langchain` / `llamaindex` | These frameworks add abstraction layers that obscure cost tracking — the project already has a precise `APICallLog` table and `generateInsight()` wrapper. Introducing an agent framework would bypass both. Cost visibility would be lost. | Direct Anthropic SDK calls via the existing `generateInsight()` pattern |
| `openai` SDK or any non-Anthropic LLM | The project is already committed to Claude (system prompts reference Figure/FIGR context extensively). Mixing providers creates prompt maintenance burden and cost tracking complexity. | `@anthropic-ai/sdk` only |
| Streaming responses for cron analysis | Streaming (SSE) adds complexity and doesn't benefit scheduled batch jobs that write to DB. Streaming is for interactive UX only. | Standard `messages.create()` / `messages.parse()` for all cron routes |
| `output_format` (deprecated parameter) | Anthropic has deprecated `output_format` in favor of `output_config.format`. Amazon Bedrock already rejects the old parameter entirely. Using it creates silent failures on Bedrock and a migration cliff later. | `output_config: { format: zodOutputFormat(schema) }` via SDK 0.78+ |
| `p-queue` or custom concurrency primitives | For Vercel serverless, each cron invocation is isolated — there is no shared in-process queue. Use Vercel KV for cross-invocation coordination instead. | Vercel KV distributed lock pattern |
| Per-hit SWT classification | Classifying each `ListeningHit` individually as it arrives is ~100x more expensive than batching. At 50 hits/day per topic, that's 50 API calls/day just for categorization. | Scheduled batch analysis: aggregate hits into a window (e.g., last 7 days), run one Claude call per topic per week |

---

## Stack Patterns by Variant

**For the SWT insight generation cron job:**
- Use `claude-haiku-4-5-20251001` (cheapest model with structured output support)
- Group hits by `topicId`, limit to last 7 days, take top 50 by `heuristicScore`
- Use `client.messages.parse()` with `zodOutputFormat(SWTSchema)` to guarantee categorical output
- Store result in `AIInsight` table with new `insightType: 'SWT_ANALYSIS'` and `topicId` (nullable FK)
- Cache last analysis timestamp in Vercel KV (`swt-analysis:{topicId}:last-run`) with 6-day TTL to prevent redundant re-analysis

**For the autonomous query coverage audit cron job:**
- No new AI model needed — this is algorithmic, not AI-driven
- Algorithm: fetch all `ListeningTopic` records + their `ListeningQuery` records; compare query strings against a known entity list (brand names, product names, tickers, common misspellings stored in DB or config); identify topics where coverage is thin (fewer than 2 active queries per platform, or all queries grade POOR/INSUFFICIENT_DATA)
- When gaps detected: call existing `generateQueries` logic (already in `lib/routers/listening.js`) or the same Claude prompt used by `refineTopicQueries`, but in an automated context
- Store generated queries with `generatedBy: 'ai-autonomous'` to distinguish from human-initiated AI generation
- Run weekly (e.g., Sunday 3am UTC) — not on every poll cycle

**If structured outputs cause issues with existing `generateInsight()` wrapper:**
- Add a separate `generateStructuredInsight(type, context, schema, options)` function in `lib/ai.js` alongside the existing `generateInsight()`
- Use `client.messages.parse()` internally — keep cost tracking via `APICallLog`
- Do not refactor existing `generateInsight()` — it works, backward compatibility matters

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@anthropic-ai/sdk@^0.78.0` | Node.js 18+, Next.js 14.2 | The SDK is ESM-first but supports CommonJS interop. Existing `import Anthropic from '@anthropic-ai/sdk'` syntax works unchanged. `zodOutputFormat` helper is in `@anthropic-ai/sdk/helpers/zod`. |
| `@anthropic-ai/sdk@^0.78.0` | `zod@^3.23.0` | The `zodOutputFormat` helper requires Zod 3.x. Already installed at compatible version — no conflict. |
| `claude-haiku-4-5-20251001` | Structured outputs | Haiku 4.5 supports structured outputs per Anthropic model docs. |
| Prisma `5.14` + `createMany skipDuplicates` | PostgreSQL (Vercel Postgres) | `skipDuplicates` is supported on PostgreSQL. Not supported on SQLite/MongoDB/SQL Server — irrelevant here. |

---

## Sources

- [Anthropic Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — verified `output_config.format`, supported models, `zodOutputFormat` API shape. HIGH confidence.
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — verified model IDs `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, pricing per MTok. HIGH confidence.
- [Anthropic SDK npm page](https://www.npmjs.com/package/@anthropic-ai/sdk) — current version 0.78.0 confirmed. HIGH confidence.
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — confirmed 100 cron jobs/project on all plans, Pro invocation precision within the minute, max 800s function duration. HIGH confidence.
- [Prisma createMany docs](https://www.prisma.io/docs/orm/prisma-client/queries/crud) — `skipDuplicates` supported on PostgreSQL. HIGH confidence.
- Existing codebase audit (`lib/ai.js`, `lib/routers/listening.js`, `prisma/schema.prisma`) — confirmed installed SDK version 0.24.0, existing `generateInsight()` pattern, `AIInsight` model shape. HIGH confidence.

---

*Stack research for: autonomous social listening query management + SWT categorized insights (additive milestone on existing Next.js/Prisma/Claude platform)*
*Researched: 2026-03-14*
