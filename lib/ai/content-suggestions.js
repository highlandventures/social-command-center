import { generateInsight, AI_PREAMBLE } from '../ai';

/**
 * Analyze post performance to find patterns in what content types, topics,
 * and formats work best.
 *
 * @param {Array} posts - Array of posts with their metrics
 * @returns {{ patterns: Array, topPerformers: Array, recommendations: Array }}
 */
export async function analyzePostPerformance(posts) {
  const systemPrompt = `${AI_PREAMBLE}
Analyze post performance and identify patterns.
Schema: {"patterns":[{"pattern":"string","evidence":"string","impact":"HIGH|MEDIUM|LOW"}],"topPerformers":[{"postId":"string","reason":"string","engagementRate":number}],"recommendations":[{"recommendation":"string","priority":"HIGH|MEDIUM|LOW","expectedImpact":"string"}]}`;

  try {
    const context = {
      task: 'Analyze post performance and find patterns',
      posts: posts.map((p) => ({
        id: p.id,
        content: p.content?.substring(0, 500),
        contentType: p.contentType,
        platform: p.platform,
        publishedAt: p.publishedAt,
        metrics: p.metrics
          ? {
              impressions: p.metrics.impressions,
              engagements: p.metrics.engagements,
              likes: p.metrics.likes,
              retweets: p.metrics.retweets,
              replies: p.metrics.replies,
              bookmarks: p.metrics.bookmarks,
              engagementRate: p.metrics.engagementRate,
              upvotes: p.metrics.upvotes,
              commentCount: p.metrics.commentCount,
            }
          : null,
      })),
    };

    return await generateInsight('content-suggestions/analyze-performance', context, {
      systemPrompt,
      maxTokens: 2048,
    });
  } catch (error) {
    console.error('Failed to analyze post performance:', error);
    return { patterns: [], topPerformers: [], recommendations: [] };
  }
}

/**
 * Generate content ideas based on trending topics from listening data
 * and existing post history.
 *
 * @param {Array} listeningData - Recent listening hits
 * @param {Array} postHistory - Previous posts for context
 * @returns {{ ideas: Array<{ title: string, platform: string, format: string, reasoning: string, estimatedEngagement: string }> }}
 */
export async function generateContentIdeas(listeningData, postHistory) {
  const systemPrompt = `${AI_PREAMBLE}
Generate 5-10 content ideas based on trending topics and post history.
Schema: {"ideas":[{"title":"string","platform":"X|REDDIT","format":"POST|THREAD|ARTICLE|COMMENT","reasoning":"string","estimatedEngagement":"HIGH|MEDIUM|LOW"}]}`;

  try {
    const context = {
      task: 'Generate content ideas from trending topics and post history',
      trendingTopics: listeningData.map((hit) => ({
        content: hit.content?.substring(0, 300),
        platform: hit.platform,
        sentiment: hit.sentiment,
        engagementCount: hit.engagementCount,
        authorFollowers: hit.authorFollowersOrKarma,
        subreddit: hit.subreddit,
        detectedAt: hit.detectedAt,
      })),
      recentPosts: postHistory.map((p) => ({
        content: p.content?.substring(0, 300),
        contentType: p.contentType,
        platform: p.platform,
        publishedAt: p.publishedAt,
        engagementRate: p.metrics?.engagementRate,
      })),
    };

    return await generateInsight('content-suggestions/generate-ideas', context, {
      systemPrompt,
      maxTokens: 2048,
    });
  } catch (error) {
    console.error('Failed to generate content ideas:', error);
    return { ideas: [] };
  }
}

/**
 * Optimize a draft thread by suggesting improvements to individual tweets.
 *
 * @param {Array} tweets - Array of draft tweet strings in thread order
 * @returns {{ optimizedTweets: Array, suggestions: Array, estimatedImprovement: string }}
 */
export async function optimizeThread(tweets) {
  const systemPrompt = `${AI_PREAMBLE}
Optimize this tweet thread for engagement. Keep each tweet under 280 chars.
Schema: {"optimizedTweets":["string"],"suggestions":[{"tweetIndex":number,"original":"string","suggestion":"string","reason":"string"}],"estimatedImprovement":"string"}`;

  try {
    const context = {
      task: 'Optimize this tweet thread for engagement',
      tweets: tweets.map((text, i) => ({
        position: i + 1,
        text,
        characterCount: text.length,
      })),
    };

    return await generateInsight('content-suggestions/optimize-thread', context, {
      systemPrompt,
      maxTokens: 2048,
    });
  } catch (error) {
    console.error('Failed to optimize thread:', error);
    return {
      optimizedTweets: tweets,
      suggestions: [],
      estimatedImprovement: 'Unable to estimate',
    };
  }
}

/**
 * Predict engagement performance for a piece of content on a given platform.
 *
 * @param {string} content - The post content to evaluate
 * @param {string} platform - Target platform (X or REDDIT)
 * @param {object} account - Account context (followers, historical engagement, etc.)
 * @returns {{ predictedImpressions: number, predictedEngRate: number, confidence: string, reasoning: string }}
 */
export async function predictPerformance(content, platform, account) {
  const systemPrompt = `${AI_PREAMBLE}
Predict engagement metrics based on content, platform, and account history.
Schema: {"predictedImpressions":number,"predictedEngRate":number,"confidence":"HIGH|MEDIUM|LOW","reasoning":"string"}`;

  try {
    const context = {
      task: 'Predict engagement performance for this content',
      content: content?.substring(0, 1000),
      platform,
      accountContext: {
        username: account?.username,
        followers: account?.followers,
        avgEngagementRate: account?.avgEngagementRate,
        recentPerformance: account?.recentPerformance,
      },
    };

    return await generateInsight('content-suggestions/predict-performance', context, {
      systemPrompt,
      maxTokens: 1024,
    });
  } catch (error) {
    console.error('Failed to predict performance:', error);
    return {
      predictedImpressions: 0,
      predictedEngRate: 0,
      confidence: 'LOW',
      reasoning: 'Prediction unavailable due to an error.',
    };
  }
}
