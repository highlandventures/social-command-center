# Requirements: Listening Intelligence

**Defined:** 2026-03-14
**Core Value:** Every relevant conversation about our brands and competitors is captured automatically, and the AI surfaces actionable patterns (strengths to amplify, weaknesses to address, threats to counter) — not just summaries.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Query Autonomy

- [ ] **QAUT-01**: System runs a daily coverage gap detection audit comparing known brands/products/tickers against active queries per platform
- [ ] **QAUT-02**: System auto-generates new queries for detected coverage gaps (new queries start inactive for safety)
- [ ] **QAUT-03**: System flags competitors with fewer active queries than owned brands (parity check)
- [ ] **QAUT-04**: System auto-triggers query refinement when a query's health grade drops to POOR
- [ ] **QAUT-05**: System enforces a per-topic query ceiling (8-12 active queries) to prevent proliferation
- [ ] **QAUT-06**: All autonomous query changes are logged with rationale (audit trail)

### SWT Analysis

- [ ] **SWT-01**: System runs batch SWT analysis categorizing listening hits into Strengths, Weaknesses, and Threats per brand/competitor
- [ ] **SWT-02**: Strengths identify what consumers value most about each brand (perceived differentiation)
- [ ] **SWT-03**: Weaknesses identify consumer-perceived gaps and areas for improvement
- [ ] **SWT-04**: Threats surface crisis signals: negative narratives gaining traction, emerging competitors, PR risks
- [ ] **SWT-05**: User can filter SWT insights by individual brand or competitor
- [ ] **SWT-06**: SWT analysis runs on a scheduled batch cadence (not per-hit) for cost efficiency
- [ ] **SWT-07**: Each SWT insight shows freshness timestamp ("based on N hits as of [date]")

### Infrastructure

- [ ] **INFR-01**: Upgrade Anthropic SDK to support structured outputs (zodOutputFormat)
- [ ] **INFR-02**: Schema migration adds competitorId FK to ListeningTopic for reliable parity auditing
- [ ] **INFR-03**: Schema adds QueryExpansionLog model for autonomous change tracking
- [ ] **INFR-04**: SWT analysis uses Haiku 4.5 for cost efficiency; query generation keeps Sonnet 4

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Entity Management

- **ENTY-01**: Structured entity glossary of brands, tickers, products, competitor names, and variants
- **ENTY-02**: Fintech/crypto-aware vocabulary (tickers like $HASH, $YLDS, RWA terminology, community slang)
- **ENTY-03**: Auto-detect missing common misspellings and name variants

### Extended Analysis

- **EXTD-01**: Cost-per-insight tracking (Claude API cost per SWT analysis run)
- **EXTD-02**: Real-time threat alerting via push/email notifications
- **EXTD-03**: Predictive trend forecasting from SWT history

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time SWT on every hit | 10-50x more expensive than batched; low signal on individual hits |
| Auto-publishing counter-narratives | Crisis response requires human judgment; automated responses can escalate |
| Custom SWT frameworks (SWOT, PESTLE) | Complexity explosion; validate SWT first before adding extensibility |
| Per-hit NLP entity extraction | Expensive and inaccurate for niche fintech terms; use query-level scoping instead |
| Autonomous query deletion | Destroys historical hit associations; deactivate instead |
| Multi-language queries | English only for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| QAUT-01 | — | Pending |
| QAUT-02 | — | Pending |
| QAUT-03 | — | Pending |
| QAUT-04 | — | Pending |
| QAUT-05 | — | Pending |
| QAUT-06 | — | Pending |
| SWT-01 | — | Pending |
| SWT-02 | — | Pending |
| SWT-03 | — | Pending |
| SWT-04 | — | Pending |
| SWT-05 | — | Pending |
| SWT-06 | — | Pending |
| SWT-07 | — | Pending |
| INFR-01 | — | Pending |
| INFR-02 | — | Pending |
| INFR-03 | — | Pending |
| INFR-04 | — | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 0
- Unmapped: 17 ⚠️

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after initial definition*
