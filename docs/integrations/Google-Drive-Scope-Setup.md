# Google Drive Scope Verification — Setup Instructions

## Why This Is Needed

We added `drive.readonly` to the Social Command Hub's Google OAuth flow. For this to work, the scope must also be registered in your Google Cloud Console project. If it's not, Google will **silently ignore** the scope during OAuth — the user completes the flow without errors, but the token won't have Drive access, and all Drive API calls will return 403.

---

## Steps

### 1. Open the Google Cloud Console

Go to [console.cloud.google.com](https://console.cloud.google.com) and select the project used for Social Command Hub (check your `GOOGLE_CLIENT_ID` env var if you're unsure which project).

### 2. Navigate to OAuth Consent Screen

**APIs & Services** → **OAuth consent screen** (left sidebar)

### 3. Check Scopes

Click **Edit App** → scroll to the **Scopes** step (Step 2).

Look for these scopes in the list:

| Scope | Should Be Present |
|-------|:--:|
| `https://www.googleapis.com/auth/gmail.readonly` | Yes (existing) |
| `https://www.googleapis.com/auth/calendar.readonly` | Yes (existing) |
| `https://www.googleapis.com/auth/drive.readonly` | **Add if missing** |
| `openid` | Yes (existing) |
| `email` | Yes (existing) |

### 4. Add `drive.readonly` If Missing

1. Click **Add or Remove Scopes**
2. In the filter/search box, type `drive.readonly`
3. Check the box for `https://www.googleapis.com/auth/drive.readonly`
4. Click **Update** → **Save and Continue**

**Note:** `drive.readonly` is classified as a **"restricted" scope** by Google. If your app is in production (published), this will trigger a re-verification requirement. If the app is still in "Testing" mode, it works immediately but only for test users listed in the consent screen.

### 5. Verify App Status

On the consent screen overview, check:

- **Publishing status:** If "In production" → Google may require a security assessment for the new restricted scope. If "Testing" → it works immediately for listed test users.
- **User type:** Should be "Internal" if this is an org-only app on Google Workspace. Internal apps skip verification entirely.

**If your Google Workspace org has the app set to "Internal"**, you're good — no verification needed. The scope takes effect immediately for all org members.

### 6. Users Must Reconnect

Existing users who already connected Google need to re-authorize to pick up the new scope. The hub will show a blue "Reconnect" banner when it detects Drive access is missing. Clicking it takes them through the OAuth flow again, which now requests `drive.readonly` alongside the existing scopes.

---

## Verifying It Worked

After a user reconnects:

1. Check the `GoogleOAuthToken` record in your database
2. The `scopes` field should now include `https://www.googleapis.com/auth/drive.readonly`
3. The Drive panel in the hub should load files without errors

If the `scopes` field doesn't include `drive.readonly` after re-auth, the scope wasn't registered correctly in GCP — go back to Step 3.

---

## Quick Reference

| What | Where |
|------|-------|
| GCP Console | [console.cloud.google.com](https://console.cloud.google.com) |
| OAuth Consent Screen | APIs & Services → OAuth consent screen |
| Scope to add | `https://www.googleapis.com/auth/drive.readonly` |
| Hub OAuth route | `apps/social/app/api/connect/google/route.js` |
| Token storage | `GoogleOAuthToken` table, `scopes` column |
| Re-auth prompt | `DriveSection.jsx` → `DriveReauthBanner` component |
