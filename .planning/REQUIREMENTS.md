# Requirements: v1.2 Email Campaigns + Polish

**Defined:** 2026-03-17
**Core Value:** Team can compose high-performing content, generate rich reports, and run email campaigns — all from one hub.

## Track A: Email Campaigns

### Email List Management
- [x] **EMAL-01**: Team can create named email lists with descriptions
- [x] **EMAL-02**: Team can import subscribers from CSV files (email, first name, last name) with duplicate detection
- [x] **EMAL-03**: Team can view, search, and filter subscribers within a list
- [x] **EMAL-04**: Subscribers have status tracking (active, unsubscribed, bounced, complained)

### Email Templates
- [ ] **ETPL-01**: System provides 4 starter templates (newsletter, announcement, product update, event invite)
- [ ] **ETPL-02**: Team can create custom email templates with HTML editor and live preview
- [ ] **ETPL-03**: AI can suggest subject line variants and body copy based on campaign context

### Email Campaigns
- [ ] **ECMP-01**: Team can create campaigns by selecting a list, choosing a template, editing content, and setting subject/from/reply-to
- [ ] **ECMP-02**: Team can preview rendered campaign emails before sending
- [ ] **ECMP-03**: Team can schedule campaigns for future delivery or send immediately
- [ ] **ECMP-04**: Campaigns send in batches via cron (respecting SMTP rate limits) without blocking Vercel serverless

### Email Tracking
- [ ] **ETRK-01**: System tracks email opens via tracking pixel
- [ ] **ETRK-02**: System tracks link clicks via redirect URLs
- [ ] **ETRK-03**: System handles bounces and marks subscribers as bounced
- [ ] **ETRK-04**: Every email includes a one-click unsubscribe link (CAN-SPAM/GDPR compliant)

### Email Analytics
- [ ] **EANL-01**: Campaign detail shows open rate, click rate, bounce rate, and unsubscribe rate
- [ ] **EANL-02**: Email dashboard shows aggregate stats: total subscribers, campaigns sent, avg open/click rates
- [ ] **EANL-03**: Campaign detail shows link click breakdown and open/click timeline

### Hub Integration
- [ ] **EHUB-01**: Email Campaigns module card on hub landing page is active (not "Coming Soon") and links to /email
- [ ] **EHUB-02**: Email section has its own layout with sidebar navigation and back-to-hub link

## Track B: Social Command Polish

### Listening Algorithm
- [ ] **SLST-01**: High-scoring listening hits are batch-validated through Claude Haiku for semantic relevance (AI score as multiplier on heuristic)
- [ ] **SLST-02**: Scoring weights adapt by topic type (KOL, competitor, brand monitoring)
- [ ] **SLST-03**: Financial/crypto-specific terms scored with context awareness (not generic positive/negative)
- [ ] **SLST-04**: Engagement velocity (engagement-per-hour) factored into scoring alongside absolute counts
- [ ] **SLST-05**: Cross-query deduplication prevents same post appearing in multiple queries for the same topic

### Mobile/Responsive + UX
- [ ] **MPOL-01**: All dashboard pages render correctly at 375px (mobile), 768px (tablet), 1024px+ (desktop)
- [ ] **MPOL-02**: Client-side routing bug fixed — no unexpected redirects when navigating between pages
- [ ] **MPOL-03**: All tRPC-powered pages have skeleton loaders, error boundaries, and helpful empty states

## Traceability

| ID | Description | Phase | Status |
|----|-------------|-------|--------|
| EMAL-01 | Create named email lists | 9 | Complete |
| EMAL-02 | CSV subscriber import | 9 | Complete |
| EMAL-03 | View/search/filter subscribers | 9 | Complete |
| EMAL-04 | Subscriber status tracking | 9 | Complete |
| ETPL-01 | Starter templates | 10 | Not started |
| ETPL-02 | Custom template editor | 10 | Not started |
| ETPL-03 | AI subject/body suggestions | 10 | Not started |
| ECMP-01 | Campaign builder | 10 | Not started |
| ECMP-02 | Campaign preview | 10 | Not started |
| ECMP-03 | Schedule/send campaigns | 10 | Not started |
| ECMP-04 | Batched cron sending | 11 | Not started |
| ETRK-01 | Open tracking pixel | 11 | Not started |
| ETRK-02 | Click tracking redirect | 11 | Not started |
| ETRK-03 | Bounce handling | 11 | Not started |
| ETRK-04 | One-click unsubscribe | 11 | Not started |
| EANL-01 | Campaign analytics | 12 | Not started |
| EANL-02 | Email dashboard stats | 12 | Not started |
| EANL-03 | Link/timeline analytics | 12 | Not started |
| EHUB-01 | Hub card activation | 12 | Not started |
| EHUB-02 | Email section layout | 9 | Not started |
| SLST-01 | AI semantic relevance | 13 | Not started |
| SLST-02 | Topic-adaptive weights | 13 | Not started |
| SLST-03 | Financial sentiment | 13 | Not started |
| SLST-04 | Engagement velocity | 13 | Not started |
| SLST-05 | Cross-query dedup | 13 | Not started |
| MPOL-01 | Responsive design | 14 | Not started |
| MPOL-02 | Routing bug fix | 14 | Not started |
| MPOL-03 | Loading/error/empty states | 14 | Not started |
