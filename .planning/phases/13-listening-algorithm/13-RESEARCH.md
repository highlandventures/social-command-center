# Phase 13: Social Listening Algorithm Improvements - Research

**Researched:** 2026-03-16
**Domain:** NLP scoring, AI-assisted content classification, deduplication
**Confidence:** HIGH

## Summary

Phase 13 improves the existing `listening-scanner.js` (~1040 lines) with five targeted enhancements: hybrid AI+heuristic scoring, topic-adaptive weights, financial context-aware sentiment, engagement velocity, and cross-query deduplication. The existing codebase is well-structured with clear separation between scoring helpers (exported, tested), sentiment analysis, and the main scan loop. All improvements are additive -- they modify or extend existing functions without architectural changes.

The key architectural decision from STATE.md is confirmed: **AI multiplier on heuristics, not a rewrite**. The existing `analyzeSentimentBatch` pattern in `lib/ai/sentiment.js` provides a proven template for batch AI calls via `generateInsight()` using Claude Haiku. The `@vercel/kv` Redis client is already used for dedup keys and can be extended for cross-query dedup. No new dependencies are needed.

**Primary recommendation:** Implement all five improvements as modifications to existing functions in `listening-scanner.js`, using the established `generateInsight()` + Haiku pattern for AI batch validation, and extending the existing Redis dedup keys for cross-query dedup.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SLST-01 | High-scoring hits batch-validated through Claude Haiku for semantic relevance (AI score as multiplier on heuristic) | Existing `generateInsight()` + Haiku pattern; `analyzeSentimentBatch` as template; batch 10-20 hits per call |
| SLST-02 | Scoring weights adapt by topic type (KOL, competitor, brand monitoring) | `getTopicKeyTerms()` already differentiates topic types; extend with weight profiles per type |
| SLST-03 | Financial/crypto terms scored with context awareness | Existing `POSITIVE_KEYWORDS`/`NEGATIVE_KEYWORDS` need financial domain expansion; ambiguous terms need context resolution |
| SLST-04 | Engagement velocity (engagement-per-hour) factored into scoring | `detectedAt` already parsed from posts; trivial to compute `engagementCount / postAgeHours` |
| SLST-05 | Cross-query dedup prevents same post appearing in multiple queries for same topic | Current dedup is `queryId + platformPostId`; add `topicId + platformPostId` check via Redis or Prisma |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | (existing) | Claude Haiku API calls | Already in use via `generateInsight()` in `lib/ai.js` |
| @vercel/kv | (existing) | Redis for dedup keys and caching | Already used for Reddit poll throttle and general caching |
| prisma | (existing) | Database queries for ListeningHit, ListeningQuery, ListeningTopic | Full schema already defined |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (existing) | Unit testing scoring functions | All new/modified pure functions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claude Haiku batch | OpenAI batch API | Already invested in Anthropic; Haiku is cheaper ($0.25/$1.25 per 1M tokens) |
| Redis cross-query dedup | Prisma unique constraint | Redis is faster for hot-path dedup; Prisma constraint is fallback |

## Architecture Patterns

### Recommended Changes (all within `listening-scanner.js`)

```
apps/social/lib/listening-scanner.js  (modify)
  - Add: TOPIC_WEIGHT_PROFILES constant
  - Add: FINANCIAL_CONTEXT_TERMS constant + resolveFinancialSentiment()
  - Add: computeEngagementVelocity() helper
  - Add: batchValidateRelevance() using generateInsight()
  - Modify: heuristicScore formula to use topic-adaptive weights
  - Modify: analyzeSentiment() to handle financial context
  - Modify: dedup check to include topicId + platformPostId
  - Modify: main scan loop to batch AI validation post-scoring

apps/social/__tests__/lib/listening-scanner.test.js  (extend)
  - Add: tests for topic-adaptive weights
  - Add: tests for financial sentiment context
  - Add: tests for engagement velocity
  - Add: tests for cross-query dedup logic
```

### Pattern 1: AI Multiplier on Heuristic Score (SLST-01)
**What:** After computing heuristicScore, batch high-scoring hits (>0.35) through Haiku for semantic relevance. AI returns a multiplier (0.5-1.5) applied to the heuristic score.
**When to use:** Only for hits above the MEDIUM priority threshold -- avoid wasting API calls on obvious spam.
**Example:**
```javascript
// Pattern from existing analyzeSentimentBatch
async function batchValidateRelevance(hits, topicContext) {
  const context = {
    task: 'Score semantic relevance of each social media post to the topic',
    topic: topicContext,
    posts: hits.map((h, i) => ({
      index: i,
      content: h.content?.substring(0, 500),
      authorFollowers: h.authorFollowersOrKarma,
      engagement: h.engagementCount,
    })),
  };

  const result = await generateInsight('listening/relevance-validation', context, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    systemPrompt: `You are a relevance classifier for social listening.
Score each post 0.5 to 1.5 where:
- 0.5 = tangentially related or off-topic noise
- 1.0 = relevant, matches topic intent
- 1.5 = highly relevant, actionable insight
Return JSON array: [{"index":number,"multiplier":number,"reason":"string"}]`,
  });

  return result; // Array of {index, multiplier, reason}
}

// In main loop, after computing heuristicScore:
// finalScore = heuristicScore * aiMultiplier
```

**Cost estimate:** At 10-20 hits per batch, ~500 input tokens + ~200 output tokens per batch = ~$0.0004 per batch. With ~50 batches/day = ~$0.02/day.

### Pattern 2: Topic-Adaptive Weight Profiles (SLST-02)
**What:** Replace hardcoded `0.45/0.25/0.20/0.10` weights with per-topic-type profiles.
**When to use:** Applied automatically based on topic type detection (already partially exists in `getTopicKeyTerms()`).
**Example:**
```javascript
const TOPIC_WEIGHT_PROFILES = {
  KOL: {
    contentRelevance: 0.35,
    engagement: 0.20,
    followers: 0.35,  // KOL topics: follower count matters most
    recency: 0.10,
  },
  COMPETITOR: {
    contentRelevance: 0.55,  // Competitor topics: content match is critical
    engagement: 0.20,
    followers: 0.10,
    recency: 0.15,
  },
  BRAND: {
    contentRelevance: 0.45,  // Default/brand monitoring
    engagement: 0.25,
    followers: 0.20,
    recency: 0.10,
  },
};

function getTopicType(topic) {
  const name = topic.name.toLowerCase();
  if (name.includes('kol')) return 'KOL';
  if (name.includes('competitor')) return 'COMPETITOR';
  return 'BRAND';
}
```

### Pattern 3: Financial Context Sentiment (SLST-03)
**What:** Ambiguous financial terms ("short", "yield", "liquidation") are classified based on surrounding context rather than hardcoded positive/negative.
**When to use:** During `analyzeSentiment()` when financial terms are detected.
**Example:**
```javascript
const FINANCIAL_AMBIGUOUS_TERMS = {
  'short': { financial: true, contexts: {
    bearish: ['short selling', 'shorting', 'short position', 'short squeeze'],
    neutral: ['in short', 'short term', 'short video', 'short time'],
  }},
  'yield': { financial: true, contexts: {
    positive: ['high yield', 'yield farming', 'yield protocol', 'yield bearing'],
    neutral: ['yield results', 'yield to'],
  }},
  'liquidation': { financial: true, contexts: {
    negative: ['forced liquidation', 'liquidation cascade', 'liquidation event'],
    neutral: ['liquidation preference', 'orderly liquidation'],
  }},
  'dump': { financial: true, contexts: {
    negative: ['token dump', 'price dump', 'dumping tokens'],
    neutral: ['data dump', 'brain dump'],
  }},
  'moon': { financial: true, contexts: {
    positive: ['to the moon', 'mooning', 'moon shot'],
    neutral: ['moon landing', 'full moon'],
  }},
  'rug': { financial: true, contexts: {
    negative: ['rug pull', 'rugged', 'rug pulled'],
    neutral: ['under the rug', 'rug design'],
  }},
};

function resolveFinancialSentiment(text, term) {
  const lower = text.toLowerCase();
  const termConfig = FINANCIAL_AMBIGUOUS_TERMS[term];
  if (!termConfig) return null;

  for (const [sentiment, phrases] of Object.entries(termConfig.contexts)) {
    if (phrases.some(p => lower.includes(p))) return sentiment;
  }
  return null; // No context match -- fall through to default logic
}
```

### Pattern 4: Engagement Velocity (SLST-04)
**What:** Compute `engagementCount / postAgeHours` and blend into score alongside absolute engagement.
**When to use:** Always, for all hits where `detectedAt` is available.
**Example:**
```javascript
function computeEngagementVelocity(engagementCount, detectedAt) {
  const ageHours = Math.max(0.5, (Date.now() - detectedAt.getTime()) / (1000 * 60 * 60));
  return engagementCount / ageHours;
}

// In scoring: replace pure normalizedEngagement with blended:
// engagementFactor = 0.6 * normalize(engagementCount, 100000)
//                  + 0.4 * normalize(engagementVelocity, 500)
```

### Pattern 5: Cross-Query Dedup (SLST-05)
**What:** Before creating a ListeningHit, check `topicId + platformPostId` in addition to existing `queryId + platformPostId`.
**When to use:** In the main scan loop, before the existing dedup check.
**Example:**
```javascript
// Existing dedup (keep): queryId + platformPostId via Prisma findFirst
// New dedup (add): topicId + platformPostId via Redis SET
const topicDedupKey = `listening:dedup:${topic.id}:${platformPostId}`;
const alreadyInTopic = await kv.get(topicDedupKey);
if (alreadyInTopic) continue;

// After creating the hit, set the dedup key
await kv.set(topicDedupKey, '1', { ex: 7 * 24 * 60 * 60 }); // 7-day TTL
```

### Anti-Patterns to Avoid
- **Full rewrite of scoring logic:** The decision is "AI multiplier on heuristics", not a replacement. Keep the heuristic pipeline intact.
- **AI call per individual hit:** Always batch. Individual API calls would be 10-50x more expensive and slower.
- **Removing existing keyword sentiment:** Financial context is an enhancement layer on top of keyword sentiment, not a replacement. Keyword sentiment is the fast fallback.
- **Prisma-only cross-query dedup:** Prisma `findFirst` on `topicId + platformPostId` is a DB round-trip per hit. Redis SET membership is much faster for the hot path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AI batch API calls | Custom HTTP client | `generateInsight()` from `lib/ai.js` | Already handles cost tracking, JSON parsing, error recovery |
| Redis dedup | Custom in-memory Set | `@vercel/kv` SET operations | Persistent across serverless invocations, already in use |
| Sentiment analysis fallback | Complex error handling | Existing keyword fallback in `analyzeSentimentBatch` | Already handles API failures gracefully |

**Key insight:** The existing codebase already has all the infrastructure patterns needed. This phase is about algorithmic improvements within the existing framework, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: AI Cost Explosion
**What goes wrong:** Sending every hit through AI validation regardless of heuristic score.
**Why it happens:** Not filtering by score threshold before batching.
**How to avoid:** Only batch hits with `heuristicScore > 0.35` (MEDIUM+ tier). Skip SPAM/LOW hits entirely.
**Warning signs:** API cost logs showing >$1/day for listening validation.

### Pitfall 2: Race Condition in Cross-Query Dedup
**What goes wrong:** Two queries for the same topic process the same post simultaneously, both pass the dedup check.
**Why it happens:** Queries within a topic are processed sequentially in the current code (inner `for` loop), but the Redis check and set are not atomic.
**How to avoid:** Use Redis `SET NX` (set-if-not-exists) pattern: `kv.set(key, '1', { ex: TTL, nx: true })`. If it returns null/false, the key already existed.
**Warning signs:** Duplicate `topicId + platformPostId` pairs in ListeningHit table.

### Pitfall 3: Financial Term False Positives
**What goes wrong:** "Short" in "short video" gets classified as bearish financial sentiment.
**Why it happens:** Financial terms are ambiguous without phrase-level context.
**How to avoid:** Use the phrase-matching approach in the financial context resolver -- match on multi-word phrases, not single words.
**Warning signs:** Brand monitoring hits about short-form content being classified as negative.

### Pitfall 4: Engagement Velocity Division by Near-Zero
**What goes wrong:** Very recent posts (seconds old) produce astronomically high velocity scores.
**Why it happens:** `engagementCount / 0.001 hours` = massive number.
**How to avoid:** Floor the age at 0.5 hours minimum. A post less than 30 minutes old is too fresh for meaningful velocity.
**Warning signs:** New posts with 1 like scoring higher than viral posts.

### Pitfall 5: AI Batch Timeout on Vercel
**What goes wrong:** Haiku batch call takes >10s, causing the cron to approach Vercel's execution limit.
**Why it happens:** Too many hits in a single batch, or complex prompt.
**How to avoid:** Cap batches at 15-20 hits. Keep the prompt concise. Set a 10s timeout on `generateInsight()` calls for this use case.
**Warning signs:** Cron execution times exceeding 30s (Vercel limit is 60s for Pro, 10s for Hobby).

## Code Examples

### Current Score Computation (lines 799-821 of listening-scanner.js)
```javascript
// Current weights: 45% content, 25% engagement, 20% followers, 10% recency
const heuristicScore =
  normalizedFollowers * 0.20 +
  normalizedEngagement * 0.25 +
  contentRelevance * 0.45 +
  recencyFactor * 0.10;
```

### Existing AI Batch Pattern (from lib/ai/sentiment.js)
```javascript
// This is the template for SLST-01's batch validation
const result = await generateInsight('sentiment/batch-analysis', context, {
  model: 'claude-haiku-4-5-20251001',
  maxTokens: 2048,
  systemPrompt: '...',
});
```

### Current Dedup Check (lines 709-716 of listening-scanner.js)
```javascript
// Current: per-query dedup via Prisma
const existing = await prisma.listeningHit.findFirst({
  where: {
    queryId: query.id,
    platformPostId: String(platformPostId),
  },
});
if (existing) continue;
```

### Existing Topic Type Detection (lines 325-361 of listening-scanner.js)
```javascript
// getTopicKeyTerms() already differentiates Figure/KOL vs Competitor topics
// This is the foundation for SLST-02's topic-adaptive weights
function getTopicKeyTerms(topic) {
  const name = topic.name.toLowerCase();
  if (name.includes('figure') || name.includes('kol')) {
    return ECOSYSTEM_TERMS;
  }
  // Competitor topics extract brand terms from name and queries
  // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed scoring weights | Topic-adaptive weights | This phase | Better signal-to-noise per topic type |
| Absolute engagement count | Engagement velocity blend | This phase | Viral-detection for fresh posts |
| Keyword-only sentiment | Financial context overlay | This phase | Correct sentiment for crypto/finance terms |
| Per-query dedup only | Cross-query + per-query dedup | This phase | No duplicate posts within a topic |
| Heuristic-only relevance | Hybrid AI+heuristic | This phase | Semantic understanding for ambiguous matches |

## Open Questions

1. **AI validation score threshold**
   - What we know: MEDIUM tier starts at 0.35 heuristicScore
   - What's unclear: Should we validate all MEDIUM+ or only HIGH+ (>0.55)?
   - Recommendation: Start with MEDIUM+ (>0.35), monitor costs, tighten if >$0.10/day

2. **Topic type detection granularity**
   - What we know: Current code checks for "kol" and "competitor" in topic name
   - What's unclear: Should topic type be a formal field on ListeningTopic model?
   - Recommendation: Use name-based detection for now (matches existing pattern), add schema field in future if needed

3. **Cross-query dedup TTL**
   - What we know: Reddit polls every 12h, X every 10min
   - What's unclear: How long should the dedup key persist?
   - Recommendation: 7-day TTL matches the recency decay window in scoring

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `apps/social/vitest.config.js` |
| Quick run command | `cd apps/social && npx vitest run __tests__/lib/listening-scanner.test.js` |
| Full suite command | `cd apps/social && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SLST-01 | AI multiplier applied to heuristic score | unit | `cd apps/social && npx vitest run __tests__/lib/listening-scanner.test.js -t "ai multiplier"` | Wave 0 |
| SLST-02 | Topic-adaptive weights produce different scores | unit | `cd apps/social && npx vitest run __tests__/lib/listening-scanner.test.js -t "topic-adaptive"` | Wave 0 |
| SLST-03 | Financial terms scored with context | unit | `cd apps/social && npx vitest run __tests__/lib/listening-scanner.test.js -t "financial"` | Wave 0 |
| SLST-04 | Engagement velocity blended into score | unit | `cd apps/social && npx vitest run __tests__/lib/listening-scanner.test.js -t "velocity"` | Wave 0 |
| SLST-05 | Cross-query dedup prevents topic duplicates | unit | `cd apps/social && npx vitest run __tests__/lib/listening-scanner.test.js -t "cross-query"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/social && npx vitest run __tests__/lib/listening-scanner.test.js`
- **Per wave merge:** `cd apps/social && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/social/__tests__/lib/listening-scanner.test.js` -- needs new test cases for: topic-adaptive weights, financial sentiment, engagement velocity, cross-query dedup, AI multiplier (mocked `generateInsight`)
- [ ] No new test files needed -- all tests extend the existing test file

## Sources

### Primary (HIGH confidence)
- `apps/social/lib/listening-scanner.js` - Full source code analysis (1040 lines)
- `apps/social/lib/ai/sentiment.js` - Existing AI batch sentiment pattern
- `apps/social/lib/ai.js` - `generateInsight()` API with cost tracking
- `apps/social/lib/redis.js` - Vercel KV client and caching patterns
- `apps/social/prisma/schema.prisma` - ListeningHit, ListeningQuery, ListeningTopic models
- `apps/social/__tests__/lib/listening-scanner.test.js` - Existing test coverage
- `apps/social/lib/api-costs.js` - Haiku pricing: $0.25/1M input, $1.25/1M output

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` - Decision: "Listening algorithm improvements are additive (AI multiplier on heuristics), not rewrite"
- `.planning/REQUIREMENTS.md` - SLST-01 through SLST-05 requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - All patterns derived from existing codebase, modifications not additions
- Pitfalls: HIGH - Based on direct code analysis of edge cases in the existing implementation

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, no external dependency changes expected)
