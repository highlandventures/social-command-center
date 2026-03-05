import { generateInsight } from '../ai';

/**
 * Analyze post performance to find patterns in what content types, topics,
 * and formats work best.
 *
 * @param {Array} posts - Array of posts with their metrics
 * @returns {{ patterns: Array, topPerformers: Array, recommendations: Array }}
 */
export async function analyzePostPerformance(posts) {
  const systemPrompt = `You are a social media analytics expert for a social media management platform.
Analyze the provided post data and identify performance patterns.
Always respond with valid JSON matching this exact schema:
{
  "patterns": [
    { "pattern": "string describing the pattern", "evidence": "string with supporting data", "impact": "HIGH|MEDIUM|LOW" }
  ],
  "topPerformers": [
    { "postId": "string", "reason": "string explaining why it performed well", "engagementRate": number }
  ],
  "recommendations": [
    { "recommendation": "string", "priority": "HIGH|MEDIUM|LOW", "expectedImpact": "string" }
  ]
}`;

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
  const systemPrompt = `You are a creative social media strategist for a social media management platform.
Generate content ideas based on trending topics and past performance data.
Always respond with valid JSON matching this exact schema:
{
  "ideas": [
    {
      "title": "string - concise content idea title",
      "platform": "X|REDDIT",
      "format": "POST|THREAD|ARTICLE|COMMENT",
      "reasoning": "string explaining why this idea is timely and relevant",
      "estimatedEngagement": "HIGH|MEDIUM|LOW"
    }
  ]
}
Generate 5-10 actionable content ideas.`;

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
  const systemPrompt = `You are a social media copywriting expert for a social media management platform.
Optimize the provided tweet thread for maximum engagement while preserving the core message.
Always respond with valid JSON matching this exact schema:
{
  "optimizedTweets": ["string - optimized version of each tweet in order"],
  "suggestions": [
    { "tweetIndex": number, "original": "string", "suggestion": "string describing the change", "reason": "string" }
  ],
  "estimatedImprovement": "string describing expected engagement lift (e.g. '15-25% higher engagement')"
}
Keep each tweet under 280 characters. Ensure the thread flows naturally.`;

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
  const systemPrompt = `You are a social media performance prediction engine for a social media management platform.
Predict the engagement metrics for the provided content based on the platform and account context.
Always respond with valid JSON matching this exact schema:
{
  "predictedImpressions": number,
  "predictedEngRate": number,
  "confidence": "HIGH|MEDIUM|LOW",
  "reasoning": "string explaining the prediction basis and key factors"
}
Base predictions on the account's historical performance, content characteristics, and platform norms.`;

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
