# Social Command Center

## What This Is

An internal social media command center for Figure Technology Solutions (Highland Ventures portfolio). Manages X and Reddit presence across multiple brand accounts (@provenancefdn, @HastraFi, @Figure), with social listening, KOL tracking, competitor intelligence, content composition, and AI-powered analytics. Built with Next.js, tRPC, Prisma, and Claude AI.

## Core Value

The team can compose, schedule, and publish high-performing content across X and Reddit — informed by real data on what works, what competitors do, and what the audience needs.

## Current Milestone: v1.0 Content Intelligence System

**Goal:** Transform the composer from a publishing tool into an intelligence-driven content creation engine that learns from performance data, competitor strategies, and audience needs.

**Target features:**
- Content performance insights panel (our posts: top/avg/poor with pattern analysis)
- Competitor content intel panel (themes, formats, strategies that resonate)
- Audience questions panel (what people want to understand from us)
- Interactive Content Co-Pilot (conversational agent for content co-creation)

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

### Active

<!-- Current scope. Building toward these. -->

- [ ] Team can view content performance insights (top/avg/poor posts with pattern analysis) in composer
- [ ] Team can see competitor content themes, formats, and strategies in composer
- [ ] Team can discover audience questions and knowledge gaps as content opportunities
- [ ] Team can co-create content with an AI agent that has full context on performance, competitors, and audience
- [ ] AI agent learns brand voice from top-performing published posts
- [ ] AI agent can pull in specific data on demand (competitor activity, audience questions, performance patterns)

### Out of Scope

- A/B testing framework — complexity too high for v1, defer to future
- Automated posting without human review — humans decide what gets published
- Cross-platform content adaptation (auto-convert X thread to Reddit post) — defer to future
- Real-time competitor monitoring alerts — use existing scheduled cron
- Multi-language content generation — English only for now
- Video/media content generation — text-first

## Context

The composer page (`app/(dashboard)/composer/page.jsx`) already has a robust UI with platform switching (X/Reddit), account selection, content type tabs (Post/Thread/Article), live preview, scheduling, and publishing. The AI infrastructure exists in `lib/ai.js` (Claude Haiku), `lib/ai/content-suggestions.js`, `lib/ai/sentiment.js`, and `lib/routers/ai.js` with endpoints for optimization, prediction, and content suggestions.

The data layer is rich: `PostMetrics` tracks engagement per post (15-min polling), `CompetitorMetrics` captures daily competitor stats, `ListeningHit` stores social mentions with sentiment and relevance scoring, and `AIInsight` holds weekly generated analyses. The `analytics` tRPC router already provides engagement trends, heatmaps, and post performance data.

The gap is **surfacing these insights in the composer workflow** where content decisions are made. Currently, insights live on separate dashboard pages — disconnected from the act of creating content.

## Constraints

- **API costs**: Claude calls must be batched/cached — no per-keystroke analysis
- **Existing schema**: Build on PostMetrics, CompetitorMetrics, ListeningHit, AIInsight — don't rebuild
- **Platform**: Vercel serverless (cron jobs for heavy analysis, not real-time)
- **AI model**: Claude 3.5 Haiku for most tasks (cost-efficient), Sonnet for co-pilot conversations
- **UI**: Panels must fit within existing composer layout without breaking the publish workflow

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Panels in composer (not separate page) | Insights must be where content decisions happen | — Pending |
| Build intel panels before co-pilot | Co-pilot quality depends on intel data quality | — Pending |
| Use existing data pipelines | PostMetrics, CompetitorMetrics, ListeningHit already collect the right data | — Pending |
| Co-pilot as conversational chat | Multi-turn lets team iterate on ideas, not just one-shot generation | — Pending |

---
*Last updated: 2026-03-14 after Content Intelligence milestone initialization*
