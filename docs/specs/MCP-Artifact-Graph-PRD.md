**figure.marketing MCP & Unified Artifact Graph**

Product Requirements Document

Marketing Command Center

Figure Technology Solutions

April 2026

*Version 1.0 --- Draft*

Table of Contents

1\. Executive Summary

2\. Problem Statement

3\. Solution Overview

4\. Architecture

5\. Data Model --- Unified Artifact Graph

6\. MCP Design

A. Tool Catalog by Module

B. Prompt Library

C. Authentication & Privacy

D. Trust Patterns

7\. Web UI Impact

8\. Module Scope

9\. Implementation Roadmap

10\. Success Metrics

11\. Non-Goals (v1)

12\. Open Questions

13\. Appendix A --- Full Tool Catalog

14\. Appendix B --- Prompt Catalog

15\. Appendix C --- Requirements Priority Matrix

1\. Executive Summary

figure.marketing is where Figure\'s marketing team tracks projects, tasks, posts, emails, LC review tickets, and campaigns. But day-to-day drafting and planning work does not happen in the hub --- it happens in Claude, Google Docs, Slack, and ad hoc tools. Getting a piece of work from where it is thought of to where it is tracked currently requires five to ten manual steps per artifact: draft in Claude, download, open figure.marketing, create a project, manually enter tasks, assign owners, attach links. Every team member pays this transfer tax, every day.

This PRD proposes two coordinated investments:

-   **A unified artifact graph** inside figure.marketing --- a shared spine that models every project, task, post, email, asset, and LC ticket as an artifact with typed parent/child and cross-reference relationships. This lets us answer questions the current schema cannot (\"show me everything under the Q2 Earnings campaign\") and lets Claude create meta-projects that reference existing work.

-   **An internal MCP (Model Context Protocol) server** --- a zero-friction bridge that lets Claude create, read, update, and link artifacts in figure.marketing on behalf of team members. The MCP is team-only, SSO-gated to \@figure.com identities, and audit-logged for L&C compliance.

Together, these collapse the create → download → move ceremony into a single confirmation click. Claude becomes the workspace; figure.marketing remains the hub; the MCP is the conveyor belt between them.

**By Phase 4 completion**, any team member should be able to co-work with Claude on an event plan, GTM brief, or content calendar, and push the full structured result --- project, sub-projects, tasks, owners, linked assets --- into figure.marketing in under two minutes, without ever leaving their Claude session.

2\. Problem Statement

Current State

-   Daily drafting, planning, and research work happens outside figure.marketing --- in Claude, Google Docs, and Slack. figure.marketing is the hub of record, but not the place work is created.

-   Every hand-off from drafting to tracking is manual: copy content, create the project, input tasks one-by-one, assign owners, link docs. A typical GTM project takes 15--30 minutes of pure data entry to spin up in the hub after the plan is already written.

-   Each module (Social Command, GTM, Email, Hub / LC Review) has its own domain schema with no unifying graph. There is no way to ask \"show me everything related to the Q2 Earnings campaign across modules\" without manual assembly.

-   There is no notion of a meta-project or derived artifact. When a new initiative builds on existing work, the link between them lives only in the brain of whoever set it up.

-   Team members who use Claude to draft are invisible to the hub --- their work only shows up once it has been manually transferred.

-   Lineage is lost. Given a published social post, there is no way to trace back to the brief that generated it, the LC ticket that cleared it, or the campaign it belongs to.

Impact

-   Transfer friction consumes hours per team member per week. On a team of 10--15, this is several headcount-weeks per quarter spent on data re-entry.

-   Context loss between drafting and publishing. Notes, rationale, and alternatives that lived in the Claude session do not make it into the hub record.

-   Duplicate work across modules. Social, email, and GTM often recreate the same assets because they cannot see each other\'s work easily.

-   Leadership reporting is laborious. Cross-cutting questions (\"what is the full marketing motion around Figure Pay launch?\") require manual synthesis.

-   L&C compliance has no clean audit trail for AI-assisted content. For a Nasdaq-listed fintech, this is material risk, not just inconvenience.

3\. Solution Overview

The proposal is three coordinated pieces, delivered in phased sequence:

Three Parts

-   **A. Unified Artifact Graph** (schema layer inside figure.marketing). A shared artifacts table and artifact\_relationships table sit alongside existing module tables. Every project, task, post, email, asset, and LC ticket gets an artifact row with type, parent, owner, and status. Typed relationships encode hierarchy and cross-references.

-   **B. MCP Server** (Claude surface). A Next.js-hosted MCP endpoint at mcp.figure.marketing exposes tools and prompts over the same API layer the web UI uses. Team members add it once to their Claude client; all drafting, planning, and reporting workflows gain direct hub integration.

-   **C. Updated Module Conventions** (engineering practice). Every new feature ships with artifact rows and matching MCP tools by default. The pattern is encoded in the codebase so future modules inherit the graph and the Claude surface for free.

Key Design Principles

-   **Single spine, many modules.** Module-specific tables remain --- the artifact graph is additive. Queries against Post or GtmProject keep working; the graph is the view on top.

-   **Web UI and MCP are coequal clients.** Neither surface is canonical. Both call the same API routes. Any action available in Claude must also be available in figure.marketing, and vice versa, unless explicitly gated (see Trust Patterns).

-   **Composite tools over CRUD.** MCP tools are shaped like workflows, not endpoints. publish\_event\_plan writes a project, sub-projects, tasks, owners, and a calendar entry in one call --- not five.

-   **Preview before composite writes.** Any tool that creates or mutates more than one artifact must return a preview for user confirmation before execution. No silent bulk mutations.

-   **Team-only, audited, revocable.** SSO-gated to \@figure.com identities. Per-user tokens. Every tool call logged with user, tool, arguments, and timestamp. Tokens revocable by admin.

4\. Architecture

4.1 Stack Overview

-   **Database:** existing Supabase / Postgres instance. New tables added; module tables evolved with an artifact\_id FK column.

-   **ORM:** existing Prisma schema, extended.

-   **API layer:** existing Next.js /api routes + tRPC. New /api/artifacts/\* endpoints and new tRPC routers for graph traversal.

-   **Web UI:** existing figure.marketing Next.js app. New relationship/lineage panes on artifact detail views.

-   **MCP server:** hosted as a Next.js route group (e.g. apps/social/app/api/mcp/\*) or a dedicated service in the monorepo. Implements MCP protocol over HTTP with Server-Sent Events.

-   **Auth:** Google Workspace SSO for the web UI. MCP uses per-user bearer tokens issued after SSO confirmation, scoped to the user\'s figure.marketing identity.

-   **Hosting:** Vercel, same project as figure.marketing. Internal subdomain mcp.figure.marketing. Not published to the public MCP registry.

4.2 Data Flow

Both the web UI and the MCP server are clients of the same API layer. A piece of work drafted in Claude and pushed via MCP is indistinguishable, in the database, from the same work created via the web UI. The only difference is the audit log entry records the provenance.

Text-based ASCII diagram:

Supabase / Postgres

\|

Next.js API layer

(tRPC + REST)

/ \\

figure.marketing MCP server

web UI (tools + prompts)

\|

Claude clients

(team, SSO-gated)

5\. Data Model --- Unified Artifact Graph

5.1 Artifact Types

Every tracked object in figure.marketing has an artifact row. Supported types in v1:

-   campaign --- highest level initiative spanning quarters or multi-month efforts

-   project --- discrete GTM initiative (existing GtmProject)

-   sub\_project --- part of a project; same shape as project with a parent

-   task --- unit of work with owner and due date (existing GtmTask)

-   subtask --- decomposed task

-   post --- social post (existing Post / Draft)

-   email --- email campaign or template

-   asset --- file or document reference

-   lc\_ticket --- legal & compliance review ticket

-   report --- generated or saved analytical report

5.2 Relationship Types

Relationships are typed, directional, and add-only (deletion is soft-archive). Supported in v1:

-   parent\_of / child\_of --- primary hierarchy (inferred from artifacts.parent\_id; materialized in the relationships table for graph queries)

-   depends\_on --- task dependency / blocker

-   relates\_to --- soft cross-reference (this post supports that campaign)

-   derived\_from --- lineage (this email was generated from that brief)

-   reviewed\_by --- LC ticket references the draft it reviewed

-   published\_as --- a draft artifact points to the published version

Deliberate discipline: six relationship types in v1. Additional types require a schema migration and a documented use case. This prevents graph sprawl.

5.3 artifacts Table

  -------------- ------------------------- ----------------------------------------------------------------------------------------------------------
  **Field**      **Type**                  **Description**
  id             String (UUID)             Primary key --- the universal artifact ID
  type           Enum                      campaign \| project \| sub\_project \| task \| subtask \| post \| email \| asset \| lc\_ticket \| report
  title          String                    Human-readable title
  parent\_id     String (UUID, nullable)   FK to artifacts.id --- primary hierarchy
  owner\_id      String (User FK)          Responsible user
  status         String                    Module-specific status (DRAFT, IN\_PROGRESS, DONE, BLOCKED, etc.)
  module         String                    Owning module (social \| gtm \| email \| lc\_review \| hub)
  entity\_id     String (UUID)             FK into the module-specific table for domain data
  metadata       JSON                      Module-extensible metadata (tags, flags, etc.)
  created\_at    Timestamp                 Creation timestamp
  updated\_at    Timestamp                 Last modified
  archived\_at   Timestamp (nullable)      Soft-delete marker
  -------------- ------------------------- ----------------------------------------------------------------------------------------------------------

5.4 artifact\_relationships Table

  -------------------- ---------------------- ---------------------------------------------------------------------------------------------------------
  **Field**            **Type**               **Description**
  id                   String (UUID)          Primary key
  source\_id           String (UUID)          FK to artifacts.id
  target\_id           String (UUID)          FK to artifacts.id
  relationship\_type   Enum                   parent\_of \| child\_of \| depends\_on \| relates\_to \| derived\_from \| reviewed\_by \| published\_as
  created\_by          String (User FK)       Who established the relationship
  created\_at          Timestamp              Creation timestamp
  archived\_at         Timestamp (nullable)   Soft-delete marker
  -------------------- ---------------------- ---------------------------------------------------------------------------------------------------------

5.5 Module Table Integration

Each existing module table adds an artifact\_id column that FKs into artifacts.id:

-   Post → artifact\_id (type = post)

-   GtmProject → artifact\_id (type = project or campaign, set by caller)

-   GtmTask → artifact\_id (type = task or subtask)

-   EmailCampaign → artifact\_id (type = email)

-   LcReviewTicket → artifact\_id (type = lc\_ticket)

**Transactional invariant:** any time a module row is created, the artifact row must be created in the same database transaction. A module row without an artifact row is a bug, not an eventual-consistency state. This is non-negotiable; the graph becomes a lie otherwise.

5.6 Query Patterns

Postgres recursive CTEs handle hierarchy traversal at the scale we operate (thousands of artifacts, dozens of users). If performance becomes a concern post-launch, the standard upgrades are well-documented: materialized path columns, transitive closure table, or the ltree extension. Not needed for v1.

5.7 Migration Plan

One-time backfill script runs during deployment:

-   For each existing Post, GtmProject, GtmTask, EmailCampaign, LcReviewTicket, create a matching artifacts row with correct type, owner, status, and module. Set artifact\_id on the source row.

-   For existing GtmTask.projectId relationships, write parent\_of / child\_of edges to artifact\_relationships.

-   Existing data has no derived\_from, reviewed\_by, or published\_as edges. These start empty and accumulate via new writes.

-   Migration is idempotent: re-runnable without corruption. Dry-run mode available.

6\. MCP Design

6.A Tool Catalog by Module

Tools are namespaced by module. Full tool catalog in Appendix A; abbreviated v1 list below.

hub.\* (cross-module artifact graph)

-   hub.get\_tree --- return an artifact and its full descendant tree

-   hub.get\_related --- return everything linked to an artifact

-   hub.trace\_lineage --- walk derived\_from edges back to origin

-   hub.link --- add a relationship between two artifacts

-   hub.create\_meta\_project --- composite: create a project that relates\_to N existing projects

-   hub.update\_artifact --- edit title, owner, status, metadata on any artifact

-   hub.reparent --- move an artifact under a different parent

-   hub.what\_am\_i\_working\_on --- returns the caller\'s active artifacts across modules

-   hub.find\_artifact --- fuzzy search across the graph

social.\* (Social Command)

-   social.draft\_post --- write draft to Social Command queue

-   social.schedule\_post --- scheduled post with timing and channel

-   social.submit\_for\_review --- route to internal review queue

-   social.publish\_content\_calendar --- composite: push N drafts as a campaign

-   social.get\_calendar --- read the scheduled calendar for a date range

-   social.get\_post\_metrics --- metrics for a post or date range, with directional caveat flag

-   social.get\_competitor\_activity --- competitor post activity

-   social.search\_listening --- query listening data

-   social.get\_kols --- key opinion leader records

-   social.get\_report --- EOW-style report pull

gtm.\* (Go-to-Market)

-   gtm.create\_project --- create a GTM project artifact

-   gtm.update\_project --- edit existing project

-   gtm.publish\_event\_plan --- composite: project + sub-projects + tasks + owners + calendar entry

-   gtm.generate\_tasks\_from\_brief --- composite: brief → suggested task tree → user confirms → write

-   gtm.expand\_project --- add sub-projects or task groups to an existing project

-   gtm.push\_asset --- upload a file directly; attach to project

-   gtm.list\_projects / gtm.get\_calendar --- read operations

email.\*

-   email.draft\_campaign / email.build\_campaign\_from\_draft --- write (composite)

-   email.list\_campaigns / email.get\_campaign\_metrics / email.search\_templates / email.get\_lists --- read

lc\_review.\*

-   lc\_review.file\_ticket --- file an LC ticket from a draft artifact; attach content; pre-flag claims

-   lc\_review.file\_from\_draft --- composite: takes a draft from the session, files with full context

-   lc\_review.get\_ticket\_status / lc\_review.list\_my\_tickets --- read

6.B Prompt Library

Prompts are reusable, parameterized templates exposed by the MCP server. They bake in Figure product context, brand voice, and workflow structure so team members do not re-explain them every session. Prompts live as markdown files in the MCP repo and are version-controlled.

v1 prompts:

-   /figure.voice\_check --- check copy against brand voice + product primer

-   /figure.draft\_launch\_thread --- draft a social thread for a Figure product launch

-   /figure.weekly\_social\_report --- generate EOW report with metric caveats

-   /figure.competitor\_brief --- synthesize competitor activity across social + listening

-   /figure.gtm\_project\_kickoff --- walk a new GTM brief into a hub project with tasks

-   /figure.expand\_project --- add sub-projects / task groups to an existing project

-   /figure.build\_meta\_project --- create a meta-project spanning multiple existing projects

-   /figure.compliance\_file --- prep content for LC review, flag claims, file ticket

-   /figure.leadership\_update --- cross-module weekly update in Miso\'s voice and format

-   /figure.post\_from\_news --- draft a Figure-relevant reaction to a news event

6.C Authentication & Privacy

-   **SSO.** Users authenticate via Google Workspace; only \@figure.com (and explicitly approved domains) can obtain MCP tokens.

-   **Per-user tokens.** Each team member gets their own bearer token. Draft attribution, audit trails, and revocation are per-user. No shared service accounts.

-   **Token issuance.** A self-serve page at figure.marketing/mcp/connect returns a fresh token after SSO. Setup doc walks users through adding the MCP to Claude Desktop / Cowork / Claude Code / web Claude.

-   **Revocation.** Admin page in figure.marketing lists active tokens per user with one-click revoke. Revoked tokens fail immediately at the MCP layer.

-   **Audit log.** Every tool call logged server-side: user\_id, tool, arguments, artifact\_ids\_affected, timestamp, outcome. Retained for 2 years. L&C can query this log for any AI-assisted artifact.

-   **Internal-only.** The MCP is not published to the Anthropic MCP registry. URL is private; discovery is via internal docs only.

6.D Trust Patterns

-   **Preview-before-write.** Any composite tool that creates or modifies more than one artifact must return a structured preview of intended changes before executing. The Claude client shows the preview to the user; the user confirms; the tool then executes. No silent bulk mutations.

-   **UI-only actions.** Publish social post, approve LC ticket, and move campaign from draft → live remain web-UI-only. The MCP can draft, schedule, and submit for review, but final publish requires a human in the web UI. This is policy, not a technical limit.

-   **Confirmation on destructive ops.** Reparenting, archiving, and relationship deletion require an explicit confirmation in the tool call arguments (e.g. confirm=true).

-   **Scoped tokens.** Tokens can be optionally scoped to read-only for contractors or agency partners, using the existing ADMIN / INTERNAL / AGENCY role system.

7\. Web UI Impact

7.1 What Stays Unchanged

-   All visual workflows: GTM Calendar, Social Command calendar, review UI, dashboards.

-   Approval and publish flows --- these remain UI-only.

-   All existing routes, layouts, and navigation.

-   The Copilot API route and UI (it solves a different problem --- in-UI ideation --- and stays as-is).

7.2 What Evolves

-   Artifact detail views (project, task, post, email, LC ticket) gain a Related / Children / Lineage pane showing the artifact\'s relationships in the graph. Click any relationship to navigate.

-   Search becomes graph-aware --- results can filter by artifact type and relationship depth.

-   Project Brief gets an \"Expand\" action that matches the MCP\'s expand\_project capability for parity.

7.3 What\'s New

-   MCP connect page at figure.marketing/mcp/connect --- user-facing token management.

-   Admin audit page --- browse tool call history, filter by user, tool, artifact.

-   Admin token management page --- list active tokens, revoke.

8\. Module Scope

  ----------------- ---------------- ---------------------------------------------------------------------------------------------------------------------------------
  **Module**        **In MCP v1**    **Notes**
  Social Command    Yes --- full     Calendar, composer, competitors, intelligence, listening, KOL, reports, reviews. Metrics-gap bugs addressed as part of Phase 1.
  GTM               Yes --- full     Projects, tasks, moments, OKRs, product hub. Meta-project + expand flows are the centerpiece of Phase 2.
  Email             Yes --- full     Campaigns, lists, templates. Lowest-priority module, shipped last.
  Hub / LC Review   Yes              File-ticket workflow is a high-value Claude-native use case for regulated content.
  Hub / Drive       No               Deprecation candidate. Out of scope for MCP; re-evaluate when the Drive module\'s future is decided.
  Copilot           No (unchanged)   Different purpose (in-UI ideation). Not wrapped, not replaced.
  ----------------- ---------------- ---------------------------------------------------------------------------------------------------------------------------------

9\. Implementation Roadmap

Phase 0: Artifact Graph Foundation (Weeks 1--3)

-   **Deliverables:** Prisma schema additions (artifacts, artifact\_relationships, module table FKs). Migration script with backfill of existing data. /api/artifacts/\* REST endpoints and new tRPC routers for graph traversal (get\_tree, get\_related, trace\_lineage, link, unlink). RLS policies aligned with existing module permissions.

-   **Validation:** every existing Post, GtmProject, GtmTask, EmailCampaign, LcReviewTicket has an artifact row. Backfill runs clean in staging; dry-run on production succeeds.

-   **No user-visible change yet.** This phase is invisible groundwork.

Phase 1: Social Command MCP + Pilot (Weeks 4--6)

-   **Deliverables:** MCP server scaffold (Next.js route group). SSO / token issuance page. Admin token management page. Social Command tool set (draft\_post, schedule\_post, submit\_for\_review, publish\_content\_calendar, get\_calendar, get\_post\_metrics with caveat flag, get\_competitor\_activity, search\_listening, get\_kols, get\_report). Prompt library v1: voice\_check, draft\_launch\_thread, weekly\_social\_report, competitor\_brief.

-   **Fixes bundled:** Supabase metrics undercount (weighted-avg in report-engine, poll-metrics window extension, add quotes field to PostMetrics). Exposing deflated numbers through MCP would erode trust.

-   **Pilot:** 3 team members (Miso + 2) onboarded. Setup doc written. 2-week feedback loop before broader rollout.

Phase 2: GTM MCP + LC Review MCP (Weeks 7--9)

-   **Deliverables:** GTM tool set including update\_project, create\_sub\_project, expand\_project, publish\_event\_plan, generate\_tasks\_from\_brief, build\_meta\_project. LC Review tool set (file\_ticket, file\_from\_draft, get\_ticket\_status, list\_my\_tickets). Prompts: gtm\_project\_kickoff, expand\_project, build\_meta\_project, compliance\_file, post\_from\_news.

-   **Preview UX:** composite tool preview design implemented in the MCP response format; Claude clients render it natively.

Phase 3: Email MCP + Graph UI (Weeks 10--11)

-   **Deliverables:** Email tool set (draft\_campaign, build\_campaign\_from\_draft, list\_campaigns, get\_campaign\_metrics, search\_templates, get\_lists). Web UI updates: Related / Children / Lineage panes on artifact detail views. Cross-module prompts: leadership\_update.

Phase 4: Hardening + Team Rollout (Week 12)

-   **Deliverables:** Audit log dashboards (internal). Admin revocation UX polish. Setup video. Internal docs in Hub. Team-wide rollout announcement with training session.

Post-Launch (Future Roadmap)

-   Additional modules added to figure.marketing ship with artifact rows and MCP tools by default (new engineering convention).

-   Advanced lineage visualization in the web UI (graph view).

-   Automated Google Docs sync (bi-directional) --- deferred to v2.

-   Export-to-PDF from the artifact graph (\"everything we did on Figure Pay launch, as a report\").

-   External stakeholder share links (read-only, scoped to specific artifact trees).

10\. Success Metrics

Adoption & Usage

-   60%+ of eligible team members actively using the MCP by end of Phase 4.

-   Average ≥3 tool calls per active user per working day by Phase 4 + 2 weeks.

-   100% of team members have onboarding docs and have completed the setup flow within 2 weeks of Phase 4 launch.

Efficiency --- North Star

-   Time from \"idea drafted in Claude\" to \"structured artifact in figure.marketing\" drops from a baseline \~15--30 min to under 2 min for routine project/event/campaign setup. Baseline measured pre-Phase-1; target measured at Phase 4 + 4 weeks.

-   50%+ reduction in manual create-project and create-task events in figure.marketing (replaced by MCP composite calls).

-   30%+ of new GTM projects in Phase 2+ include at least one parent/child, meta-project, or cross-reference link --- demonstrating the graph is being used, not just present.

Quality & Compliance

-   100% of composite tool calls present a preview before execution. Preview acceptance / rejection tracked.

-   Zero unauthorized artifact access (audit log verified; RLS passes pen test).

-   ≥99% MCP server uptime (excluding scheduled maintenance).

-   L&C can produce a complete audit trail for any AI-assisted artifact within 5 minutes of request.

Cross-Module Visibility

-   ≥30% of artifacts created post-launch have at least one cross-module relationship within 90 days.

-   Leadership report turnaround (the \"what\'s the full marketing motion around X launch\" question) drops from manual assembly (\~1 hour) to prompt + review (\<10 min).

11\. Non-Goals (v1)

-   **Public MCP.** Not published to the Anthropic registry. Internal-only, SSO-gated.

-   **Non-Figure users.** No external stakeholders, contractors (except approved agency accounts), or customers.

-   **Full web UI replacement.** Approvals, calendars, visual review, dashboards stay in the web UI. The MCP augments; it does not replace.

-   **Auto-publish without human confirmation.** Publish and approve actions remain UI-only and require human click.

-   **Bi-directional sync with Google Docs or Slack.** Future enhancement. v1 is figure.marketing only.

-   **Copilot replacement or integration.** Copilot is left in place. The MCP is additive.

-   **Drive module.** Out of scope; deprecation candidate.

-   **Dependency management and critical path.** depends\_on relationships are stored, but no gantt / critical-path calculation in v1.

-   **Real-time collaboration.** MCP writes are atomic; no multiplayer editing within Claude sessions.

-   **Agent-initiated writes without user confirmation.** Claude must always return tool call results to the user for confirmation on composite mutations.

12\. Open Questions

-   **ID normalization.** Do all existing module tables use UUIDs, or will migration need ID format conversion? Needs schema audit in Phase 0.

-   **RLS policy design.** Should artifact-level permissions derive from the owning module\'s existing permissions, or is there a unified policy? Needs decision before Phase 0 ships.

-   **SSO provider.** Is Google Workspace the right SSO, or should we inherit whatever figure.marketing\'s NextAuth flow already uses (TEAM\_PASSWORD in current code)?

-   **Publish gate enforcement.** Which exact actions stay UI-only? Proposed: publish social post, approve LC ticket, move campaign live, move GTM project from planned to executing. Confirm list with product and L&C.

-   **Metrics-gap fix sequencing.** Recommendation: fix before exposing get\_post\_metrics in Phase 1. Needs owner assignment in engineering.

-   **Cost model.** Per-user LLM API usage --- team budget vs. department chargeback? Needs finance conversation.

-   **Prompt library ownership.** Who maintains /figure.\* prompts? Proposed: marketing owns content, engineering owns schema/validation. Formalize.

-   **Preview UX parity.** Claude clients render tool previews differently (Desktop vs. Cowork vs. Code vs. web). Test matrix needed before Phase 1 pilot.

13\. Appendix A --- Full Tool Catalog

  ------------------------------------ ------------ ----------- -----------
  **Tool**                             **Module**   **Type**    **Phase**
  hub.get\_tree                        hub          read        0
  hub.get\_related                     hub          read        0
  hub.trace\_lineage                   hub          read        0
  hub.find\_artifact                   hub          read        0
  hub.what\_am\_i\_working\_on         hub          read        0
  hub.link                             hub          write       0
  hub.unlink                           hub          write       0
  hub.update\_artifact                 hub          write       0
  hub.reparent                         hub          write       0
  hub.create\_meta\_project            hub          composite   2
  social.draft\_post                   social       write       1
  social.schedule\_post                social       write       1
  social.submit\_for\_review           social       write       1
  social.publish\_content\_calendar    social       composite   1
  social.get\_calendar                 social       read        1
  social.get\_post\_metrics            social       read        1
  social.get\_competitor\_activity     social       read        1
  social.search\_listening             social       read        1
  social.get\_kols                     social       read        1
  social.get\_report                   social       read        1
  gtm.create\_project                  gtm          write       2
  gtm.update\_project                  gtm          write       2
  gtm.publish\_event\_plan             gtm          composite   2
  gtm.generate\_tasks\_from\_brief     gtm          composite   2
  gtm.expand\_project                  gtm          composite   2
  gtm.push\_asset                      gtm          write       2
  gtm.list\_projects                   gtm          read        2
  gtm.get\_calendar                    gtm          read        2
  email.draft\_campaign                email        write       3
  email.build\_campaign\_from\_draft   email        composite   3
  email.list\_campaigns                email        read        3
  email.get\_campaign\_metrics         email        read        3
  email.search\_templates              email        read        3
  email.get\_lists                     email        read        3
  lc\_review.file\_ticket              lc\_review   write       2
  lc\_review.file\_from\_draft         lc\_review   composite   2
  lc\_review.get\_ticket\_status       lc\_review   read        2
  lc\_review.list\_my\_tickets         lc\_review   read        2
  ------------------------------------ ------------ ----------- -----------

14\. Appendix B --- Prompt Catalog

  -------------------------------- -------------------------------------------------------- -----------
  **Prompt**                       **Purpose**                                              **Phase**
  /figure.voice\_check             Check copy against brand voice + product primer          1
  /figure.draft\_launch\_thread    Draft a social thread for a Figure product launch        1
  /figure.weekly\_social\_report   EOW report with metric caveats baked in                  1
  /figure.competitor\_brief        Competitor synthesis across social + listening           1
  /figure.gtm\_project\_kickoff    Brief → hub project with tasks + owners                  2
  /figure.expand\_project          Add sub-projects or task groups to an existing project   2
  /figure.build\_meta\_project     Create meta-project linking multiple existing projects   2
  /figure.compliance\_file         Prep content, flag claims, file LC ticket                2
  /figure.post\_from\_news         Draft Figure-relevant reaction to a news event           2
  /figure.leadership\_update       Cross-module weekly update in Miso\'s voice              3
  -------------------------------- -------------------------------------------------------- -----------

15\. Appendix C --- Requirements Priority Matrix

  ------------------------------------------- ----------- -------------- ------------------------------------------------------------
  **Feature**                                 **Phase**   **Priority**   **Rationale**
  Unified artifact schema                     0           MUST           Foundation for everything else; no MCP value without it
  Module table FK backfill migration          0           MUST           Graph coverage of existing data; dirty data breaks trust
  /api/artifacts/\* endpoints                 0           MUST           Serves both MCP and web UI clients
  RLS policies for artifacts                  0           MUST           Compliance non-negotiable
  MCP server + SSO token flow                 1           MUST           No MCP without auth
  Social Command core tools                   1           MUST           First module; proves pattern
  Metrics gap fix                             1           MUST           Exposing wrong numbers erodes trust immediately
  v1 prompt library (social)                  1           MUST           Prompts are where team knowledge compounds
  GTM + LC Review tools                       2           MUST           High daily friction; biggest workflow wins
  Preview-before-write UX                     2           MUST           Composite tools are the new surface area for mistakes
  Meta-project + expand flows                 2           SHOULD         Unlocks the hierarchical work the user asked for
  Email tools                                 3           SHOULD         Lowest daily-use module; shipped after high-impact modules
  Graph UI panes (related/children/lineage)   3           SHOULD         Parity between web UI and MCP
  Admin audit log UI                          4           MUST           L&C and InfoSec requirement
  Token admin / revocation UI                 4           MUST           Security hygiene for a regulated fintech
  Advanced lineage graph visualization        Post-v1     NICE           Useful but not required; raw data is queryable already
  Google Docs / Slack bi-directional sync     Post-v1     NICE           Larger scope; revisit after v1 adoption measured
  Export-to-PDF from artifact tree            Post-v1     NICE           Downstream reporting win; not blocking
  External stakeholder share links            Post-v1     NICE           Requires permission model evolution
  ------------------------------------------- ----------- -------------- ------------------------------------------------------------

*End of Document*

*For questions or clarifications, contact the VP of Marketing.*
