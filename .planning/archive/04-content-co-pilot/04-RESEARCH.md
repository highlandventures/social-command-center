# Phase 4: Content Co-Pilot - Research

**Researched:** 2026-03-15
**Domain:** Conversational AI chat interface with streaming, intel context injection, brand voice learning
**Confidence:** HIGH

## Summary

Phase 4 replaces the existing "AI Ideas" sidebar tab in the composer with a full conversational co-pilot powered by Claude Sonnet. The implementation requires: (1) a streaming chat API using the Vercel AI SDK (`ai` + `@ai-sdk/anthropic`), which provides the `useChat` hook and `streamText` server helper designed specifically for Next.js App Router; (2) new Prisma models for conversation persistence (`CopilotThread`, `CopilotMessage`); (3) a system prompt pipeline that assembles intel context from the AIInsight cache and brand voice examples from top-performing posts; (4) a "draft insertion" mechanism that detects draft content in co-pilot messages and provides an "Insert into Composer" button.

The project already has `@anthropic-ai/sdk` v0.24.3 for batch AI analysis (Haiku). For the co-pilot's streaming chat, the Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) is the standard approach -- it handles SSE streaming, message state management, loading/error states, and abort via `useChat`, eliminating hundreds of lines of custom streaming code. The existing `@anthropic-ai/sdk` remains for batch cron analysis; the AI SDK is additive for the chat use case.

**Primary recommendation:** Use Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) with a dedicated `/api/copilot/chat` route handler, NOT tRPC, for the streaming endpoint. Use tRPC for non-streaming operations (thread CRUD, intel fetching, daily usage counts).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Replace existing "AI Ideas" sidebar tab with "Co-Pilot" -- keeps sidebar at 4 tabs (Drafts, Queue, Intel, Co-Pilot)
- Simple text input + send button at bottom (Enter to send, Shift+Enter for newline)
- Stream responses using Claude streaming API -- tokens appear as they arrive (ChatGPT-style)
- Conversation history persists in database via a CopilotThread model
- Show most recent conversation on open with a "New Thread" button to start fresh
- Smart suggestion chips on empty state: 3-4 contextual prompts based on latest intel data
- Auto-load condensed summary of all 3 intel sources on conversation start (~500 tokens)
- Co-pilot can fetch deeper data on-demand when conversation calls for it
- Few-shot learning from top-performing published posts (3-5 posts as examples in system prompt)
- Per-account voice: each account's top posts train a different voice
- Voice switches automatically when user switches accounts in the composer
- Performance prediction on-demand only with inline score card display
- "Insert into Composer" button on each co-pilot message containing draft content
- Replace/append prompt when composer already has content
- Mode-aware drafts (thread/post/article based on active mode)
- Claude Sonnet for all co-pilot conversations
- Soft daily limit with warning after ~50 messages -- no hard block
- Costs logged to existing APICallLog table
- Inline error with retry button in chat -- no page-level errors
- Graceful degradation when no intel data exists

### Claude's Discretion
- CopilotThread/CopilotMessage schema design (fields, indexes, retention)
- System prompt engineering for brand voice + intel context injection
- Smart suggestion chip generation logic
- Streaming implementation details (SSE vs WebSocket vs tRPC subscription)
- Message rendering styles (markdown support, code blocks, etc.)
- Exact condensed intel summary format and token budget
- How to detect "draft content" in co-pilot messages for showing the insert button

### Deferred Ideas (OUT OF SCOPE)
- Graphics/image evaluation (requires vision model capabilities)
- Auto-predict before publish (prediction gate on publish/schedule button)
- Slash commands in chat input (/predict, /voice, /competitors)
- Cross-platform content adaptation in co-pilot
- A/B content variant generation
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CPLT-01 | Chat interface in composer for multi-turn content co-creation conversations | Vercel AI SDK `useChat` hook handles message state, streaming, abort; dedicated API route for streaming; CopilotThread/CopilotMessage Prisma models for persistence |
| CPLT-02 | Co-pilot has access to all 3 intel panels as context (performance patterns, competitor themes, audience questions) | System prompt pipeline reads from AIInsight cache (PERFORMANCE_PATTERN, COMPETITOR_STRATEGY, AUDIENCE_QUESTION types); condensed ~500 token summary auto-loaded; on-demand deeper fetches via function calling or secondary queries |
| CPLT-03 | Co-pilot learns brand voice from top-performing published posts | Few-shot examples in system prompt from top-tier posts per account; query Post + PostMetrics sorted by engagementRate; voice switches when selectedAccount changes |
| CPLT-04 | Co-pilot can predict performance of drafted content before publishing | Reuse/adapt existing `predictPerformance` logic from `lib/ai/content-suggestions.js`; render inline score card in chat message |
| CPLT-05 | Co-pilot can insert drafted content directly into the composer editor | Draft detection heuristic on assistant messages; "Insert into Composer" button; replace/append modal; mode-aware content generation (thread array vs single post vs article) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | ^4.x (latest stable) | `useChat` hook, `streamText` server helper, message types | Industry standard for Next.js AI chat; handles streaming, abort, error states, message management out of the box |
| `@ai-sdk/anthropic` | ^3.x (latest) | Anthropic provider for AI SDK | Official provider; maps Claude models to AI SDK interface |
| `@anthropic-ai/sdk` | 0.24.3 (existing) | Batch AI calls in cron jobs | Already installed; keep for non-streaming Haiku analysis |
| `@prisma/client` | 5.14.x (existing) | Database ORM for thread/message persistence | Already in use project-wide |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-markdown` | ^9.x | Render markdown in co-pilot responses | Chat messages with headers, lists, bold, code blocks |
| `remark-gfm` | ^4.x | GFM tables/strikethrough in markdown | If co-pilot outputs tables or task lists |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vercel AI SDK `useChat` | Raw `fetch` + `ReadableStream` + custom state | 200+ lines of custom streaming code, manual abort handling, manual message accumulation; only justified if AI SDK proves incompatible |
| Vercel AI SDK | tRPC subscription with SSE | tRPC v10 has no native SSE support; would require upgrading to v11 or adding community packages; high risk for low gain |
| `react-markdown` | `dangerouslySetInnerHTML` | Security risk, no sanitization; markdown renderer is trivial to add |

**Installation:**
```bash
npm install ai @ai-sdk/anthropic react-markdown remark-gfm
```

## Architecture Patterns

### Recommended Project Structure
```
app/api/copilot/
  chat/route.js          # Streaming chat endpoint (POST) -- uses AI SDK streamText
lib/
  copilot/
    system-prompt.js     # Builds system prompt with intel + brand voice
    intel-context.js     # Reads/condenses AIInsight cache for co-pilot context
    brand-voice.js       # Fetches top posts per account as few-shot examples
    draft-detector.js    # Detects draft content in assistant messages
  routers/
    copilot.js           # tRPC router for thread CRUD, usage counts, suggestion chips
components/
  CopilotPanel.jsx       # Main co-pilot sidebar panel (replaces AI Ideas)
  CopilotMessage.jsx     # Individual message renderer with markdown + insert button
  CopilotInput.jsx       # Text input with send button, Enter/Shift+Enter
  CopilotSuggestionChips.jsx  # Empty state contextual prompts
  PredictionCard.jsx     # Inline score card for performance predictions
prisma/
  schema.prisma          # + CopilotThread, CopilotMessage models
```

### Pattern 1: Streaming Chat via Vercel AI SDK
**What:** Use `streamText` in a Next.js API route and `useChat` on the client
**When to use:** All co-pilot conversation interactions
**Example:**
```javascript
// app/api/copilot/chat/route.js
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { buildSystemPrompt } from '@/lib/copilot/system-prompt';

export async function POST(req) {
  const { messages, accountId, postMode, platform } = await req.json();

  const systemPrompt = await buildSystemPrompt({ accountId, postMode, platform });

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages,
    maxTokens: 2048,
    // onFinish callback for persistence + cost logging
    async onFinish({ text, usage }) {
      // Save to CopilotMessage, log to APICallLog
    },
  });

  return result.toDataStreamResponse();
}
```

```javascript
// components/CopilotPanel.jsx (client)
import { useChat } from 'ai/react';

function CopilotPanel({ accountId, postMode, platform }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, reload } = useChat({
    api: '/api/copilot/chat',
    body: { accountId, postMode, platform },
  });
  // render messages, input, etc.
}
```

### Pattern 2: System Prompt Pipeline
**What:** Assemble a dynamic system prompt with intel context + brand voice + mode awareness
**When to use:** Every conversation start and when account/mode changes
**Example:**
```javascript
// lib/copilot/system-prompt.js
export async function buildSystemPrompt({ accountId, postMode, platform }) {
  const [intelSummary, brandExamples] = await Promise.all([
    getCondensedIntelSummary(),       // ~500 tokens from AIInsight cache
    getTopPostsForAccount(accountId), // 3-5 top posts as few-shot
  ]);

  return `You are a content co-pilot for a social media team...

## Current Context
- Platform: ${platform}
- Post mode: ${postMode}
- Active account: ${accountId}

## Intel Summary
${intelSummary}

## Brand Voice Examples
Write in the style of these top-performing posts:
${brandExamples.map((p, i) => `Example ${i+1}: "${p.content}"`).join('\n')}

## Guidelines
- When suggesting content, be mode-aware: threads produce arrays, single posts stay under 280 chars for X
- Reference specific data from the intel summary when relevant
- If asked to predict performance, provide engagement rate estimate, impressions estimate, confidence level
- When writing draft content, clearly mark it so the team can insert it into the composer
`;
}
```

### Pattern 3: Draft Detection and Insertion
**What:** Detect draft content in assistant messages and show an "Insert into Composer" button
**When to use:** Any assistant message that contains publishable content
**Example:**
```javascript
// lib/copilot/draft-detector.js
// Heuristic: look for content in code fences, or after "Here's a draft:" patterns,
// or messages that are primarily content (not conversational)
export function detectDraftContent(messageText) {
  // Check for explicit draft markers
  const draftPatterns = [
    /(?:here'?s?\s+(?:a|the|your)\s+)?draft[:\s]/i,
    /```(?:draft|post|thread|tweet)/i,
    /##\s*(?:Draft|Post|Thread|Tweet)/i,
  ];

  const hasDraftMarker = draftPatterns.some(p => p.test(messageText));

  // Check for thread format (numbered items or array-like structure)
  const hasThreadFormat = /(?:^|\n)\s*(?:\d+[.)]\s|Tweet \d|Post \d)/m.test(messageText);

  return hasDraftMarker || hasThreadFormat;
}
```

### Pattern 4: Non-Streaming Operations via tRPC
**What:** Thread CRUD, usage counting, suggestion chips stay in tRPC
**When to use:** Everything except the streaming chat itself
**Example:**
```javascript
// lib/routers/copilot.js
export const copilotRouter = router({
  // Get recent thread for "show most recent on open"
  getRecentThread: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.copilotThread.findFirst({
      where: { userId: ctx.user.id },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }),

  // Create new thread
  createThread: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.prisma.copilotThread.create({
      data: { userId: ctx.user.id },
    });
  }),

  // Get daily usage count for soft limit
  getDailyUsage: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return ctx.prisma.copilotMessage.count({
      where: {
        thread: { userId: ctx.user.id },
        role: 'user',
        createdAt: { gte: today },
      },
    });
  }),

  // Smart suggestion chips
  getSuggestionChips: protectedProcedure.query(async ({ ctx }) => {
    // Read latest intel from AIInsight cache, generate 3-4 contextual prompts
  }),
});
```

### Anti-Patterns to Avoid
- **Streaming through tRPC:** tRPC v10 does not support SSE natively. Do NOT attempt to hack streaming through tRPC mutations or subscriptions. Use a plain Next.js API route for the streaming endpoint.
- **Loading all intel in every message:** The ~500 token intel summary goes in the system prompt only. Do NOT append full intel data to every user message -- it inflates costs linearly per turn.
- **Single system prompt for all accounts:** Brand voice MUST be per-account. Switching accounts in the composer must rebuild the system prompt with different few-shot examples.
- **Storing streamed messages mid-stream:** Persist messages only `onFinish` (complete response), not during streaming. Partial messages in the DB create consistency issues.
- **Blocking the streaming route with heavy DB queries:** Build the system prompt BEFORE calling `streamText`. Pre-fetch intel summary and brand voice, then stream.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE streaming + message state | Custom fetch + ReadableStream + useState for messages, loading, error, abort | Vercel AI SDK `useChat` + `streamText` | Handles reconnection, abort, message accumulation, error recovery, token-by-token rendering. 200+ lines of custom code eliminated. |
| Markdown rendering | Regex-based markdown parser or dangerouslySetInnerHTML | `react-markdown` + `remark-gfm` | XSS-safe, handles edge cases (nested lists, code fences, tables), well-maintained |
| Chat message persistence sync | Custom sync logic between client state and DB | AI SDK `onFinish` callback + tRPC for initial load | `onFinish` fires exactly once per completed response with full text + usage stats |
| Cost calculation per message | Manual token counting | AI SDK `usage` object in `onFinish` (provides `promptTokens`, `completionTokens`) | Exact token counts from the API response, not estimates |

**Key insight:** The Vercel AI SDK was built specifically for the Next.js + LLM streaming use case. Rolling a custom implementation would replicate 80% of what `useChat`/`streamText` already handle, but with more bugs and no community maintenance.

## Common Pitfalls

### Pitfall 1: System Prompt Token Budget Creep
**What goes wrong:** Intel summary + brand voice examples + instructions exceed 2000 tokens, making every message expensive
**Why it happens:** Three intel sources + 5 example posts + detailed instructions add up fast
**How to avoid:** Hard budget: ~500 tokens for intel summary, ~300 tokens for brand voice examples (truncate post content to 200 chars each), ~200 tokens for instructions = ~1000 tokens total system prompt. Measure with `anthropic.messages.countTokens()` during development.
**Warning signs:** APICallLog showing > $0.05 per message, or input tokens consistently > 3000

### Pitfall 2: Account Context Not Updating on Switch
**What goes wrong:** User switches accounts in composer, but co-pilot still uses previous account's brand voice
**Why it happens:** `useChat` caches its configuration; changing `body` props doesn't restart the conversation
**How to avoid:** When `selectedAccount` changes, call `useChat`'s `setMessages([])` or create a new thread. Include `accountId` in the `body` option of `useChat` and verify it's sent with each request.
**Warning signs:** Co-pilot voice doesn't match the active account's style

### Pitfall 3: Streaming Route Missing Auth
**What goes wrong:** The `/api/copilot/chat` route is a plain Next.js API route, not a tRPC procedure -- it bypasses tRPC auth middleware
**Why it happens:** Moving from tRPC to plain API route means `protectedProcedure` no longer applies
**How to avoid:** Explicitly call `getServerSession(authOptions)` at the top of the route handler and return 401 if no session. Use the same `authOptions` from `lib/auth.js`.
**Warning signs:** Unauthenticated requests succeeding against the chat endpoint

### Pitfall 4: Empty Intel on First Use
**What goes wrong:** Co-pilot launched before cron has populated AIInsight cache; system prompt has no intel data
**Why it happens:** New deployment or first-time setup, cron hasn't run yet
**How to avoid:** System prompt builder checks for empty intel and includes a fallback note: "Intel data is not yet available. Run the daily analysis cron to populate insights." Co-pilot still functions for drafting without intel.
**Warning signs:** Co-pilot responses are generic, never reference performance data or competitor themes

### Pitfall 5: Message Ordering Race Conditions
**What goes wrong:** Loading a thread's history while a new message is being streamed creates duplicate or out-of-order messages
**Why it happens:** Client state from `useChat` and DB state from thread load can conflict
**How to avoid:** Load thread history ONCE on mount, then let `useChat` manage all subsequent messages. Set `initialMessages` prop on `useChat` from the DB-loaded history. Never re-fetch thread history while a conversation is active.
**Warning signs:** Duplicate messages, messages appearing in wrong order

### Pitfall 6: Vercel Serverless Function Timeout
**What goes wrong:** Long co-pilot responses (complex threads, detailed predictions) exceed Vercel's default 10s function timeout
**Why it happens:** Streaming keeps the connection open for the full generation time; Sonnet can take 20-30s for long responses
**How to avoid:** Vercel Hobby has 10s, Pro has 60s. Ensure the project is on Pro plan, or set `maxDuration` in the route config: `export const maxDuration = 60;`. Also set reasonable `maxTokens` (2048 for most responses).
**Warning signs:** 504 gateway timeout errors on longer generations

## Code Examples

### Prisma Schema for CopilotThread/CopilotMessage
```prisma
// Add to prisma/schema.prisma

model CopilotThread {
  id        String   @id @default(cuid())
  userId    String
  accountId String?  // Which social account context
  title     String?  // Auto-generated from first message
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages CopilotMessage[]

  @@index([userId, updatedAt])
  @@map("copilot_threads")
}

model CopilotMessage {
  id        String   @id @default(cuid())
  threadId  String
  role      String   // "user" | "assistant" | "system"
  content   String
  metadata  Json?    // For predictions, draft markers, etc.
  createdAt DateTime @default(now())

  thread CopilotThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId, createdAt])
  @@map("copilot_messages")
}
```

Note: Add `copilotThreads CopilotThread[]` relation to the User model.

### Sonnet Cost Constants
```javascript
// Add to lib/api-costs.js
// Claude Sonnet 3.5 / Sonnet 4: $3/1M input, $15/1M output
CLAUDE_SONNET_INPUT_PER_TOKEN: 0.000003,
CLAUDE_SONNET_OUTPUT_PER_TOKEN: 0.000015,
```

### Intel Context Condensation
```javascript
// lib/copilot/intel-context.js
import { prisma } from '@/lib/db';

export async function getCondensedIntelSummary() {
  const [perfInsight, compInsight, audInsight] = await Promise.all([
    prisma.aIInsight.findFirst({
      where: { insightType: 'PERFORMANCE_PATTERN', dismissed: false },
      orderBy: { generatedAt: 'desc' },
    }),
    prisma.aIInsight.findFirst({
      where: { insightType: 'COMPETITOR_STRATEGY', dismissed: false },
      orderBy: { generatedAt: 'desc' },
    }),
    prisma.aIInsight.findFirst({
      where: { insightType: 'AUDIENCE_QUESTION', dismissed: false },
      orderBy: { generatedAt: 'desc' },
    }),
  ]);

  const sections = [];
  if (perfInsight?.content) {
    sections.push(`Performance: ${summarize(perfInsight.content, 150)}`);
  }
  if (compInsight?.content) {
    sections.push(`Competitors: ${summarize(compInsight.content, 150)}`);
  }
  if (audInsight?.content) {
    sections.push(`Audience Questions: ${summarize(audInsight.content, 150)}`);
  }

  return sections.length > 0
    ? sections.join('\n\n')
    : 'No intel data available yet. Run the daily analysis cron to populate insights.';
}

function summarize(content, maxChars) {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return text.length > maxChars ? text.slice(0, maxChars) + '...' : text;
}
```

### Brand Voice Example Fetching
```javascript
// lib/copilot/brand-voice.js
import { prisma } from '@/lib/db';

export async function getTopPostsForAccount(accountId, limit = 5) {
  if (!accountId) return [];

  const posts = await prisma.post.findMany({
    where: {
      accountId,
      status: 'PUBLISHED',
    },
    include: {
      metrics: {
        orderBy: { fetchedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 50, // fetch more, then sort by engagement
  });

  // Sort by engagement rate, take top N
  return posts
    .filter(p => p.metrics[0]?.engagementRate > 0)
    .sort((a, b) => (b.metrics[0]?.engagementRate || 0) - (a.metrics[0]?.engagementRate || 0))
    .slice(0, limit)
    .map(p => ({
      content: p.content.slice(0, 200),
      contentType: p.contentType,
      engagementRate: p.metrics[0]?.engagementRate,
    }));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `fetch` + `ReadableStream` for LLM streaming | Vercel AI SDK `useChat`/`streamText` | AI SDK v3+ (2024), now at v4/v6 (2025-2026) | Eliminates boilerplate; handles abort, reconnect, error states |
| tRPC subscriptions via WebSocket | SSE via plain API routes for streaming; tRPC for CRUD | tRPC v11 added SSE (March 2025), but v10 projects use hybrid | tRPC v10 projects should NOT attempt streaming through tRPC |
| One-shot AI generation (request/response) | Streaming with `onFinish` persistence | Industry standard since ChatGPT (2023) | Users expect token-by-token rendering; batch response feels broken |
| Global brand voice prompt | Per-account few-shot examples from actual data | Current best practice | Much better voice matching than generic instructions |

**Deprecated/outdated:**
- `client.messages.create({ stream: true })` raw approach: Still works but requires manual event parsing; AI SDK wraps this cleanly
- The existing `ai.suggestContent` tRPC query: Will be subsumed by the co-pilot; can be kept for backward compatibility but the UI tab goes away

## Open Questions

1. **Thread retention policy**
   - What we know: CopilotThread/CopilotMessage will accumulate over time
   - What's unclear: How long to keep old threads; whether to auto-prune
   - Recommendation: Start with no auto-pruning. Add a `retentionDays` config later if storage becomes an issue. Index on `updatedAt` for efficient cleanup queries.

2. **AI SDK version pinning**
   - What we know: AI SDK has had multiple major versions (v3, v4, v6). The `useChat` API is stable across versions.
   - What's unclear: Whether the latest version has breaking changes with Next.js 14 (vs 15)
   - Recommendation: Install `ai@^4` (stable with Next.js 14 App Router). Test streaming works on first implementation task. The core `useChat` + `streamText` API has been stable since v3.

3. **Concurrent conversations across tabs**
   - What we know: Users might have multiple browser tabs open
   - What's unclear: Whether `useChat` handles this gracefully
   - Recommendation: Each tab operates independently; thread ID scoping prevents cross-tab interference. Not a launch blocker.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.x |
| Config file | `vitest.config.js` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CPLT-01 | Chat streaming endpoint returns SSE stream | integration | `npx vitest run __tests__/lib/copilot/chat-route.test.js -x` | Wave 0 |
| CPLT-02 | System prompt includes condensed intel from AIInsight cache | unit | `npx vitest run __tests__/lib/copilot/intel-context.test.js -x` | Wave 0 |
| CPLT-03 | Brand voice examples loaded per account from top posts | unit | `npx vitest run __tests__/lib/copilot/brand-voice.test.js -x` | Wave 0 |
| CPLT-04 | Performance prediction returns score card data | unit | `npx vitest run __tests__/lib/copilot/prediction.test.js -x` | Wave 0 |
| CPLT-05 | Draft detection identifies publishable content in messages | unit | `npx vitest run __tests__/lib/copilot/draft-detector.test.js -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/lib/copilot/intel-context.test.js` -- covers CPLT-02 (intel summary condensation)
- [ ] `__tests__/lib/copilot/brand-voice.test.js` -- covers CPLT-03 (top post selection per account)
- [ ] `__tests__/lib/copilot/draft-detector.test.js` -- covers CPLT-05 (draft content detection heuristic)
- [ ] `__tests__/lib/copilot/chat-route.test.js` -- covers CPLT-01 (streaming endpoint with mocked Anthropic)
- [ ] `__tests__/lib/copilot/prediction.test.js` -- covers CPLT-04 (prediction score card generation)
- [ ] Framework install: `npm install ai @ai-sdk/anthropic react-markdown remark-gfm` -- new dependencies

## Sources

### Primary (HIGH confidence)
- Anthropic SDK TypeScript repo (https://github.com/anthropics/anthropic-sdk-typescript) -- streaming API patterns, `messages.stream()` and `messages.create({ stream: true })`
- Anthropic Streaming Messages docs (https://docs.anthropic.com/en/api/messages-streaming) -- SSE event format, event types
- Vercel AI SDK docs (https://ai-sdk.dev/docs/introduction) -- `useChat`, `streamText`, provider architecture
- Vercel AI SDK Anthropic provider (https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) -- model names, configuration

### Secondary (MEDIUM confidence)
- Anthropic pricing page (https://platform.claude.com/docs/en/about-claude/pricing) -- Sonnet $3/$15 per 1M tokens, verified March 2026
- tRPC v11 announcement (https://trpc.io/blog/announcing-trpc-v11) -- SSE support in v11 only; confirms v10 lacks native SSE

### Tertiary (LOW confidence)
- AI SDK v6 blog post (https://vercel.com/blog/ai-sdk-6) -- v6 features; project should use v4 for Next.js 14 compatibility (needs validation at install time)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vercel AI SDK is the canonical approach for Next.js + Claude streaming; verified via official docs
- Architecture: HIGH - Patterns directly follow existing project conventions (self-contained panels, tRPC for CRUD, API routes for streaming)
- Pitfalls: HIGH - Based on known tRPC v10 limitations, Vercel serverless constraints, and standard streaming gotchas
- Schema design: MEDIUM - CopilotThread/CopilotMessage design follows standard chat patterns; may need iteration on metadata fields

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (30 days -- stable domain, AI SDK versions may update)
