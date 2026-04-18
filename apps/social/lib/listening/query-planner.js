/**
 * Query Planner
 * -------------
 * Pure function that turns a list of BrandEntity rows into the set of ListeningQuery
 * rows needed to capture every valid mention of those entities on X.
 *
 * Each planner output is a `PlannedQuery` object ({ queryString, template, entityId }),
 * which the reconciler then materializes as a row in the `listening_queries` table.
 *
 * Design principles:
 *   1. PURE. Same input → same output. Unit-testable with no network/DB.
 *   2. ONE TEMPLATE = ONE QUERY. Each template emits a single query per entity;
 *      the reconciler can diff cleanly by (entityId, template) tuple.
 *   3. FEWER QUERIES > MORE. When an entity has multiple handles/tickers/hashtags,
 *      we OR them into ONE query (minimizes API calls vs. 1-per-handle).
 *   4. SAFE DEFAULTS. Every query includes `lang:en` to cut non-English noise; every
 *      query applies entity.negativeTerms as `-term` exclusions; min_faves is opt-in.
 */

const TEMPLATE = Object.freeze({
  MENTION_SWEEP: 'mention_sweep',             // tweets mentioning any @handle (excluding self-posts)
  TICKER_SWEEP: 'ticker_sweep',               // $TICKER or $ticker
  NAME_SWEEP: 'name_sweep',                   // "Canonical Name" or aliases
  AMBIGUOUS_NAME_SWEEP: 'ambig_name_sweep',   // ambiguous name + qualifier AND-group
  HASHTAG_SWEEP: 'hashtag_sweep',             // any tracked hashtag
  FROM_ACCOUNT_SWEEP: 'from_account_sweep',   // (from:handle1 OR from:handle2) — what brand says about itself
  PERSON_SWEEP: 'person_sweep',               // for PERSON entities: posts by/about them with brand context
});

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** Quote a term if it contains whitespace or special chars (keeps unquoted tickers). */
function quote(term) {
  if (!term) return term;
  const needsQuoting = /\s|[-:]/.test(term) || (!term.startsWith('$') && !term.startsWith('#'));
  return needsQuoting ? `"${term.replace(/"/g, '')}"` : term;
}

/** OR-group a list of terms, each optionally quoted. Returns "" for empty lists. */
function orGroup(terms, { shouldQuote = true } = {}) {
  const valid = (terms || []).map((t) => t.trim()).filter(Boolean);
  if (!valid.length) return '';
  const parts = valid.map((t) => (shouldQuote ? quote(t) : t));
  return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
}

/** Normalize a handle (strip @, lowercase for comparison). */
function cleanHandle(h) {
  return String(h || '').replace(/^@/, '').trim();
}

/** Normalize a hashtag (ensure leading #). */
function cleanHashtag(t) {
  const s = String(t || '').trim();
  if (!s) return '';
  return s.startsWith('#') ? s : `#${s}`;
}

/** Normalize a ticker (ensure leading $). */
function cleanTicker(t) {
  const s = String(t || '').trim();
  if (!s) return '';
  return s.startsWith('$') ? s : `$${s}`;
}

/** Build the `-term1 -term2 ...` suffix from negativeTerms. */
function negSuffix(negativeTerms) {
  const valid = (negativeTerms || []).map((t) => String(t).trim()).filter(Boolean);
  if (!valid.length) return '';
  return valid.map((t) => (/\s/.test(t) ? `-"${t}"` : `-${t}`)).join(' ');
}

/** Apply lang:en, negatives, and optional min_faves. */
function wrap(body, entity) {
  const parts = [body];
  const neg = negSuffix(entity.negativeTerms);
  if (neg) parts.push(neg);
  if (entity.minFaves && entity.minFaves > 0) parts.push(`min_faves:${entity.minFaves}`);
  parts.push('lang:en');
  return parts.filter(Boolean).join(' ');
}

// ------------------------------------------------------------
// Templates
// ------------------------------------------------------------

function mentionSweep(entity) {
  const handles = (entity.xHandles || []).map(cleanHandle).filter(Boolean);
  if (!handles.length) return null;
  // Mention any handle but exclude tweets FROM those handles (self-posts handled by
  // FROM_ACCOUNT_SWEEP so they don't collide).
  const mentionGroup = orGroup(handles.map((h) => `@${h}`), { shouldQuote: false });
  const excludeSelf = handles.map((h) => `-from:${h}`).join(' ');
  return { template: TEMPLATE.MENTION_SWEEP, queryString: wrap(`${mentionGroup} ${excludeSelf}`, entity) };
}

function tickerSweep(entity) {
  const tickers = (entity.tickers || []).map(cleanTicker).filter(Boolean);
  if (!tickers.length) return null;
  return { template: TEMPLATE.TICKER_SWEEP, queryString: wrap(orGroup(tickers, { shouldQuote: false }), entity) };
}

function nameSweep(entity) {
  if (entity.isAmbiguous) return null;
  const names = [entity.canonicalName, ...(entity.aliases || [])].filter(Boolean);
  if (!names.length) return null;
  return { template: TEMPLATE.NAME_SWEEP, queryString: wrap(orGroup(names), entity) };
}

function ambiguousNameSweep(entity) {
  if (!entity.isAmbiguous) return null;
  const names = [entity.canonicalName, ...(entity.aliases || [])].filter(Boolean);
  const qualifiers = entity.qualifiers || [];
  if (!names.length || !qualifiers.length) return null;
  const nameGroup = orGroup(names);
  const qualGroup = orGroup(qualifiers);
  return { template: TEMPLATE.AMBIGUOUS_NAME_SWEEP, queryString: wrap(`${nameGroup} ${qualGroup}`, entity) };
}

function hashtagSweep(entity) {
  const tags = (entity.hashtags || []).map(cleanHashtag).filter(Boolean);
  if (!tags.length) return null;
  return { template: TEMPLATE.HASHTAG_SWEEP, queryString: wrap(orGroup(tags, { shouldQuote: false }), entity) };
}

function fromAccountSweep(entity) {
  const handles = (entity.xHandles || []).map(cleanHandle).filter(Boolean);
  if (!handles.length) return null;
  const group = handles.length === 1
    ? `from:${handles[0]}`
    : `(${handles.map((h) => `from:${h}`).join(' OR ')})`;
  return { template: TEMPLATE.FROM_ACCOUNT_SWEEP, queryString: wrap(group, entity) };
}

function personSweep(entity) {
  if (entity.kind !== 'PERSON') return null;
  const handles = (entity.xHandles || []).map(cleanHandle).filter(Boolean);
  const names = [entity.canonicalName, ...(entity.aliases || [])].filter(Boolean);
  const qualifiers = entity.qualifiers || [];
  if ((!handles.length && !names.length) || !qualifiers.length) return null;

  // Mix operator-style terms (from:X, @X — never quote) with name terms (must quote
  // when they contain whitespace). Hand-combine instead of a single orGroup call.
  const subjectParts = [
    ...handles.map((h) => `from:${h}`),
    ...handles.map((h) => `@${h}`),
    ...names.map((n) => quote(n)),
  ];
  const subjectGroup = subjectParts.length === 1 ? subjectParts[0] : `(${subjectParts.join(' OR ')})`;
  const qualGroup = orGroup(qualifiers);
  return { template: TEMPLATE.PERSON_SWEEP, queryString: wrap(`${subjectGroup} ${qualGroup}`, entity) };
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * Generate the complete set of queries for a single entity.
 * Returns an array of { template, queryString } — caller attaches entityId/topicId.
 */
export function planQueriesForEntity(entity) {
  if (!entity || entity.enabled === false) return [];
  const builders = [
    mentionSweep,
    tickerSweep,
    nameSweep,
    ambiguousNameSweep,
    hashtagSweep,
    fromAccountSweep,
    personSweep,
  ];
  return builders.map((fn) => fn(entity)).filter(Boolean);
}

/**
 * Generate queries for every entity in a topic. Returns rows shaped like the desired
 * `listening_queries` table state, minus the id/createdAt — the reconciler diffs these
 * against actual rows.
 */
export function planQueriesForTopic(topicId, entities) {
  const rows = [];
  for (const entity of entities || []) {
    const planned = planQueriesForEntity(entity);
    for (const q of planned) {
      rows.push({
        topicId,
        platform: 'X',
        queryString: q.queryString,
        negativeKeywords: entity.negativeTerms || [],
        generatedBy: 'ontology',
        active: true,
        sourceEntityId: entity.id,
        sourceTemplate: q.template,
      });
    }
  }
  return rows;
}

// Exposed for unit tests that want to probe internals.
export const __test = { quote, orGroup, cleanHandle, cleanHashtag, cleanTicker, negSuffix, wrap, TEMPLATE };
