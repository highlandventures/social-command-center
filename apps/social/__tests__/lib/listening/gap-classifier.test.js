import { describe, it, expect } from 'vitest';
import { classifyGap, __test } from '@/lib/listening/gap-classifier.js';

// Minimal fixture ontology — three entities, each with different identifying fields.
const entities = [
  {
    id: 'e-fm',
    kind: 'PRODUCT',
    canonicalName: 'Figure Markets',
    aliases: ['FigureMarkets'],
    tickers: [],
    xHandles: ['FigureMarkets'],
    hashtags: [],
  },
  {
    id: 'e-ft',
    kind: 'BRAND',
    canonicalName: 'Figure Technology Solutions',
    aliases: ['FigureTech', 'Figure Technologies'],
    tickers: ['$FIGR'],
    xHandles: ['Figure'],
    hashtags: [],
  },
  {
    id: 'e-mc',
    kind: 'PERSON',
    canonicalName: 'Mike Cagney',
    aliases: [],
    tickers: [],
    xHandles: ['mcagney'],
    hashtags: [],
  },
];

describe('extractCandidateTokens', () => {
  it('pulls handles, tickers, hashtags, and proper nouns', () => {
    const tokens = __test.extractCandidateTokens({
      content: 'Excited to see @FigureMarkets launch $FIGR with #FigureHELOC',
      authorUsername: 'someone',
    });
    expect(tokens).toEqual(expect.arrayContaining(['someone', 'figuremarkets', '$figr', '#figureheloc']));
  });

  it('ignores stopwords in capitalized phrases', () => {
    const tokens = __test.extractCandidateTokens({ content: 'The Big Launch Today', authorUsername: '' });
    // "The" should not make it through, but "Big Launch Today" should
    expect(tokens.some((t) => t.includes('big'))).toBe(true);
  });
});

describe('classifyGap — EXTEND_ENTITY', () => {
  it('matches an existing handle with a typo/variant → extend xHandles', () => {
    const result = classifyGap(
      { content: 'Shoutout to @figure_markets for the launch', authorUsername: 'figure_markets' },
      entities
    );
    expect(result.mode).toBe('EXTEND_ENTITY');
    expect(result.entity.canonicalName).toBe('Figure Markets');
    expect(result.field).toBe('xHandles');
  });

  it('matches the $FIGR ticker mentioned without the $ prefix', () => {
    const result = classifyGap(
      { content: 'Big news for FIGR today', authorUsername: '' },
      entities
    );
    expect(result.mode).toBe('EXTEND_ENTITY');
    expect(result.entity.canonicalName).toBe('Figure Technology Solutions');
  });

  it('matches "figuretech" to the Figure Technologies alias', () => {
    const result = classifyGap({ content: 'FigureTech is growing fast', authorUsername: '' }, entities);
    expect(result.mode).toBe('EXTEND_ENTITY');
    expect(result.entity.canonicalName).toBe('Figure Technology Solutions');
  });
});

describe('classifyGap — CREATE_ENTITY', () => {
  it('falls back to CREATE when nothing matches', () => {
    const result = classifyGap(
      { content: 'Thoughts on @rhubarb_labs_xyz and their new token?', authorUsername: 'rhubarb_labs_xyz' },
      entities
    );
    expect(result.mode).toBe('CREATE_ENTITY');
    expect(result.suggestedHandles).toContain('rhubarb_labs_xyz');
  });

  it('returns empty suggestion when input has no identifying tokens', () => {
    const result = classifyGap({ content: '', authorUsername: '' }, entities);
    expect(result.mode).toBe('CREATE_ENTITY');
    expect(result.tokens).toEqual([]);
  });
});
