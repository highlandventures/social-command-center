# Phase 9: Email Data Layer + List Management - Research

**Researched:** 2026-03-16
**Domain:** Prisma schema design, tRPC CRUD routers, CSV import, Next.js route groups
**Confidence:** HIGH

## Summary

Phase 9 establishes the data foundation for the entire Email Campaigns module. It adds 6 Prisma models to the existing schema (EmailList, EmailSubscriber, EmailCampaign, EmailTemplate, EmailSend, EmailEvent), builds CRUD operations for lists and subscribers via tRPC, implements CSV import with client-side parsing and server-side batch upsert, and creates the (email) route group with its own layout and sidebar navigation.

The project already has 30+ Prisma models, 20+ tRPC routers, and established patterns for cursor-based pagination, Zod validation, and dashboard layouts. Phase 9 follows these patterns exactly -- no new libraries or architectural patterns are needed. The only net-new concern is CSV parsing, which is handled client-side via the built-in FileReader API (no library needed for simple email/name CSV).

**Primary recommendation:** Follow existing tRPC router patterns (schedules.js for CRUD, posts.js for cursor pagination + search), add all 6 email models to schema.prisma upfront (even though only lists/subscribers get CRUD now), and create `app/(email)/` as a new route group with its own layout mirroring `(dashboard)/layout.jsx` but with email-specific sidebar nav.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EMAL-01 | Team can create named email lists with descriptions | tRPC CRUD router pattern from schedules.js; Prisma EmailList model with name, description, createdById |
| EMAL-02 | Team can import subscribers from CSV (email, first name, last name) with duplicate detection | Client-side FileReader CSV parse, server-side tRPC mutation with Prisma createMany + skipDuplicates on unique(listId, email) |
| EMAL-03 | Team can view, search, and filter subscribers within a list | Cursor-based pagination pattern from posts.js; Prisma contains filter for search; status enum filter |
| EMAL-04 | Subscribers have status tracking (active, unsubscribed, bounced, complained) | SubscriberStatus enum in Prisma; default ACTIVE; status transitions handled by future phases (tracking, unsubscribe) |
| EHUB-02 | Email section has its own layout with sidebar navigation and back-to-hub link | New (email) route group with layout.jsx mirroring (dashboard) pattern; sidebar with email-specific nav tabs |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | ^5.14.0 | ORM + migrations | Already powering 30+ models in schema.prisma |
| tRPC | ^10.45.0 | Type-safe API layer | All existing routers use this pattern |
| Zod | ^3.23.0 | Input validation | Used in every tRPC router for input schemas |
| Next.js | ^14.2.0 | Route groups, layouts | (email) route group follows existing (dashboard) and (hub) patterns |
| Clerk | 6.9.15 | Auth | Shared auth context across all route groups |
| React/Tailwind | ^18.3/^3.4 | UI | All existing pages use these |

### Supporting (no new packages needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| superjson | ^2.2.6 | tRPC serialization | Already configured in trpc.js |
| @tanstack/react-query | ^4.36.0 | Client-side caching | Already configured via tRPC client |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side CSV parse | papaparse library | Overkill for simple 3-column CSV; FileReader + split is sufficient |
| Separate email database | Same Prisma schema | Architecture decision already locked: single schema, shared db |

**Installation:**
```bash
# No new packages needed -- all dependencies are already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/social/
  prisma/
    schema.prisma           # Add 6 email models + enums here
  lib/
    routers/
      email-lists.js        # EmailList CRUD router (follows schedules.js pattern)
      email-subscribers.js  # Subscriber CRUD + CSV import + search/filter
      app.js                # Register new routers: emailLists, emailSubscribers
  app/
    (email)/
      layout.jsx            # Email section layout (sidebar nav + back-to-hub)
      lists/
        page.jsx            # List management page (create, view, delete lists)
      lists/[id]/
        page.jsx            # Subscriber view for a specific list (search, filter, import CSV)
```

### Pattern 1: tRPC CRUD Router (from schedules.js)
**What:** Standard CRUD operations with Zod validation and protectedProcedure
**When to use:** All email list operations (create, list, update, delete)
**Example:**
```javascript
// Source: apps/social/lib/routers/schedules.js (verified from codebase)
export const emailListsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.emailList.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { subscribers: true } } },
    });
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailList.create({
        data: { ...input, createdById: ctx.user.id },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailList.delete({ where: { id: input.id } });
    }),
});
```

### Pattern 2: Cursor-Based Pagination with Search (from posts.js)
**What:** Paginated list with optional filters and text search
**When to use:** Subscriber list view with search and status filter
**Example:**
```javascript
// Source: apps/social/lib/routers/posts.js (verified from codebase)
list: protectedProcedure
  .input(z.object({
    listId: z.string(),
    status: z.enum(['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED']).optional(),
    search: z.string().optional(),
    limit: z.number().min(1).max(100).default(50),
    cursor: z.string().nullish(),
  }))
  .query(async ({ ctx, input }) => {
    const where = { listId: input.listId };
    if (input.status) where.status = input.status;
    if (input.search) {
      where.OR = [
        { email: { contains: input.search, mode: 'insensitive' } },
        { firstName: { contains: input.search, mode: 'insensitive' } },
        { lastName: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    const items = await ctx.prisma.emailSubscriber.findMany({
      where,
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    let nextCursor = undefined;
    if (items.length > input.limit) {
      nextCursor = items.pop().id;
    }
    return { items, nextCursor };
  }),
```

### Pattern 3: CSV Import via Client-Side Parse + Server Batch Upsert
**What:** FileReader parses CSV on client, sends parsed rows to tRPC mutation for batch insert
**When to use:** EMAL-02 subscriber import
**Example:**
```javascript
// Client-side: parse CSV with FileReader
function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      const emailIdx = headers.indexOf('email');
      if (emailIdx === -1) return reject(new Error('CSV must have an "email" column'));

      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        return {
          email: cols[emailIdx]?.toLowerCase(),
          firstName: cols[headers.indexOf('first name')] || cols[headers.indexOf('firstname')] || null,
          lastName: cols[headers.indexOf('last name')] || cols[headers.indexOf('lastname')] || null,
        };
      }).filter(r => r.email && r.email.includes('@'));

      resolve(rows);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Server-side: tRPC mutation with createMany + skipDuplicates
importCSV: protectedProcedure
  .input(z.object({
    listId: z.string(),
    subscribers: z.array(z.object({
      email: z.string().email(),
      firstName: z.string().nullish(),
      lastName: z.string().nullish(),
    })).max(10000),
  }))
  .mutation(async ({ ctx, input }) => {
    const result = await ctx.prisma.emailSubscriber.createMany({
      data: input.subscribers.map(s => ({
        listId: input.listId,
        email: s.email.toLowerCase(),
        firstName: s.firstName || null,
        lastName: s.lastName || null,
        status: 'ACTIVE',
      })),
      skipDuplicates: true, // Relies on @@unique([listId, email])
    });
    return { imported: result.count, total: input.subscribers.length };
  }),
```

### Pattern 4: Route Group Layout (from (dashboard)/layout.jsx and (hub)/layout.jsx)
**What:** Separate layout with sidebar navigation, back-to-hub link, Clerk auth
**When to use:** EHUB-02 email section layout
**Example:**
```javascript
// Source: apps/social/app/(dashboard)/layout.jsx pattern
// Email layout has its own sidebar with email-specific tabs
const emailTabs = [
  { key: '/email/lists', label: 'Lists', icon: '...' },
  // Future phases will add: Templates, Campaigns, Analytics
];

// Back-to-hub link pattern from (dashboard)/layout.jsx line 93-101:
<Link href="/" className="flex items-center gap-3 px-3 py-2 ...">
  <ChevronLeftIcon />
  Marketing Hub
</Link>
```

### Anti-Patterns to Avoid
- **Don't create a separate Prisma schema or database.** Architecture decision is locked: single schema.prisma file with all models.
- **Don't use a CSV parsing library.** The CSV format is simple (3 columns). FileReader + string split is sufficient and avoids a dependency.
- **Don't build email-specific auth middleware.** Use the existing `protectedProcedure` from trpc.js -- Clerk auth is shared.
- **Don't create models incrementally.** Add all 6 email models in one migration even though only 2 get CRUD now. This avoids migration churn in phases 10-12.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database ORM | Raw SQL queries | Prisma with createMany, skipDuplicates | Type safety, migration management, existing pattern |
| Input validation | Manual checks | Zod schemas in tRPC | Consistent with all existing routers |
| Pagination | Offset-based | Cursor-based (posts.js pattern) | Already proven pattern, better perf at scale |
| Auth middleware | Custom session checks | protectedProcedure from trpc.js | Clerk integration already handles everything |
| Duplicate detection | Manual email lookups | @@unique([listId, email]) + skipDuplicates | Database-level constraint is authoritative |

**Key insight:** This phase is pure CRUD with established patterns. Every operation maps to an existing codebase pattern. The risk is in over-engineering, not under-engineering.

## Common Pitfalls

### Pitfall 1: Forgetting skipDuplicates on CSV Import
**What goes wrong:** CSV import fails with unique constraint violation on duplicate emails
**Why it happens:** Prisma createMany throws by default on duplicates
**How to avoid:** Always use `skipDuplicates: true` in createMany, which relies on the @@unique([listId, email]) constraint
**Warning signs:** Import mutation errors on re-imports or CSVs with duplicate rows

### Pitfall 2: Missing Prisma Migration
**What goes wrong:** Models exist in schema.prisma but tables don't exist in database
**Why it happens:** Forgetting to run `npx prisma migrate dev` after schema changes
**How to avoid:** Always run migration after schema update. In Vercel, `prisma generate` runs on build but `migrate deploy` must be configured separately (or use `prisma db push` for dev).
**Warning signs:** PrismaClientValidationError at runtime

### Pitfall 3: Not Registering New Routers in app.js
**What goes wrong:** tRPC calls to emailLists.* fail with "No procedure found"
**Why it happens:** Creating router file but forgetting to import and register in lib/routers/app.js
**How to avoid:** Always add new routers to the appRouter in app.js (line 23-44 pattern)
**Warning signs:** 404 errors on tRPC calls to new endpoints

### Pitfall 4: Case-Sensitive Email Matching
**What goes wrong:** "User@example.com" and "user@example.com" treated as different subscribers
**Why it happens:** Not normalizing email to lowercase before insert
**How to avoid:** Always `.toLowerCase()` email addresses before storing. Apply in both CSV import and manual subscriber creation.
**Warning signs:** Duplicate subscribers with different casing

### Pitfall 5: Large CSV Blocking the UI
**What goes wrong:** UI freezes during large CSV parse or import
**Why it happens:** Parsing 10K+ row CSV or sending huge payload in single mutation
**How to avoid:** Parse CSV client-side (non-blocking FileReader), cap mutation input at 10,000 rows (z.array().max(10000)), show progress. For MVP, this limit is sufficient.
**Warning signs:** Browser tab becomes unresponsive during import

### Pitfall 6: Prisma Client Not Regenerated After Schema Change
**What goes wrong:** TypeScript/IDE doesn't recognize new models, runtime errors about missing model
**Why it happens:** `prisma generate` wasn't run after modifying schema.prisma
**How to avoid:** Run `npx prisma generate` after any schema change. The build script already includes this (`prisma generate && next build`).
**Warning signs:** "Unknown model" errors in router code

## Code Examples

### Prisma Schema: All 6 Email Models
```prisma
// Source: Designed to match existing schema.prisma conventions (cuid IDs, @@map, @@index patterns)

enum SubscriberStatus {
  ACTIVE
  UNSUBSCRIBED
  BOUNCED
  COMPLAINED
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  SENDING
  SENT
  FAILED
}

enum EmailEventType {
  DELIVERED
  OPENED
  CLICKED
  BOUNCED
  COMPLAINED
  UNSUBSCRIBED
}

model EmailList {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  subscribers EmailSubscriber[]
  campaigns   EmailCampaign[]

  @@index([createdById])
  @@map("email_lists")
}

model EmailSubscriber {
  id        String           @id @default(cuid())
  listId    String
  email     String
  firstName String?
  lastName  String?
  status    SubscriberStatus @default(ACTIVE)
  metadata  Json?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  list   EmailList   @relation(fields: [listId], references: [id], onDelete: Cascade)
  sends  EmailSend[]
  events EmailEvent[]

  @@unique([listId, email])
  @@index([listId, status])
  @@index([email])
  @@map("email_subscribers")
}

model EmailTemplate {
  id        String   @id @default(cuid())
  name      String
  subject   String?
  htmlBody  String
  category  String?  // newsletter, announcement, product-update, event-invite
  isStarter Boolean  @default(false)
  createdById String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  campaigns EmailCampaign[]

  @@index([createdById])
  @@map("email_templates")
}

model EmailCampaign {
  id          String         @id @default(cuid())
  name        String
  subject     String
  fromName    String?
  fromEmail   String?
  replyTo     String?
  listId      String
  templateId  String?
  htmlContent String?
  status      CampaignStatus @default(DRAFT)
  scheduledFor DateTime?
  sentAt      DateTime?
  createdById String
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  list     EmailList     @relation(fields: [listId], references: [id])
  template EmailTemplate? @relation(fields: [templateId], references: [id])
  sends    EmailSend[]

  @@index([status])
  @@index([listId])
  @@map("email_campaigns")
}

model EmailSend {
  id           String   @id @default(cuid())
  campaignId   String
  subscriberId String
  messageId    String?  // SMTP message ID for tracking
  status       String   @default("QUEUED") // QUEUED, SENT, FAILED
  sentAt       DateTime?
  error        String?
  createdAt    DateTime @default(now())

  campaign   EmailCampaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  subscriber EmailSubscriber @relation(fields: [subscriberId], references: [id], onDelete: Cascade)
  events     EmailEvent[]

  @@unique([campaignId, subscriberId])
  @@index([campaignId, status])
  @@map("email_sends")
}

model EmailEvent {
  id           String         @id @default(cuid())
  sendId       String
  subscriberId String
  eventType    EmailEventType
  metadata     Json?          // { url: "..." } for clicks, { reason: "..." } for bounces
  occurredAt   DateTime       @default(now())

  send       EmailSend       @relation(fields: [sendId], references: [id], onDelete: Cascade)
  subscriber EmailSubscriber @relation(fields: [subscriberId], references: [id], onDelete: Cascade)

  @@index([sendId])
  @@index([subscriberId, eventType])
  @@index([occurredAt])
  @@map("email_events")
}
```

### Router Registration in app.js
```javascript
// Add to imports in apps/social/lib/routers/app.js:
import { emailListsRouter } from './email-lists';
import { emailSubscribersRouter } from './email-subscribers';

// Add to appRouter:
export const appRouter = router({
  // ... existing routers ...
  emailLists: emailListsRouter,
  emailSubscribers: emailSubscribersRouter,
});
```

### Email Layout with Sidebar (EHUB-02)
```jsx
// apps/social/app/(email)/layout.jsx
// Follows (dashboard)/layout.jsx pattern: sidebar + top bar + Clerk auth
// Key differences:
// - Email-specific nav tabs (Lists, future: Templates, Campaigns, Analytics)
// - "Marketing Hub" back link (same as dashboard)
// - Title: "Email Campaigns" instead of "Social Command Center"
// - No account switcher (email is not platform-specific)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma createMany without skipDuplicates | createMany with skipDuplicates | Prisma 4.x+ | Enables idempotent CSV imports |
| Separate API routes for each operation | tRPC router with typed procedures | Project convention | Consistent with all 20+ existing routers |
| Server-side CSV parsing (multer) | Client-side FileReader + server batch | Project convention | No file upload middleware needed, simpler Vercel deployment |

## Open Questions

1. **Email from address configuration**
   - What we know: nodemailer is already installed (^7.0.13). SMTP provider not yet configured (noted as blocker in STATE.md).
   - What's unclear: Which SMTP provider will be used, what the from/reply-to defaults should be.
   - Recommendation: Phase 9 only creates models and CRUD. The fromEmail/fromName fields on EmailCampaign are just data -- no SMTP connection needed until Phase 11 (Send Pipeline). Default values can be set later.

2. **Subscriber count limits**
   - What we know: CSV import capped at 10,000 rows per mutation for safety.
   - What's unclear: Expected list sizes for the team's use case.
   - Recommendation: 10K cap per import is fine for MVP. Can be increased later or chunked on client if needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | apps/social/vitest.config.js |
| Quick run command | `cd apps/social && npx vitest run __tests__/lib/email` |
| Full suite command | `cd apps/social && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMAL-01 | Create/edit/delete email lists | unit | `cd apps/social && npx vitest run __tests__/lib/email/email-lists.test.js -x` | No -- Wave 0 |
| EMAL-02 | CSV import with duplicate detection | unit | `cd apps/social && npx vitest run __tests__/lib/email/csv-import.test.js -x` | No -- Wave 0 |
| EMAL-03 | Search/filter subscribers | unit | `cd apps/social && npx vitest run __tests__/lib/email/email-subscribers.test.js -x` | No -- Wave 0 |
| EMAL-04 | Subscriber status tracking | unit | `cd apps/social && npx vitest run __tests__/lib/email/email-subscribers.test.js -x` | No -- Wave 0 |
| EHUB-02 | Email layout with sidebar nav | manual-only | Visual inspection -- layout is a React component | N/A |

### Sampling Rate
- **Per task commit:** `cd apps/social && npx vitest run __tests__/lib/email`
- **Per wave merge:** `cd apps/social && npx vitest run`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] `apps/social/__tests__/lib/email/email-lists.test.js` -- covers EMAL-01
- [ ] `apps/social/__tests__/lib/email/csv-import.test.js` -- covers EMAL-02
- [ ] `apps/social/__tests__/lib/email/email-subscribers.test.js` -- covers EMAL-03, EMAL-04

## Sources

### Primary (HIGH confidence)
- `apps/social/prisma/schema.prisma` -- Existing 30+ model patterns, conventions (cuid, @@map, @@index)
- `apps/social/lib/routers/schedules.js` -- CRUD router pattern (create, list, update, toggle, delete)
- `apps/social/lib/routers/posts.js` -- Cursor-based pagination + search/filter pattern
- `apps/social/lib/routers/app.js` -- Router registration pattern (20 routers)
- `apps/social/lib/trpc.js` -- Context creation, protectedProcedure, auth middleware
- `apps/social/app/(dashboard)/layout.jsx` -- Sidebar layout pattern with back-to-hub link
- `apps/social/app/(hub)/page.jsx` -- Hub module cards (email card exists, currently inactive)
- `apps/social/app/(hub)/layout.jsx` -- Minimal hub layout pattern
- `apps/social/vitest.config.js` -- Test configuration
- `apps/social/__tests__/setup.js` -- Test mock patterns

### Secondary (MEDIUM confidence)
- Prisma createMany skipDuplicates -- documented in Prisma docs, verified via schema conventions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used extensively
- Architecture: HIGH -- all patterns directly observed in existing codebase
- Pitfalls: HIGH -- derived from actual codebase patterns and Prisma documentation
- Schema design: HIGH -- follows 30+ existing model conventions exactly

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- no external dependencies or fast-moving APIs)
