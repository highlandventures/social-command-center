# Stack Research

**Domain:** Report Center — scheduled generation, PDF export, server-side chart rendering, email HTML templates, Slack Block Kit delivery
**Researched:** 2026-03-15
**Confidence:** HIGH (all critical claims verified via official docs, npm registry, or Vercel docs)

---

## Context

This is an additive milestone on an existing Next.js 14 / Prisma 5.14 / tRPC 10 / Vercel platform. The existing stack requires no framework changes. The research question is: **what specific libraries, patterns, and constraints govern the five new capabilities** — scheduled report generation, PDF export, server-side chart rendering, email HTML templates, and Slack Block Kit delivery.

**Existing stack (do not re-research):**
- `next@^14.2.0`, `@trpc/server@^10.45.0`, `@prisma/client@^5.14.0`
- `recharts@^2.12.0` (in-app charting only — cannot render server-side)
- `nodemailer@^7.0.13` (installed but unused — the sending transport is ready)
- `@vercel/kv@^2.0.0`, `@vercel/blob@^0.23.0` (infrastructure already wired)
- `@anthropic-ai/sdk` (report generation already works via existing `generateInsight()`)
- Vercel Cron infrastructure (10 cron routes already defined in `vercel.json`)

**Critical platform constraint:** Vercel serverless with Fluid Compute enabled (the default). With Fluid Compute, the Pro plan allows up to 800s max duration — relevant for long-running report generation. Without Fluid Compute it would be 300s max. Bundle size limit is 250 MB unzipped / ~50 MB compressed per serverless function.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@react-pdf/renderer` | `^4.3.2` | Server-side PDF generation | The only viable PDF library for Vercel serverless. Does NOT require Chromium or a headless browser — renders PDF from React component trees using its own layout engine (Yoga). v4.3.2 is current (published ~Jan 2026). Requires `serverExternalPackages` config in `next.config.js` to avoid bundling into the serverless function and hitting the 50 MB compressed limit. HIGH confidence — verified via official react-pdf.org compatibility docs and npm registry. |
| QuickChart.io (external service) | API — no npm package | Server-side chart image generation for email and Slack | Recharts renders only in the browser via React/SVG — it cannot run in Node.js API routes. QuickChart.io generates Chart.js chart images from a URL or POST request. The resulting URL is a static PNG that can be embedded in `<img>` tags in email HTML or as Slack Block Kit `image` blocks. No npm install required — construct a URL and call it with `fetch`. Free tier: 60 requests/min + 1,000 charts/month; Pro plan removes limits. HIGH confidence — verified via quickchart.io official docs. |
| `@react-email/components` | `^1.0.8` | React components for email HTML templates | The standard approach for building email HTML in a React/Next.js stack. Renders to valid, cross-client email HTML (tested against Gmail, Outlook, Apple Mail). Used with `@react-email/render` to produce the HTML string that nodemailer sends. React Email 5.0 (Nov 2025) adds dark mode, Tailwind 4, and React 19 support. HIGH confidence — verified via official react.email changelog. |
| `@react-email/render` | `^2.0.4` | Convert React email components to HTML strings | The render utility that transforms `<EmailTemplate />` components into the HTML string that nodemailer's `html:` field accepts. Server-safe — runs in Node.js without a browser. Pair with `@react-email/components` for a complete email authoring system. HIGH confidence — verified via official react.email docs. |
| `@slack/webhook` | `^7.0.7` | Slack Incoming Webhook delivery | Official Slack SDK package for posting to Incoming Webhook URLs. Supports Block Kit via a `blocks` array in the payload — pass an `image` block with a QuickChart.io URL for embedded chart images. No OAuth or Slack App Bot required — webhooks are configured per-channel and stored as an env var. Avoids the "Full Slack App" complexity that is explicitly out of scope. HIGH confidence — verified via official @slack/webhook npm page (published 13 days ago). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nodemailer` | `^7.0.13` (already installed) | SMTP email transport | Already installed. Wire it to SMTP credentials (e.g., SendGrid SMTP, AWS SES, or Gmail OAuth2). Use `nodemailer.createTransport()` + `transporter.sendMail({ html: renderedHtml })`. No upgrade needed — v7.0.13 is current and stable. |
| `quickchart-js` | `^3.1.2` | JavaScript client for QuickChart.io URL construction | Optional convenience wrapper around the QuickChart REST API. Provides a `QuickChart` class with methods to set chart type, data, dimensions, and call `getUrl()` or `getShortUrl()`. Alternative: construct URLs manually via `fetch` — both work. Use `quickchart-js` if chart configs become complex; use raw `fetch` for simple bar/line charts. MEDIUM confidence — npm-verified but not official Slack/QuickChart documentation. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `next.config.js` `serverExternalPackages` | Prevent `@react-pdf/renderer` from being bundled into the serverless function | Add `serverExternalPackages: ['@react-pdf/renderer']` to prevent the yoga-layout dependency from inflating the serverless bundle past the 50 MB compressed limit. This is the official Next.js 14 config key (not `experimental.serverComponentsExternalPackages` which was renamed in 14.1.1+). |
| `export const maxDuration = 60` in PDF API route | Extend the function timeout for PDF generation | PDF generation is CPU-intensive. Set `maxDuration = 60` (seconds) in the API route handler file. On Vercel Pro with Fluid Compute enabled, the ceiling is 800s — 60s is conservative and sufficient for a single report PDF. |
| Vercel Cron (existing) | Trigger scheduled report generation | Already used across 10 routes in `vercel.json`. Add new cron entries for weekly, monthly, quarterly, and yearly report generation using the established pattern. No new infrastructure needed. |
| `@vercel/blob` (already installed) | Store generated PDFs for on-demand download | Already installed. After generating a PDF with `@react-pdf/renderer`, stream or buffer the result and upload to Vercel Blob Storage. Return a signed URL for the download button. Avoids the 4.5 MB response body limit for PDF downloads. |

---

## Installation

```bash
# PDF generation
npm install @react-pdf/renderer@^4.3.2

# Email templates
npm install @react-email/components@^1.0.8 @react-email/render@^2.0.4

# Slack delivery
npm install @slack/webhook@^7.0.7

# Optional: QuickChart URL builder (or use raw fetch calls)
npm install quickchart-js@^3.1.2
```

`nodemailer`, `@vercel/blob`, and `@vercel/kv` are already installed — no changes needed.

**Required config change to `next.config.js`:**
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
};

module.exports = nextConfig;
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@react-pdf/renderer` | Puppeteer / `@sparticuz/chromium-min` + Playwright | Only if exact HTML-fidelity PDF is required (pixel-perfect screenshot of the report page). Puppeteer/Playwright with `@sparticuz/chromium-min` can run on Vercel but requires careful bundle size management and adds ~100 MB to the function size. For structured data reports, `@react-pdf/renderer`'s component model produces cleaner, more maintainable PDFs than a screenshot. |
| `@react-pdf/renderer` | Dedicated PDF microservice (AWS EC2 or Railway) | Only if Vercel bundle size limits become a real problem after deploying. The `serverExternalPackages` workaround should prevent the bundle issue — validate in staging before considering a microservice. |
| QuickChart.io (external service) | `chart.js` + `canvas` + `node-canvas` | `node-canvas` compiles native C++ bindings (Cairo/Pango) which are not available in Vercel serverless. QuickChart.io is a hosted service that avoids native binaries entirely. Use `node-canvas` only on a dedicated Node.js server, never on Vercel serverless. |
| `@react-email/components` + `@react-email/render` | MJML / `mjml-react` | MJML is battle-tested for responsive email (especially Outlook) but uses its own DSL — developers cannot write standard JSX/CSS. React Email v5's component set (2025) covers the standard components needed for report emails. Choose MJML only if Outlook rendering fidelity is a critical requirement and React Email's output fails Litmus tests. |
| `@slack/webhook` + raw Block Kit JSON | Full Slack App with `@slack/bolt` and OAuth | The PROJECT.md explicitly defers the full Slack App to a future milestone. `@slack/webhook` + Incoming Webhooks is the correct scope: one URL per channel, no bot OAuth, no event subscriptions. If interactive Slack messages (buttons, modals) are needed later, migrate to `@slack/bolt`. |
| `@vercel/blob` for PDF storage | Stream PDF directly in response body | Vercel Functions have a 4.5 MB response body limit. A multi-page report PDF can exceed this. Upload to Blob Storage and return a URL instead of streaming the binary. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Puppeteer / `puppeteer-core` | Ships a Chromium binary (~170 MB) that exceeds Vercel's 250 MB unzipped function limit. Generates cryptic 504 Gateway Timeout errors with no useful stack trace. Architecturally wrong for serverless. | `@react-pdf/renderer` for structured PDFs |
| `node-canvas` / `canvas` npm package | Requires native C++ bindings (Cairo/Pango) that are not available in the Vercel serverless runtime. Will silently fail or produce build errors. | QuickChart.io for chart images |
| Recharts for server-side chart images | Recharts is a React DOM renderer — it requires a browser environment. It cannot run in Node.js API routes or cron handlers. Importing it server-side throws errors or produces no output. | QuickChart.io for images used in email and Slack |
| Inline base64 chart images in email | Some email clients (notably Outlook 365, Gmail) strip or block base64-encoded `<img src="data:image/png;base64,...">` tags for security. | QuickChart.io URLs as `<img src="https://...">` — served over HTTPS, email-safe |
| `html-pdf` / `pdf-creator-node` | Both use PhantomJS (deprecated, security-vulnerable) or wkhtmltopdf (requires system libraries unavailable on Vercel). Will fail at build or runtime on serverless. | `@react-pdf/renderer` |
| Resend (email service) | Introduces a paid third-party email API when `nodemailer` is already installed and SMTP transport is standard. If the team already has SMTP credentials (SendGrid, SES), Resend adds cost and vendor lock-in for no benefit. | `nodemailer` with existing SMTP transport |
| QuickChart short URLs for reports | Short URLs on the free tier expire after ~3 days. Report emails may be reopened days or weeks later. Embedded chart images would break. | Use full QuickChart GET URLs (constructed via `quickchart-js` or manual URL encoding) — these do not expire. For long configs, use POST to the QuickChart API and cache the chart URL in the Report DB record. |

---

## Stack Patterns by Variant

**For scheduled report generation (cron-triggered):**
- Add cron entries to `vercel.json` (e.g., `"schedule": "0 7 * * 1"` for Monday 7am UTC weekly)
- Cron handler: fetch metrics for the time window, call Claude via existing `generateInsight()` to produce the report text, assemble the `Report` Prisma record with status `GENERATING` → `READY`
- Generate chart URLs via QuickChart.io and store them on the Report record (so they are consistent across email, Slack, and PDF)
- Set `export const maxDuration = 60` in the cron API route

**For PDF export:**
- Create a dedicated API route `app/api/reports/[id]/pdf/route.js`
- Import `@react-pdf/renderer` only in this route (isolated — prevents bundle bloat to other routes)
- Use `renderToBuffer()` to produce a Buffer, upload to `@vercel/blob`, and return the blob URL
- Set `export const maxDuration = 60` in this route
- Add `serverExternalPackages: ['@react-pdf/renderer']` to `next.config.js`

**For email delivery:**
- Build `ReportEmailTemplate` component using `@react-email/components`
- Render to HTML string: `const html = await render(<ReportEmailTemplate report={report} />)`
- Embed QuickChart.io URLs in `<Img>` components — no base64, no inline SVG
- Send via existing `nodemailer` transport: `transporter.sendMail({ html, subject, to })`

**For Slack delivery:**
- Initialize `IncomingWebhook` with `SLACK_WEBHOOK_URL` env var
- Build Block Kit payload: `section` blocks for text, `image` blocks for each QuickChart.io chart URL, `divider` blocks between sections
- Send: `await webhook.send({ blocks: [...], text: fallbackText })`
- Always include `text` as a fallback for clients that do not render Block Kit

**For QuickChart.io chart URL construction:**
- Use `quickchart-js` or raw URL construction: `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=600&height=300`
- For complex configs (Recharts-equivalent bar + line combinations), use the POST endpoint and cache the result in the Report DB record to avoid re-generation on each email or PDF render
- Format: `png` for email and Slack (JPEG artifacts on charts), `svg` for in-PDF embedding via `@react-pdf/renderer`'s `<Image>` component

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@react-pdf/renderer@^4.3.2` | Next.js 14.1.1+ | Before 14.1.1, the App Router crashed when importing react-pdf. The project is on `^14.2.0` — this constraint is satisfied. Requires `serverExternalPackages: ['@react-pdf/renderer']` in `next.config.js` to prevent bundle size overflow on Vercel. |
| `@react-pdf/renderer@^4.3.2` | React 18 | Supported since v4.1.0 added React 19 support — v4 is backwards-compatible with React 18 (the project's current version). |
| `@react-email/render@^2.0.4` | `nodemailer@^7.0.13` | No conflict. `render()` returns an HTML string; nodemailer accepts any HTML string in `sendMail({ html: '...' })`. |
| `@react-email/components@^1.0.8` | React 18 | Compatible. React Email 5.x supports React 18 and React 19. |
| `@slack/webhook@^7.0.7` | Node.js 18+ | The project runs on Vercel which uses Node 18+ runtime by default. No conflict. |
| `quickchart-js@^3.1.2` | Any Node.js version | Pure JavaScript, zero native dependencies. No compatibility concerns. |

---

## Sources

- [react-pdf.org compatibility docs](https://react-pdf.org/compatibility) — verified Next.js 14.1.1+ requirement, React 18/19 compatibility, and `serverComponentsExternalPackages` workaround. HIGH confidence.
- [npm: @react-pdf/renderer](https://www.npmjs.com/package/@react-pdf/renderer) — confirmed current version 4.3.2 published ~Jan 2026. HIGH confidence.
- [QuickChart.io documentation](https://quickchart.io/documentation/) — verified URL format, POST endpoint, chart types (Chart.js-based), chart-in-email approach. HIGH confidence.
- [QuickChart: send charts in email](https://quickchart.io/documentation/send-charts-in-email/) — verified `<img src="url">` embedding method, short URL recommendation, language-agnostic construction. HIGH confidence.
- [QuickChart: rate limits (community)](https://community.quickchart.io/t/rate-limits-for-quickchart-free-plan/722) — free tier is 60 req/min + 1,000 charts/month per official FAQ. MEDIUM confidence (two conflicting figures — 60 and 120 req/min — in different docs; FAQ page preferred).
- [npm: react-email](https://www.npmjs.com/package/react-email) — confirmed v5.2.9. HIGH confidence.
- [npm: @react-email/components](https://www.npmjs.com/package/@react-email/components) — confirmed v1.0.8. HIGH confidence.
- [npm: @react-email/render](https://www.npmjs.com/package/@react-email/render) — confirmed v2.0.4. HIGH confidence.
- [React Email docs: Nodemailer integration](https://react.email/docs/integrations/nodemailer) — verified `render()` + `transporter.sendMail()` pattern. HIGH confidence.
- [npm: @slack/webhook](https://www.npmjs.com/package/@slack/webhook?activeTab=versions) — confirmed v7.0.7 (published 13 days ago), Node 18+ requirement, Block Kit support via `blocks` array. HIGH confidence.
- [Slack Block Kit docs](https://docs.slack.dev/block-kit/) — verified `image` block type, fallback `text` field requirement for non-Block-Kit surfaces. HIGH confidence.
- [Vercel Functions duration docs](https://vercel.com/docs/functions/configuring-functions/duration) — confirmed: Fluid Compute (default on Pro) allows up to 800s max duration; without Fluid Compute, Pro max is 300s; `export const maxDuration` syntax for Next.js App Router. HIGH confidence.
- [Vercel serverless size limit](https://vercel.com/kb/guide/troubleshooting-function-250mb-limit) — confirmed 250 MB unzipped / ~50 MB compressed limit per function. HIGH confidence.
- GitHub issue: [react-pdf exceeds 50 MB on Vercel](https://github.com/wojtekmaj/react-pdf/issues/1504) — confirmed `serverExternalPackages` is the standard mitigation. HIGH confidence (community-verified, multiple reporters).
- Existing codebase audit (`package.json`, `vercel.json`, `next.config.js`) — confirmed installed versions, 10 existing cron routes, bare `next.config.js` (needs `serverExternalPackages` added). HIGH confidence.

---

*Stack research for: Report Center v1.1 — scheduled generation, PDF export, server-side charts, email templates, Slack delivery (additive milestone on existing Next.js 14 / Prisma / Vercel platform)*
*Researched: 2026-03-15*
