# Notion Task Inbox Setup

No workspace admin access needed. No Notion API key needed in the app.

## How It Works

```
Team files task in Social Command → Saved to app database (instant)
                                          ↓
                              Claude scheduled job (every 5 min)
                                          ↓
                              Creates page in Notion Task Inbox
                                          ↓
                              Notion automation copies to Marketing Tasks
```

---

## Step 1: Run the Prisma Migration

The new `NotionTaskInbox` model needs to be added to the database:

```bash
cd apps/social
npx prisma migrate dev --name add-notion-task-inbox
```

For production (Vercel):
```bash
npx prisma migrate deploy
```

## Step 2: Add a CRON_SECRET Environment Variable

This protects the sync API endpoint. Generate a random secret and add it to Vercel:

| Variable | Value |
|---|---|
| `CRON_SECRET` | Any random string (e.g. `openssl rand -hex 32`) |

Then update the scheduled task in Claude (Scheduled section in sidebar → sync-tasks-to-notion) to replace `REPLACE_WITH_CRON_SECRET` in the prompt with your actual secret.

## Step 3: Set Up the Notion Automation

This copies tasks from your Task Inbox into the main Marketing Tasks database:

1. Open the [Task Inbox database](https://www.notion.so/c0a81c67896c46db96540c18cdc43917) in Notion
2. Click the **lightning bolt** icon (Automations)
3. Click **"New automation"**
4. **Trigger:** "When a page is added"
5. **Action:** "Create page in" → select **Marketing Tasks**
6. **Map properties:**
   - Task name → Task name
   - Status → Status
   - Due → Due
   - Product → Product
   - Channel → Channel
   - Audience → Audience
   - Social Channel → Social Channel
   - Priority → Review Priority
   - Notes → Notes
   - Summary → Summary
7. Click **Save**

## Step 4: Deploy & Test

1. Push the code changes and let Vercel deploy
2. Open Social Command → hamburger menu → **Marketing Tasks**
3. Click **"New Task"** and file a test task
4. It saves instantly to the app
5. Within 5 minutes, the scheduled sync pushes it to Notion Task Inbox
6. The Notion automation copies it to Marketing Tasks

---

## Files Changed

| File | What |
|---|---|
| `prisma/schema.prisma` | New `NotionTaskInbox` model |
| `lib/notion-tasks.js` | Prisma-backed adapter (no Notion API) |
| `lib/routers/notion-tasks.js` | tRPC routes for create/list/update |
| `lib/routers/app.js` | Registered `notionTasks` router |
| `components/hub/NotionTasksSection.jsx` | Full UI: form + task list + filters |
| `app/(hub)/notion-tasks/page.jsx` | Page route |
| `app/(hub)/layout.jsx` | Sidebar link |
| `app/api/cron/notion-sync/route.js` | Sync API endpoint |
