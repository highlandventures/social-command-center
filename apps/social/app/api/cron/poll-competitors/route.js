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
import { generateInsight } from '@/lib/ai';
import { logger } from '@/lib/logger';

const log = logger('cron/poll-competitors');

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
              // TwitterAPI.io returns metrics at top level (likeCount, retweetCount, etc.)
              const likes = tweet.likeCount || tweet.like_count || tweet.public_metrics?.like_count || 0;
              const retweets = tweet.retweetCount || tweet.retweet_count || tweet.public_metrics?.retweet_count || 0;
              const replies = tweet.replyCount || tweet.reply_count || tweet.public_metrics?.reply_count || 0;
              const quotes = tweet.quoteCount || tweet.quote_count || tweet.public_metrics?.quote_count || 0;
              const eng = likes + retweets + replies + quotes;
              totalEngagement += eng;
              tweetCount++;

              // Store individual post content + metrics
              const tweetText = tweet.text || tweet.full_text || '';
              const tweetId = tweet.id || tweet.id_str || '';
              const postedAt = tweet.createdAt || tweet.created_at ? new Date(tweet.createdAt || tweet.created_at) : new Date();
              const impressionsCount = tweet.viewCount || tweet.impressionCount || tweet.public_metrics?.impression_count || 0;
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
                    likes,
                    retweets,
                    replies,
                    quotes,
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
                    likes,
                    retweets,
                    replies,
                    quotes,
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

        log.info(
          `  ${comp.name}: ${followersX} followers, ${postsCount} posts, ${mentionCount} mentions`,
        );
        results.competitorsProcessed++;
      } catch (compError) {
        log.error(`Error processing competitor ${comp.name}`, { error: compError });
        results.errors.push({ competitor: comp.name, error: compError.message });
      }
    }

    // ── Amplifier collection ────────────────────────────────
    // For each competitor, fetch retweeters of their top 5 most-engaged posts
    for (const comp of competitors) {
      try {
        const recentPosts = await prisma.competitorPost.findMany({
          where: { competitorId: comp.id, postedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          orderBy: { engagementRate: 'desc' },
          take: 5,
        });

        for (const post of recentPosts) {
          try {
            const retweetersRes = await twitterApiIoRequest(apiKey, '/twitter/tweet/retweeters', {
              tweetId: post.platformPostId,
            });
            const retweeters = retweetersRes?.data?.users || retweetersRes?.users || [];

            for (const user of retweeters.slice(0, 20)) {
              const username = user.username || user.screen_name || '';
              if (!username) continue;

              await prisma.competitorAmplifier.upsert({
                where: {
                  competitorId_platform_username: {
                    competitorId: comp.id,
                    platform: 'X',
                    username,
                  },
                },
                update: {
                  interactionCount: { increment: 1 },
                  lastSeenAt: new Date(),
                  followersCount: user.followers_count || user.followersCount || 0,
                  displayName: user.name || user.display_name || null,
                  avatarUrl: user.profile_image_url || user.avatar || null,
                  platformUserId: user.id ? String(user.id) : undefined,
                },
                create: {
                  competitorId: comp.id,
                  platform: 'X',
                  username,
                  platformUserId: user.id ? String(user.id) : null,
                  displayName: user.name || user.display_name || null,
                  avatarUrl: user.profile_image_url || user.avatar || null,
                  followersCount: user.followers_count || user.followersCount || 0,
                  amplificationType: 'RETWEET',
                  interactionCount: 1,
                },
              });
            }
          } catch (retErr) {
            // Non-fatal: skip this post's retweeters
            console.warn(`  Retweeters fetch failed for post ${post.platformPostId}:`, retErr.message);
          }
        }
      } catch (ampError) {
        console.warn(`  Amplifier collection failed for ${comp.name}:`, ampError.message);
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
    // Pre-compute all metrics deterministically, then ask AI to interpret
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

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

        // Get 14-day-ago metrics for trend comparison
        const trendDate = new Date(today);
        trendDate.setDate(trendDate.getDate() - 14);
        trendDate.setUTCHours(0, 0, 0, 0);
        const trendMetrics = await prisma.competitorMetrics.findMany({
          where: { date: trendDate },
          select: { competitorId: true, followersX: true, avgEngagementRate: true },
        });
        const trendByComp = {};
        for (const m of trendMetrics) trendByComp[m.competitorId] = m;

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

        // ── Pre-compute deterministic format breakdown ──────────
        const globalFormatStats = {};
        for (const post of allCompPosts) {
          const fmt = post.contentType || 'POST';
          if (!globalFormatStats[fmt]) globalFormatStats[fmt] = { postCount: 0, totalEng: 0, byComp: {} };
          globalFormatStats[fmt].postCount++;
          globalFormatStats[fmt].totalEng += post.engagementRate;
          if (!globalFormatStats[fmt].byComp[post.competitor.name]) {
            globalFormatStats[fmt].byComp[post.competitor.name] = { count: 0, totalEng: 0 };
          }
          globalFormatStats[fmt].byComp[post.competitor.name].count++;
          globalFormatStats[fmt].byComp[post.competitor.name].totalEng += post.engagementRate;
        }
        const preComputedFormats = Object.entries(globalFormatStats).map(([format, stats]) => {
          const byCompEntries = Object.entries(stats.byComp);
          const topComp = byCompEntries.sort((a, b) => b[1].count - a[1].count)[0];
          return {
            format,
            postCount: stats.postCount,
            avgEngRate: +(stats.totalEng / stats.postCount).toFixed(4),
            topCompetitor: topComp ? topComp[0] : null,
          };
        });

        // ── Pre-compute per-competitor strategy data ──────────
        const preComputedStrategyCards = Object.entries(postsByComp).map(([compId, data]) => {
          const posts = data.posts;
          const avgEngRate = posts.reduce((s, p) => s + p.engagementRate, 0) / posts.length;
          const postsPerDay = posts.length / 30;
          const followers = followersByComp[compId] || 0;

          // Format mix
          const formats = {};
          for (const p of posts) formats[p.contentType] = (formats[p.contentType] || 0) + 1;
          const formatMix = Object.entries(formats)
            .sort((a, b) => b[1] - a[1])
            .map(([f, c]) => `${f}: ${Math.round((c / posts.length) * 100)}%`)
            .join(', ');

          // Engagement vs Figure benchmark
          const engDiff = figureAvgEngRate > 0
            ? ((avgEngRate - figureAvgEngRate) / figureAvgEngRate * 100).toFixed(0)
            : 0;
          const engBenchmark = Number(engDiff) > 0
            ? `${engDiff}% higher than Figure`
            : Number(engDiff) < 0
              ? `${Math.abs(engDiff)}% lower than Figure`
              : 'On par with Figure';

          // Follower benchmark
          const followerRatio = figureFollowers > 0
            ? (followers / figureFollowers).toFixed(1)
            : 'N/A';

          // Trend (14-day comparison)
          const prev = trendByComp[compId];
          const followerGrowth = prev?.followersX > 0
            ? (((followers - prev.followersX) / prev.followersX) * 100).toFixed(1)
            : null;
          const engTrend = prev?.avgEngagementRate > 0
            ? (((avgEngRate - prev.avgEngagementRate) / prev.avgEngagementRate) * 100).toFixed(1)
            : null;

          // Recent vs older half post cadence
          const recentPosts = posts.filter(p => new Date(p.postedAt) >= fourteenDaysAgo);
          const olderPosts = posts.filter(p => new Date(p.postedAt) < fourteenDaysAgo);
          const recentCadence = recentPosts.length / 14;
          const olderCadence = olderPosts.length / 16; // remaining days

          return {
            competitorName: data.name,
            postCount: posts.length,
            postingCadence: `${postsPerDay.toFixed(1)} posts/day`,
            formatMix,
            engagementRate: avgEngRate.toFixed(4),
            followerCount: followers,
            engagementBenchmark: engBenchmark,
            followerBenchmark: `${followerRatio}x Figure's followers`,
            trend: {
              followerGrowth14d: followerGrowth ? `${followerGrowth}%` : 'No prior data',
              engagementTrend14d: engTrend ? `${engTrend}%` : 'No prior data',
              cadenceTrend: recentCadence > olderCadence * 1.2
                ? 'Accelerating'
                : recentCadence < olderCadence * 0.8
                  ? 'Slowing down'
                  : 'Steady',
            },
            // Content samples — 280 chars for 15 top-performing posts (enough for theme extraction)
            topContentSamples: [...posts]
              .sort((a, b) => b.engagementRate - a.engagementRate)
              .slice(0, 15)
              .map(p => ({ content: p.content.slice(0, 280), engagementRate: p.engagementRate.toFixed(4) })),
          };
        });

        // Figure content samples — also 280 chars, more of them
        const figureContentSamples = figurePosts
          .sort((a, b) => (b.metrics[0]?.engagementRate || 0) - (a.metrics[0]?.engagementRate || 0))
          .slice(0, 20)
          .map(p => ({
            content: (p.content || '').slice(0, 280),
            engagementRate: (p.metrics[0]?.engagementRate || 0).toFixed(4),
          }));

        const aiContext = {
          instruction: `You are given pre-computed metrics for competitor analysis. DO NOT recompute any numbers.

Your job is to INTERPRET the data and produce:
1. "themes": Identify the top 15 recurring themes/topics across competitor content samples. For each: { "phrase": string, "occurrences": int (how many samples touch this theme), "avgEngRate": float (from the samples), "competitors": string[] }
2. "strategyCards": For each competitor, use the pre-computed metrics below and add ONLY:
   - "topThemes": array of 3 theme strings (from their content samples)
   - "keyInsight": 1-2 sentences — what is this competitor doing differently that Figure should pay attention to? Be specific, reference numbers.
   Copy all other fields (postingCadence, formatMix, engagementRate, etc.) exactly from the pre-computed data.
3. "contentGaps": Compare Figure's content samples against competitor themes.
   - "gaps": array of { "theme": string, "competitors": string[], "avgEngRate": float, "recommendation": string (specific action — e.g. "Create a thread breaking down X" not "Consider posting about X") } — topics competitors cover with good engagement that Figure doesn't (top 10)
   - "strengths": array of { "theme": string, "figurePostCount": int, "avgEngRate": float } — topics Figure covers that competitors don't (top 10)

IMPORTANT:
- Only identify themes that appear in 2+ content samples (not one-off mentions)
- Recommendations must be specific and actionable (format + topic + angle)
- If a competitor's trend shows "Accelerating" cadence + rising engagement, flag them as gaining momentum

Return a JSON object with keys: themes, formats, strategyCards, contentGaps.`,

          preComputedFormats,
          preComputedStrategyCards,
          figure: {
            avgEngagementRate: figureAvgEngRate.toFixed(4),
            postsPerDay: figurePostsPerDay.toFixed(1),
            followersX: figureFollowers,
            contentSamples: figureContentSamples,
          },
        };

        const aiResult = await generateInsight('competitor_strategy', aiContext, {
          model: 'claude-haiku-4-5-20251001',
          maxTokens: 3000,
          systemPrompt: 'You are a competitive intelligence analyst for Figure, a company in the RWA/tokenization space. You interpret pre-computed metrics — never invent numbers. Your insights must be specific (reference actual engagement rates, follower counts, trends) and actionable (recommend specific content formats + topics + angles). Always respond with valid JSON.',
        });

        // Merge AI-generated fields into pre-computed strategy cards
        const mergedStrategyCards = preComputedStrategyCards.map((card) => {
          const aiCard = (aiResult.strategyCards || []).find(
            (c) => c.competitorName === card.competitorName
          );
          return {
            ...card,
            topThemes: aiCard?.topThemes || [],
            keyInsight: aiCard?.keyInsight || '',
          };
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

        // Store formats result (pre-computed, not AI-generated)
        await prisma.aIInsight.create({
          data: {
            insightType: 'COMPETITOR_STRATEGY',
            content: { type: 'formats', data: preComputedFormats },
          },
        });

        // Store strategy cards result (merged: pre-computed + AI themes/insights)
        await prisma.aIInsight.create({
          data: {
            insightType: 'COMPETITOR_STRATEGY',
            content: { type: 'strategyCards', data: mergedStrategyCards },
          },
        });

        // Store content gaps result
        await prisma.aIInsight.create({
          data: {
            insightType: 'COMPETITOR_STRATEGY',
            content: { type: 'contentGaps', data: aiResult.contentGaps || { gaps: [], strengths: [] } },
          },
        });

        log.info('Competitor strategy AI analysis cached:', {
          themes: (aiResult.themes || []).length,
          formats: preComputedFormats.length,
          strategyCards: mergedStrategyCards.length,
          contentGaps: (aiResult.contentGaps?.gaps || []).length,
        });
      }
    } catch (aiError) {
      log.error('Competitor strategy AI analysis failed', { error: aiError });
      results.errors.push({ step: 'ai_analysis', error: aiError.message });
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    log.error('poll-competitors cron error', { error });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
