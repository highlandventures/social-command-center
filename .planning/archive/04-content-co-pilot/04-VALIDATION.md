---
phase: 4
slug: content-co-pilot
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-15
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.js (created in Wave 0 / Plan 01) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CPLT-02,03,05 | vitest (TDD) | `npx vitest run __tests__/lib/copilot/ --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | CPLT-01,04 | vitest (TDD) | `npx vitest run __tests__/lib/copilot/chat-route.test.js __tests__/lib/copilot/prediction.test.js --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | CPLT-01,02 | vitest (TDD) | `npx vitest run __tests__/lib/routers/copilot.test.js --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | CPLT-01,02,03,05 | file check | `node -e "..."` file existence + content checks | N/A | ⬜ pending |
| 04-03-02 | 03 | 3 | CPLT-01 | grep check | `grep -c "CopilotPanel" ...` | N/A | ⬜ pending |
| 04-03-03 | 03 | 3 | ALL | checkpoint:human-verify | `npm run build 2>&1 \| tail -5` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/lib/copilot/intel-context.test.js` — tests for condensed intel summary
- [ ] `__tests__/lib/copilot/brand-voice.test.js` — tests for per-account voice examples
- [ ] `__tests__/lib/copilot/system-prompt.test.js` — tests for system prompt assembly
- [ ] `__tests__/lib/copilot/draft-detector.test.js` — tests for draft content detection
- [ ] `__tests__/lib/copilot/chat-route.test.js` — tests for streaming chat endpoint
- [ ] `__tests__/lib/copilot/prediction.test.js` — tests for performance prediction
- [ ] `__tests__/lib/routers/copilot.test.js` — tests for copilot tRPC procedures
- [ ] `vitest` + `@vitest/coverage-v8` — installed as dev dependencies

*Wave 0 items are created as part of Plan 01 (TDD-first approach).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chat interface renders in Co-Pilot tab | CPLT-01 | UI visual verification | Open composer, click Co-Pilot tab, verify chat input and message area render |
| Streaming responses appear token-by-token | CPLT-01 | Real-time streaming behavior | Send a message, verify tokens stream in progressively |
| Co-pilot references intel data | CPLT-02 | AI response quality | Ask about competitors or performance, verify response references real data |
| Brand voice matches top posts | CPLT-03 | Voice quality assessment | Generate content, compare tone/style to top-performing posts |
| Performance prediction card renders | CPLT-04 | UI + AI response format | Ask co-pilot to predict performance, verify score card appears |
| Insert into composer works | CPLT-05 | Cross-component interaction | Click insert button, verify content appears in composer editor |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-15
