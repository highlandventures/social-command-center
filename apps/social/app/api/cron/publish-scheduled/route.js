/**
 * Cron: Publish Scheduled Posts
 * Schedule: Every minute (* * * * *)
 *
 * Picks up posts with status SCHEDULED whose scheduledFor <= now,
 * publishes them via the appropriate platform adapter, and updates status.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getValidToken } from '@/lib/token-refresh';
import { XPlatformAdapter } from '@/lib/x-adapter';
import { publishRedditPost, listLateAccounts } from '@/lib/late-reddit';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { published: 0, failed: 0, errors: [] };

  try {
    // Fetch all posts that are due for publishing
    const duePosts = await prisma.post.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: { lte: new Date() },
      },
      include: {
        account: true,
        threadPosts: {
          orderBy: { threadPosition: 'asc' },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    for (const post of duePosts) {
      try {
        const token = await getValidToken(post.account);
        let platformPostId = null;

        if (post.account.platform === 'X') {
          const adapter = new XPlatformAdapter(token);

          if (post.contentType === 'THREAD') {
            // Publish thread: main post + children in order
            const threadContents = [post.content];
            for (const child of post.threadPosts) {
              threadContents.push(child.content);
            }

            const publishedThread = await adapter.publishThread(threadContents);
            platformPostId = publishedThread[0]?.data?.id || null;

            // Update child posts with their platform IDs and status
            for (let i = 0; i < post.threadPosts.length; i++) {
              const childPlatformId = publishedThread[i + 1]?.data?.id || null;
              await prisma.post.update({
                where: { id: post.threadPosts[i].id },
                data: {
                  status: 'PUBLISHED',
                  publishedAt: new Date(),
                  platformPostId: childPlatformId,
                },
              });
            }
          } else if (post.contentType === 'ARTICLE') {
            const result = await adapter.publishArticle(post.articleTitle || '', post.content);
            platformPostId = result?.data?.id || null;
          } else {
            // Standard POST
            const result = await adapter.publishTweet(post.content);
            platformPostId = result?.data?.id || null;
          }
        } else if (post.account.platform === 'REDDIT') {
          // Publish via Late API (no direct Reddit OAuth needed)
          const lateAccounts = await listLateAccounts();
          const redditAccount = (lateAccounts?.data || lateAccounts || [])
            .find((a) => a.platform === 'reddit');

          if (!redditAccount) {
            throw new Error('No Reddit account connected in Late.');
          }

          const title = post.articleTitle || post.content.substring(0, 100);
          const result = await publishRedditPost({
            accountId: redditAccount._id || redditAccount.id,
            subreddit: post.subreddit || 'FigureTech',
            title,
            content: post.content,
            flairId: post.flairId || undefined,
          });

          platformPostId = result?._id || result?.id || null;
        }

        // Update the main post status to PUBLISHED
        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            platformPostId,
          },
        });

        // Log to AuditLog
        await prisma.auditLog.create({
          data: {
            userId: post.createdById,
            action: 'post.published',
            target: post.id,
            metadata: {
              platform: post.account.platform,
              contentType: post.contentType,
              platformPostId,
            },
          },
        });

        results.published++;
      } catch (postError) {
        console.error(`Failed to publish post ${post.id}:`, postError);

        // Mark as FAILED
        await prisma.post.update({
          where: { id: post.id },
          data: { status: 'FAILED' },
        });

        // Log failure to AuditLog
        await prisma.auditLog.create({
          data: {
            userId: post.createdById,
            action: 'post.publish_failed',
            target: post.id,
            metadata: {
              platform: post.account.platform,
              error: postError.message,
            },
          },
        });

        results.failed++;
        results.errors.push({ postId: post.id, error: postError.message });
      }
    }

    return NextResponse.json({
      ok: true,
      ...results,
      total: duePosts.length,
    });
  } catch (error) {
    console.error('publish-scheduled cron error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
