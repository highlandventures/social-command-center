/**
 * Adapter barrel exports.
 *
 * Re-exports all platform adapters from a single location.
 * New code should import from '@/lib/adapters' instead of individual files.
 * Existing imports from '@/lib/x-adapter' etc. still work (no breaking change).
 *
 * Future work: move the actual adapter files into this directory.
 */

export { XPlatformAdapter } from '../x-adapter';
export { RedditAdapter } from '../reddit-adapter';
export { getValidToken } from '../token-refresh';
