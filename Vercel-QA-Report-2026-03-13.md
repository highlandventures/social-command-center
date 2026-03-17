# Social Command Center — QA Test Report

**Date:** March 13, 2026
**Environment:** https://social-command-center-sand.vercel.app
**Deployment:** Pre-push (commit `a1c05b1` with fixes NOT yet deployed)
**Tester:** Claude (automated use-case walkthrough)

---

## Executive Summary

Tested all 7 main pages (Dashboard, Composer, Calendar, Social Listening, KOL Tracking, Reports, Admin) as a social media manager would use them. The platform loads fast and the overall architecture is solid — real data flows through most pages. However, several critical field-mapping bugs in the KOL and Reports pages render those features unusable, and the Social Listening filters don't work. Most of these issues are already fixed in the local commit `a1c05b1` awaiting push.

---

## Page-by-Page Results

### 1. Dashboard — MOSTLY WORKING

**What works:**
- Metric cards render with real data (428.5K impressions, 1% eng rate, 41,092 followers, 4,426 engagements, 269 posts)
- Per-Account Breakdown table shows all 3 accounts (@Figure, @HastraFi, @provenancefdn) with correct data
- Account drill-down works — clicking @Figure opens detailed view with Engagement Over Time chart, Follower Growth, Post Performance Map, Best Posting Times heatmap, and full Post Performance Table
- Brand Sentiment section renders (score 58, 13% pos / 83% neu / 5% neg)
- Chart tooltips work on hover

**Bugs:**
| # | Severity | Bug | Status |
|---|----------|-----|--------|
| D1 | Medium | **Time range filter non-functional** — clicking "Last 7 days" doesn't change the active state or filter data | Not fixed |
| D2 | Low | **Sentiment Trend chart very sparse** — only 2 data points on a single date | Data issue |
| D3 | Low | **Sentiment Drivers section empty** — "AI-DETECTED THEMES" header with no content below | Not fixed |
| D4 | Low | **Follower Growth chart flat line** — appears to only have 1 data point, so the chart shows a horizontal line | Data issue |
| D5 | Low | **Clicks/CTR columns all 0%** in Post Performance Table — Twitter API doesn't provide click data | By design (API limitation) |

---

### 2. Composer — WORKING WELL

**What works:**
- Platform toggles (X / Reddit)
- Post type selector (Post / Thread / Article)
- Multi-tweet thread editor with character count per tweet (e.g., 122/280, 273/280)
- Live Preview renders realistic X thread preview with @highland_vc branding
- Character limit warnings ("+10 over limit" shown in orange)
- Image, link, and AI attachment buttons per tweet
- Schedule and Publish Now buttons with date/time picker
- Drafts (0) and Queue (0) sidebar tabs

**Bugs:** None observed — this is the most polished page.

---

### 3. Calendar — WORKING WELL

**What works:**
- Month view renders correctly for March 2026
- Real published posts appear as green events (Mar 9, 12, 13)
- Month/Week/List view toggle buttons
- Today (Mar 13) highlighted with blue circle
- Legend (Scheduled / Published / AI Suggestion)
- Green dots on future Wednesdays suggest recurring scheduled content

**Bugs:** None observed.

---

### 4. Social Listening — PARTIALLY WORKING

**What works:**
- Listening Feed loads with real hits (50 badge count)
- Hit cards show author, follower count, content preview, relevance badge (MEDIUM/LOW), timestamp, topic tag, engagement count, heuristic score
- View/Dismiss action buttons on each hit
- Active Topics sidebar with hit counts and HOT/WARM badges
- Topics tab renders topic management table with queries, hits, polling tier, status, and Scan Now/AI Refine/Delete actions
- AI Insights tab shows listening summary (50 hits analyzed, sentiment breakdown)
- Brand filter UI activates correctly ("Showing data for Figure Clear")

**Bugs:**
| # | Severity | Bug | Status |
|---|----------|-----|--------|
| L1 | Critical | **Brand filter doesn't filter results** — selecting @Figure shows "Showing data for Figure" but feed results don't change (hardcoded `true` bypass) | Fixed in `a1c05b1` |
| L2 | Critical | **Relevance filter (HIGH/MEDIUM) non-functional** — clicking HIGH doesn't activate or filter | Fixed in `a1c05b1` |
| L3 | High | **All hits show MEDIUM or LOW relevance** — no HIGH relevance hits exist because `aiRelevance` was never populated | Fixed in `a1c05b1` |
| L4 | Medium | **Share of Voice shows "No data yet"** despite competitor topics being active with data | Not fixed |
| L5 | Medium | **Competitors tab shows "No competitors configured"** despite competitor listening topics existing (Tradable, Goldfinch, etc.) | Not fixed — Competitor model not populated |
| L6 | Low | **Sentiment Trend chart very sparse** — only 2 data points | Data issue |

---

### 5. KOL Tracking — MOSTLY BROKEN (pre-push)

**What works:**
- Summary metric cards render (24 Active KOLs, 0 Total Activations, 0.0% Avg Engagement, 42.3K Est. Total Impressions)
- KOL names and platform badges display correctly
- "+ Add KOL" button present
- AI Discovery tab renders (with mock data)

**Bugs:**
| # | Severity | Bug | Status |
|---|----------|-----|--------|
| K1 | Critical | **Followers column empty** for all 24 KOLs — field mapping mismatch | Fixed in `a1c05b1` |
| K2 | Critical | **Type column empty** — `relationshipType` not being transformed to display format | Fixed in `a1c05b1` |
| K3 | Critical | **Activations column empty** — shows tiny gray squares instead of numbers | Fixed in `a1c05b1` |
| K4 | Critical | **Avg Eng. shows just "%"** — no numeric value, only the percent sign | Fixed in `a1c05b1` |
| K5 | Critical | **Impressions column empty** | Fixed in `a1c05b1` |
| K6 | Critical | **Sentiment shows "% pos"** — no numeric value | Fixed in `a1c05b1` |
| K7 | High | **AI Score badges render as empty yellow rectangles** — no letter grade visible | Fixed in `a1c05b1` |
| K8 | High | **Avatar circles show no initials** — all dark gray circles with no text | Fixed in `a1c05b1` |
| K9 | High | **Recent Activations tab stuck in loading state** — shows 3 skeleton placeholders that never resolve (API call without required `kolId`) | Fixed in `a1c05b1` |
| K10 | Medium | **AI Discovery shows hardcoded mock data** instead of real candidates from listening data | Fixed in `a1c05b1` |

---

### 6. Reports — PARTIALLY WORKING

**What works:**
- AI Report Builder: template buttons populate the prompt field, Generate Report button fires
- Report Repository: shows generated reports with title and AI% progress bar
- Historical Benchmarks: chart renders with metric selector tabs, summary cards display

**Bugs:**
| # | Severity | Bug | Status |
|---|----------|-----|--------|
| R1 | High | **Report generation fails** — shows "Report generation failed. Please try again." (likely missing `ANTHROPIC_API_KEY` in Vercel env vars) | Env var needed |
| R2 | High | **Report Repository: TYPE column blank** — `report.type` doesn't exist, should be `report.reportType` | Fixed in `a1c05b1` |
| R3 | High | **Report Repository: CREATED BY column blank** — `report.createdBy` doesn't match schema | Fixed in `a1c05b1` |
| R4 | High | **Report Repository: DATE column blank** — `report.created` doesn't exist, should use `report.createdAt` | Fixed in `a1c05b1` |
| R5 | Medium | **Report Repository: PAGES column blank** — field doesn't exist in schema | Fixed in `a1c05b1` (shows "—") |
| R6 | Low | **Historical Benchmarks: hardcoded summary cards** — 4.2% engagement, 16.4K followers etc. are static values | Not fixed |

---

### 7. Admin — WORKING WELL

**What works:**
- Settings tab: Connected Accounts (3 accounts active), Connect X/Reddit Account buttons, Team Management with invite form, API Configuration (twitterapi_io provider, Official API Fallback enabled), Polling Configuration with 7 cron jobs
- Cost Tracker tab: $7.92 total API cost, 19,973 calls, breakdown by provider (X Official: $2.50/819 calls, TwitterAPI.io: $5.41/19,154 calls), Daily Cost Trend chart
- Roadmap tab (not tested in detail)

**Bugs:** None critical observed.

---

## Bug Summary

| Severity | Total | Fixed in `a1c05b1` | Still Open |
|----------|-------|---------------------|------------|
| Critical | 8 | 7 | 1 |
| High | 7 | 6 | 1 |
| Medium | 4 | 1 | 3 |
| Low | 5 | 0 | 5 |
| **Total** | **24** | **14** | **10** |

### Action Items to Deploy

1. **Push commit `a1c05b1`** — fixes 14 of 24 bugs (all KOL page issues, listening filters, report field mappings)
2. **Add `ANTHROPIC_API_KEY` to Vercel env vars** — fixes report generation failure
3. **Populate Competitor model** — connect listening topics to Competitor records for Share of Voice
4. **Fix Dashboard time range filter** — currently non-functional
5. **Wire up Historical Benchmarks** with real computed data instead of hardcoded values
6. **Consider adding mention count metrics** to the listening page (implemented in `a1c05b1` backend but may need UI wiring)

---

## Pages Ranked by Health

1. **Composer** — Fully functional, polished UI
2. **Calendar** — Fully functional with real data
3. **Admin** — Fully functional, great cost tracking
4. **Dashboard** — Mostly working, minor filter/data gaps
5. **Reports** — Partially working, needs env var + field fixes
6. **Social Listening** — Partially working, filters broken
7. **KOL Tracking** — Mostly broken pre-push, should be largely fixed post-push
