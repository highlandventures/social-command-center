import { generateInsight, AI_PREAMBLE } from '../ai';

/**
 * Generate an AI profile summary for a KOL.
 *
 * Produces a narrative description of who the KOL is, their audience,
 * their relevance to Figure/Provenance, and key topics they cover.
 *
 * @param {object} kol - KOL profile data from the KOL model
 * @param {Array} activations - Recent KOLActivation records (up to 10)
 * @returns {{
 *   summary: string,
 *   audienceProfile: string,
 *   brandRelevance: string,
 *   keyTopics: string[]
 * }}
 */
export async function generateProfileSummary(kol, activations = []) {
  const systemPrompt = `${AI_PREAMBLE}
Generate a concise profile summary for this KOL (Key Opinion Leader) who is relevant to Figure Markets / Provenance Blockchain.
Schema: {"summary":"2-3 sentence narrative about who this person is and what they do","audienceProfile":"1-2 sentences describing their likely audience","brandRelevance":"1-2 sentences about why they matter to Figure/Provenance","keyTopics":["topic1","topic2","topic3"]}
Focus on factual observations. Do not invent information not supported by the data provided.`;

  const accountAge = kol.accountCreatedAt
    ? `${Math.round((Date.now() - new Date(kol.accountCreatedAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years`
    : 'unknown';

  const context = {
    task: 'Generate a profile summary for this KOL',
    kol: {
      name: kol.name,
      username: kol.username,
      platform: kol.platform,
      bio: kol.bio || null,
      location: kol.location || null,
      verified: kol.verified || false,
      followers: kol.baselineFollowers || 0,
      following: kol.followingCount || 0,
      accountAge,
      relationshipType: kol.relationshipType,
      compensationMonthly: kol.compensationMonthly || 0,
      aiScore: kol.aiScore || null,
    },
    recentActivations: activations.slice(0, 10).map((a) => ({
      type: a.activationType,
      content: a.content?.substring(0, 300),
      sentiment: a.sentiment,
      postedAt: a.postedAt || a.detectedAt,
      engagement: a.metricsAtDetection || {},
    })),
    activationCount: activations.length,
  };

  try {
    return await generateInsight('kol-profile/summary', context, {
      systemPrompt,
      maxTokens: 1024,
    });
  } catch (error) {
    console.error('Failed to generate KOL profile summary:', error);
    return {
      summary: `${kol.name} (@${kol.username}) is a ${kol.platform} account with ${kol.baselineFollowers || 0} followers.`,
      audienceProfile: 'Unable to determine audience profile.',
      brandRelevance: 'Profile summary generation unavailable.',
      keyTopics: [],
    };
  }
}
