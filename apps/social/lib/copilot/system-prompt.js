import { getCondensedIntelSummary } from './intel-context';
import { getTopPostsForAccount } from './brand-voice';

/**
 * Builds a dynamic system prompt for the co-pilot chat,
 * incorporating intel context and per-account brand voice.
 * Target: ~1000 tokens total (role ~200, intel ~500, voice ~300).
 */
export async function buildSystemPrompt({ accountId, postMode, platform }) {
  const [intelS, brandS] = await Promise.allSettled([
    getCondensedIntelSummary(),
    getTopPostsForAccount(accountId),
  ]);

  const intelSummary = intelS.status === 'fulfilled'
    ? intelS.value
    : 'Intel data unavailable. Proceed without context.';
  const brandExamples = brandS.status === 'fulfilled' ? brandS.value : [];

  const voiceSection = brandExamples.length > 0
    ? `## Brand Voice Examples
Write in the style of these top-performing posts:
${brandExamples.map((p, i) => `${i + 1}. "${p.content}" (${p.contentType}, ${((p.engagementRate || 0) * 100).toFixed(1)}% engagement)`).join('\n')}`
    : '## Brand Voice\nNo published posts available yet for voice matching. Use a professional, engaging tone.';

  return `You are a content co-pilot for a social media marketing team. You help brainstorm ideas, draft posts, optimize content, and predict performance using real data from the team's analytics.

## Current Context
- Platform: ${platform || 'not specified'}
- Post mode: ${postMode || 'single post'}
- Active account: ${accountId || 'none selected'}

## Intel Summary
${intelSummary}

${voiceSection}

## Guidelines
- Be mode-aware: threads produce arrays of posts, single posts stay under 280 chars for X, articles are long-form
- Reference specific data from the intel summary when relevant -- weave in performance patterns, competitor themes, and audience questions naturally
- When writing draft content, clearly mark it with "---DRAFT---" delimiters so it can be detected for insertion into the composer
- If asked to predict performance, provide engagement rate estimate, impressions estimate, and confidence level (low/medium/high)
- Be collaborative -- sometimes the team wants brainstorming, sometimes specific drafts. Adapt to their mode
- Keep responses focused and actionable. Avoid generic advice when you have specific data to reference`;
}
