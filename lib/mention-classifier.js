/**
 * Mention type classifier.
 *
 * Determines whether a social media mention is a REPLY, QUOTE, DM, or plain MENTION
 * by inspecting the raw API payload fields that each platform provides.
 *
 * This is pure logic with no API calls — safe and fast.
 */

/**
 * Classify an X (Twitter) mention into its mention type.
 *
 * X API fields used for classification:
 * - `in_reply_to_status_id` / `in_reply_to_user_id` → REPLY
 * - `referenced_tweets` with type "quoted" → QUOTE
 * - `referenced_tweets` with type "retweeted" → MENTION (retweet, treat as mention)
 * - `message_create` / DM-specific fields → DM
 * - Otherwise → MENTION (organic @mention)
 *
 * @param {Object} mention - Raw mention object from X/TwitterAPI.io
 * @returns {'REPLY'|'QUOTE'|'DM'|'MENTION'}
 */
export function classifyXMention(mention) {
  if (!mention || typeof mention !== 'object') return 'MENTION';

  // ── DM detection ──
  if (mention.message_create || mention.type === 'message_create' || mention.isDM) {
    return 'DM';
  }

  // ── Reply detection (v2 API) ──
  if (mention.in_reply_to_user_id || mention.in_reply_to_status_id || mention.in_reply_to_status_id_str) {
    return 'REPLY';
  }

  // ── v2 referenced_tweets detection ──
  const refs = mention.referenced_tweets || mention.referencedTweets || [];
  if (Array.isArray(refs) && refs.length > 0) {
    // Quote tweets take priority over retweets
    if (refs.some((r) => r.type === 'quoted')) return 'QUOTE';
    if (refs.some((r) => r.type === 'replied_to')) return 'REPLY';
    // Retweet — treat as a mention
    if (refs.some((r) => r.type === 'retweeted')) return 'MENTION';
  }

  // ── TwitterAPI.io / v1.1 fields ──
  if (mention.quoted_status || mention.quoted_status_id_str || mention.isQuote) {
    return 'QUOTE';
  }

  // ── Default: plain @mention ──
  return 'MENTION';
}

/**
 * Classify a Reddit mention/notification into its mention type.
 *
 * @param {Object} mention - Raw Reddit notification object
 * @returns {'REPLY'|'MENTION'}
 */
export function classifyRedditMention(mention) {
  if (!mention || typeof mention !== 'object') return 'MENTION';

  // Reddit inbox types: comment_reply, post_reply, username_mention, t4 (DM)
  const kind = mention.type || mention.kind || '';

  if (kind === 't4' || mention.was_comment === false) return 'DM';
  if (kind === 'comment_reply' || kind === 'post_reply') return 'REPLY';

  // username_mention or anything else
  return 'MENTION';
}

/**
 * Classify a mention for any supported platform.
 *
 * @param {string} platform - 'X' or 'REDDIT'
 * @param {Object} mention - Raw mention object from the platform API
 * @returns {'REPLY'|'QUOTE'|'DM'|'MENTION'}
 */
export function classifyMention(platform, mention) {
  if (platform === 'X') return classifyXMention(mention);
  if (platform === 'REDDIT') return classifyRedditMention(mention);
  return 'MENTION';
}
