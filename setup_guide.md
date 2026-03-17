# Slack Ticket Logger — Setup Guide

A local automation workflow that captures Slack ticket form submissions via Zapier and appends them to a running Word document.

**Flow:** Slack Workflow Builder → Zapier Catch Hook → Zapier POST → ngrok → Local Python script → `.docx` file

---

## 1. Prerequisites

- **Python 3.8+** (check with `python3 --version`)
- **pip** (included with Python)
- Install dependencies:

```bash
pip install flask python-docx
```

---

## 2. Running the Script

```bash
cd ~/social\ command
python slack_ticket_logger.py
```

You should see:

```
Slack Ticket Logger running on http://localhost:5050
  POST /ticket  — Append a ticket
  GET  /health  — Health check
  Saving to: ~/social command/slack_tickets.docx
```

Test the health endpoint in another terminal:

```bash
curl http://localhost:5050/health
```

Test a sample ticket:

```bash
curl -X POST http://localhost:5050/ticket \
  -H "Content-Type: application/json" \
  -d '{"submitter": "Miso", "title": "Test ticket", "priority": "High", "description": "Just testing the webhook"}'
```

Open `~/social command/slack_tickets.docx` to confirm the entry was appended.

---

## 3. Exposing Locally via ngrok

Since Zapier needs a public URL to reach your local server, use ngrok to create a secure tunnel.

### Install ngrok

```bash
# macOS (Homebrew)
brew install ngrok

# Or download from https://ngrok.com/download
```

### Sign up and authenticate

1. Create a free account at [ngrok.com](https://ngrok.com)
2. Copy your auth token from the dashboard
3. Run:

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

### Start the tunnel

```bash
ngrok http 5050
```

ngrok will display a public URL like:

```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:5050
```

Your webhook endpoint is: `https://abc123.ngrok-free.app/ticket`

### Tip: Use a free static domain

Free ngrok accounts can claim one static domain so your URL doesn't change between sessions:

1. Go to **ngrok Dashboard → Cloud Edge → Domains**
2. Claim your free static domain (e.g., `your-name.ngrok-free.app`)
3. Run ngrok with:

```bash
ngrok http 5050 --url=your-name.ngrok-free.app
```

This gives you a stable URL you can set once in Zapier and never update.

---

## 4. Zapier Setup

### Step A: Create the Trigger (Catch Hook)

1. Go to [zapier.com](https://zapier.com) and create a new Zap
2. **Trigger app:** Webhooks by Zapier
3. **Trigger event:** Catch Hook
4. Click **Continue** — Zapier generates a webhook URL like:
   `https://hooks.zapier.com/hooks/catch/12345/abcdef/`
5. Copy this URL — you'll use it in Slack Workflow Builder (Step 5)
6. Send a test submission from Slack to populate sample data, then click **Test trigger**

### Step B: Create the Action (POST to your server)

1. **Action app:** Webhooks by Zapier
2. **Action event:** POST
3. Configure the action:
   - **URL:** Your ngrok URL + `/ticket` (e.g., `https://your-name.ngrok-free.app/ticket`)
   - **Payload Type:** json
   - **Data:** Map each Slack form field to a JSON key:

| Key           | Value (from Zapier trigger)         |
|---------------|-------------------------------------|
| `submitter`   | *Map to submitter field from Slack* |
| `title`       | *Map to title field from Slack*     |
| `description` | *Map to description field from Slack* |
| `priority`    | *Map to priority field from Slack*  |
| `channel`     | *Map to channel field from Slack*   |

   You can add or remove keys freely — the script captures all fields dynamically.

4. Click **Test action** to confirm a `200 OK` response
5. Turn on the Zap

---

## 5. Slack Workflow Builder

1. Open Slack and go to **Tools → Workflow Builder** (or search "Workflow Builder")
2. Click **Create Workflow** → choose a trigger (e.g., **Shortcut** so users can launch it from any channel)
3. Add a **Form** step with your desired fields:
   - Submitter Name (short text)
   - Ticket Title (short text)
   - Description (long text)
   - Priority (select: Low / Medium / High / Critical)
   - Any other fields you need
4. Add a **Send a Webhook** step:
   - **URL:** Paste the Zapier Catch Hook URL from Step 4A
   - **Method:** POST
   - **Body:** Map form variables into JSON:

```json
{
  "submitter": "{{Submitter Name}}",
  "title": "{{Ticket Title}}",
  "description": "{{Description}}",
  "priority": "{{Priority}}"
}
```

5. **Publish** the workflow
6. Test it by triggering the shortcut in Slack and filling out the form

---

## 6. Optional: Run on Startup

### macOS (launchd)

Create `~/Library/LaunchAgents/com.slackticketlogger.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.slackticketlogger</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/YOUR_USERNAME/social command/slack_ticket_logger.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/slack_ticket_logger.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/slack_ticket_logger_err.log</string>
</dict>
</plist>
```

Replace `YOUR_USERNAME` with your macOS username, then load it:

```bash
launchctl load ~/Library/LaunchAgents/com.slackticketlogger.plist
```

### Windows (Task Scheduler)

1. Open Task Scheduler → Create Basic Task
2. Name: "Slack Ticket Logger"
3. Trigger: "When the computer starts"
4. Action: Start a program
   - Program: `python`
   - Arguments: `C:\Users\YOUR_USERNAME\social command\slack_ticket_logger.py`
5. Finish and enable the task

---

## 7. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `Connection refused` on curl test | Script isn't running | Run `python slack_ticket_logger.py` and check for errors |
| ngrok shows `502 Bad Gateway` | Script isn't running or wrong port | Confirm script is on port 5050 and reachable locally |
| Zapier action fails with timeout | ngrok tunnel is down | Restart ngrok; use a static domain so the URL stays stable |
| Zapier action returns `404` | Wrong endpoint path | Make sure the URL ends with `/ticket` |
| `.docx` not updating | File permission issue | Check that `~/social command/` is writable |
| Empty fields in the document | Zapier field mapping is wrong | Re-map fields in the Zapier POST action; test with curl first |
| `ModuleNotFoundError: flask` | Dependencies not installed | Run `pip install flask python-docx` |
| Ticket logged but formatting looks off | Opened in a non-Word app | Open in Microsoft Word or Google Docs for best rendering |
| ngrok URL changed after restart | Free ngrok gives random URLs | Claim a free static domain in the ngrok dashboard |
| Script crashes on startup | Port 5050 already in use | Kill the other process: `lsof -i :5050` then `kill <PID>` |

---

## Architecture Diagram

```
┌──────────────────┐     ┌──────────────────┐     ┌───────────┐     ┌──────────────┐     ┌──────────────────┐
│  Slack Workflow   │────▶│  Zapier Catch     │────▶│  Zapier   │────▶│    ngrok      │────▶│  Flask Server    │
│  Builder Form     │     │  Hook (trigger)   │     │  POST     │     │  tunnel       │     │  localhost:5050  │
└──────────────────┘     └──────────────────┘     │  (action)  │     └───────────────┘     │                  │
                                                   └───────────┘                            │  ┌──────────┐   │
                                                                                            │  │ .docx    │   │
                                                                                            │  │ append   │   │
                                                                                            │  └──────────┘   │
                                                                                            └──────────────────┘
```
