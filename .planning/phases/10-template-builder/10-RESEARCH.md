# Phase 10: Template Builder + Campaign CRUD - Research

**Researched:** 2026-03-16
**Domain:** Email template authoring, campaign management, HTML email preview, AI content suggestions
**Confidence:** HIGH

## Summary

Phase 10 builds the email template editor and campaign builder on top of the EmailTemplate and EmailCampaign Prisma models created in Phase 9. The existing email section (`app/(email)/`) already has a layout with sidebar navigation, lists pages, and tRPC routers for email lists and subscribers. This phase adds three new pages (templates list, template editor, campaign builder) and two new tRPC routers (`emailTemplates`, `emailCampaigns`), plus an AI subject line/body suggestion endpoint.

The project already uses `@react-email/components` and `@react-email/render` for the report email template, nodemailer for SMTP sending, and the Anthropic SDK (`lib/ai.js` with `generateInsight()`) for all AI features. The code-based HTML editor approach (NOT visual drag-and-drop) is the architecture decision for this phase. A simple `<textarea>` for HTML with a side-by-side iframe preview is the right MVP approach -- no CodeMirror/Monaco dependency needed given the team size and use case.

**Primary recommendation:** Use a split-pane layout with raw HTML textarea on the left and sandboxed iframe preview on the right. Leverage `@react-email/render` for server-side preview rendering via tRPC, and extend `lib/email-sender.js` for campaign sending. Add 4 seed templates as database rows with `isStarter: true`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ETPL-01 | System provides 4 starter templates (newsletter, announcement, product update, event invite) | Seed script using Prisma createMany with isStarter:true; EmailTemplate model already has isStarter Boolean field |
| ETPL-02 | Team can create custom email templates with HTML editor and live preview | Split-pane editor page with textarea + iframe preview; tRPC emailTemplates router for CRUD |
| ETPL-03 | AI can suggest subject line variants and body copy based on campaign context | New tRPC procedure using existing generateInsight() from lib/ai.js |
| ECMP-01 | Team can create campaigns by selecting list, template, editing content, setting subject/from/reply-to | Multi-step campaign builder page; tRPC emailCampaigns router; EmailCampaign model already has all needed fields |
| ECMP-02 | Team can preview rendered campaign emails before sending | Server-side render via @react-email/render or direct HTML iframe preview of campaign htmlContent |
| ECMP-03 | Team can schedule campaigns for future delivery or send immediately | Campaign status workflow (DRAFT -> SCHEDULED or SENDING); scheduledFor field exists on EmailCampaign model |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | ^14.2.0 | App framework, routing | Already in use |
| @trpc/server | ^10.45.0 | API layer | All existing routers use this pattern |
| Prisma | ^5.14.0 | Database ORM | EmailTemplate + EmailCampaign models exist |
| @react-email/render | ^2.0.4 | Server-side HTML email rendering | Already used in email-sender.js |
| @react-email/components | ^1.0.9 | React Email component library | Already used in report-email.jsx |
| @anthropic-ai/sdk | ^0.24.0 | AI suggestions | Used via lib/ai.js generateInsight() |
| nodemailer | ^7.0.13 | SMTP email sending | Already configured in lib/email-sender.js |
| zod | ^3.23.0 | Input validation | All tRPC procedures use this |

### No New Dependencies Needed
The existing stack covers all Phase 10 needs. The HTML editor uses a native `<textarea>` element (no CodeMirror/Monaco). The preview uses a sandboxed `<iframe>` with `srcdoc`. No new packages to install.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Textarea for HTML | CodeMirror 6 / Monaco | Overkill for internal tool MVP; adds ~300KB+ bundle; syntax highlighting nice-to-have, not needed |
| iframe srcdoc preview | @react-email/render on client | iframe is simpler, works with raw HTML; React Email render is server-side only |
| Raw HTML templates | MJML | MJML adds compilation step and dependency; raw HTML gives full control for internal team |

## Architecture Patterns

### Recommended Project Structure
```
apps/social/
  app/(email)/
    templates/
      page.jsx                # Template list page
      [id]/
        page.jsx              # Template editor (create/edit)
    campaigns/
      page.jsx                # Campaign list page
      [id]/
        page.jsx              # Campaign builder (create/edit)
  lib/
    routers/
      email-templates.js      # tRPC router for EmailTemplate CRUD
      email-campaigns.js      # tRPC router for EmailCampaign CRUD + AI + preview
    email-sender.js           # Extend with sendCampaignEmail() function
    email-templates/
      starters/               # 4 starter template HTML strings (or inline in seed)
  prisma/
    seed-email-templates.js   # Seed script for 4 starter templates
```

### Pattern 1: tRPC Router (follows email-lists.js exactly)
**What:** Each new domain gets its own router file registered in app.js
**When to use:** All new server-side operations
**Example:**
```javascript
// lib/routers/email-templates.js
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const emailTemplatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { campaigns: true } } },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.emailTemplate.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      subject: z.string().max(200).optional(),
      htmlBody: z.string().min(1),
      category: z.string().max(50).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailTemplate.create({
        data: { ...input, createdById: ctx.user.id },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      subject: z.string().max(200).optional(),
      htmlBody: z.string().optional(),
      category: z.string().max(50).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.emailTemplate.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailTemplate.delete({ where: { id: input.id } });
    }),
});
```

### Pattern 2: Split-Pane Template Editor
**What:** Textarea on left, iframe preview on right, with debounced preview updates
**When to use:** Template editor page (ETPL-02)
**Example:**
```jsx
// Simplified template editor pattern
const [htmlBody, setHtmlBody] = useState(template?.htmlBody || '');
const [previewHtml, setPreviewHtml] = useState('');

// Debounce preview updates (500ms)
useEffect(() => {
  const timer = setTimeout(() => setPreviewHtml(htmlBody), 500);
  return () => clearTimeout(timer);
}, [htmlBody]);

// Layout
<div className="grid grid-cols-2 gap-4 h-[calc(100vh-200px)]">
  <div className="flex flex-col">
    <label className="text-xs font-medium text-content-muted mb-1">HTML</label>
    <textarea
      value={htmlBody}
      onChange={(e) => setHtmlBody(e.target.value)}
      className="flex-1 font-mono text-sm p-3 bg-surface-secondary border border-border rounded-lg resize-none"
      spellCheck={false}
    />
  </div>
  <div className="flex flex-col">
    <label className="text-xs font-medium text-content-muted mb-1">Preview</label>
    <iframe
      srcDoc={previewHtml}
      sandbox="allow-same-origin"
      className="flex-1 bg-white border border-border rounded-lg"
    />
  </div>
</div>
```

### Pattern 3: Multi-Step Campaign Builder
**What:** Step wizard (Select List -> Choose Template -> Edit Content -> Preview -> Schedule/Send)
**When to use:** Campaign creation page (ECMP-01, ECMP-02, ECMP-03)
**Example:**
```jsx
const [step, setStep] = useState(1); // 1=List, 2=Template, 3=Edit, 4=Preview, 5=Schedule
const STEPS = ['Select List', 'Choose Template', 'Edit Content', 'Preview', 'Schedule'];

// Step indicator bar
<div className="flex gap-2 mb-6">
  {STEPS.map((s, i) => (
    <div key={s} className={`flex-1 h-1 rounded-full ${i < step ? 'bg-blue-600' : 'bg-border'}`} />
  ))}
</div>
```

### Pattern 4: AI Subject Line Suggestions (follows generateInsight pattern)
**What:** tRPC mutation that calls generateInsight() with campaign context
**When to use:** AI suggestions in campaign builder (ETPL-03)
**Example:**
```javascript
// In email-campaigns router
suggestSubjectLines: protectedProcedure
  .input(z.object({
    templateName: z.string().optional(),
    htmlContent: z.string().optional(),
    campaignName: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    return generateInsight('email_subject_suggestions', {
      templateName: input.templateName,
      contentSnippet: (input.htmlContent || '').replace(/<[^>]*>/g, '').slice(0, 500),
      campaignName: input.campaignName,
    }, {
      systemPrompt: `You are an email marketing expert. Generate 5 subject line variants and a brief body copy suggestion. Respond with JSON: { "subjectLines": ["..."], "bodySuggestion": "..." }`,
      maxTokens: 512,
    });
  }),
```

### Anti-Patterns to Avoid
- **Drag-and-drop editor for MVP:** Over-engineered for an internal team tool. The architecture decision is code-based HTML editing.
- **Client-side email rendering:** `@react-email/render` is server-only. Use iframe `srcdoc` for client-side preview of raw HTML.
- **Sending emails synchronously in campaign creation:** Campaign sending MUST be decoupled -- set status to SCHEDULED/SENDING and let a cron handle actual delivery (Phase 11: ECMP-04).
- **Storing template HTML in filesystem:** Use the database (EmailTemplate.htmlBody). Starter templates are seeded rows, not files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email HTML rendering | Custom HTML sanitizer | iframe sandbox="allow-same-origin" | Browser sandboxing handles security; no XSS risk in iframe with srcdoc |
| SMTP transport | Custom HTTP email sender | nodemailer (already configured) | Handles TLS, auth, connection pooling, attachments |
| JSON parsing from AI | Manual regex extraction | parseAIJSON() from lib/ai.js | Already handles markdown fences, nested braces, fallback |
| Date/time scheduling | Custom timezone logic | Native Date with ISO strings | Prisma stores DateTime as UTC; schedule with scheduledFor DateTime field |
| Form validation | Custom validators | zod schemas in tRPC input | Consistent with every other router in the project |

## Common Pitfalls

### Pitfall 1: iframe Preview Not Updating
**What goes wrong:** Setting srcdoc on an iframe sometimes doesn't trigger re-render in React
**Why it happens:** React may not diff srcdoc changes on the same iframe element
**How to avoid:** Use a `key` prop that changes with content hash, or set srcdoc via ref: `iframeRef.current.srcdoc = html`
**Warning signs:** Preview appears stuck on old content

### Pitfall 2: HTML Entity Encoding in Textarea
**What goes wrong:** Special characters in HTML (&amp;, &lt;) get double-encoded
**Why it happens:** React escapes text content in textarea value
**How to avoid:** Use controlled textarea with raw string state -- React handles this correctly for textarea elements. Don't manually encode/decode.
**Warning signs:** Preview shows &amp;amp; instead of &amp;

### Pitfall 3: Campaign Status Race Conditions
**What goes wrong:** User clicks "Send Now" multiple times, creating duplicate sends
**Why it happens:** No optimistic locking on campaign status transitions
**How to avoid:** Use Prisma's `updateMany` with a `where` clause that includes the expected current status: `where: { id, status: 'DRAFT' }`. If zero rows updated, the status already changed.
**Warning signs:** Duplicate EmailSend rows for the same campaign+subscriber

### Pitfall 4: Missing Layout Navigation Update
**What goes wrong:** New pages exist but are not accessible from the sidebar
**Why it happens:** The email layout.jsx has a hardcoded `tabs` array with only "Lists" -- new pages need to be added
**How to avoid:** Update the `tabs` array in `app/(email)/layout.jsx` to include Templates and Campaigns
**Warning signs:** Users can't navigate to new pages without typing URLs

### Pitfall 5: Starter Templates Not Idempotent
**What goes wrong:** Running seed multiple times creates duplicate starter templates
**Why it happens:** createMany without unique constraint check
**How to avoid:** Use `upsert` keyed on name+isStarter, or check existence before creating
**Warning signs:** Multiple copies of "Newsletter" template in list

## Code Examples

### Starter Template Seed Script
```javascript
// prisma/seed-email-templates.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const STARTER_TEMPLATES = [
  {
    name: 'Newsletter',
    category: 'newsletter',
    subject: 'Your Weekly Update',
    htmlBody: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px 0">
  <div style="background:#5B56F5;border-radius:8px 8px 0 0;padding:32px 24px;text-align:center">
    <h1 style="color:#fff;font-size:22px;margin:0">Weekly Newsletter</h1>
    <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:8px 0 0">{{date}}</p>
  </div>
  <div style="background:#fff;padding:24px">
    <h2 style="font-size:18px;color:#111827;margin:0 0 12px">Hello {{firstName}},</h2>
    <p style="font-size:14px;line-height:1.6;color:#374151">Your content goes here.</p>
  </div>
  <div style="padding:16px 24px;text-align:center">
    <p style="font-size:11px;color:#9ca3af;margin:0">Generated by Social Command</p>
  </div>
</div></body></html>`,
  },
  // ... announcement, product_update, event_invite follow same pattern
];

async function seedTemplates() {
  for (const tpl of STARTER_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { id: `starter-${tpl.category}` }, // Use deterministic IDs for starters
      update: { htmlBody: tpl.htmlBody, subject: tpl.subject },
      create: {
        id: `starter-${tpl.category}`,
        ...tpl,
        isStarter: true,
        createdById: 'system',
      },
    });
  }
}
```

### Campaign Builder tRPC Router (key procedures)
```javascript
// lib/routers/email-campaigns.js
export const emailCampaignsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.emailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        list: { select: { id: true, name: true, _count: { select: { subscribers: true } } } },
        template: { select: { id: true, name: true } },
        _count: { select: { sends: true } },
      },
    });
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      subject: z.string().min(1).max(200),
      fromName: z.string().max(100).optional(),
      fromEmail: z.string().email().optional(),
      replyTo: z.string().email().optional(),
      listId: z.string(),
      templateId: z.string().optional(),
      htmlContent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.emailCampaign.create({
        data: { ...input, createdById: ctx.user.id, status: 'DRAFT' },
      });
    }),

  schedule: protectedProcedure
    .input(z.object({
      id: z.string(),
      scheduledFor: z.date().optional(), // null = send immediately
    }))
    .mutation(async ({ ctx, input }) => {
      const status = input.scheduledFor ? 'SCHEDULED' : 'SENDING';
      const updated = await ctx.prisma.emailCampaign.updateMany({
        where: { id: input.id, status: 'DRAFT' },
        data: { status, scheduledFor: input.scheduledFor || new Date() },
      });
      if (updated.count === 0) throw new TRPCError({ code: 'CONFLICT', message: 'Campaign already scheduled or sent' });
      return { status };
    }),
});
```

### Email Layout Tabs Update
```javascript
// In app/(email)/layout.jsx, update the tabs array:
const tabs = [
  { key: '/email/lists', label: 'Lists', icon: '\uD83D\uDCCB' },
  { key: '/email/templates', label: 'Templates', icon: '\uD83C\uDFA8' },
  { key: '/email/campaigns', label: 'Campaigns', icon: '\uD83D\uDCE8' },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MJML for email templates | Raw HTML with inline styles | Ongoing | MJML adds compilation step; raw HTML is fine for internal tools |
| Visual drag-and-drop editors | Code-based for internal tools | Architecture decision | Much simpler implementation, full control |
| Client-side template rendering | Server-side @react-email/render | Current | Better email client compatibility |

## Open Questions

1. **System user ID for starter templates**
   - What we know: `createdById` is required on EmailTemplate; starter templates need a system user
   - What's unclear: Whether a "system" user exists in the users table
   - Recommendation: Use the first ADMIN user's ID, or create a deterministic system user ID that the seed script ensures exists. Alternatively, make `createdById` optional on EmailTemplate for system-created templates.

2. **Template variable syntax**
   - What we know: Starter templates may include variables like `{{firstName}}`, `{{date}}`
   - What's unclear: Whether Phase 10 should implement variable substitution or just leave it as raw HTML
   - Recommendation: For MVP, support simple string replacement of `{{firstName}}`, `{{lastName}}`, `{{email}}` at send time. Document but don't over-engineer -- this can be enhanced later.

3. **"Send Immediately" flow without cron (ECMP-03 vs ECMP-04)**
   - What we know: ECMP-04 (batched cron sending) is Phase 11. ECMP-03 requires send immediately capability.
   - What's unclear: Whether "send immediately" in Phase 10 means synchronous send for small lists or just setting status to SENDING.
   - Recommendation: Phase 10 sets status to SENDING with scheduledFor = now(). Phase 11's cron picks it up. For testing, provide a manual trigger endpoint or a simple inline send for lists under 50 subscribers.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | apps/social/vitest.config.js |
| Quick run command | `cd apps/social && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/social && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ETPL-01 | 4 starter templates seeded with correct fields | unit | `cd apps/social && npx vitest run __tests__/lib/email-templates/seed-templates.test.js -x` | No - Wave 0 |
| ETPL-02 | Template CRUD operations (create, read, update, delete) | unit | `cd apps/social && npx vitest run __tests__/lib/routers/email-templates.test.js -x` | No - Wave 0 |
| ETPL-03 | AI subject line and body suggestions return valid JSON | unit | `cd apps/social && npx vitest run __tests__/lib/email-campaigns/ai-suggestions.test.js -x` | No - Wave 0 |
| ECMP-01 | Campaign CRUD with list/template associations | unit | `cd apps/social && npx vitest run __tests__/lib/routers/email-campaigns.test.js -x` | No - Wave 0 |
| ECMP-02 | Campaign preview renders HTML content | unit | `cd apps/social && npx vitest run __tests__/lib/email-campaigns/preview.test.js -x` | No - Wave 0 |
| ECMP-03 | Campaign scheduling sets correct status and scheduledFor | unit | `cd apps/social && npx vitest run __tests__/lib/routers/email-campaigns.test.js -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/social && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd apps/social && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/social/__tests__/lib/routers/email-templates.test.js` -- covers ETPL-01, ETPL-02
- [ ] `apps/social/__tests__/lib/routers/email-campaigns.test.js` -- covers ECMP-01, ECMP-03
- [ ] `apps/social/__tests__/lib/email-campaigns/ai-suggestions.test.js` -- covers ETPL-03
- [ ] `apps/social/__tests__/lib/email-campaigns/preview.test.js` -- covers ECMP-02

## Sources

### Primary (HIGH confidence)
- Prisma schema at `apps/social/prisma/schema.prisma` -- EmailTemplate, EmailCampaign, EmailSend, EmailEvent models verified
- Existing email section at `apps/social/app/(email)/` -- layout.jsx, lists/page.jsx patterns verified
- `apps/social/lib/email-sender.js` -- nodemailer + @react-email/render pattern verified
- `apps/social/lib/ai.js` -- generateInsight() API pattern verified
- `apps/social/lib/routers/email-lists.js` -- tRPC router pattern verified
- `apps/social/package.json` -- all dependency versions verified

### Secondary (MEDIUM confidence)
- HTML email best practices: inline styles, max-width 600px container, system font stacks (consistent with existing report-email.jsx)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use
- Architecture: HIGH - follows exact patterns from existing email section and dashboard
- Pitfalls: HIGH - identified from direct code reading of existing patterns
- AI integration: HIGH - generateInsight() pattern well-established across codebase

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- no fast-moving dependencies)
