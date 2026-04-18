import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './db';
import { API_COSTS } from './api-costs';

let anthropicClient = null;

// Shared preamble for all AI prompts — avoids repeating in every system prompt
export const AI_PREAMBLE = 'You are a social media analyst. Always respond with valid JSON matching the schema below.';

function getAnthropic() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

// Generic insight generator with cost tracking
export async function generateInsight(type, context, options = {}) {
  const anthropic = getAnthropic();
  const model = options.model || 'claude-haiku-4-5-20251001';
  const systemPrompt = options.systemPrompt || 'You are an AI assistant for a social media management platform. Always respond with valid JSON.';

  const startTime = Date.now();
  const response = await anthropic.messages.create({
    model,
    max_tokens: options.maxTokens || 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: typeof context === 'string' ? context : JSON.stringify(context) }],
  });

  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  const isSonnet = model.includes('sonnet') || model.includes('opus');
  const inputRate = isSonnet ? API_COSTS.CLAUDE_SONNET_INPUT_PER_TOKEN : API_COSTS.CLAUDE_INPUT_PER_TOKEN;
  const outputRate = isSonnet ? API_COSTS.CLAUDE_SONNET_OUTPUT_PER_TOKEN : API_COSTS.CLAUDE_OUTPUT_PER_TOKEN;
  const estimatedCost = ((response.usage?.input_tokens || 0) * inputRate) + ((response.usage?.output_tokens || 0) * outputRate);

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
function parseAIJSON(text) {
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

  // 4. Salvage a truncated response. Common pattern: AI hit max_tokens mid-JSON,
  //    so there's an unclosed fence and unbalanced braces. Strip the leading
  //    fence, tally the unclosed brackets, and append closers in reverse order.
  //    Lets the UI render whatever structured data made it through instead of
  //    showing an empty card (see ticket cmo3k3mve).
  try {
    const salvage = salvageTruncatedJSON(text);
    if (salvage) return salvage;
  } catch {
    // salvage is best-effort; fall through to raw.
  }

  // 5. Fallback — return raw text so the caller can still display something
  return { raw: text };
}

function salvageTruncatedJSON(text) {
  // Strip leading ```json or ``` fence.
  let body = text.trim();
  const fenceStart = body.match(/^```(?:json)?\s*\n?/);
  if (fenceStart) body = body.slice(fenceStart[0].length);
  // If there's a trailing fence somewhere, truncate at it.
  const trailingFence = body.lastIndexOf('```');
  if (trailingFence !== -1) body = body.slice(0, trailingFence);

  body = body.trim();
  if (!body.startsWith('{') && !body.startsWith('[')) return null;

  // Walk forward to find the last position where the JSON was structurally sound
  // (depth > 0, not mid-string, last character was a `,`|`}`|`]`|`"`). Then
  // drop trailing commas and balance open brackets so JSON.parse succeeds.
  let depth = 0;
  let inString = false;
  let escape = false;
  const stack = []; // track which bracket type was opened

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') { depth++; stack.push(ch); continue; }
    if (ch === '}' || ch === ']') { depth--; stack.pop(); continue; }
  }

  // Cut off any incomplete key/value after the last well-formed element.
  let trimmed = body.replace(/[\s,]*$/, '');
  // If we're mid-string, drop the unterminated piece.
  if (inString) {
    const lastQuote = trimmed.lastIndexOf('"');
    const prevQuote = trimmed.lastIndexOf('"', lastQuote - 1);
    if (prevQuote !== -1) trimmed = trimmed.slice(0, prevQuote).replace(/[\s,:]*$/, '');
  }
  // Drop a dangling key with no value (e.g. `"foo":` at end).
  trimmed = trimmed.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  trimmed = trimmed.replace(/\s*"[^"]*"\s*:\s*$/, '');

  // Close remaining open brackets in LIFO order.
  for (let i = stack.length - 1; i >= 0; i--) {
    trimmed += stack[i] === '{' ? '}' : ']';
  }

  try {
    const parsed = JSON.parse(trimmed);
    // Mark salvaged so the UI can annotate if it wants.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      parsed._truncated = true;
    }
    return parsed;
  } catch {
    return null;
  }
}
