# Phase 4: Content Co-Pilot - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning
**Source:** Direct user decisions

<domain>
## Phase Boundary

Conversational AI agent in the composer sidebar that co-creates content with the team. Replaces the existing "AI Ideas" tab with a chat interface powered by Claude Sonnet. Has full context on performance patterns, competitor themes, and audience questions from Phases 1-3. Can draft mode-aware content (thread/post/article), predict performance, and insert directly into the composer editor.

Scope: Text-based co-piloting only. Uses existing intel data from AIInsight cache. No new external data sources.

</domain>

<decisions>
## Implementation Decisions

### Chat Interface (CPLT-01)
- Replace existing "AI Ideas" sidebar tab with "Co-Pilot" -- keeps sidebar at 4 tabs (Drafts, Queue, Intel, Co-Pilot)
- Simple text input + send button at bottom (Enter to send, Shift+Enter for newline)
- Stream responses using Claude streaming API -- tokens appear as they arrive (ChatGPT-style)
- Conversation history persists in database via a CopilotThread model
- Show most recent conversation on open with a "New Thread" button to start fresh
- Smart suggestion chips on empty state: 3-4 contextual prompts based on latest intel data (e.g., "Write a thread about [hot audience question]", "Counter [competitor theme]", "Follow up on your top post about [topic]")

### Intel Awareness (CPLT-02)
- Auto-load a condensed summary of all 3 intel sources on conversation start (~500 tokens)
- Co-pilot can fetch deeper data on-demand when the conversation calls for it (e.g., "what questions are people asking about staking?" triggers full cluster fetch)
- Proactively references intel in suggestions -- weaves in performance data, competitor themes, audience questions naturally
- Always aware of current draft in the composer editor -- can offer suggestions contextually
- Model should evolve with weekly intel refreshes -- each conversation gets the latest cached insights from the most recent cron runs

### Brand Voice (CPLT-03)
- Few-shot learning from top-performing published posts (3-5 posts as examples in system prompt)
- Per-account voice: each account's top posts train a different voice (@provenancefdn more technical, @Figure more corporate)
- Voice switches automatically when user switches accounts in the composer
- Top posts come from Phase 1 performance intel data (tiered posts, top tier)

### Performance Prediction (CPLT-04)
- On-demand only -- user explicitly asks or co-pilot offers to predict
- Displays as an inline score card in the chat: predicted engagement rate, impressions estimate, confidence level, comparison to account average
- Styled consistently with the intel panel cards (colored border-l, compact layout)

### Draft Insertion (CPLT-05)
- "Insert into Composer" button on each co-pilot message containing draft content
- If composer editor already has content, prompt user: "Replace current draft or append below?"
- Mode-aware drafts: if in thread mode, co-pilot generates a thread (array of tweets); single post mode generates within char limit; article mode generates long-form
- Respects the active post mode and platform when generating content

### AI Model and Costs
- Claude Sonnet for all co-pilot conversations (per PROJECT.md decision)
- Soft daily limit with warning: after ~50 messages, show a gentle note ("You've been productive today!") -- no hard block
- Costs logged to existing APICallLog table
- Auto-loaded intel summary kept lean (~500 tokens) to control per-message cost

### Error Handling
- Inline error with retry button in chat -- no page-level errors
- Chat stays functional after errors -- user can retry or send a different message
- Graceful degradation when no intel data exists: co-pilot still works for drafting, notes "I don't have performance data yet -- run the daily cron to populate intel"

### Claude's Discretion
- CopilotThread/CopilotMessage schema design (fields, indexes, retention)
- System prompt engineering for brand voice + intel context injection
- Smart suggestion chip generation logic
- Streaming implementation details (SSE vs WebSocket vs tRPC subscription)
- Message rendering styles (markdown support, code blocks, etc.)
- Exact condensed intel summary format and token budget
- How to detect "draft content" in co-pilot messages for showing the insert button

</decisions>

<specifics>
## Specific Ideas

- User wants the co-pilot to be a collaborative thought starter -- sometimes the team has content ideas, sometimes they want a brainstorm/jam session. The co-pilot should adapt to both modes.
- Model should continuously evolve based on weekly trends, best practices, and competitor analysis that gets fed in via cron. Each conversation should reflect the latest data.
- User mentioned interest in evaluating graphics/images and how well they could perform on algorithms -- deferred to future since it requires vision model capabilities beyond text co-piloting.
- Existing `ai.optimizeThread` mutation does one-shot thread optimization -- co-pilot should subsume this with richer conversational optimization.
- Existing `ai.predictPerformance` mutation predicts engagement metrics -- co-pilot should use this or a similar approach for inline predictions.
- Existing `ai.suggestContent` query generates content ideas from listening data -- co-pilot replaces this with conversational idea generation.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/ai.js`: `generateInsight()` helper with cost tracking via APICallLog -- can extend for co-pilot messages
- `lib/ai.js`: `getAnthropic()` singleton -- reuse for streaming client
- `lib/routers/ai.js`: Existing `optimizeThread`, `predictPerformance`, `suggestContent` procedures -- patterns to follow or subsume
- `components/PerformanceIntelPanel.jsx`: Self-contained panel pattern with tRPC queries and staleTime caching
- `components/ui`: Skeleton, PlatformBadge, MiniSparkline components for consistent styling

### Established Patterns
- AIInsight cache-read pattern: tRPC procedures read from AIInsight cache, no live AI computation in routers (Phases 1-3)
- Self-contained panels: components manage own tRPC queries with `staleTime: 5 * 60 * 1000`
- Sidebar tab switching: `sidebarTab` state in composer page controls which tab content renders
- `readCachedInsight(prisma, dataType)` helper for DRY cache reads from AIInsight

### Integration Points
- `app/(dashboard)/composer/page.jsx` line 36: `sidebarTab` state -- replace 'ideas' key with 'copilot'
- `app/(dashboard)/composer/page.jsx` line 881: AI Ideas tab button -- rename to Co-Pilot
- `lib/routers/app.js`: Register new copilot tRPC router
- `prisma/schema.prisma`: Add CopilotThread and CopilotMessage models

</code_context>

<deferred>
## Deferred Ideas

- Graphics/image evaluation -- requires vision model capabilities (user mentioned wanting to evaluate how well graphics could do on the algorithm)
- Auto-predict before publish (prediction gate on publish/schedule button)
- Slash commands in chat input (/predict, /voice, /competitors)
- Cross-platform content adaptation in co-pilot (auto-convert X thread to Reddit post)
- A/B content variant generation

</deferred>

---

*Phase: 04-content-co-pilot*
*Context gathered: 2026-03-15 via direct user decisions*
