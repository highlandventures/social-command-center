/**
 * Notion Integration Adapter — Zapier Webhook Bridge
 *
 * Instead of calling the Notion API directly (requires enterprise admin
 * to create an internal integration), this adapter sends structured
 * payloads to a Zapier Catch Hook. Zapier then forwards them to Notion.
 *
 * Outbound (app → Zapier → Notion): sendReviewStatus, sendComment
 * Inbound (Notion → Zapier → app): handled by /api/webhooks/notion-comments
 */

const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL;

/**
 * Send a review status update to Zapier (which updates the Notion page).
 * @param {string} postId - Internal post ID
 * @param {string} notionPageId - Notion page ID for this post
 * @param {'Pending Review'|'Approved'|'Changes Requested'|'Rejected'} status
 * @param {string} [appReviewUrl] - Link back to the in-app review page
 */
export async function sendReviewStatus(postId, notionPageId, status, appReviewUrl) {
  return sendWebhook({
    event: 'review_status_changed',
    postId,
    notionPageId,
    status,
    appReviewUrl: appReviewUrl || null,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send a comment to Zapier (which adds it as a Notion comment).
 * @param {string} postId - Internal post ID
 * @param {string} notionPageId - Notion page ID for this post
 * @param {string} authorName - Who wrote the comment in the app
 * @param {string} content - Comment text
 */
export async function sendComment(postId, notionPageId, authorName, content) {
  return sendWebhook({
    event: 'comment_added',
    postId,
    notionPageId,
    authorName,
    content,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Check if Zapier integration is configured.
 */
export function isConfigured() {
  return !!ZAPIER_WEBHOOK_URL;
}

// ---- Internal ----

async function sendWebhook(payload) {
  if (!ZAPIER_WEBHOOK_URL) return null;

  const res = await fetch(ZAPIER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`Zapier webhook failed (${res.status}):`, await res.text().catch(() => ''));
  }

  return { ok: res.ok, status: res.status };
}
