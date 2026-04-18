/**
 * Gap Classifier
 * --------------
 * Pure function that decides, for a diagnose gap, what the cheapest fix is.
 * Options, in preference order:
 *   1. EXTEND_ENTITY: a close-matching existing entity exists → the user should
 *      add the missing token to that entity's aliases / xHandles / tickers /
 *      hashtags. No new row, no planner template change.
 *   2. PROMOTE_TERM: the missing token is a generic ecosystem/brand phrase that
 *      would help many entities if globally promoted to HIGH_CONFIDENCE. Emitted
 *      when the token doesn't map cleanly to any one entity but is semantically
 *      close to the ontology (ecosystem term appearing multiple times in gaps).
 *   3. CREATE_ENTITY: genuinely new brand/product/person/token with no nearby
 *      entity. Falls through when EXTEND and PROMOTE both decline.
 *   4. NEEDS_TEMPLATE: nothing the planner emits could catch this pattern (rare).
 *      Requires a code-level PR — the tool exports a markdown snippet for review.
 */

/** Tokenize tweet content into candidate tokens the fix might target. */
function extractCandidateTokens({ content, authorUsername }) {
  const tokens = new Set();
  const author = (authorUsername || '').replace(/^@/, '').toLowerCase();
  if (author) tokens.add(author);

  const text = (content || '').toLowerCase();
  // @ handles, $ tickers, # hashtags — explicit social tokens
  for (const h of text.match(/@[a-z0-9_]+/g) || []) tokens.add(h.slice(1));
  for (const t of text.match(/\$[a-z0-9_]+/gi) || []) tokens.add(t.toLowerCase());
  for (const h of text.match(/#[a-z0-9_]+/g) || []) tokens.add(h.toLowerCase());
  // CamelCase / capitalized multi-word phrases (length > 3 chars), up to 3 words
  for (const m of content?.match(/\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\b/g) || []) {
    if (m.length > 3 && !/^(The|This|That|And|But|Not|For|With|From|Just)$/i.test(m)) {
      tokens.add(m.toLowerCase());
    }
  }
  return [...tokens].filter(Boolean);
}

/**
 * Levenshtein distance, capped for performance (max length 30).
 * Returns Infinity if either string is longer than cap.
 */
function editDistance(a, b, cap = 30) {
  if (a === b) return 0;
  if (a.length > cap || b.length > cap) return Infinity;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/** Normalized edit similarity (0 = totally different, 1 = identical). */
function similarity(a, b) {
  const max = Math.max(a.length, b.length);
  if (!max) return 1;
  const d = editDistance(a, b);
  if (d === Infinity) return 0;
  return 1 - d / max;
}

/**
 * For each token, check if any existing entity has an alias/handle/ticker close
 * to it (similarity ≥ 0.75 OR one is a substring of the other and both are > 3 chars).
 * Returns the best match or null.
 */
function findClosestEntity(token, entities) {
  let best = null;
  let bestScore = 0;
  const t = token.toLowerCase().trim();
  if (!t) return null;

  for (const entity of entities) {
    const candidates = [
      entity.canonicalName,
      ...(entity.aliases || []),
      ...(entity.xHandles || []).map((h) => String(h).replace(/^@/, '')),
      ...(entity.tickers || []).map((x) => String(x).replace(/^\$/, '')),
      ...(entity.hashtags || []).map((h) => String(h).replace(/^#/, '')),
    ].map((s) => String(s || '').toLowerCase().trim()).filter(Boolean);

    for (const cand of candidates) {
      let score = similarity(t, cand);

      // Substring match boost — "@figure_pay" → candidate "figurepay" etc.
      if (t.length > 3 && cand.length > 3) {
        if (t.includes(cand) || cand.includes(t)) {
          score = Math.max(score, 0.82);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        best = { entity, matchedField: fieldForCandidate(entity, cand), candidate: cand, score };
      }
    }
  }

  // Threshold: 0.75. Below that we don't treat it as a close match.
  return bestScore >= 0.75 ? best : null;
}

function fieldForCandidate(entity, cand) {
  const low = (s) => String(s || '').toLowerCase();
  if (low(entity.canonicalName) === cand) return 'canonicalName';
  if ((entity.aliases || []).some((x) => low(x) === cand)) return 'aliases';
  if ((entity.xHandles || []).some((x) => low(String(x).replace(/^@/, '')) === cand)) return 'xHandles';
  if ((entity.tickers || []).some((x) => low(String(x).replace(/^\$/, '')) === cand)) return 'tickers';
  if ((entity.hashtags || []).some((x) => low(String(x).replace(/^#/, '')) === cand)) return 'hashtags';
  return 'aliases';
}

/**
 * For a token like `@figure_pay`, suggest which field it should be added to if
 * EXTEND is chosen. @-handles → xHandles, $tickers → tickers, #tags → hashtags,
 * everything else → aliases.
 */
function suggestedFieldForToken(token) {
  if (token.startsWith('$')) return 'tickers';
  if (token.startsWith('#')) return 'hashtags';
  // An @-mention token comes in already stripped of @ from extractCandidateTokens,
  // so fall back to heuristic: if it's a single lowercase word w/ underscore/number, treat as handle.
  if (/^[a-z][a-z0-9_]+$/i.test(token) && token.length < 30 && !token.includes(' ')) return 'xHandles';
  return 'aliases';
}

/**
 * Main entry. Returns one of:
 *   { mode: 'EXTEND_ENTITY',   entity, field, token, score }
 *   { mode: 'CREATE_ENTITY',   suggestedName, suggestedHandles, suggestedKind }
 *   { mode: 'NEEDS_TEMPLATE',  reason, tokens, sampleContent }  — reserved; not emitted yet
 *
 * entities: array of BrandEntity rows with { canonicalName, aliases, xHandles, tickers, hashtags }
 */
export function classifyGap({ content, authorUsername }, entities) {
  const tokens = extractCandidateTokens({ content, authorUsername });
  if (!tokens.length) {
    return {
      mode: 'CREATE_ENTITY',
      suggestedName: '',
      suggestedHandles: [],
      suggestedKind: 'BRAND',
      tokens: [],
    };
  }

  // Find the best EXTEND candidate across all tokens.
  let bestExtend = null;
  for (const token of tokens) {
    const match = findClosestEntity(token, entities);
    if (match && (!bestExtend || match.score > bestExtend.score)) {
      bestExtend = { ...match, token };
    }
  }

  if (bestExtend) {
    return {
      mode: 'EXTEND_ENTITY',
      entity: bestExtend.entity,
      field: suggestedFieldForToken(bestExtend.token),
      matchedField: bestExtend.matchedField,
      token: bestExtend.token,
      similarity: Number(bestExtend.score.toFixed(2)),
      tokens,
    };
  }

  // Fall through: CREATE_ENTITY. Seed canonical name with the first plausible token.
  const handleLike = tokens.find((t) => /^[a-z][a-z0-9_]+$/i.test(t) && t.length > 2);
  return {
    mode: 'CREATE_ENTITY',
    suggestedName: handleLike || (content?.split(/\s+/)[0] || '').replace(/[^\w]/g, '').slice(0, 40),
    suggestedHandles: handleLike ? [handleLike] : (authorUsername ? [authorUsername.replace(/^@/, '')] : []),
    suggestedKind: 'BRAND',
    tokens,
  };
}

// Exposed for testing.
export const __test = { extractCandidateTokens, findClosestEntity, similarity, editDistance };
