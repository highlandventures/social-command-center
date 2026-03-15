---
phase: 4
slug: content-co-pilot
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing) + manual verification |
| **Config file** | jest.config.js (if exists) or "none — Wave 0 installs" |
| **Quick run command** | `npx jest --passWithNoTests` |
| **Full suite command** | `npx jest --passWithNoTests` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --passWithNoTests`
- **After every plan wave:** Run `npx jest --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CPLT-01 | checkpoint:human-verify | manual | N/A | ⬜ pending |
| 04-01-02 | 01 | 1 | CPLT-02 | checkpoint:human-verify | manual | N/A | ⬜ pending |
| 04-01-03 | 01 | 1 | CPLT-03 | checkpoint:human-verify | manual | N/A | ⬜ pending |
| 04-02-01 | 02 | 2 | CPLT-04 | checkpoint:human-verify | manual | N/A | ⬜ pending |
| 04-02-02 | 02 | 2 | CPLT-05 | checkpoint:human-verify | manual | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework setup needed.

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
