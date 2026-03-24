/**
 * Cron: Daily Analytics
 * Schedule: 2:00 AM UTC daily (0 2 * * *)
 *
 * For each active account:
 *   1. Fetches current follower/following counts → upserts AccountMetrics
 *   2. Imports recent tweets as Post records (if not already tracked)
 *   3. Snapshots current metrics for each imported post → PostMetrics
 *
 * COST OPTIMIZATION: Uses TwitterAPI.io for ALL reads (~$0.15/1K requests)
 * instead of Official X API (~$100/mo for Basic tier). The Official X API
 * is only needed for writes (posting, liking, etc).
 *
 * TwitterAPI.io provides viewCount (impressions) which is equivalent
 * to non_public_metrics.impression_count from the Official API.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { twitterApiIoRequest } from '@/lib/twitter-api';
import { API_COSTS } from '@/lib/api-costs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const debugMode = searchParams.get('debug') === 'true';
  const results = { accountsProcessed: 0, tweetsImported: 0, metricsCreated: 0, errors: [], debug: [] };

  const apiKey = process.env.TWITTERAPI_IO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'TWITTERAPI_IO_API_KEY not configured' }, { status: 500 });
  }

  try {
    const activeAccounts = await prisma.account.findMany({
      where: { isActive: true },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let systemUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

    for (const account of activeAccounts) {
      try {
        if (account.platform === 'X') {
          // ── Use TwitterAPI.io for all reads (much cheaper) ──
          // Single timeline request gives us tweets + author follower data
          const timelineRes = await twitterApiIoRequest(apiKey, '/twitter/user/last_tweets', {
            userName: account.username,
          });

          // TwitterAPI.io nests tweets inside data.tweets
          const tweets = timelineRes?.data?.tweets || timelineRes?.tweets || [];

          // Extract follower/following from first tweet's author field.
          // TwitterAPI.io returns author.followers (int) and author.following (int).
          // Fallback: try user profile endpoint if timeline author data is missing.
          const author = tweets[0]?.author || {};
          let followers = author.followers || author.followersCount || author.follower_count || 0;
          let following = author.following || author.followingCount || author.friends_count || 0;

          // If timeline didn't yield follower data, fetch the profile directly
          if (followers === 0) {
            try {
              const profileRes = await twitterApiIoRequest(apiKey, '/twitter/user/profile_by_username', {
                userName: account.username,
              });
              const profile = profileRes?.data || profileRes || {};
              followers = profile.followers || profile.followersCount || profile.follower_count || 0;
              following = profile.following || profile.followingCount || profile.friends_count || 0;
            } catch (profileErr) {
              console.warn(`[daily-analytics] Profile fallback failed for @${account.username}:`, profileErr.message);
            }
          }

          if (followers === 0) {
            console.warn(`[daily-analytics] Could not resolve follower count for @${account.username} — timeline author and profile fallback both returned 0`);
            results.errors.push({ accountId: account.id, error: `Follower count 0 for @${account.username}` });
          }

          if (debugMode) {
            results.debug.push({
              account: account.username,
              tweetsCount: tweets.length,
              authorKeys: Object.keys(author),
              resolvedFollowers: followers,
              resolvedFollowing: following,
              usedProfileFallback: (author.followers || 0) === 0 && followers > 0,
            });
          }

          for (const tweet of tweets) {
            if (!tweet.id || !tweet.text) continue;

            const tweetId = String(tweet.id);
            const publishedAt = tweet.createdAt ? new Date(tweet.createdAt) : null;
            if (!publishedAt || isNaN(publishedAt.getTime())) continue;

            // Upsert Post record
            const existingPost = await prisma.post.findFirst({
              where: {
                accountId: account.id,
                platformPostId: tweetId,
              },
            });

            let postId;
            if (existingPost) {
              postId = existingPost.id;
            } else {
              const newPost = await prisma.post.create({
                data: {
                  accountId: account.id,
                  platform: 'X',
                  platformPostId: tweetId,
                  content: tweet.text,
                  contentType: 'POST',
                  status: 'PUBLISHED',
                  publishedAt,
                  createdById: systemUser.id,
                },
              });
              postId = newPost.id;
              results.tweetsImported++;
            }

            // Step 3: Create PostMetrics snapshot
            // TwitterAPI.io provides viewCount (same as non_public_metrics.impression_count)
            const impressions = tweet.viewCount || 0;
            const likes = tweet.likeCount || 0;
            const retweets = tweet.retweetCount || 0;
            const replies = tweet.replyCount || 0;
            const bookmarks = tweet.bookmarkCount || 0;
            const quotes = tweet.quoteCount || 0;
            const engagements = likes + retweets + replies + bookmarks + quotes;
            const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;

            await prisma.postMetrics.create({
              data: {
                postId,
                accountId: account.id,
                impressions,
                engagements,
                likes,
                retweets,
                replies,
                bookmarks,
                engagementRate,
              },
            });
            results.metricsCreated++;
          }

          // Upsert AccountMetrics — only write follower data when non-zero
          // to prevent overwriting valid historical counts with 0.
          // If followers=0, carry forward from the most recent valid snapshot.
          let createFollowers = followers;
          let createFollowing = following;
          if (followers === 0) {
            const lastValid = await prisma.accountMetrics.findFirst({
              where: { accountId: account.id, followers: { gt: 0 } },
              orderBy: { date: 'desc' },
            });
            if (lastValid) {
              createFollowers = lastValid.followers;
              createFollowing = lastValid.following ?? following;
            }
          }

          await prisma.accountMetrics.upsert({
            where: {
              accountId_date: {
                accountId: account.id,
                date: today,
              },
            },
            update: {
              totalPosts: tweets.length,
              ...(followers > 0 ? { followers, following } : {}),
            },
            create: {
              accountId: account.id,
              date: today,
              followers: createFollowers,
              following: createFollowing,
              totalPosts: tweets.length,
            },
          });

          // Log cost — summary entry for this account's daily analytics
          await prisma.aPICallLog.create({
            data: {
              provider: 'twitterapi_io',
              endpoint: 'daily-analytics',
              method: 'GET',
              statusCode: 200,
              responseTime: 0,
              estimatedCost: API_COSTS.TWITTERAPI_IO,
              accountId: account.id,
            },
          });
        } else if (account.platform === 'REDDIT') {
          // Skip Reddit if no adapter configured
          continue;
        }

        results.accountsProcessed++;
      } catch (accountError) {
        console.error(`Error fetching daily analytics for account ${account.id}:`, accountError);
        results.errors.push({
          accountId: account.id,
          error: accountError.message,
        });
      }
    }

    // ── Deduplicate ListeningHits ──
    // During the cron outage, Redis dedup keys expired and the same posts were
    // re-imported with fresh detectedAt timestamps. Keep oldest per platformPostId+topicId.
    try {
      // Find all platformPostId+topicId combos that have duplicates
      const dupes = await prisma.$queryRaw`
        SELECT "platformPostId", "topicId", COUNT(*) as cnt, MIN(id) as keep_id
        FROM listening_hits
        WHERE "platformPostId" IS NOT NULL
        GROUP BY "platformPostId", "topicId"
        HAVING COUNT(*) > 1
      `;

      if (dupes.length > 0) {
        const keepIds = dupes.map(d => d.keep_id);
        const dupePlatformPostIds = dupes.map(d => d.platformPostId);

        const deleted = await prisma.listeningHit.deleteMany({
          where: {
            platformPostId: { in: dupePlatformPostIds },
            id: { notIn: keepIds },
          },
        });
        console.log(`[daily-analytics] Deduped ${deleted.count} duplicate ListeningHits (${dupes.length} groups)`);
        results.listeningHitsDeduped = deleted.count;
      }
    } catch (dedupErr) {
      console.error('[daily-analytics] ListeningHit dedup failed:', dedupErr.message);
    }

    // ── Backfill null actionType on ListeningHits ──
    // Hits created before Phase 15 have actionType=null. Set to FYI so filters work.
    try {
      const backfilled = await prisma.listeningHit.updateMany({
        where: { actionType: null },
        data: { actionType: 'FYI' },
      });
      if (backfilled.count > 0) {
        console.log(`[daily-analytics] Backfilled ${backfilled.count} ListeningHits with actionType=FYI`);
        results.listeningHitsBackfilled = backfilled.count;
      }
    } catch (backfillErr) {
      console.error('[daily-analytics] ListeningHit actionType backfill failed:', backfillErr.message);
    }

    // ── APICallLog cleanup: purge miscounted failed calls ──
    // Fix: prior bug logged estimatedCost > 0 for non-2xx responses.
    // This deletes those phantom cost entries. Idempotent after first run.
    try {
      const purged = await prisma.aPICallLog.deleteMany({
        where: {
          OR: [
            { statusCode: { lt: 200 } },
            { statusCode: { gte: 300 } },
          ],
          estimatedCost: { gt: 0 },
        },
      });
      if (purged.count > 0) {
        console.log(`[daily-analytics] Purged ${purged.count} miscounted failed-call log entries`);
      }
    } catch (purgeErr) {
      console.error('[daily-analytics] Failed-call purge failed:', purgeErr.message);
    }

    // ── APICallLog retention: delete entries older than 30 days ──
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deleted = await prisma.aPICallLog.deleteMany({
        where: { timestamp: { lt: thirtyDaysAgo } },
      });
      console.log(`[daily-analytics] Cleaned up ${deleted.count} old APICallLog entries`);
    } catch (cleanupErr) {
      console.error('[daily-analytics] APICallLog cleanup failed:', cleanupErr.message);
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('daily-analytics cron error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

