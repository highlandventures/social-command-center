---
phase: 5
slug: report-engine-charts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.js` (exists, `__tests__/**/*.test.{js,jsx}` pattern) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | RCNT-01 | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "KPI" -x` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | RCNT-02 | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "summary" -x` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | RCNT-03 | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "delta" -x` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | RCNT-04 | unit | `npx vitest run __tests__/lib/chart-renderer.test.js -x` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | RCNT-05 | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "sentiment" -x` | ❌ W0 | ⬜ pending |
| 05-01-06 | 01 | 1 | RCNT-06 | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "ad hoc" -x` | ❌ W0 | ⬜ pending |
| 05-01-07 | 01 | 1 | RCNT-07 | unit | `npx vitest run __tests__/lib/report-engine.test.js -t "content schema" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/lib/report-engine.test.js` — stubs for RCNT-01, RCNT-02, RCNT-03, RCNT-05, RCNT-06, RCNT-07
- [ ] `__tests__/lib/chart-renderer.test.js` — stubs for RCNT-04
- [ ] Mock for QuickChart.io HTTP calls (avoid external API calls in tests)
- [ ] Mock for `generateInsight()` (avoid Claude API calls in tests)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inline charts visually render correctly in report preview | RCNT-04 | Visual rendering quality | Open report detail page, verify charts display with correct data |
| KPI cards layout matches design expectations | RCNT-01 | UI layout verification | Generate a report, check topline stats are prominent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
