/**
 * Cron: Poll Mentions
 * Schedule: Every 5 minutes (* /5 * * * *)
 *
 * For each active social account, fetches new mentions from the platform
 * and creates Mention + InboxItem records for any that don't already exist.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getValidToken } from '@/lib/token-refresh';
import { XPlatformAdapter } from '@/lib/x-adapter';
import { RedditAdapter } from '@/lib/reddit-adapter';
import { classifyMention } from '@/lib/mention-classifier';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { newMentions: 0, accountsProcessed: 0, errors: [] };

  try {
    const activeAccounts = await prisma.account.findMany({
      where: { isActive: true },
    });

    for (const account of activeAccounts) {
      try {
        const token = await getValidToken(account);
        let rawMentions = [];
        let newHighWaterMark = null; // platform id of the newest mention seen this run

        if (account.platform === 'X') {
          const adapter = new XPlatformAdapter(token);
          // sinceId = account.lastMentionId: search stops once we see the tweet we saw last
          // run, so we only pull genuinely new mentions. Without this, we'd re-scan the top
          // ~20 every 5 min and lose anything that bursts past the window between runs.
          const response = await adapter.getMentions(account.username, {
            sinceId: account.lastMentionId || undefined,
            maxPages: 5,
          });
          rawMentions = response?.tweets || response?.data || [];
          newHighWaterMark = response?.latestId || null;
        } else if (account.platform === 'REDDIT') {
          const adapter = new RedditAdapter(token);
          const response = await adapter.getMentions();
          rawMentions = response?.data?.children?.map((c) => c.data) || [];
        }

        for (const mention of rawMentions) {
          try {
            const authorUsername =
              mention.author?.userName ||
              mention.author?.username ||
              mention.author ||
              mention.user?.screen_name ||
              'unknown';
            const content =
              mention.text ||
              mention.body ||
              mention.full_text ||
              '';
            const sourceUrl =
              mention.url ||
              mention.permalink ||
              null;
            const platformMentionId =
              mention.id ||
              mention.id_str ||
              mention.name ||
              null;

            // Dedupe: prefer platformMentionId when present (one row per unique platform
            // post id). Fall back to (author, content) which can collide when two people
            // quote-tweet the same text, but better than nothing when the API doesn't
            // surface an id (very rare).
            const existing = platformMentionId
              ? await prisma.mention.findFirst({
                  where: {
                    accountId: account.id,
                    platformMentionId: String(platformMentionId),
                  },
                })
              : await prisma.mention.findFirst({
                  where: {
                    accountId: account.id,
                    authorUsername: String(authorUsername),
                    content: String(content),
                  },
                });

            if (existing) continue;

            // Classify mention type from raw API payload
            const mentionType = classifyMention(account.platform, mention);

            // Create Mention record
            const newMention = await prisma.mention.create({
              data: {
                accountId: account.id,
                platform: account.platform,
                platformMentionId: platformMentionId ? String(platformMentionId) : null,
                authorUsername: String(authorUsername),
                authorDisplayName:
                  mention.author?.name ||
                  mention.author?.displayName ||
                  mention.author_fullname ||
                  null,
                content: String(content),
                mentionType,
                sourceUrl: sourceUrl ? String(sourceUrl) : null,
              },
            });

            // Map mention types to inbox item types
            const inboxItemType = mentionType === 'DM' ? 'DM' : 'MENTION';

            // Create corresponding InboxItem
            await prisma.inboxItem.create({
              data: {
                accountId: account.id,
                platform: account.platform,
                itemType: inboxItemType,
                fromUsername: String(authorUsername),
                content: String(content),
              },
            });

            results.newMentions++;
          } catch (mentionError) {
            console.error(
              `Error processing mention for account ${account.id}:`,
              mentionError,
            );
          }
        }

        // Persist the new high-water mark so next run's search starts from here.
        if (newHighWaterMark && newHighWaterMark !== account.lastMentionId) {
          await prisma.account.update({
            where: { id: account.id },
            data: { lastMentionId: newHighWaterMark, lastMentionSyncAt: new Date() },
          });
        }

        results.accountsProcessed++;
      } catch (accountError) {
        console.error(
          `Error polling mentions for account ${account.id}:`,
          accountError,
        );
        results.errors.push({
          accountId: account.id,
          error: accountError.message,
        });
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('poll-mentions cron error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
