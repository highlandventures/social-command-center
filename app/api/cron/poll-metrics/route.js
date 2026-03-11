/**
 * Cron: Poll Post Metrics
 * Schedule: Every 15 minutes (* /15 * * * *)
 *
 * Adaptive polling: fetches engagement metrics for published posts based on age.
 *   - Posts <2h old: always poll
 *   - Posts 2-48h old: poll (within cycle)
 *   - Posts >48h but <7d: only if last fetched >6h ago
 *   - Posts >7d: skip
 *
 * COST OPTIMIZATION: Uses TwitterAPI.io for reads (~$0.15/1K requests).
 * Fetches each user's timeline once per cycle, then matches post IDs
 * from the response. This is much cheaper than the Official X API.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function shouldPollPost(post, now) {
  const postAgeMs = now.getTime() - new Date(post.publishedAt).getTime();
  const lastFetch = post.metrics[0]?.fetchedAt;
  const timeSinceLastFetch = lastFetch
    ? now.getTime() - new Date(lastFetch).getTime()
    : Infinity;

  if (postAgeMs < TWO_HOURS_MS) return true;
  if (postAgeMs < FORTY_EIGHT_HOURS_MS) return true;
  if (postAgeMs < SEVEN_DAYS_MS) return timeSinceLastFetch > SIX_HOURS_MS;
  return false;
}

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.TWITTERAPI_IO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'TWITTERAPI_IO_API_KEY not configured' }, { status: 500 });
  }

  const results = { metricsFetched: 0, postsProcessed: 0, apiCalls: 0, errors: [] };

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

    const publishedPosts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        platformPostId: { not: null },
        publishedAt: { gte: sevenDaysAgo },
      },
      include: {
        account: true,
        metrics: {
          orderBy: { fetchedAt: 'desc' },
          take: 1,
        },
      },
    });

    const postsToPoll = publishedPosts.filter((p) => shouldPollPost(p, now));

    // Group X posts by account
    const xPostsByAccount = {};

    for (const post of postsToPoll) {
      if (post.account.platform === 'X') {
        const accountId = post.account.id;
        if (!xPostsByAccount[accountId]) {
          xPostsByAccount[accountId] = { account: post.account, posts: [] };
        }
        xPostsByAccount[accountId].posts.push(post);
      }
    }

    // --- FETCH VIA TwitterAPI.io (1 timeline request per account) ---
    for (const { account, posts } of Object.values(xPostsByAccount)) {
      try {
        // Fetch the user's recent timeline from TwitterAPI.io
        const url = new URL('https://api.twitterapi.io/twitter/user/last_tweets');
        url.searchParams.set('userName', account.username);

        const start = Date.now();
        const res = await fetch(url, {
          headers: { 'X-API-Key': apiKey },
        });

        await prisma.aPICallLog.create({
          data: {
            provider: 'twitterapi_io',
            endpoint: '/user/last_tweets',
            method: 'GET',
            statusCode: res.status,
            responseTime: Date.now() - start,
            estimatedCost: 0.00015,
            accountId: account.id,
          },
        });

        results.apiCalls++;

        if (!res.ok) {
          results.errors.push({ accountId: account.id, error: `TwitterAPI.io ${res.status}` });
          continue;
        }

        const data = await res.json();
        // TwitterAPI.io nests tweets inside data.tweets
        const tweets = data?.data?.tweets || data?.tweets || [];

        // Opportunistically snapshot follower count from the timeline response
        // we already paid for. This keeps follower data fresh every 15 min
        // instead of relying solely on the daily-analytics cron at 2 AM.
        if (tweets[0]?.author) {
          const a = tweets[0].author;
          const followers = a.followers || a.followersCount || a.follower_count || 0;
          const following = a.following || a.followingCount || a.friends_count || 0;
          if (followers > 0) {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            try {
              await prisma.accountMetrics.upsert({
                where: {
                  accountId_date: { accountId: account.id, date: today },
                },
                update: { followers, following },
                create: {
                  accountId: account.id,
                  date: today,
                  followers,
                  following,
                  totalPosts: 0,
                },
              });
            } catch (e) {
              // Non-critical — don't fail the whole metrics poll for a follower snapshot
            }
          }
        }

        // Build a map of tweet ID → engagement data
        const tweetMap = {};
        for (const tweet of tweets) {
          if (tweet.id) tweetMap[String(tweet.id)] = tweet;
        }

        // Match against posts we need to poll
        for (const post of posts) {
          try {
            const tweet = tweetMap[post.platformPostId];
            if (!tweet) continue;

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
                postId: post.id,
                accountId: post.accountId,
                impressions,
                engagements,
                likes,
                retweets,
                replies,
                bookmarks,
                engagementRate,
              },
            });

            results.metricsFetched++;
            results.postsProcessed++;
          } catch (postError) {
            console.error(`Error storing metrics for post ${post.id}:`, postError);
            results.errors.push({ postId: post.id, error: postError.message });
          }
        }
      } catch (accountError) {
        console.error(`Error processing X account ${account.id}:`, accountError);
        results.errors.push({ accountId: account.id, error: accountError.message });
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('poll-metrics cron error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
