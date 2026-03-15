# Requirements: Content Intelligence System

**Defined:** 2026-03-14
**Core Value:** Team can compose high-performing content informed by real data on what works, what competitors do, and what the audience needs.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Performance Intel

- [x] **PERF-01**: Team can view published posts ranked by performance tier (top / average / poor) with engagement metrics
- [x] **PERF-02**: Team can see pattern analysis -- which topics, content formats (thread vs post vs article), and posting times correlate with high performance
- [x] **PERF-03**: Team can view engagement trend sparklines per post showing trajectory over time
- [x] **PERF-04**: Insights are displayed as reusable cards in the composer sidebar (e.g., "Threads about RWA outperform single posts by 3.2x")

### Competitor Intel

- [x] **COMP-01**: System captures competitor post content (not just account-level metrics) from X (Reddit deferred to future phase)
- [x] **COMP-02**: AI extracts themes and topics competitors are posting about with frequency analysis
- [x] **COMP-03**: AI identifies content formats competitors use and which formats get highest engagement
- [x] **COMP-04**: Team can view a per-competitor strategy summary (posting cadence, top themes, engagement benchmarks vs ours)

### Audience Questions

- [ ] **AUDQ-01**: System extracts questions from listening hits (filtering intent = "question" from mentions, replies, comments)
- [ ] **AUDQ-02**: Questions are clustered by topic (e.g., "tokenization questions", "staking questions", "Figure vs competitor")
- [ ] **AUDQ-03**: Unanswered/recurring questions are surfaced as content opportunities
- [ ] **AUDQ-04**: Each question cluster has a content opportunity score based on volume and engagement

### Content Co-Pilot

- [ ] **CPLT-01**: Chat interface in composer for multi-turn content co-creation conversations
- [ ] **CPLT-02**: Co-pilot has access to all 3 intel panels as context (performance patterns, competitor themes, audience questions)
- [ ] **CPLT-03**: Co-pilot learns brand voice from top-performing published posts (uses them as few-shot examples)
- [ ] **CPLT-04**: Co-pilot can predict performance of drafted content before publishing
- [ ] **CPLT-05**: Co-pilot can insert drafted content directly into the composer editor

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Analytics

- **ADVN-01**: A/B test framework for content variants
- **ADVN-02**: Cross-platform content adaptation (auto-convert X thread to Reddit post)
- **ADVN-03**: Audience demographic analysis beyond engagement counts

### Automation

- **AUTO-01**: Automated content calendar suggestions based on optimal posting patterns
- **AUTO-02**: Real-time competitor activity alerts
- **AUTO-03**: Auto-generated weekly content strategy reports

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automated posting without human review | Humans decide what gets published -- co-pilot assists, doesn't publish |
| Video/media content generation | Text-first for v1, media creation is a different problem |
| Multi-language content | English only for now |
| Real-time competitor alerts | Use existing scheduled cron -- real-time adds cost and complexity |
| Custom AI model training | Use Claude with few-shot examples, don't fine-tune |
| A/B testing | High complexity, defer to v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERF-01 | Phase 1 | Complete |
| PERF-02 | Phase 1 | Complete |
| PERF-03 | Phase 1 | Complete |
| PERF-04 | Phase 1 | Complete |
| COMP-01 | Phase 2 | Complete |
| COMP-02 | Phase 2 | Complete |
| COMP-03 | Phase 2 | Complete |
| COMP-04 | Phase 2 | Complete |
| AUDQ-01 | Phase 3 | Pending |
| AUDQ-02 | Phase 3 | Pending |
| AUDQ-03 | Phase 3 | Pending |
| AUDQ-04 | Phase 3 | Pending |
| CPLT-01 | Phase 4 | Pending |
| CPLT-02 | Phase 4 | Pending |
| CPLT-03 | Phase 4 | Pending |
| CPLT-04 | Phase 4 | Pending |
| CPLT-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after roadmap creation*
