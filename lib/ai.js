import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './db';
import { API_COSTS } from './api-costs';

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
  const estimatedCost = ((response.usage?.input_tokens || 0) * API_COSTS.CLAUDE_INPUT_PER_TOKEN) + ((response.usage?.output_tokens || 0) * API_COSTS.CLAUDE_OUTPUT_PER_TOKEN);

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
  // Try to parse as JSON — handle markdown code blocks, leading text, etc.
  return parseAIJSON(text);
}

/**
 * Robust JSON extraction from AI responses.
 * Handles:
 *  - Clean JSON
 *  - Markdown-wrapped JSON (```json ... ``` or ``` ... ```)
 *  - JSON embedded after explanatory text
 *  - Nested braces
 */
export function parseAIJSON(text) {
  if (!text || !text.trim()) return { raw: '' };

  // 1. Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch {
    // continue
  }

  // 2. Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // 3. Find the first top-level { ... } or [ ... ] block
  const jsonStart = text.search(/[\[{]/);
  if (jsonStart !== -1) {
    const openChar = text[jsonStart];
    const closeChar = openChar === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = jsonStart; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === openChar) depth++;
      if (ch === closeChar) depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(jsonStart, i + 1));
        } catch {
          break;
        }
      }
    }
  }

  // 4. Fallback — return raw text so the caller can still display something
  return { raw: text };
}
