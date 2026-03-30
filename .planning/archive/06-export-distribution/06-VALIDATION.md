---
phase: 6
slug: export-distribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | vitest.config.js |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | EXPT-01 | unit | `npx vitest run __tests__/lib/pdf-renderer.test.js -t "generates PDF buffer"` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | EXPT-02 | unit | `npx vitest run __tests__/lib/pdf-renderer.test.js -t "includes all sections"` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | DIST-01 | unit | `npx vitest run __tests__/lib/email-sender.test.js -t "sends email"` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | DIST-02 | unit | `npx vitest run __tests__/lib/email-sender.test.js -t "email content"` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 1 | DIST-03 | unit | `npx vitest run __tests__/lib/email-sender.test.js -t "recipients"` | ❌ W0 | ⬜ pending |
| 06-02-04 | 02 | 1 | DIST-04 | unit | `npx vitest run __tests__/lib/email-sender.test.js -t "delivery logging"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/lib/pdf-renderer.test.js` — stubs for EXPT-01, EXPT-02 (mock renderToBuffer, verify component structure)
- [ ] `__tests__/lib/email-sender.test.js` — stubs for DIST-01, DIST-02, DIST-03, DIST-04 (mock nodemailer transport, verify HTML content)
- [ ] No new framework install needed (Vitest already configured)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF visual layout matches Figure brand | EXPT-02 | Visual inspection needed | Open generated PDF, verify purple header bar, Figure logo, Sharp Grotesk headings |
| Email renders correctly across clients | DIST-02 | Cross-client rendering varies | Send test email, verify in Gmail + Outlook |
| PDF download triggers browser save dialog | EXPT-01 | Browser behavior | Click "Export PDF" on report detail, verify download |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
