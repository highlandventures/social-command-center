---
phase: 8
slug: benchmarking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.js |
| **Quick run command** | `npx vitest run __tests__/lib/milestones.test.js __tests__/lib/benchmark-compare.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run __tests__/lib/milestones.test.js __tests__/lib/benchmark-compare.test.js`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-00-01 | 00 | 0 | BNCH-01, BNCH-02, BNCH-03 | unit stubs | `npx vitest run __tests__/lib/milestones.test.js __tests__/lib/benchmark-compare.test.js` | ❌ W0 | ⬜ pending |
| 08-01-01 | 01 | 1 | BNCH-02 | unit | `npx vitest run __tests__/lib/milestones.test.js` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | BNCH-01, BNCH-03 | unit | `npx vitest run __tests__/lib/benchmark-compare.test.js` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | BNCH-04 | visual | Manual: verify KPICard shows delta/direction with green/red/flat | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/lib/milestones.test.js` — stubs for BNCH-02 (milestone CRUD)
- [ ] `__tests__/lib/benchmark-compare.test.js` — stubs for BNCH-01, BNCH-03 (period comparison, milestone benchmark)

*Existing `__tests__/lib/report-engine.test.js` already covers `calculateDelta` and `getPreviousPeriod` for BNCH-04 core logic.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BenchmarkSelector UI renders WoW/MoM/QoQ/YoY options and milestone dropdown | BNCH-01, BNCH-03 | React component rendering in browser | Open report detail, verify selector shows period options and milestone list |
| KPICard shows green up / red down / flat arrows correctly | BNCH-04 | Visual styling verification | Compare two periods, verify arrow colors match delta direction |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
