/**
 * Cron Job Monitoring & Alerting
 *
 * Provides a wrapper for cron job handlers that:
 * 1. Logs success/failure to APICallLog
 * 2. Sends Slack notifications on failures (if SLACK_WEBHOOK_URL is set)
 * 3. Tracks execution time and error details
 *
 * Usage in a cron route:
 *   import { withCronMonitor } from '@/lib/cron-monitor';
 *   export const GET = withCronMonitor('publish-scheduled', async () => {
 *     // ... your cron logic
 *     return { published: 5 };
 *   });
 */

import { prisma } from './db';
import { verifyCronAuth } from './cron-auth';

/**
 * Wrap a cron handler with monitoring, auth, and alerting.
 *
 * @param {string} jobName - Identifier for this cron job (e.g. 'publish-scheduled')
 * @param {Function} handler - Async function that performs the cron work. Can return a result object for logging.
 * @returns {Function} Next.js route handler (GET)
 */
export function withCronMonitor(jobName, handler) {
  return async function monitoredCronHandler(request) {
    // ── Auth check ──
    if (!verifyCronAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const startTime = Date.now();
    let statusCode = 200;
    let result = null;
    let errorMessage = null;

    try {
      result = await handler(request);
    } catch (error) {
      statusCode = 500;
      errorMessage = error?.message || 'Unknown error';
      console.error(`[CRON:${jobName}] Failed:`, error);

      // ── Send Slack alert ──
      await sendSlackAlert(jobName, error).catch((slackErr) => {
        console.error(`[CRON:${jobName}] Slack alert failed:`, slackErr);
      });
    }

    // ── Log to APICallLog ──
    const responseTime = Date.now() - startTime;
    try {
      await prisma.aPICallLog.create({
        data: {
          provider: 'cron',
          endpoint: jobName,
          method: 'CRON',
          statusCode,
          responseTime,
          estimatedCost: 0,
        },
      });
    } catch (logErr) {
      console.error(`[CRON:${jobName}] Failed to log execution:`, logErr);
    }

    // ── Response ──
    if (statusCode === 500) {
      return new Response(
        JSON.stringify({ error: errorMessage, job: jobName, duration: responseTime }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, job: jobName, duration: responseTime, result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };
}

/**
 * Send a failure alert to Slack via webhook.
 *
 * @param {string} jobName
 * @param {Error} error
 */
async function sendSlackAlert(jobName, error) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return; // No webhook configured, skip silently

  const env = process.env.VERCEL_ENV || 'development';
  const timestamp = new Date().toISOString();

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `\u26A0\uFE0F Cron Job Failure: ${jobName}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Job:*\n\`${jobName}\`` },
          { type: 'mrkdwn', text: `*Environment:*\n\`${env}\`` },
          { type: 'mrkdwn', text: `*Time:*\n${timestamp}` },
          { type: 'mrkdwn', text: `*Error:*\n\`${error?.message?.slice(0, 200) || 'Unknown'}\`` },
        ],
      },
    ],
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Query recent cron failures from APICallLog.
 * Useful for the admin dashboard.
 *
 * @param {number} hours - Look back window in hours (default 24)
 * @returns {Promise<Array>} Recent cron failures
 */
export async function getRecentCronFailures(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return prisma.aPICallLog.findMany({
    where: {
      provider: 'cron',
      statusCode: { gte: 400 },
      timestamp: { gte: since },
    },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });
}
