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

        if (account.platform === 'X') {
          const adapter = new XPlatformAdapter(token);
          const response = await adapter.getMentions(account.username);
          // TwitterAPI.io returns { tweets: [...] } or { data: [...] }
          rawMentions = response?.tweets || response?.data || [];
        } else if (account.platform === 'REDDIT') {
          const adapter = new RedditAdapter(token);
          const response = await adapter.getMentions();
          // Reddit returns { data: { children: [...] } }
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

            // Dedupe: check if mention already exists by author + content combo
            const existing = await prisma.mention.findFirst({
              where: {
                accountId: account.id,
                authorUsername: String(authorUsername),
                content: String(content),
              },
            });

            if (existing) continue;

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
                mentionType: 'MENTION',
                sourceUrl: sourceUrl ? String(sourceUrl) : null,
              },
            });

            // Create corresponding InboxItem
            await prisma.inboxItem.create({
              data: {
                accountId: account.id,
                platform: account.platform,
                itemType: 'MENTION',
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
