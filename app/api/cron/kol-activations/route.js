/**
 * Cron: KOL Activations
 * Schedule: Every 30 minutes (* /30 * * * *)
 *
 * For each active KOL, searches for brand mentions by the KOL
 * and creates KOLActivation records for newly detected activations.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { XPlatformAdapter } from '@/lib/x-adapter';
import { RedditAdapter } from '@/lib/reddit-adapter';
import { API_COSTS } from '@/lib/api-costs';

export const dynamic = 'force-dynamic';

/**
 * Simple keyword-based sentiment for KOL activations.
 */
const POSITIVE_SIGNALS = /🔥|🚀|bullish|excited|congrats|love|great|awesome|amazing|milestone|game.?changer|killer|moon|let'?s go|lfg|gm|onward|upward|\+\d+%/i;
const NEGATIVE_SIGNALS = /bearish|scam|dump|rug|concerned|disappointed|worried|overvalued|fud|sell|warning|avoid|crash|decline/i;

function classifySentiment(content) {
  if (!content) return null;
  const pos = POSITIVE_SIGNALS.test(content);
  const neg = NEGATIVE_SIGNALS.test(content);
  if (pos && !neg) return 'POSITIVE';
  if (neg && !pos) return 'NEGATIVE';
  return 'NEUTRAL';
}

/**
 * Determine the activation type based on the raw hit data.
 */
function classifyActivation(hit) {
  if (hit.referenced_tweets) {
    const refTypes = hit.referenced_tweets.map((r) => r.type);
    if (refTypes.includes('retweeted')) return 'RETWEET';
    if (refTypes.includes('quoted')) return 'QUOTE_TWEET';
    if (refTypes.includes('replied_to')) return 'REPLY';
  }
  if (hit.in_reply_to_id || hit.in_reply_to) return 'REPLY';
  if (hit.is_quote_status || hit.quoted_status) return 'QUOTE_TWEET';
  if (hit.link_id || hit.parent_id) return 'COMMENT';
  if (hit.subreddit) return 'SUBREDDIT_POST';
  return 'DIRECT_MENTION';
}

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { activationsCreated: 0, kolsProcessed: 0, profilesEnriched: 0, errors: [] };

  try {
    // Get all active brand accounts to build search queries
    const brandAccounts = await prisma.account.findMany({
      where: { isActive: true },
    });

    // Build brand handle sets per platform
    const xBrandHandles = brandAccounts
      .filter((a) => a.platform === 'X')
      .map((a) => `@${a.username}`);
    const redditBrandUsernames = brandAccounts
      .filter((a) => a.platform === 'REDDIT')
      .map((a) => a.username);

    // Include brand terms so we catch KOLs discussing Figure without @-mentioning
    const BRAND_TERMS = ['$FIGR', '$figr', 'Figure Markets', 'Figure Lending', 'provenance', '$HASH'];
    const allXTerms = [...xBrandHandles, ...BRAND_TERMS];

    // Shared adapters using bearer/service tokens for reads
    const xAdapter = new XPlatformAdapter(process.env.X_BEARER_TOKEN || '');
    const redditAdapter = new RedditAdapter(process.env.REDDIT_SERVICE_TOKEN || '');

    const activeKOLs = await prisma.kOL.findMany({
      where: { active: true },
    });

    for (const kol of activeKOLs) {
      try {
        let rawHits = [];
        const searchStart = Date.now();

        if (kol.platform === 'X') {
          // Search for tweets from the KOL mentioning brand handles or brand terms
          // Query: "from:kol_username (@brand1 OR $FIGR OR "Figure Markets" ...)"
          if (allXTerms.length === 0) continue;

          const brandQuery =
            allXTerms.length === 1
              ? allXTerms[0]
              : `(${allXTerms.join(' OR ')})`;
          const searchQuery = `from:${kol.username} ${brandQuery}`;

          const response = await xAdapter.searchTweets(searchQuery);
          rawHits = response?.data?.tweets || response?.tweets || [];
        } else if (kol.platform === 'REDDIT') {
          // Search for Reddit posts/comments by the KOL mentioning brand
          if (redditBrandUsernames.length === 0) continue;

          const brandQuery = redditBrandUsernames.join(' OR ');
          const searchQuery = `author:${kol.username} ${brandQuery}`;

          const response = await redditAdapter.searchAll(searchQuery);
          const children = response?.data?.children || [];
          rawHits = children.map((c) => c.data);
        }

        for (const hit of rawHits) {
          try {
            const platformPostId =
              hit.id || hit.id_str || hit.name || null;

            if (!platformPostId) continue;

            // Dedupe: check if this activation already exists
            const existing = await prisma.kOLActivation.findFirst({
              where: {
                kolId: kol.id,
                platformPostId: String(platformPostId),
              },
            });

            if (existing) continue;

            const content =
              hit.text || hit.body || hit.selftext || hit.title || '';
            const sourceUrl =
              hit.url ||
              (hit.permalink
                ? hit.permalink.startsWith('http')
                  ? hit.permalink
                  : `https://reddit.com${hit.permalink}`
                : null);

            // Collect metrics at detection time
            // TwitterAPI.io uses flat fields (likeCount) and nested (public_metrics.like_count)
            const metricsAtDetection = {};
            if (kol.platform === 'X') {
              const pm = hit.public_metrics || {};
              metricsAtDetection.likes = hit.likeCount || pm.like_count || 0;
              metricsAtDetection.retweets = hit.retweetCount || pm.retweet_count || 0;
              metricsAtDetection.replies = hit.replyCount || pm.reply_count || 0;
              metricsAtDetection.quotes = hit.quoteCount || pm.quote_count || 0;
              metricsAtDetection.impressions = hit.viewCount || pm.impression_count || 0;
              metricsAtDetection.bookmarks = hit.bookmarkCount || pm.bookmark_count || 0;
            } else if (kol.platform === 'REDDIT') {
              metricsAtDetection.upvotes = hit.ups || 0;
              metricsAtDetection.downvotes = hit.downs || 0;
              metricsAtDetection.comments = hit.num_comments || 0;
              metricsAtDetection.awards = hit.total_awards_received || 0;
              metricsAtDetection.score = hit.score || 0;
            }

            const activationType = classifyActivation(hit);

            // Extract actual post date (TwitterAPI.io: "Sat Mar 14 23:55:43 +0000 2026", Reddit: created_utc epoch)
            let postedAt = null;
            if (hit.createdAt) {
              postedAt = new Date(hit.createdAt);
            } else if (hit.created_at) {
              postedAt = new Date(hit.created_at);
            } else if (hit.created_utc) {
              postedAt = new Date(hit.created_utc * 1000);
            }
            if (postedAt && isNaN(postedAt.getTime())) postedAt = null;

            await prisma.kOLActivation.create({
              data: {
                kolId: kol.id,
                platform: kol.platform,
                activationType,
                platformPostId: String(platformPostId),
                content: String(content),
                sourceUrl,
                postedAt,
                sentiment: classifySentiment(content),
                detectionMethod: 'cron_search',
                metricsAtDetection,
              },
            });

            results.activationsCreated++;
          } catch (hitError) {
            console.error(
              `Error processing KOL activation for KOL ${kol.id}:`,
              hitError,
            );
          }
        }

        // ── Enrich KOL profile metadata from search results ──
        // TwitterAPI.io returns author data on each tweet — use it to backfill
        // avatarUrl and baselineFollowers that the seed script doesn't provide.
        if (kol.platform === 'X' && (!kol.avatarUrl || !kol.baselineFollowers)) {
          try {
            let authorAvatar = null;
            let authorFollowers = 0;

            if (rawHits.length > 0) {
              // Extract from search results
              const firstHit = rawHits[0];
              authorAvatar = firstHit.author?.profilePicture || firstHit.author?.profile_image_url || firstHit.author?.avatar || null;
              authorFollowers = firstHit.author?.followers || firstHit.author?.followersCount || firstHit.author?.public_metrics?.followers_count || 0;
            } else {
              // No activation hits — fetch profile directly as fallback
              const profile = await xAdapter.getUserProfile(kol.username);
              const userData = profile?.data || profile;
              authorAvatar = userData?.profilePicture || userData?.profile_image_url || userData?.avatar || null;
              authorFollowers = userData?.followers || userData?.followersCount || userData?.public_metrics?.followers_count || userData?.follower_count || 0;
            }

            const updates = {};
            if (authorAvatar && !kol.avatarUrl) updates.avatarUrl = authorAvatar;
            if (authorFollowers > 0 && (!kol.baselineFollowers || kol.baselineFollowers === 0)) updates.baselineFollowers = authorFollowers;

            if (Object.keys(updates).length > 0) {
              await prisma.kOL.update({ where: { id: kol.id }, data: updates });
              results.profilesEnriched++;
            }
          } catch (enrichErr) {
            console.warn(`Profile enrichment failed for @${kol.username}:`, enrichErr.message);
          }
        }

        // Log API call
        await prisma.aPICallLog.create({
          data: {
            provider: kol.platform === 'X' ? 'twitterapi_io' : 'reddit',
            endpoint: 'kol-activation-search',
            method: 'GET',
            statusCode: 200,
            responseTime: Date.now() - searchStart,
            estimatedCost: kol.platform === 'X' ? API_COSTS.TWITTERAPI_IO : API_COSTS.REDDIT_OAUTH,
          },
        });

        results.kolsProcessed++;
      } catch (kolError) {
        console.error(
          `Error processing KOL ${kol.id}:`,
          kolError,
        );
        results.errors.push({
          kolId: kol.id,
          error: kolError.message,
        });
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('kol-activations cron error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
