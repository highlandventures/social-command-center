/**
 * Cron: Poll Competitor Metrics
 * Schedule: Daily at 3 AM (0 3 * * *)
 *
 * For each Competitor with X accounts, fetches follower counts and
 * recent engagement data via TwitterAPI.io, then upserts a
 * CompetitorMetrics row for today.
 *
 * Also computes daily share-of-voice across all competitors + Figure
 * by counting ListeningHit records from the last 24 hours.
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

  const results = { competitorsProcessed: 0, errors: [] };

  try {
    const apiKey = process.env.TWITTERAPI_IO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'TWITTERAPI_IO_API_KEY not set' },
        { status: 500 },
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Fetch all competitors with their accounts
    const competitors = await prisma.competitor.findMany({
      include: { accounts: true, keywords: true },
    });

    // Also fetch Figure's own accounts for share-of-voice baseline
    const figureAccounts = await prisma.account.findMany({
      where: { isActive: true, platform: 'X' },
    });

    // ── Per-competitor metrics ───────────────────────────────
    for (const comp of competitors) {
      try {
        let followersX = 0;
        let postsCount = 0;
        let totalEngagement = 0;
        let tweetCount = 0;

        for (const acct of comp.accounts.filter((a) => a.platform === 'X')) {
          try {
            // Fetch profile for follower count
            const profileRes = await twitterApiIoRequest(apiKey, '/twitter/user/info', {
              userName: acct.username,
            });
            const profile = profileRes?.data || profileRes || {};
            const followers =
              profile.followers || profile.followersCount || profile.follower_count || 0;
            followersX += followers;

            // Update platformUserId if we got it
            if (profile.id && !acct.platformUserId) {
              await prisma.competitorAccount.update({
                where: { id: acct.id },
                data: { platformUserId: String(profile.id) },
              });
            }

            // Fetch recent tweets for engagement data
            const tweetsRes = await twitterApiIoRequest(apiKey, '/twitter/user/last_tweets', {
              userName: acct.username,
            });
            const tweets = tweetsRes?.data?.tweets || tweetsRes?.tweets || [];
            postsCount += tweets.length;

            for (const tweet of tweets) {
              const pm = tweet.public_metrics || tweet.metrics || {};
              const eng =
                (pm.like_count || pm.likes || 0) +
                (pm.retweet_count || pm.retweets || 0) +
                (pm.reply_count || pm.replies || 0) +
                (pm.quote_count || pm.quotes || 0);
              totalEngagement += eng;
              tweetCount++;
            }
          } catch (acctError) {
            console.warn(`  Error fetching @${acct.username}:`, acctError.message);
          }
        }

        const avgEngagementRate =
          tweetCount > 0 && followersX > 0
            ? (totalEngagement / tweetCount / followersX) * 100
            : 0;

        // Count listening hits for this competitor in last 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const mentionCount = await prisma.listeningHit.count({
          where: {
            topic: { name: `Competitor: ${comp.name}` },
            detectedAt: { gte: yesterday },
          },
        });

        // Sentiment from recent hits
        const sentimentCounts = await prisma.listeningHit.groupBy({
          by: ['sentiment'],
          where: {
            topic: { name: `Competitor: ${comp.name}` },
            detectedAt: { gte: yesterday },
          },
          _count: true,
        });
        const posCount = sentimentCounts.find((s) => s.sentiment === 'POSITIVE')?._count || 0;
        const totalSentiment = sentimentCounts.reduce((sum, s) => sum + s._count, 0);
        const sentimentPositivePct = totalSentiment > 0 ? (posCount / totalSentiment) * 100 : 0;

        // Upsert today's metrics
        await prisma.competitorMetrics.upsert({
          where: {
            competitorId_date: { competitorId: comp.id, date: today },
          },
          update: {
            ...(followersX > 0 ? { followersX } : {}),
            postsCount,
            avgEngagementRate: parseFloat(avgEngagementRate.toFixed(4)),
            mentionCount,
            sentimentPositivePct: parseFloat(sentimentPositivePct.toFixed(2)),
          },
          create: {
            competitorId: comp.id,
            date: today,
            followersX,
            postsCount,
            avgEngagementRate: parseFloat(avgEngagementRate.toFixed(4)),
            mentionCount,
            sentimentPositivePct: parseFloat(sentimentPositivePct.toFixed(2)),
          },
        });

        // Log API call
        await prisma.aPICallLog.create({
          data: {
            provider: 'twitterapi_io',
            endpoint: 'poll-competitors',
            method: 'GET',
            statusCode: 200,
            responseTime: 0,
            estimatedCost: comp.accounts.length * API_COSTS.TWITTERAPI_IO * 2,
          },
        });

        console.log(
          `  ${comp.name}: ${followersX} followers, ${postsCount} posts, ${mentionCount} mentions`,
        );
        results.competitorsProcessed++;
      } catch (compError) {
        console.error(`Error processing competitor ${comp.name}:`, compError);
        results.errors.push({ competitor: comp.name, error: compError.message });
      }
    }

    // ── Share of Voice calculation ────────────────────────────
    // Count total mentions across all competitor topics + Figure topic
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const allMentionCounts = {};
    let grandTotal = 0;

    // Figure brand mentions
    const figureMentions = await prisma.listeningHit.count({
      where: {
        topic: { name: 'Figure Brand & Products' },
        detectedAt: { gte: yesterday },
      },
    });
    allMentionCounts['__figure__'] = figureMentions;
    grandTotal += figureMentions;

    // Competitor mentions
    for (const comp of competitors) {
      const count = await prisma.listeningHit.count({
        where: {
          topic: { name: `Competitor: ${comp.name}` },
          detectedAt: { gte: yesterday },
        },
      });
      allMentionCounts[comp.id] = count;
      grandTotal += count;
    }

    // Update share of voice percentages
    if (grandTotal > 0) {
      for (const comp of competitors) {
        const sov = ((allMentionCounts[comp.id] || 0) / grandTotal) * 100;
        await prisma.competitorMetrics.updateMany({
          where: { competitorId: comp.id, date: today },
          data: { shareOfVoicePct: parseFloat(sov.toFixed(2)) },
        });
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('poll-competitors cron error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
