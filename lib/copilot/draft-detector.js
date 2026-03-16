/**
 * Detects whether an assistant message contains draft content
 * that could be inserted into the composer editor.
 */
export function detectDraftContent(messageText) {
  if (!messageText) return false;

  // Check for explicit draft markers
  const draftPatterns = [
    /(?:here'?s?\s+(?:a|the|your)\s+)?draft[:\s]/i,
    /```(?:draft|post|thread|tweet)/i,
    /##\s*(?:Draft|Post|Thread|Tweet)/i,
  ];

  const hasDraftMarker = draftPatterns.some(p => p.test(messageText));

  // Check for thread format (numbered items or array-like structure)
  const hasThreadFormat = /(?:^|\n)\s*(?:\d+[.)]\s|Tweet \d|Post \d)/m.test(messageText);

  return hasDraftMarker || hasThreadFormat;
}
