# PM Outbox — Social Command

> Agents write here when they need Miso's attention on Social Command work. Read this first before starting any session.

## Format

```
### [YYYY-MM-DD HH:MM] [STATUS] — Subject
**From:** Agent Name
**Type:** decision-needed | blocker | status-update | fyi
**Priority:** urgent | normal | low

[Description]

**Options (if decision):**
1. Option A — [tradeoff]
2. Option B — [tradeoff]
```

**STATUS:** `PENDING` (needs Miso), `RESPONDED` (Miso answered), `RESOLVED` (done)

---

### 2026-03-23 23:30 [RESOLVED] — Infrastructure fix session: cost tracking, crons, backfill
**From:** Cowork (Miso session)
**Type:** status-update
**Priority:** urgent

**Root cause found:** Vercel Deployment Protection was blocking ALL 13 cron jobs since ~March 16. Crons hit Vercel's SSO wall before reaching the app, so `CRON_SECRET` auth never ran. Result: 7+ days of zero impression data, flat follower counts, no new listening hits.

**Fixes deployed:**
1. Cost tracker overcounting — `estimatedCost` now $0 for non-2xx responses (was charging for 429/500s, inflating costs 16x)
2. Redis throttle fallback — if KV + Prisma both fail, skip Reddit poll instead of burning credits
3. APICallLog retention — daily cron deletes rows >30 days + purges miscounted failed-call entries
4. SociaVault cost updated $0.0048 → $0.00395; cache TTLs reduced (USER_PROFILE 24h→1h, SEARCH_RESULTS 30m→10m)
5. Removed abandoned `social-command-center/` prototype (superseded by `apps/social/`)
6. Vercel Deployment Protection disabled for production (Clerk handles app auth, crons use CRON_SECRET)
7. `CRON_SECRET` reset and verified working
8. Tweet backfill — 1,475 tweets across 4 accounts via `backfill-history` endpoint
9. ListeningHit actionType backfill — 983 hits set to FYI (were null, breaking action type filters)

**Still needs attention:**
- `@orangebaboon22` returns 0 followers/tweets — may be suspended or renamed, investigate
- Duplicate listening hits exist from dedup key expiry during outage (will age out, or can be cleaned manually)
- New listening hits get AI classification going forward; 983 backfilled hits are all FYI (retroactive Claude classification would cost ~$0.50 if desired)

---

### 2026-03-23 00:00 [RESOLVED] — pm-outbox created for Social Command
**From:** Cowork
**Type:** fyi
**Priority:** low

Created a local pm-outbox.md for the Social Command workspace so agent sessions here can flag decisions, blockers, and status updates without relying on the parent Figure outbox.

---

<!-- New entries go above this line, newest first -->
