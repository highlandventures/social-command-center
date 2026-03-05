import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './db';

let anthropicClient = null;

export function getAnthropic() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

// Generic insight generator with cost tracking
export async function generateInsight(type, context, options = {}) {
  const anthropic = getAnthropic();
  const model = options.model || 'claude-3-5-haiku-20241022';
  const systemPrompt = options.systemPrompt || 'You are an AI assistant for a social media management platform. Always respond with valid JSON.';

  const startTime = Date.now();
  const response = await anthropic.messages.create({
    model,
    max_tokens: options.maxTokens || 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: typeof context === 'string' ? context : JSON.stringify(context) }],
  });

  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  // Cost estimate for Haiku: $0.25/1M input, $1.25/1M output
  const estimatedCost = ((response.usage?.input_tokens || 0) * 0.00000025) + ((response.usage?.output_tokens || 0) * 0.00000125);

  // Log to APICallLog
  await prisma.aPICallLog.create({
    data: {
      provider: 'claude',
      endpoint: type,
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      tokensUsed,
      estimatedCost,
    },
  });

  const text = response.content?.[0]?.text || '';
  // Try to parse as JSON
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
