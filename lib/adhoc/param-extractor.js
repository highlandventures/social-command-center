/**
 * Extracts report generation parameters from an assistant message.
 *
 * Looks for a JSON block containing {"action":"generate","params":{...}}
 * in the message text, supporting both markdown code fences and raw JSON.
 *
 * @param {string} text - The assistant message content
 * @returns {{ title: string, dateStart: string, dateEnd: string, reportType: string, metricsScope: string, comparisonBaseline: string } | null}
 */
export function extractReportParams(text) {
  if (!text || typeof text !== 'string') return null;

  // Try markdown code fence first (```json ... ``` or ``` ... ```)
  const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)```/;
  const fenceMatch = text.match(fenceRegex);

  if (fenceMatch) {
    const parsed = tryParseGenerateBlock(fenceMatch[1].trim());
    if (parsed) return parsed;
  }

  // Try raw JSON with action:"generate"
  const rawRegex = /\{[^{}]*"action"\s*:\s*"generate"[^{}]*"params"\s*:\s*\{[^}]*\}[^}]*\}/;
  const rawMatch = text.match(rawRegex);

  if (rawMatch) {
    const parsed = tryParseGenerateBlock(rawMatch[0]);
    if (parsed) return parsed;
  }

  return null;
}

/**
 * Attempts to parse a JSON string as a generate action block.
 * Returns the params object if valid, null otherwise.
 */
function tryParseGenerateBlock(jsonString) {
  try {
    const obj = JSON.parse(jsonString);
    if (obj?.action === 'generate' && obj?.params) {
      const { title, dateStart, dateEnd, reportType, metricsScope, comparisonBaseline } = obj.params;
      return { title, dateStart, dateEnd, reportType, metricsScope, comparisonBaseline };
    }
    return null;
  } catch {
    return null;
  }
}
