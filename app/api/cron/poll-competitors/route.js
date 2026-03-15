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
import { generateInsight } from '@/lib/ai';

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

              // Store individual post content + metrics
              const tweetText = tweet.text || tweet.full_text || '';
              const tweetId = tweet.id || tweet.id_str || '';
              const postedAt = tweet.created_at ? new Date(tweet.created_at) : new Date();
              const impressionsCount = pm.impression_count || pm.impressions || 0;
              const followersForRate = followersX || 1;

              if (tweetId && tweetText) {
                await prisma.competitorPost.upsert({
                  where: {
                    competitorId_platformPostId: {
                      competitorId: comp.id,
                      platformPostId: String(tweetId),
                    },
                  },
                  update: {
                    likes: pm.like_count || pm.likes || 0,
                    retweets: pm.retweet_count || pm.retweets || 0,
                    replies: pm.reply_count || pm.replies || 0,
                    quotes: pm.quote_count || pm.quotes || 0,
                    impressions: impressionsCount,
                    engagementRate: followersForRate > 0 ? (eng / followersForRate) * 100 : 0,
                  },
                  create: {
                    competitorId: comp.id,
                    platform: 'X',
                    platformPostId: String(tweetId),
                    content: tweetText,
                    contentType: 'POST',
                    authorUsername: acct.username,
                    postedAt,
                    likes: pm.like_count || pm.likes || 0,
                    retweets: pm.retweet_count || pm.retweets || 0,
                    replies: pm.reply_count || pm.replies || 0,
                    quotes: pm.quote_count || pm.quotes || 0,
                    impressions: impressionsCount,
                    engagementRate: followersForRate > 0 ? (eng / followersForRate) * 100 : 0,
                  },
                });
              }
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

    // ── Batch AI Analysis: Competitor Strategy ──────────────────
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Fetch all competitor posts from last 30 days
      const allCompPosts = await prisma.competitorPost.findMany({
        where: { postedAt: { gte: thirtyDaysAgo } },
        include: { competitor: { select: { id: true, name: true } } },
        orderBy: { postedAt: 'desc' },
      });

      if (allCompPosts.length > 0) {
        // Fetch Figure's own published posts for benchmark comparison
        const figurePosts = await prisma.post.findMany({
          where: { status: 'PUBLISHED', publishedAt: { gte: thirtyDaysAgo } },
          include: { metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 } },
        });
        const figureAvgEngRate = figurePosts.length > 0
          ? figurePosts.reduce((sum, p) => sum + (p.metrics[0]?.engagementRate || 0), 0) / figurePosts.length
          : 0;
        const figurePostsPerDay = figurePosts.length / 30;

        // Get latest follower counts per competitor (from today's CompetitorMetrics)
        const latestMetrics = await prisma.competitorMetrics.findMany({
          where: { date: today },
          select: { competitorId: true, followersX: true },
        });
        const followersByComp = {};
        for (const m of latestMetrics) followersByComp[m.competitorId] = m.followersX;

        // Also get Figure's follower count
        const figureFollowers = figureAccounts.length > 0
          ? (await prisma.accountMetrics.findMany({
              where: { accountId: { in: figureAccounts.map(a => a.id) } },
              orderBy: { date: 'desc' },
              take: figureAccounts.length,
            })).reduce((sum, m) => sum + (m.followers || 0), 0)
          : 0;

        // Group posts by competitor
        const postsByComp = {};
        for (const post of allCompPosts) {
          const compId = post.competitorId;
          if (!postsByComp[compId]) postsByComp[compId] = { name: post.competitor.name, posts: [] };
          postsByComp[compId].posts.push(post);
        }

        // Build context for AI
        const competitorSummaries = Object.entries(postsByComp).map(([compId, data]) => {
          const posts = data.posts;
          const avgEngRate = posts.reduce((s, p) => s + p.engagementRate, 0) / posts.length;
          const postsPerDay = posts.length / 30;

          // Content samples (first 100 chars of up to 10 posts)
          const contentSamples = posts.slice(0, 10).map(p => p.content.slice(0, 100));

          // Format breakdown
          const formats = {};
          for (const p of posts) {
            formats[p.contentType] = (formats[p.contentType] || 0) + 1;
          }

          return {
            competitorName: data.name,
            postCount: posts.length,
            postsPerDay: postsPerDay.toFixed(1),
            avgEngagementRate: avgEngRate.toFixed(4),
            followersX: followersByComp[compId] || 0,
            formatBreakdown: formats,
            contentSamples,
          };
        });

        const aiContext = {
          instruction: `Analyze competitor posting strategies and generate three JSON objects:
1. "themes": array of { phrase (string), occurrences (int), avgEngRate (float), competitors (string[]) } — top 20 themes across all competitors
2. "formats": array of { format (string), postCount (int), avgEngRate (float), topCompetitor (string) } — format breakdown
3. "strategyCards": array of { competitorName (string), postingCadence (string like "2.3 posts/day"), topThemes (array of 3 strings), formatMix (string), engagementRate (string), followerCount (int), engagementBenchmark (string comparing to Figure's avg), followerBenchmark (string comparing to Figure's count), keyInsight (string, 1-2 sentences) }

Return a JSON object with keys: themes, formats, strategyCards.`,
          competitors: competitorSummaries,
          figure: {
            avgEngagementRate: figureAvgEngRate.toFixed(4),
            postsPerDay: figurePostsPerDay.toFixed(1),
            followersX: figureFollowers,
          },
        };

        const aiResult = await generateInsight('competitor_strategy', aiContext, {
          model: 'claude-3-5-haiku-20241022',
          maxTokens: 2048,
          systemPrompt: 'You are a competitive intelligence analyst for a social media team in the RWA/tokenization space. Analyze competitor posting strategies and compare to our (Figure) performance. Always respond with valid JSON matching the requested schema.',
        });

        // Dismiss old COMPETITOR_STRATEGY insights, then store new ones
        await prisma.aIInsight.updateMany({
          where: { insightType: 'COMPETITOR_STRATEGY', dismissed: false },
          data: { dismissed: true },
        });

        // Store themes result
        await prisma.aIInsight.create({
          data: {
            insightType: 'COMPETITOR_STRATEGY',
            content: { type: 'themes', data: aiResult.themes || [] },
          },
        });

        // Store formats result
        await prisma.aIInsight.create({
          data: {
            insightType: 'COMPETITOR_STRATEGY',
            content: { type: 'formats', data: aiResult.formats || [] },
          },
        });

        // Store strategy cards result
        await prisma.aIInsight.create({
          data: {
            insightType: 'COMPETITOR_STRATEGY',
            content: { type: 'strategyCards', data: aiResult.strategyCards || [] },
          },
        });

        console.log('Competitor strategy AI analysis cached:', {
          themes: (aiResult.themes || []).length,
          formats: (aiResult.formats || []).length,
          strategyCards: (aiResult.strategyCards || []).length,
        });
      }
    } catch (aiError) {
      console.error('Competitor strategy AI analysis failed:', aiError.message);
      results.errors.push({ step: 'ai_analysis', error: aiError.message });
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
