/**
 * Centralised API cost constants.
 *
 * All estimated per-request costs live here so they can be updated in one
 * place when pricing changes. Values are in USD.
 */

export const API_COSTS = {
  // TwitterAPI.io — $0.15 per 1K requests
  TWITTERAPI_IO: 0.00015,

  // Reddit OAuth API — $0.24 per 1K calls (estimated)
  REDDIT_OAUTH: 0.00024,

  // SociaVault — $29 per 6K credits
  SOCIAVAULT: 0.0048,

  // X Official API (Basic tier)
  X_OFFICIAL_GET: 0.003,
  X_OFFICIAL_POST: 0.01,

  // Claude AI (Haiku 3.5)
  CLAUDE_INPUT_PER_TOKEN: 0.00000025,   // $0.25 per 1M input tokens
  CLAUDE_OUTPUT_PER_TOKEN: 0.00000125,  // $1.25 per 1M output tokens

  // Claude AI (Sonnet 4)
  CLAUDE_SONNET_INPUT_PER_TOKEN: 0.000003,   // $3 per 1M input tokens
  CLAUDE_SONNET_OUTPUT_PER_TOKEN: 0.000015,  // $15 per 1M output tokens
};
