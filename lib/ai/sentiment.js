import { generateInsight } from '../ai';

// ── Keyword lists for fast local sentiment analysis ──

const POSITIVE_KEYWORDS = [
  'amazing', 'awesome', 'beautiful', 'best', 'brilliant', 'bullish',
  'celebrate', 'congratulations', 'congrats', 'delighted', 'excellent',
  'excited', 'fantastic', 'good', 'great', 'happy', 'impressive',
  'incredible', 'innovative', 'inspiring', 'love', 'nice', 'outstanding',
  'perfect', 'phenomenal', 'positive', 'powerful', 'promising', 'proud',
  'remarkable', 'stellar', 'strong', 'success', 'super', 'terrific',
  'thank', 'thanks', 'thrilled', 'top', 'tremendous', 'underrated',
  'valuable', 'well done', 'wonderful', 'wow',
];

const NEGATIVE_KEYWORDS = [
  'angry', 'annoying', 'awful', 'bad', 'bearish', 'broken', 'bug',
  'complaint', 'concern', 'crash', 'critical', 'dead', 'disappointed',
  'disappointing', 'disaster', 'disgusting', 'dislike', 'down', 'dreadful',
  'error', 'fail', 'failed', 'failure', 'fraud', 'frustrated', 'garbage',
  'hate', 'horrible', 'hurt', 'issue', 'junk', 'lack', 'lackluster',
  'lame', 'mediocre', 'mess', 'missing', 'negative', 'never', 'nightmare',
  'overrated', 'pathetic', 'poor', 'problem', 'ridiculous', 'scam', 'slow',
  'spam', 'stupid', 'sucks', 'terrible', 'trash', 'ugly', 'unacceptable',
  'unfortunately', 'unhappy', 'useless', 'waste', 'weak', 'worse', 'worst',
  'wrong',
];

/**
 * Fast keyword-based sentiment analysis (no API call).
 * Counts positive and negative keyword matches and returns a sentiment label.
 *
 * @param {string} text - The text to analyze
 * @returns {{ sentiment: 'POSITIVE'|'NEGATIVE'|'NEUTRAL', confidence: number }}
 */
export function analyzeSentimentKeyword(text) {
  if (!text || typeof text !== 'string') {
    return { sentiment: 'NEUTRAL', confidence: 0 };
  }

  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    const cleaned = word.replace(/[^a-z]/g, '');
    if (POSITIVE_KEYWORDS.includes(cleaned)) positiveCount++;
    if (NEGATIVE_KEYWORDS.includes(cleaned)) negativeCount++;
  }

  // Also check for multi-word phrases
  for (const phrase of POSITIVE_KEYWORDS) {
    if (phrase.includes(' ') && lower.includes(phrase)) positiveCount++;
  }
  for (const phrase of NEGATIVE_KEYWORDS) {
    if (phrase.includes(' ') && lower.includes(phrase)) negativeCount++;
  }

  const total = positiveCount + negativeCount;

  if (total === 0) {
    return { sentiment: 'NEUTRAL', confidence: 0.5 };
  }

  const positiveRatio = positiveCount / total;
  const negativeRatio = negativeCount / total;
  const dominance = Math.abs(positiveCount - negativeCount) / total;

  // Confidence scales with how decisive the keyword balance is and total matches
  const confidence = Math.min(0.95, 0.4 + dominance * 0.4 + Math.min(total, 10) * 0.02);

  if (positiveRatio > 0.6) {
    return { sentiment: 'POSITIVE', confidence: parseFloat(confidence.toFixed(2)) };
  } else if (negativeRatio > 0.6) {
    return { sentiment: 'NEGATIVE', confidence: parseFloat(confidence.toFixed(2)) };
  } else {
    return { sentiment: 'NEUTRAL', confidence: parseFloat(Math.max(0.3, confidence - 0.1).toFixed(2)) };
  }
}

/**
 * Use Claude Haiku for nuanced batch sentiment analysis.
 *
 * @param {Array<string>} texts - Array of texts to analyze
 * @returns {Array<{ sentiment: 'POSITIVE'|'NEGATIVE'|'NEUTRAL', confidence: number, reasoning: string }>}
 */
export async function analyzeSentimentBatch(texts) {
  const systemPrompt = `You are a sentiment analysis engine for a social media management platform.
Analyze the sentiment of each provided text with nuance — consider sarcasm, context, and implied meaning.
Always respond with valid JSON matching this exact schema:
[
  {
    "index": number,
    "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
    "confidence": number between 0 and 1,
    "reasoning": "brief explanation of sentiment determination"
  }
]
Return one object per input text, in the same order as provided.`;

  try {
    const context = {
      task: 'Analyze sentiment for each of the following texts',
      texts: texts.map((t, i) => ({ index: i, text: t?.substring(0, 500) })),
    };

    const result = await generateInsight('sentiment/batch-analysis', context, {
      systemPrompt,
      maxTokens: 2048,
    });

    // Handle both array response and wrapped response
    if (Array.isArray(result)) {
      return result;
    }
    if (result.results && Array.isArray(result.results)) {
      return result.results;
    }
    // Fallback: return keyword-based analysis for each text
    return texts.map((t) => ({
      ...analyzeSentimentKeyword(t),
      reasoning: 'Fallback to keyword-based analysis',
    }));
  } catch (error) {
    console.error('Failed to analyze sentiment batch:', error);
    return texts.map((t) => ({
      ...analyzeSentimentKeyword(t),
      reasoning: 'Fallback to keyword-based analysis due to error',
    }));
  }
}

/**
 * Use Claude to classify the intent of a text message.
 *
 * @param {string} text - The text to classify
 * @returns {{ intent: 'question'|'complaint'|'praise'|'opportunity'|'spam', confidence: number, reasoning: string }}
 */
export async function classifyIntent(text) {
  const systemPrompt = `You are an intent classification engine for a social media management platform.
Classify the intent of the provided text into exactly one of these categories:
- "question": The author is asking a question or seeking information.
- "complaint": The author is expressing dissatisfaction or reporting a problem.
- "praise": The author is expressing positive sentiment or appreciation.
- "opportunity": The text represents a business opportunity, partnership potential, or lead.
- "spam": The text is promotional spam, bot-generated, or irrelevant noise.

Always respond with valid JSON matching this exact schema:
{
  "intent": "question" | "complaint" | "praise" | "opportunity" | "spam",
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation of classification"
}`;

  try {
    const context = {
      task: 'Classify the intent of this text',
      text: text?.substring(0, 1000),
    };

    return await generateInsight('sentiment/classify-intent', context, {
      systemPrompt,
      maxTokens: 512,
    });
  } catch (error) {
    console.error('Failed to classify intent:', error);
    return {
      intent: 'question',
      confidence: 0,
      reasoning: 'Classification unavailable due to an error.',
    };
  }
}

/**
 * Use Claude to identify recurring themes from a batch of posts.
 *
 * @param {Array<string>} texts - Array of post texts to analyze
 * @returns {{ themes: Array<{ name: string, frequency: number, sentiment: string, representativeTexts: string[] }> }}
 */
export async function extractThemes(texts) {
  const systemPrompt = `You are a thematic analysis engine for a social media management platform.
Identify recurring themes from the provided batch of social media posts.
Group related discussions and surface the most significant topics.
Always respond with valid JSON matching this exact schema:
{
  "themes": [
    {
      "name": "string - concise theme name",
      "frequency": number - how many of the provided texts relate to this theme,
      "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED",
      "representativeTexts": ["string - short excerpt from 1-3 representative posts"]
    }
  ]
}
Return themes ordered by frequency (most common first). Identify 3-8 themes.`;

  try {
    const context = {
      task: 'Extract recurring themes from these social media posts',
      totalPosts: texts.length,
      texts: texts.map((t, i) => ({ index: i, text: t?.substring(0, 300) })),
    };

    return await generateInsight('sentiment/extract-themes', context, {
      systemPrompt,
      maxTokens: 2048,
    });
  } catch (error) {
    console.error('Failed to extract themes:', error);
    return { themes: [] };
  }
}
