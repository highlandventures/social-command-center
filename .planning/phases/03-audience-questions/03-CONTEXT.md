# Phase 3: Audience Questions - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning
**Source:** Direct user decisions

<domain>
## Phase Boundary

Extract questions from existing ListeningHit data using AI intent classification, cluster them by topic, score as content opportunities, and surface in a third panel in the composer sidebar. No new API calls needed — all data comes from existing social listening hits.

Scope: Uses existing ListeningHit records only. No new external data sources.

</domain>

<decisions>
## Implementation Decisions

### Question Extraction (AUDQ-01)
- Batch AI extraction during the existing `poll-listening` cron (same pattern as Phase 2 competitor analysis)
- Claude Haiku classifies ListeningHit content to identify which hits contain questions (intent = question)
- Results cached in AIInsight with a new `AUDIENCE_QUESTIONS` InsightType (same pattern as COMPETITOR_STRATEGY)
- No live AI computation in tRPC procedures — cache-read only

### Topic Clustering (AUDQ-02)
- AI clusters questions into topics during the same cron batch
- Results cached in AIInsight with AUDIENCE_QUESTIONS type and content.type = 'clusters'
- AI receives all recent questions and returns topic clusters with labels

### Unanswered/Recurring Detection (AUDQ-03)
- AI prompt cross-references questions against Figure's published Post content to detect "answered" questions
- Questions appearing repeatedly are flagged as recurring
- Unanswered + recurring questions marked in the cached output as content opportunities

### Opportunity Scoring (AUDQ-04)
- Each cluster gets a score based on: question count (volume) + total engagement from source ListeningHit records
- AI computes scores during batch analysis
- Higher score = more people asking + higher engagement on those posts

### Panel UI (all AUDQ)
- Third panel in composer sidebar Intel tab (below Competitor Intel), with border-t divider
- Self-contained `AudienceQuestionsPanel` component — no props, own tRPC queries with staleTime caching
- Shows clusters ranked by opportunity score, each expandable to see individual questions
- No sub-tabs — single view (simpler than competitor intel)
- Follow Phase 1/2 patterns: Skeleton loading, error states, empty states, color-coded cards

### Data Source
- Uses existing ListeningHit records only — no new API calls
- Questions come from social listening hits that are already captured by poll-listening cron

### Claude's Discretion
- AudienceQuestion schema design (or whether to skip a separate model and use AIInsight cache directly)
- AI prompt design for question classification and clustering
- Opportunity score formula weighting
- Cluster expand/collapse interaction pattern and visual design
- Color theme for the panel cards

</decisions>

<specifics>
## Specific Ideas

- ListeningHit already has `content` (text), `engagementCount`, `sentiment`, `aiRelevance`, `authorFollowersOrKarma` fields — rich data for question extraction
- ListeningHit has `topicId` linking to ListeningTopic — could use existing topic structure to seed clustering
- AIInsight table + InsightType enum pattern is proven from Phase 1 (PERFORMANCE_PATTERN) and Phase 2 (COMPETITOR_STRATEGY)
- poll-listening cron already processes hits — adding question extraction is minimal incremental work
- Existing published Posts can be queried to check if Figure has addressed specific topics

</specifics>

<deferred>
## Deferred Ideas

- Real-time question alerts
- Auto-generated answer drafts for unanswered questions
- Question trend analysis over time
- Cross-platform question comparison (X vs Reddit)

</deferred>

---

*Phase: 03-audience-questions*
*Context gathered: 2026-03-14 via direct user decisions*
