/**
 * Unit tests for mention type classification.
 *
 * Tests classifyXMention and classifyRedditMention against
 * realistic API payloads from X v2, TwitterAPI.io, and Reddit.
 */

import { describe, it, expect } from 'vitest';
import { classifyXMention, classifyRedditMention, classifyMention } from '@/lib/mention-classifier';

describe('classifyXMention', () => {
  // ── REPLY detection ──

  it('detects reply via in_reply_to_user_id (v2)', () => {
    expect(classifyXMention({ in_reply_to_user_id: '12345', text: '@user hi' })).toBe('REPLY');
  });

  it('detects reply via in_reply_to_status_id (v1.1)', () => {
    expect(classifyXMention({ in_reply_to_status_id: '67890', text: '@user hi' })).toBe('REPLY');
  });

  it('detects reply via in_reply_to_status_id_str', () => {
    expect(classifyXMention({ in_reply_to_status_id_str: '67890', text: 'reply' })).toBe('REPLY');
  });

  it('detects reply via referenced_tweets with replied_to type', () => {
    expect(
      classifyXMention({
        referenced_tweets: [{ type: 'replied_to', id: '111' }],
        text: 'reply text',
      })
    ).toBe('REPLY');
  });

  // ── QUOTE detection ──

  it('detects quote tweet via referenced_tweets', () => {
    expect(
      classifyXMention({
        referenced_tweets: [{ type: 'quoted', id: '222' }],
        text: 'QT text',
      })
    ).toBe('QUOTE');
  });

  it('detects quote tweet via quoted_status (v1.1)', () => {
    expect(
      classifyXMention({
        quoted_status: { id: '333', text: 'original' },
        text: 'my thoughts',
      })
    ).toBe('QUOTE');
  });

  it('detects quote tweet via quoted_status_id_str', () => {
    expect(classifyXMention({ quoted_status_id_str: '444' })).toBe('QUOTE');
  });

  it('detects quote tweet via isQuote flag (TwitterAPI.io)', () => {
    expect(classifyXMention({ isQuote: true, text: 'look at this' })).toBe('QUOTE');
  });

  it('prioritizes QUOTE over RETWEET when both present in referenced_tweets', () => {
    expect(
      classifyXMention({
        referenced_tweets: [
          { type: 'retweeted', id: '555' },
          { type: 'quoted', id: '666' },
        ],
      })
    ).toBe('QUOTE');
  });

  // ── DM detection ──

  it('detects DM via message_create', () => {
    expect(classifyXMention({ message_create: { target: {} } })).toBe('DM');
  });

  it('detects DM via type field', () => {
    expect(classifyXMention({ type: 'message_create' })).toBe('DM');
  });

  it('detects DM via isDM flag', () => {
    expect(classifyXMention({ isDM: true })).toBe('DM');
  });

  // ── Plain MENTION (default) ──

  it('defaults to MENTION for plain @mention', () => {
    expect(classifyXMention({ text: '@figr_tech great product!' })).toBe('MENTION');
  });

  it('defaults to MENTION for retweet', () => {
    expect(
      classifyXMention({
        referenced_tweets: [{ type: 'retweeted', id: '777' }],
      })
    ).toBe('MENTION');
  });

  it('defaults to MENTION for empty object', () => {
    expect(classifyXMention({})).toBe('MENTION');
  });

  // ── Edge cases ──

  it('returns MENTION for null', () => {
    expect(classifyXMention(null)).toBe('MENTION');
  });

  it('returns MENTION for undefined', () => {
    expect(classifyXMention(undefined)).toBe('MENTION');
  });

  it('returns MENTION for non-object', () => {
    expect(classifyXMention('string')).toBe('MENTION');
  });

  it('handles referenced_tweets as non-array gracefully', () => {
    expect(classifyXMention({ referenced_tweets: 'not-an-array' })).toBe('MENTION');
  });
});

describe('classifyRedditMention', () => {
  it('detects comment_reply', () => {
    expect(classifyRedditMention({ type: 'comment_reply' })).toBe('REPLY');
  });

  it('detects post_reply', () => {
    expect(classifyRedditMention({ type: 'post_reply' })).toBe('REPLY');
  });

  it('detects DM via t4 kind', () => {
    expect(classifyRedditMention({ kind: 't4' })).toBe('DM');
  });

  it('detects DM via was_comment false', () => {
    expect(classifyRedditMention({ was_comment: false })).toBe('DM');
  });

  it('defaults to MENTION for username_mention', () => {
    expect(classifyRedditMention({ type: 'username_mention' })).toBe('MENTION');
  });

  it('defaults to MENTION for empty object', () => {
    expect(classifyRedditMention({})).toBe('MENTION');
  });

  it('returns MENTION for null', () => {
    expect(classifyRedditMention(null)).toBe('MENTION');
  });
});

describe('classifyMention (dispatcher)', () => {
  it('routes X mentions to classifyXMention', () => {
    expect(classifyMention('X', { in_reply_to_user_id: '1' })).toBe('REPLY');
  });

  it('routes Reddit mentions to classifyRedditMention', () => {
    expect(classifyMention('REDDIT', { type: 'comment_reply' })).toBe('REPLY');
  });

  it('returns MENTION for unknown platform', () => {
    expect(classifyMention('TIKTOK', { type: 'reply' })).toBe('MENTION');
  });
});
