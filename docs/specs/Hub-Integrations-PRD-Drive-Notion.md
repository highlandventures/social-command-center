# Feature Spec: Google Drive Hub Integration

**Author:** Miso / Claude
**Date:** March 27, 2026
**Status:** Draft
**Module:** Social Command Hub (`/hub`)

---

## Problem Statement

The Social Command Hub currently surfaces Calendar, Email, and Tasks — but a critical daily workflow still requires context-switching: reviewing and acting on Google Drive document activity (comments, action items, approvals). Marketing team members bounce between the hub and Drive throughout the day, losing context and missing action items buried in doc comments.

---

## Goals

1. **Surface Drive document activity in the hub** so users see recent files, open comments, and action items without leaving the app.
2. **Connect Drive comments to the hub's task system** so action items from doc reviews automatically surface as trackable tasks.
3. **Provide inline editing** — Google Workspace files (Docs, Sheets, Slides) open in an embedded editor panel within the hub. Non-Workspace files (PDFs, images) open in a new tab via `webViewLink`.
4. **Reduce daily tool-switching by ~30%** for the marketing team's core document review workflow.

---

## Non-Goals

- **Custom rich-text editor.** We use Google's native embedded editor (iframe) rather than building our own editor with the Docs API. This gives full editing capability with zero maintenance overhead.
- **Google Drive write operations.** Phase 1 is `drive.readonly`. Creating/uploading files from the hub is out of scope.
- **Notion or Zapier integration.** Scoped out of this effort. The existing `notion-adapter.js` Zapier bridge is untouched and will be addressed in a separate spec.
- **Google Workspace admin-level APIs.** We use user-scoped OAuth only — no domain-wide delegation or admin consent required.

---

## Architecture Overview

### Google Drive Integration (Backend Complete)

The Drive backend is already built and follows the same pattern as Gmail/Calendar:

| Layer | File | What It Does |
|-------|------|-------------|
| OAuth scope | `app/api/connect/google/route.js` | Added `drive.readonly` to existing Google OAuth flow |
| API adapter | `lib/google-drive.js` | `listDriveFiles`, `searchDriveFiles`, `getDriveFile`, `listFolderContents` via native fetch |
| tRPC router | `lib/routers/google.js` | `driveRecentFiles`, `driveSearch`, `driveFile`, `driveFolderContents` procedures |
| Token refresh | `lib/google-token-refresh.js` | Existing flow — no changes needed |

**User action required:** Users must reconnect Google (visit `/api/connect/google`) once to grant the new `drive.readonly` scope. The hub should detect the missing scope and prompt re-auth.

---

## User Stories

### As a Marketing VP (Miso)

- **I want to see my recently modified Google Drive files in the hub** so I can quickly jump to the doc I need to review without opening Drive separately.
- **I want to search Drive from the hub** so I can find a specific brief, campaign doc, or asset without context-switching.
- **I want to see which docs have unresolved comments** so I know where my review attention is needed.

### As a Marketing Team Member

- **I want Drive doc activity to surface as tasks** so when someone @mentions me in a comment or assigns an action item, it shows up in my hub Tasks section.
- **I want to click a Drive file in the hub and land directly in the Google editor** so reviewing and editing is seamless.
- **I want to filter Drive files by type** (Docs, Sheets, Slides) so I can quickly find the right asset.

---

## Requirements

### P0 — Must-Have (Phase 1)

#### DriveSection Component

A new hub panel alongside Calendar, Email, and Tasks.

- Shows 5 most recently modified files with name, type icon, owner, and `timeAgo` timestamp
- Each file row links to `webViewLink` (opens in Google Docs/Sheets/Slides in a new tab)
- File type labels via `getFileTypeLabel()` (already in adapter)
- Search input at top of panel — calls `google.driveSearch` on submit, clears on escape
- Loading skeleton matching existing hub component patterns (`ActivityRowSkeleton`)
- Empty state for users who haven't connected Google / granted Drive scope
- "View in Drive" link at panel header → opens `drive.google.com`

#### Embedded Editor Panel (Option 1: Google Iframe)

- Clicking a Google Workspace file (Doc, Sheet, Slides) opens a full-screen overlay with:
  - Left sidebar: file name, type, owner, modified time, "Open in full Google Docs" link, close button
  - Main area: embedded Google editor via `?embedded=true` iframe URL
  - Top bar: file name + close button
- Non-Workspace files (PDFs, images, etc.) open via `webViewLink` in a new tab
- Editor auto-saves (handled by Google) — no save button needed
- Escape key or close button dismisses the overlay

**Acceptance criteria:**

- Hub loads Drive files within 2s of page load
- Clicking a Google Workspace file opens the embedded editor within the hub
- Clicking a non-Workspace file opens it in a new tab
- Embedded editor supports full editing (typing, formatting, comments, etc.)
- Search returns results filtered by user's query
- File type filter chips correctly narrow the file list
- Users without Google connected see an appropriate empty state (reuse `GoogleConnectCard`)
- Component follows existing hub patterns: same card style, skeleton loading, section header

#### Re-Auth Prompt for Drive Scope

- Check `google.connectionStatus` → if connected but stored `scopes` doesn't include `drive.readonly`, show a banner: "Connect Google Drive to see your files here" with re-auth button pointing to `/api/connect/google`
- After re-auth, the banner disappears and Drive files load automatically

**Acceptance criteria:**

- Users who connected Google before the Drive scope was added see the re-auth prompt
- Re-auth flow preserves existing Gmail + Calendar access (Google merges scopes on re-consent)
- Prompt does not appear for users who have already granted Drive scope

### P1 — Nice-to-Have (Phase 1 Stretch)

#### Drive Folder Browsing

- Clicking a folder in DriveSection opens its contents inline
- Breadcrumb navigation: "My Drive > Marketing > Q1 Briefs"
- Back button returns to previous folder or recent files view
- Uses `google.driveFolderContents` procedure (already built)

#### File Type Filter Chips

- Horizontal chip row: All | Docs | Sheets | Slides | PDFs
- Filters `driveRecentFiles` or `driveSearch` by MIME type
- Active chip highlighted; only one active at a time

#### Starred Files Quick Access

- "Starred" toggle alongside recent files
- Filters to `starred = true` files — uses existing `starred` field from Drive API response

### P2 — Future Considerations (Phase 2)

#### Drive Comments → Tasks Pipeline

This is the higher-value integration that turns passive file browsing into an active workflow tool.

- **Google Drive Comments API** polling (cron job, every 15 min)
  - Fetch recent comments across user's Drive files
  - Parse `@mentions` and action-item patterns ("TODO:", "Action:", "Please review")
  - Create/update tasks in hub's existing `tasks` tRPC router
  - Mark task as resolved when the originating Drive comment is resolved

- **Architecture:**
  - New cron: `api/cron/drive-comments.js`
  - Comment-to-task mapping stored in Prisma (new `DriveCommentSync` model)
  - Deduplication by comment ID to avoid duplicate tasks
  - Task metadata includes doc name, comment text, and deep link back to the specific comment anchor

- **Scope decision needed:** The Drive Comments API works per-file. To get comments across all files, we'd either poll recently modified files (feasible for small teams) or use the Drive Activity API (requires Google Workspace admin approval). For Phase 2, recommend starting with recently-modified-files polling and evaluating Activity API if the team outgrows it.

#### Comment Preview in DriveSection

- Expand a file row to see its unresolved comment threads inline
- Reply to comments from within the hub (requires upgrading to `drive` scope from `drive.readonly`)
- Comment count badge on file rows that have unresolved comments

#### Drive Activity Feed

- "Recent Activity" section showing doc edits, comments, and shares across the team
- Filterable by person, doc type, or activity type
- Integrates into the existing hub Recent Activity feed

---

## Success Metrics

### Leading Indicators (measure within 2 weeks)

- **Drive panel engagement:** >70% of daily hub visits include at least one Drive file click-through
- **Search usage:** >3 Drive searches per user per week
- **Re-auth completion:** >90% of existing Google-connected users complete re-auth within 1 week of deploy

### Lagging Indicators (measure at 30/60 days)

- **Context-switching reduction:** 30% fewer Drive tab opens per day (self-reported or measured via session analytics)
- **Time-to-doc:** Average time from "I need that doc" to opening it drops by 50% (hub search vs. navigating Drive)
- **Action item completion rate:** 15% improvement once Drive comments → tasks pipeline is live (Phase 2)

---

## Technical Dependencies

| Dependency | Status | Owner | Notes |
|-----------|--------|-------|-------|
| Google Drive OAuth scope | Done | — | Added to `/api/connect/google` |
| Drive adapter (`lib/google-drive.js`) | Done | — | `listDriveFiles`, `searchDriveFiles`, `getDriveFile`, `listFolderContents` |
| tRPC routes | Done | — | `driveRecentFiles`, `driveSearch`, `driveFile`, `driveFolderContents` |
| Token refresh | Done | — | Existing `getValidGoogleToken` flow, no changes |
| DriveSection component | Done | — | `components/hub/DriveSection.jsx` — file list, search, type filters, embedded editor |
| Hub page integration | Done | — | DriveSection on its own `/drive` page, linked in sidebar under "Tools" |
| Re-auth scope detection | Done | — | Banner prompts re-auth when Drive scope is missing |
| Google Cloud Console | **Verify** | Miso | Confirm `drive.readonly` scope is enabled in the GCP project's OAuth consent screen |

---

## Open Questions

| Question | Status | Resolution |
|----------|--------|------------|
| Where should the Drive panel live? | **Resolved** | Own page (`/drive`) in sidebar under "Tools", above footer |
| GCP scope verification? | **Action needed** | See `Google-Drive-Scope-Setup.md` for step-by-step |
| Phase 2 comments polling staleness? | **Resolved** | 5 minutes |
| File type filters visible by default? | **Resolved** | Behind a "Filter" toggle to keep UI clean |

---

## Implementation Plan

**Phase 1a (Complete):** DriveSection component on the hub page with file list, search, type filter chips, embedded Google editor panel, and re-auth prompt. Backend + frontend done.

**Phase 1b (Quick follow-up):** Folder browsing with breadcrumb nav, starred files quick access. All backend support already exists.

**Phase 2 (Future sprint):** Drive comments → tasks pipeline. Requires new Prisma model, cron job, and a scope decision on Comments API vs. Activity API.
