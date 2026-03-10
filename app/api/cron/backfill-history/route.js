/**
 * Cron / On-demand: Backfill Historical Tweet Data
 *
 * Pulls older tweets from TwitterAPI.io (paginated) and creates:
 *   1. Post records for each historical tweet
 *   2. PostMetrics snapshots with engagement data
 *   3. AccountMetrics entries (one per date a tweet was published)
 *
 * This populates the engagement trend and heatmap charts with historical data.
 *
 * Query params:
 *   ?maxPages=25  — how many pages of tweets to fetch per account (20 tweets/page)
 *   ?accountId=xx — optional, backfill only a specific account
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min for Vercel Pro

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const maxPages = parseInt(searchParams.get('maxPages') || '25', 10);
  const targetAccountId = searchParams.get('accountId') || null;

  const results = {
    accountsProcessed: 0,
    tweetsImported: 0,
    metricsCreated: 0,
    accountMetricsCreated: 0,
    totalTweetsFetched: 0,
    existingPostsSkipped: 0,
    existingMetricsSkipped: 0,
    debug: [],
    errors: [],
  };

  try {
    // Only use TwitterAPI.io (third-party) — no OAuth needed
    const apiKey = process.env.TWITTERAPI_IO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'TWITTERAPI_IO_API_KEY not configured' }, { status: 500 });
    }

    const where = { isActive: true, platform: 'X' };
    if (targetAccountId) where.id = targetAccountId;

    const activeAccounts = await prisma.account.findMany({ where });
    const systemUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

    for (const account of activeAccounts) {
      try {
        console.log(`[backfill] Starting for @${account.username} (maxPages=${maxPages})`);

        // Paginated fetch from TwitterAPI.io
        const { tweets, followerCount, followingCount } = await fetchTimelinePaginated(
          apiKey,
          account.username,
          maxPages
        );

        results.totalTweetsFetched += tweets.length;

        // For first account, do a raw API test to debug empty responses
        if (results.debug.length === 0) {
          try {
            const rawTestUrl = `https://api.twitterapi.io/twitter/user/last_tweets?userName=${account.username}`;
            const rawRes = await fetch(rawTestUrl, { headers: { 'X-API-Key': apiKey } });
            const rawText = await rawRes.text();
            const rawParsed = JSON.parse(rawText);
            results.debug.push({
              account: account.username,
              tweetsFetched: tweets.length,
              rawStatus: rawRes.status,
              rawKeys: Object.keys(rawParsed),
              rawTweetsLength: (rawParsed?.data?.tweets || rawParsed?.tweets)?.length,
              rawHasNextPage: rawParsed?.has_next_page,
              rawSample: (rawParsed?.data?.tweets || rawParsed?.tweets)?.[0] ? {
                id: (rawParsed.data?.tweets || rawParsed.tweets)[0].id,
                text: ((rawParsed.data?.tweets || rawParsed.tweets)[0].text || '').slice(0, 80),
                createdAt: (rawParsed.data?.tweets || rawParsed.tweets)[0].createdAt,
                viewCount: (rawParsed.data?.tweets || rawParsed.tweets)[0].viewCount,
              } : null,
              rawFirstChars: rawText.slice(0, 200),
              followerCount,
            });
          } catch (rawErr) {
            results.debug.push({
              account: account.username,
              rawError: rawErr.message,
            });
          }
        } else {
          results.debug.push({
            account: account.username,
            tweetsFetched: tweets.length,
            followerCount,
          });
        }

        console.log(`[backfill] Fetched ${tweets.length} tweets for @${account.username}`);

        // Track which dates we see tweets on (for AccountMetrics)
        const datesToMetrics = {};

        for (const tweet of tweets) {
          if (!tweet.id || !tweet.text) continue;

          const tweetId = String(tweet.id);
          const publishedAt = tweet.createdAt ? new Date(tweet.createdAt) : null;
          if (!publishedAt || isNaN(publishedAt.getTime())) continue;

          // Track this date for AccountMetrics
          const dateKey = publishedAt.toISOString().slice(0, 10);
          if (!datesToMetrics[dateKey]) {
            datesToMetrics[dateKey] = { postCount: 0 };
          }
          datesToMetrics[dateKey].postCount++;

          // Upsert Post record
          const existing = await prisma.post.findFirst({
            where: {
              accountId: account.id,
              platformPostId: tweetId,
            },
          });

          let postId;
          if (existing) {
            postId = existing.id;
            results.existingPostsSkipped++;
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

          // Check if we already have metrics for this post
          const existingMetrics = await prisma.postMetrics.findFirst({
            where: { postId },
          });

          if (existingMetrics) {
            results.existingMetricsSkipped++;
          }
          if (!existingMetrics) {
            // Extract engagement metrics from TwitterAPI.io response
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
        }

        // Create/update AccountMetrics for each date we saw tweets
        // IMPORTANT: Only write follower counts for TODAY's date.
        // TwitterAPI.io only returns current follower counts, not historical.
        // Writing today's count to past dates corrupts follower delta calculations.
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayStr = today.toISOString().slice(0, 10);

        for (const [dateStr, data] of Object.entries(datesToMetrics)) {
          const date = new Date(dateStr + 'T00:00:00.000Z');
          const isToday = dateStr === todayStr;

          try {
            await prisma.accountMetrics.upsert({
              where: {
                accountId_date: {
                  accountId: account.id,
                  date,
                },
              },
              update: {
                totalPosts: data.postCount,
                // Only update followers for today's record
                ...(isToday && followerCount > 0 ? { followers: followerCount, following: followingCount } : {}),
              },
              create: {
                accountId: account.id,
                date,
                // Only set followers for today; historical dates get 0 (unknown)
                followers: isToday ? followerCount : 0,
                following: isToday ? followingCount : 0,
                totalPosts: data.postCount,
              },
            });
            results.accountMetricsCreated++;
          } catch (e) {
            // Skip duplicates
          }
        }

        // Always ensure today has a follower snapshot even if no tweets today
        if (!datesToMetrics[todayStr] && followerCount > 0) {
          try {
            await prisma.accountMetrics.upsert({
              where: {
                accountId_date: { accountId: account.id, date: today },
              },
              update: { followers: followerCount, following: followingCount },
              create: {
                accountId: account.id,
                date: today,
                followers: followerCount,
                following: followingCount,
                totalPosts: 0,
              },
            });
            results.accountMetricsCreated++;
          } catch (e) {
            // Skip duplicates
          }
        }

        // Log API cost
        const pagesUsed = Math.ceil(tweets.length / 20);
        await prisma.aPICallLog.create({
          data: {
            provider: 'twitterapi_io',
            endpoint: 'backfill-history',
            method: 'GET',
            statusCode: 200,
            responseTime: 0,
            estimatedCost: (tweets.length / 1000) * 0.15, // $0.15 per 1K tweets
            accountId: account.id,
          },
        });

        results.accountsProcessed++;
        console.log(`[backfill] Done @${account.username}: ${tweets.length} tweets, ${results.tweetsImported} new`);
      } catch (accountError) {
        console.error(`[backfill] Error for account ${account.id}:`, accountError);
        results.errors.push({
          accountId: account.id,
          username: account.username,
          error: accountError.message,
        });
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('[backfill] Fatal error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

/**
 * Fetch paginated timeline from TwitterAPI.io.
 * Each page returns ~20 tweets with full engagement metrics.
 */
async function fetchTimelinePaginated(apiKey, username, maxPages = 25) {
  const baseUrl = 'https://api.twitterapi.io/twitter/user/last_tweets';
  const allTweets = [];
  let cursor = '';
  let followerCount = 0;
  let followingCount = 0;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ userName: username });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${baseUrl}?${params}`, {
      headers: { 'X-API-Key': apiKey },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(`TwitterAPI.io ${res.status}: ${errText}`);
    }

    const data = await res.json();

    // Debug: capture raw response keys on first page
    if (page === 0) {
      console.log(`[backfill] Raw response keys for @${username}:`, Object.keys(data));
      console.log(`[backfill] Raw tweets type:`, typeof data?.tweets, 'length:', data?.tweets?.length);
      // Check alternative field names
      if (!data?.tweets) {
        console.log(`[backfill] Full response (first 500 chars):`, JSON.stringify(data).slice(0, 500));
      }
    }

    // TwitterAPI.io nests tweets inside data.tweets (not top-level)
    const tweets = data?.data?.tweets || data?.tweets || [];
    if (!tweets.length) break;

    // Capture follower count from first tweet's author
    if (page === 0 && tweets[0]?.author) {
      followerCount = tweets[0].author.followers || 0;
      followingCount = tweets[0].author.following || 0;
    }

    allTweets.push(...tweets);

    // Log progress
    console.log(`[backfill] Page ${page + 1}: ${tweets.length} tweets (total: ${allTweets.length})`);

    // Check for next page — next_cursor is at top level
    if (data?.next_cursor) {
      cursor = data.next_cursor;
    } else {
      break;
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  return { tweets: allTweets, followerCount, followingCount };
}
