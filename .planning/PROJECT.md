# Social Command Center

## What This Is

An internal social media command center for Figure Technology Solutions (Highland Ventures portfolio). Manages X and Reddit presence across multiple brand accounts (@provenancefdn, @HastraFi, @Figure), with social listening, KOL tracking, competitor intelligence, content composition, and AI-powered analytics. Built with Next.js, tRPC, Prisma, and Claude AI.

## Core Value

The team can compose, schedule, and publish high-performing content across X and Reddit — informed by real data on what works, what competitors do, and what the audience needs.

## Current Milestone: v1.1 Report Center

**Goal:** Transform the Report Center from a manual AI report builder into a fully automated reporting system with scheduled cadence reports, conversational ad hoc report creation, rich visual output across all channels (in-app, email, Slack), and flexible benchmarking against time periods and milestones.

**Target features:**
- Scheduled cadence reports (weekly, monthly, quarterly, yearly auto-generation)
- Ad hoc milestone/event reports with in-app AI chat for scoping
- Rich visual reports with topline KPIs, executive summaries, and inline charts
- PDF export for all reports
- Email and Slack distribution with full visual reports inline
- Benchmarking against previous time periods and custom milestones (side-by-side + deltas)

## Requirements

### Validated

<!-- Existing capabilities that work and are relied upon -->

- ✓ Multi-account X publishing (single posts, threads, articles) — existing
- ✓ Reddit publishing via Late API — existing
- ✓ Post scheduling with cron-based auto-publish — existing
- ✓ Live preview (X and Reddit format) in composer — existing
- ✓ AI thread optimization (per-tweet suggestions) — existing (`ai.optimizeThread`)
- ✓ AI performance prediction (impressions, engagement rate) — existing (`ai.predictPerformance`)
- ✓ AI content ideas from listening feed — existing (`ai.suggestContent`)
- ✓ Post metrics polling (impressions, engagements, likes, retweets, replies) — existing
- ✓ Competitor metrics (followers, engagement rate, share of voice) — existing
- ✓ Social listening with sentiment analysis — existing
- ✓ Weekly AI insights cron (performance highlights, optimal posting times) — existing
- ✓ KOL tracking with AI scoring — existing
- ✓ Topic-based listening with boolean queries for X and Reddit — existing
- ✓ Query performance tracking (noise rate, actionable rate, health grade) — existing
- ✓ Content performance insights in composer (top/avg/poor with pattern analysis) — v1.0 Phase 1
- ✓ Competitor content themes, formats, and strategies in composer — v1.0 Phase 2
- ✓ Audience questions and knowledge gaps as content opportunities — v1.0 Phase 3
- ✓ Basic AI report generation (weekly, monthly, competitive, KOL, custom) — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Scheduled cadence reports auto-generate on weekly, monthly, quarterly, and yearly cycles
- [ ] Team can create ad hoc milestone/event reports through conversational AI chat
- [ ] AI asks clarifying questions to scope reports (time range, metrics, snapshot cadence)
- [ ] Reports can be benchmarked against previous time periods (WoW, MoM, QoQ, YoY)
- [ ] Reports can be benchmarked against custom milestones (product launches, events)
- [ ] Every report has topline KPI stats and AI-generated executive summary
- [ ] Reports contain inline charts and rich visuals (not just text)
- [ ] Reports can be exported as PDF
- [ ] Reports auto-deliver via email with full visual content inline
- [ ] Reports auto-deliver via Slack with full visual content inline
- [ ] Team can share individual reports on-demand via email or Slack

### Deferred (from v1.0)

- [ ] Team can co-create content with an AI agent that has full context on performance, competitors, and audience
- [ ] AI agent learns brand voice from top-performing published posts
- [ ] AI agent can pull in specific data on demand (competitor activity, audience questions, performance patterns)

### Out of Scope

- A/B testing framework — complexity too high, defer to future
- Automated posting without human review — humans decide what gets published
- Cross-platform content adaptation (auto-convert X thread to Reddit post) — defer to future
- Real-time competitor monitoring alerts — use existing scheduled cron
- Multi-language content generation — English only for now
- Video/media content generation — text-first
- Full Slack App (OAuth + bot) — using Incoming Webhooks for now, upgrade path exists
- PPTX slide export — landscape PDF pages initially

## Context

The composer page has a robust UI with platform switching, account selection, content type tabs, live preview, scheduling, and publishing. The Intel tab in the composer sidebar now surfaces performance insights, competitor intelligence, and audience questions inline — v1.0 Phases 1-3 delivered this.

The data layer is rich: `PostMetrics` tracks engagement per post (15-min polling), `CompetitorMetrics` captures daily competitor stats, `ListeningHit` stores social mentions with sentiment and relevance scoring, and `AIInsight` holds weekly generated analyses. The `analytics` tRPC router provides engagement trends, heatmaps, and post performance data.

The Reports page exists at `/reports` with basic AI report generation (5 types), a report repository, and a simple 12-month benchmarks view. The gap is **automation, distribution, and visual richness** — reports are currently manual, text-heavy, can't be scheduled, and have no email/Slack delivery. Export buttons are stubs. Benchmarking is limited to fixed 12-month windows.

## Constraints

- **API costs**: Claude calls must be batched/cached — no per-keystroke analysis
- **Existing schema**: Build on PostMetrics, CompetitorMetrics, ListeningHit, AIInsight — don't rebuild
- **Platform**: Vercel serverless (cron jobs for heavy analysis, not real-time)
- **AI model**: Claude 3.5 Haiku for most tasks (cost-efficient), Sonnet for co-pilot conversations
- **UI**: Reports page already exists — enhance, don't replace
- **Server-side charts**: Must work within Vercel serverless (no Puppeteer) — use QuickChart.io

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Panels in composer (not separate page) | Insights must be where content decisions happen | — Pending |
| Build intel panels before co-pilot | Co-pilot quality depends on intel data quality | — Pending |
| Use existing data pipelines | PostMetrics, CompetitorMetrics, ListeningHit already collect the right data | — Pending |
| Co-pilot as conversational chat | Multi-turn lets team iterate on ideas, not just one-shot generation | — Pending |

---
*Last updated: 2026-03-15 after Report Center milestone v1.1 initialization*
