---
phase: 7
slug: scheduling-ad-hoc-reports
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.js |
| **Quick run command** | `npx vitest run __tests__/lib/scheduling/ __tests__/lib/adhoc-report/ --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run __tests__/lib/scheduling/ __tests__/lib/adhoc-report/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-00-01 | 00 | 1 | SCHED-01..04, ADHC-01..05 | stubs | `npx vitest run __tests__/lib/scheduling/ __tests__/lib/adhoc-report/` | ❌ W0 | ⬜ pending |
| 07-01-01 | 01 | 1 | SCHED-01..04, DIST-01, DIST-03 | unit | `npx vitest run __tests__/lib/scheduling/` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | ADHC-01..05 | unit | `npx vitest run __tests__/lib/adhoc-report/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/lib/scheduling/schedule-manager.test.js` — stubs for SCHED-01..04, DIST-01, DIST-03
- [ ] `__tests__/lib/adhoc-report/adhoc-chat.test.js` — stubs for ADHC-01..05

*Wave 0 creates these as describe.skip stubs per project convention.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schedule UI CRUD | SCHED-03 | Visual/interaction | Create, edit, toggle, delete a schedule in /reports |
| Ad hoc chat streaming | ADHC-01 | Requires Anthropic API | Open chat, describe report, verify AI asks questions |
| Chat persists across refresh | ADHC-05 | Browser state | Start chat, refresh page, verify messages reload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
