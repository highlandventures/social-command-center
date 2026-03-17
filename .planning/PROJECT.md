# Social Command Center

## What This Is

An internal social media command center for Figure Technology Solutions (Highland Ventures portfolio). Manages X and Reddit presence across multiple brand accounts (@provenancefdn, @HastraFi, @Figure), with social listening, KOL tracking, competitor intelligence, content composition, AI-powered analytics, a conversational AI co-pilot, and a full-featured Report Center with rich visuals, PDF export, email distribution, automated scheduling, ad hoc reports, and benchmarking. Built with Next.js, tRPC, Prisma, and Claude AI.

## Core Value

The team can compose, schedule, and publish high-performing content across X and Reddit — informed by real data on what works, what competitors do, and what the audience needs — and generate, distribute, and benchmark rich visual reports automatically.

## Requirements

### Validated

- ✓ Multi-account X publishing (single posts, threads, articles) — existing
- ✓ Reddit publishing via Late API — existing
- ✓ Post scheduling with cron-based auto-publish — existing
- ✓ Live preview (X and Reddit format) in composer — existing
- ✓ AI thread optimization (per-tweet suggestions) — existing
- ✓ AI performance prediction (impressions, engagement rate) — existing
- ✓ AI content ideas from listening feed — existing
- ✓ Post metrics polling (impressions, engagements, likes, retweets, replies) — existing
- ✓ Competitor metrics (followers, engagement rate, share of voice) — existing
- ✓ Social listening with sentiment analysis — existing
- ✓ Weekly AI insights cron (performance highlights, optimal posting times) — existing
- ✓ KOL tracking with AI scoring — existing
- ✓ Topic-based listening with boolean queries for X and Reddit — existing
- ✓ Query performance tracking (noise rate, actionable rate, health grade) — existing
- ✓ Content performance insights in composer (top/avg/poor with pattern analysis) — v1.0
- ✓ Competitor content themes, formats, and strategies in composer — v1.0
- ✓ Audience questions and knowledge gaps as content opportunities — v1.0
- ✓ AI co-pilot in composer with streaming chat, intel context, brand voice, predictions, draft insertion — v1.0
- ✓ Rich report generation with KPIs, AI summaries, inline charts, comparison deltas — v1.1
- ✓ PDF export with branded layout — v1.1
- ✓ Email distribution with HTML templates and PDF attachment — v1.1
- ✓ Delivery tracking for all report channels — v1.1
- ✓ Automated report scheduling (weekly/monthly/quarterly/yearly) — v1.1
- ✓ Ad hoc reports with conversational AI scoping — v1.1
- ✓ Period-over-period benchmarking (WoW/MoM/QoQ/YoY) — v1.1
- ✓ Custom milestone benchmarking — v1.1

### Active

(No active requirements — planning next milestone)

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

Shipped v1.0 (Content Intelligence System) and v1.1 (Report Center). ~32,500 LOC across JS/JSX. 205 tests passing.

Tech stack: Next.js 15 (App Router), tRPC v10, Prisma 5, Claude AI (Haiku for routine, Sonnet for complex), QuickChart.io for server-side charts, @react-pdf/renderer for PDF export, React Email + nodemailer for email distribution, Vercel AI SDK for streaming chat.

The composer sidebar now has 4 intel tabs (Performance, Competitor, Audience, Co-Pilot). The Report Center has 5 sub-tabs (AI Report Builder, Report Repository, Historical Benchmarks, Schedules, Milestones) plus Ad Hoc reports. Reports auto-generate on configured cadences and deliver via email with PDF attached.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Panels in composer (not separate page) | Insights must be where content decisions happen | ✓ Good — team uses intel while composing |
| Build intel panels before co-pilot | Co-pilot quality depends on intel data quality | ✓ Good — co-pilot leverages all 3 intel sources |
| Use existing data pipelines | PostMetrics, CompetitorMetrics, ListeningHit already collect the right data | ✓ Good — zero new data ingestion needed |
| Co-pilot as conversational chat | Multi-turn lets team iterate on ideas, not just one-shot generation | ✓ Good — streaming feels responsive |
| Haiku for routine, Sonnet for complex | Cost optimization without sacrificing quality | ✓ Good — keeps API costs manageable |
| QuickChart.io for server-side charts | Vercel serverless can't run Puppeteer/headless Chrome | ✓ Good — fast, reliable, no infra overhead |
| Structured JSON report content | Single source of truth for in-app, PDF, and email rendering | ✓ Good — all channels render from same data |
| Ephemeral benchmark comparisons | Avoid cluttering reports with comparison artifacts | ✓ Good — fast delta computation on demand |
| Lightweight benchmark delta path | Reuse calculateKPIs + calculateDelta, skip AI/chart regeneration | ✓ Good — instant comparisons vs 30s full regen |

## Constraints

- **API costs**: Claude calls must be batched/cached — no per-keystroke analysis
- **Existing schema**: Build on PostMetrics, CompetitorMetrics, ListeningHit, AIInsight — don't rebuild
- **Platform**: Vercel serverless (cron jobs for heavy analysis, not real-time)
- **AI model**: Claude Haiku for most tasks (cost-efficient), Sonnet for co-pilot conversations
- **UI**: Enhance existing pages — don't replace
- **Server-side charts**: Must work within Vercel serverless — use QuickChart.io

---
*Last updated: 2026-03-17 after v1.1 Report Center milestone completion*
