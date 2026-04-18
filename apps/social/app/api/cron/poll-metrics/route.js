/**
 * Cron: Poll Post Metrics + Discover New Tweets
 * Schedule: Every 15 minutes (* /15 * * * *)
 *
 * Two responsibilities:
 * 1. METRICS POLLING — adaptive engagement updates for tracked posts:
 *      - Posts <2h old: always poll
 *      - Posts 2-48h old: poll (within cycle)
 *      - Posts >48h but <7d: only if last fetched >6h ago
 *      - Posts >7d: skip
 * 2. TWEET DISCOVERY — any tweet in the timeline response that isn't in the
 *    database gets auto-imported as a PUBLISHED post with an initial metrics
 *    snapshot. This keeps the dashboard current without running backfill.
 *
 * COST OPTIMIZATION: Uses TwitterAPI.io for reads (~$0.15/1K requests).
 * Fetches each user's timeline once per cycle, then matches post IDs
 * from the response. This is much cheaper than the Official X API.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { twitterApiIoRequest } from '@/lib/twitter-api';
import { createWithArtifact } from '@/lib/artifacts/create';
import { ARTIFACT_MODULE, ARTIFACT_TYPE } from '@/lib/artifacts/types';

export const dynamic = 'force-dynamic';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Phase 17-03 Task 3 — "Option D" threshold-gated 30d window.
// Posts that went meaningfully viral keep accruing engagement past 7d, so we
// continue polling them through 30d at a 24h cadence. Low-performers stop at
// 7d to bound API cost. Threshold tunable here; revisit with production data.
// See .planning/phases/17-artifact-graph-foundation/17-03-PLAN.md
const HIGH_PERFORMER_IMPRESSIONS_THRESHOLD = 5000;

function isHighPerformer(post) {
  // `post.metrics` may arrive as the single most-recent snapshot OR the
  // full series (when caller asks). Peak-of-impressions-seen is the signal.
  if (!Array.isArray(post.metrics)) return false;
  let peak = 0;
  for (const m of post.metrics) {
    if ((m?.impressions || 0) > peak) peak = m.impressions;
  }
  return peak >= HIGH_PERFORMER_IMPRESSIONS_THRESHOLD;
}

function shouldPollPost(post, now) {
  const postAgeMs = now.getTime() - new Date(post.publishedAt).getTime();
  const lastFetch = post.metrics[0]?.fetchedAt;
  const timeSinceLastFetch = lastFetch
    ? now.getTime() - new Date(lastFetch).getTime()
    : Infinity;

  if (postAgeMs < TWO_HOURS_MS) return true;
  if (postAgeMs < FORTY_EIGHT_HOURS_MS) return true;
  if (postAgeMs < SEVEN_DAYS_MS) return timeSinceLastFetch > SIX_HOURS_MS;
  if (postAgeMs < THIRTY_DAYS_MS) {
    return isHighPerformer(post) && timeSinceLastFetch > TWENTY_FOUR_HOURS_MS;
  }
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

  const results = { metricsFetched: 0, postsProcessed: 0, apiCalls: 0, followerSnapshots: 0, newPostsDiscovered: 0, fallbackFetches: 0, errors: [] };

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

    // Get ALL active X accounts so we can snapshot followers for all of them,
    // not just accounts that happen to have recent posts.
    const allXAccounts = await prisma.account.findMany({
      where: { isActive: true, platform: 'X' },
    });

    // 30d window (was 7d). Posts 7–30d only poll via the high-performer gate
    // inside shouldPollPost(). We pull the full metrics series so isHighPerformer
    // can compute peak impressions without a second query.
    const publishedPosts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        platformPostId: { not: null },
        publishedAt: { gte: thirtyDaysAgo },
      },
      include: {
        account: true,
        metrics: {
          orderBy: { fetchedAt: 'desc' },
          take: 10,
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

    // Ensure ALL active X accounts are included (even those with no recent posts)
    // so their followers get snapshotted every 15 minutes.
    for (const account of allXAccounts) {
      if (!xPostsByAccount[account.id]) {
        xPostsByAccount[account.id] = { account, posts: [] };
      }
    }

    // System user for auto-discovered posts (queried once, not per-account)
    const systemUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });

    // --- FETCH VIA TwitterAPI.io (1 timeline request per account) ---
    for (const { account, posts } of Object.values(xPostsByAccount)) {
      try {
        // Fetch the user's recent timeline from TwitterAPI.io
        const data = await twitterApiIoRequest(
          apiKey,
          '/twitter/user/last_tweets',
          { userName: account.username },
          { accountId: account.id },
        );

        results.apiCalls++;
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
              results.followerSnapshots++;
            } catch (e) {
              // Non-critical — don't fail the whole metrics poll for a follower snapshot
              console.warn(`[poll-metrics] Follower snapshot failed for account ${account.id} (@${account.username}):`, e.message);
              results.errors.push({ accountId: account.id, error: `Follower snapshot: ${e.message}` });
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
                quotes,
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

        // --- Per-tweet fallback fetch for 7–30d high-performers not in timeline ---
        // The recent timeline (`last_tweets`) returns ~20 most recent tweets, so
        // posts aged past ~1–2 weeks won't match. For high-performer posts still
        // accruing impressions, fall back to a per-tweet lookup.
        //
        // TODO(phase-17-03): confirm the exact TwitterAPI.io per-tweet endpoint
        // path (e.g. `/twitter/tweets?ids=...` or `/twitter/tweet/:id`) against
        // https://twitterapi.io/docs or an existing call in the repo and
        // implement the fetch below. Until then this is a logged no-op so the
        // threshold-gated 7–30d window at least stops polling for cost control,
        // even though the fallback update is deferred.
        const needsFallback = posts.filter((p) => {
          const ageMs = now.getTime() - new Date(p.publishedAt).getTime();
          return ageMs > SEVEN_DAYS_MS && ageMs < THIRTY_DAYS_MS && !tweetMap[p.platformPostId] && isHighPerformer(p);
        });
        if (needsFallback.length > 0) {
          console.log(
            `[poll-metrics] ${needsFallback.length} high-performer post(s) aged 7–30d skipped pending per-tweet fallback endpoint (TODO phase-17-03)`,
          );
          results.fallbackFetches += 0; // bump to needsFallback.length once the fallback is wired.
        }

        // --- Discover new tweets not yet in the database ---
        // We already have the timeline response; check for tweets we don't track yet.
        const knownPlatformIds = new Set(
          (await prisma.post.findMany({
            where: { accountId: account.id, platformPostId: { not: null } },
            select: { platformPostId: true },
          })).map((p) => p.platformPostId)
        );

        for (const tweet of tweets) {
          const tweetId = String(tweet.id);
          if (!tweetId || !tweet.text || knownPlatformIds.has(tweetId)) continue;

          const publishedAt = tweet.createdAt ? new Date(tweet.createdAt) : null;
          if (!publishedAt || isNaN(publishedAt.getTime())) continue;

          try {
            const { moduleRow: newPost } = await createWithArtifact(prisma, {
              module: ARTIFACT_MODULE.SOCIAL,
              type: ARTIFACT_TYPE.POST,
              prismaModel: 'post',
              title: String(tweet.text).slice(0, 120),
              ownerId: systemUser.id,
              status: 'PUBLISHED',
              moduleCreate: (tx) =>
                tx.post.create({
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
                }),
            });

            // Create initial metrics snapshot
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
                postId: newPost.id,
                accountId: account.id,
                impressions,
                engagements,
                likes,
                retweets,
                replies,
                bookmarks,
                quotes,
                engagementRate,
              },
            });

            results.newPostsDiscovered++;
            knownPlatformIds.add(tweetId);
          } catch (discoverError) {
            // Skip duplicates from race conditions
            if (!discoverError.message?.includes('Unique constraint')) {
              console.error(`[poll-metrics] Error discovering tweet ${tweetId}:`, discoverError.message);
              results.errors.push({ tweetId, error: discoverError.message });
            }
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
