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
          const timelineRes = await twitterApiIoRequest(apiKey, '/user/last_tweets', {
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
              const profileRes = await twitterApiIoRequest(apiKey, '/user/profile_by_username', {
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

          // Log cost — TwitterAPI.io: 1 timeline request = ~$0.00015
          await prisma.aPICallLog.create({
            data: {
              provider: 'twitterapi_io',
              endpoint: 'daily-analytics',
              method: 'GET',
              statusCode: 200,
              responseTime: 0,
              estimatedCost: 0.00015, // ~$0.15/1K requests x 1 request
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

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('daily-analytics cron error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

/**
 * Simple TwitterAPI.io request helper — avoids importing the full adapter
 * and the OAuth token dependency (TwitterAPI.io uses API key auth only).
 */
async function twitterApiIoRequest(apiKey, path, params = {}) {
  const url = new URL(`https://api.twitterapi.io/twitter${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

  const start = Date.now();
  const res = await fetch(url, {
    headers: { 'X-API-Key': apiKey },
  });

  // Track in API call log
  await prisma.aPICallLog.create({
    data: {
      provider: 'twitterapi_io',
      endpoint: path,
      method: 'GET',
      statusCode: res.status,
      responseTime: Date.now() - start,
      estimatedCost: 0.00015,
    },
  });

  if (!res.ok) {
    throw new Error(`TwitterAPI.io ${res.status}: ${await res.text().catch(() => 'unknown')}`);
  }
  return res.json();
}
