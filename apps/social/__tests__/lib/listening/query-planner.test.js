import { describe, it, expect } from 'vitest';
import { planQueriesForEntity, planQueriesForTopic, __test } from '@/lib/listening/query-planner.js';

// Shared fixtures — read closely; they encode the exact semantics we want.

const figureMarkets = {
  id: 'e-fm',
  kind: 'BRAND',
  canonicalName: 'Figure Markets',
  aliases: ['FigureMarkets'],
  tickers: [],
  xHandles: ['Figure', 'FigureMarkets'],
  redditUsers: [],
  hashtags: [],
  isAmbiguous: false,
  qualifiers: [],
  negativeTerms: ['figure out', 'figure skating'],
  minFaves: null,
  enabled: true,
};

const openNetwork = {
  id: 'e-open',
  kind: 'PRODUCT',
  canonicalName: 'OPEN network',
  aliases: ['On-chain Public Equity'],
  tickers: [],
  xHandles: [],
  redditUsers: [],
  hashtags: [],
  isAmbiguous: true,
  qualifiers: ['Figure', 'FIGR', 'Provenance'],
  negativeTerms: ['open source', 'open letter'],
  minFaves: 2,
  enabled: true,
};

const figrStock = {
  id: 'e-figr',
  kind: 'TOKEN',
  canonicalName: 'FIGR stock',
  aliases: [],
  tickers: ['$FIGR', 'FIGR_HELOC'],
  xHandles: [],
  redditUsers: [],
  hashtags: ['#FIGR'],
  isAmbiguous: false,
  qualifiers: [],
  negativeTerms: [],
  minFaves: null,
  enabled: true,
};

const mcagney = {
  id: 'e-mike',
  kind: 'PERSON',
  canonicalName: 'Mike Cagney',
  aliases: [],
  tickers: [],
  xHandles: ['mcagney'],
  redditUsers: [],
  hashtags: [],
  isAmbiguous: false,
  qualifiers: ['Figure', 'FIGR', 'Provenance', 'HELOC'],
  negativeTerms: [],
  minFaves: null,
  enabled: true,
};

// ============================================================
// Helpers (internal primitives that keep everything deterministic)
// ============================================================

describe('quote()', () => {
  it('does not quote tickers', () => {
    expect(__test.quote('$FIGR')).toBe('$FIGR');
  });
  it('does not quote hashtags', () => {
    expect(__test.quote('#FIGR')).toBe('#FIGR');
  });
  it('quotes multi-word terms', () => {
    expect(__test.quote('Figure Markets')).toBe('"Figure Markets"');
  });
  it('quotes single words (to be safe against operator collisions)', () => {
    expect(__test.quote('Hastra')).toBe('"Hastra"');
  });
});

describe('orGroup()', () => {
  it('returns empty string for empty input', () => {
    expect(__test.orGroup([])).toBe('');
  });
  it('returns bare term for single input', () => {
    expect(__test.orGroup(['Hastra'])).toBe('"Hastra"');
  });
  it('ORs multiple terms with parens', () => {
    expect(__test.orGroup(['Hastra', 'HastraFi'])).toBe('("Hastra" OR "HastraFi")');
  });
});

describe('negSuffix()', () => {
  it('returns empty when no negatives', () => {
    expect(__test.negSuffix([])).toBe('');
  });
  it('prefixes single-word negatives with -', () => {
    expect(__test.negSuffix(['scam', 'airdrop'])).toBe('-scam -airdrop');
  });
  it('quotes multi-word negatives', () => {
    expect(__test.negSuffix(['figure out', 'figure skating']))
      .toBe('-"figure out" -"figure skating"');
  });
});

// ============================================================
// Template-level assertions
// ============================================================

describe('planQueriesForEntity — Figure Markets (brand with handles)', () => {
  const queries = planQueriesForEntity(figureMarkets);
  const byTemplate = Object.fromEntries(queries.map((q) => [q.template, q.queryString]));

  it('emits a MENTION_SWEEP that ORs @-mentions and excludes self-posts', () => {
    expect(byTemplate.mention_sweep).toBe(
      '(@Figure OR @FigureMarkets) -from:Figure -from:FigureMarkets -"figure out" -"figure skating" lang:en'
    );
  });

  it('emits a NAME_SWEEP for canonical + aliases', () => {
    expect(byTemplate.name_sweep).toBe(
      '("Figure Markets" OR "FigureMarkets") -"figure out" -"figure skating" lang:en'
    );
  });

  it('emits a FROM_ACCOUNT_SWEEP so we always capture posts by the brand', () => {
    expect(byTemplate.from_account_sweep).toBe(
      '(from:Figure OR from:FigureMarkets) -"figure out" -"figure skating" lang:en'
    );
  });

  it('does NOT emit ticker/hashtag/ambiguous/person templates (not applicable)', () => {
    expect(byTemplate.ticker_sweep).toBeUndefined();
    expect(byTemplate.hashtag_sweep).toBeUndefined();
    expect(byTemplate.ambig_name_sweep).toBeUndefined();
    expect(byTemplate.person_sweep).toBeUndefined();
  });
});

describe('planQueriesForEntity — OPEN network (ambiguous product)', () => {
  const queries = planQueriesForEntity(openNetwork);
  const byTemplate = Object.fromEntries(queries.map((q) => [q.template, q.queryString]));

  it('uses AMBIGUOUS_NAME_SWEEP with qualifier AND-group and respects min_faves', () => {
    expect(byTemplate.ambig_name_sweep).toBe(
      '("OPEN network" OR "On-chain Public Equity") ("Figure" OR "FIGR" OR "Provenance") -"open source" -"open letter" min_faves:2 lang:en'
    );
  });

  it('does NOT emit the plain NAME_SWEEP (ambiguous entities skip it)', () => {
    expect(byTemplate.name_sweep).toBeUndefined();
  });
});

describe('planQueriesForEntity — $FIGR (ticker + hashtag, no handles)', () => {
  const queries = planQueriesForEntity(figrStock);
  const byTemplate = Object.fromEntries(queries.map((q) => [q.template, q.queryString]));

  it('emits a TICKER_SWEEP with $-prefixed tickers', () => {
    expect(byTemplate.ticker_sweep).toBe('($FIGR OR $FIGR_HELOC) lang:en');
  });

  it('emits a HASHTAG_SWEEP', () => {
    expect(byTemplate.hashtag_sweep).toBe('#FIGR lang:en');
  });

  it('still emits a NAME_SWEEP for the canonical name', () => {
    expect(byTemplate.name_sweep).toBe('"FIGR stock" lang:en');
  });

  it('does NOT emit mention / from-account (no handles)', () => {
    expect(byTemplate.mention_sweep).toBeUndefined();
    expect(byTemplate.from_account_sweep).toBeUndefined();
  });
});

describe('planQueriesForEntity — Mike Cagney (PERSON)', () => {
  const queries = planQueriesForEntity(mcagney);
  const byTemplate = Object.fromEntries(queries.map((q) => [q.template, q.queryString]));

  it('emits a PERSON_SWEEP combining from:/ @handle / name with brand qualifiers', () => {
    expect(byTemplate.person_sweep).toBe(
      '(from:mcagney OR @mcagney OR "Mike Cagney") ("Figure" OR "FIGR" OR "Provenance" OR "HELOC") lang:en'
    );
  });

  it('also emits MENTION_SWEEP and FROM_ACCOUNT_SWEEP since it has a handle', () => {
    expect(byTemplate.mention_sweep).toBeDefined();
    expect(byTemplate.from_account_sweep).toBe('from:mcagney lang:en');
  });
});

describe('planQueriesForEntity — disabled entity returns nothing', () => {
  it('skips when enabled=false', () => {
    expect(planQueriesForEntity({ ...figureMarkets, enabled: false })).toEqual([]);
  });
});

// ============================================================
// Topic-level integration
// ============================================================

describe('planQueriesForTopic', () => {
  it('aggregates planned queries across all entities and attaches topic/entity metadata', () => {
    const rows = planQueriesForTopic('topic-1', [figureMarkets, openNetwork]);
    expect(rows.length).toBeGreaterThanOrEqual(4); // FM has ≥3, OPEN has 1
    for (const r of rows) {
      expect(r.topicId).toBe('topic-1');
      expect(r.platform).toBe('X');
      expect(r.generatedBy).toBe('ontology');
      expect(r.active).toBe(true);
      expect(r.sourceEntityId).toBeTruthy();
      expect(r.sourceTemplate).toBeTruthy();
    }
    // Both entities should be represented at least once.
    const entityIds = new Set(rows.map((r) => r.sourceEntityId));
    expect(entityIds.has('e-fm')).toBe(true);
    expect(entityIds.has('e-open')).toBe(true);
  });

  it('is deterministic — same input produces byte-identical output', () => {
    const a = planQueriesForTopic('t', [figureMarkets, openNetwork, figrStock, mcagney]);
    const b = planQueriesForTopic('t', [figureMarkets, openNetwork, figrStock, mcagney]);
    expect(a).toEqual(b);
  });
});
