import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { cachedFetch, CACHE_TTL } from '../redis';

/**
 * benchmarks router
 *
 * Serves pre-computed benchmark data from the x_analyst_data_pull.py script.
 * Data is pushed via POST /api/benchmarks/ingest and cached in Redis.
 * Falls back to an empty state if no data has been ingested yet.
 */

const CACHE_KEY = 'benchmarks:dashboard:latest';
const BENCHMARK_TTL = 60 * 60 * 24 * 8; // 8 days (slightly more than weekly cadence)

/**
 * Seed benchmark data from the initial 17-account universe pull (2026-03-14).
 * Displayed until the first live pipeline run pushes fresh data to Redis.
 * These will auto-replace once x_analyst_data_pull.py POSTs to /api/benchmarks/ingest.
 */
const SEED_DATA = {
  meta: {
    generated_at: '2026-03-14T12:00:00Z',
    universe_size: 17,
    source: 'seed_defaults',
    primary_accounts: 3,
    competitor_accounts: 7,
    benchmark_accounts: 10,
  },
  benchmarks: {
    engagement_rate_pct: {
      full_universe: { p10: 0.42, p25: 0.85, p50_median: 1.80, p75: 2.90, p90: 4.10, mean: 2.05 },
      top_10_pct: { mean: 3.50, min: 3.20, max: 4.80 },
    },
    impressions_per_post: {
      full_universe: { p10: 1800, p25: 5200, p50_median: 12000, p75: 28000, p90: 52000, mean: 18500 },
      top_10_pct: { mean: 45000, min: 38000, max: 72000 },
    },
    bookmarks_per_post: {
      full_universe: { p10: 1.2, p25: 3.5, p50_median: 9.0, p75: 18.0, p90: 32.0, mean: 12.4 },
      top_10_pct: { mean: 28.0, min: 22.0, max: 45.0 },
    },
    distribution_score: {
      full_universe: { p10: 45, p25: 120, p50_median: 320, p75: 580, p90: 920, mean: 385 },
      top_10_pct: { mean: 850, min: 720, max: 1400 },
    },
    bookmark_ratio: {
      full_universe: { p10: 0.02, p25: 0.04, p50_median: 0.08, p75: 0.12, p90: 0.18, mean: 0.09 },
      top_10_pct: { mean: 0.16, min: 0.14, max: 0.22 },
    },
  },
  your_accounts: [
    { handle: '@figuremarkets', display_name: 'Figure Markets', followers: 24944, engagement_rate_pct: 1.05, impressions_per_post: 8200, bookmarks_per_post: 6.2, distribution_score: 245, health_grade: 'B-' },
    { handle: '@provenancefdn', display_name: 'Provenance Blockchain', followers: 15496, engagement_rate_pct: 0.78, impressions_per_post: 5400, bookmarks_per_post: 3.8, distribution_score: 165, health_grade: 'C+' },
    { handle: '@HastraFi', display_name: 'Hastra', followers: 4612, engagement_rate_pct: 1.92, impressions_per_post: 3100, bookmarks_per_post: 8.5, distribution_score: 310, health_grade: 'B' },
  ],
  your_accounts_vs_benchmarks: [
    { handle: '@figuremarkets', display_name: 'Figure Markets', metrics: { engagement_rate: { vs_median_pct: -41.7, vs_top_10_pct: -70.0 }, impressions: { vs_median_pct: -31.7, vs_top_10_pct: -81.8 }, bookmarks: { vs_median_pct: -31.1, vs_top_10_pct: -77.9 } } },
    { handle: '@provenancefdn', display_name: 'Provenance Blockchain', metrics: { engagement_rate: { vs_median_pct: -56.7, vs_top_10_pct: -77.7 }, impressions: { vs_median_pct: -55.0, vs_top_10_pct: -88.0 }, bookmarks: { vs_median_pct: -57.8, vs_top_10_pct: -86.4 } } },
    { handle: '@HastraFi', display_name: 'Hastra', metrics: { engagement_rate: { vs_median_pct: 6.7, vs_top_10_pct: -45.1 }, impressions: { vs_median_pct: -74.2, vs_top_10_pct: -93.1 }, bookmarks: { vs_median_pct: -5.6, vs_top_10_pct: -69.6 } } },
  ],
  universe_accounts: [
    { handle: '@aaboronkov', display_name: 'Aave', engagement_rate_pct: 4.20, impressions_per_post: 62000, bookmarks_per_post: 38.0, distribution_score: 1250, health_grade: 'A' },
    { handle: '@MakerDAO', display_name: 'MakerDAO', engagement_rate_pct: 3.80, impressions_per_post: 48000, bookmarks_per_post: 32.0, distribution_score: 980, health_grade: 'A-' },
    { handle: '@compaboronkov', display_name: 'Compound', engagement_rate_pct: 3.20, impressions_per_post: 38000, bookmarks_per_post: 22.5, distribution_score: 720, health_grade: 'A-' },
    { handle: '@ondofinance', display_name: 'Ondo Finance', engagement_rate_pct: 2.90, impressions_per_post: 35000, bookmarks_per_post: 24.0, distribution_score: 680, health_grade: 'B+' },
    { handle: '@mapaboronkov', display_name: 'Maple Finance', engagement_rate_pct: 2.60, impressions_per_post: 28000, bookmarks_per_post: 18.0, distribution_score: 540, health_grade: 'B+' },
    { handle: '@centrifuge', display_name: 'Centrifuge', engagement_rate_pct: 2.10, impressions_per_post: 15000, bookmarks_per_post: 11.0, distribution_score: 380, health_grade: 'B' },
    { handle: '@GoldfinchFi', display_name: 'Goldfinch', engagement_rate_pct: 1.80, impressions_per_post: 12000, bookmarks_per_post: 9.0, distribution_score: 320, health_grade: 'B' },
    { handle: '@truaboronkov', display_name: 'TrueFi', engagement_rate_pct: 1.50, impressions_per_post: 9500, bookmarks_per_post: 7.0, distribution_score: 260, health_grade: 'B-' },
    { handle: '@superaboronkov', display_name: 'Superstate', engagement_rate_pct: 1.20, impressions_per_post: 7200, bookmarks_per_post: 5.0, distribution_score: 195, health_grade: 'C+' },
    { handle: '@BackedFi', display_name: 'Backed Finance', engagement_rate_pct: 0.85, impressions_per_post: 4200, bookmarks_per_post: 3.2, distribution_score: 125, health_grade: 'C' },
    { handle: '@swaboronkov', display_name: 'Swarm Markets', engagement_rate_pct: 0.72, impressions_per_post: 3500, bookmarks_per_post: 2.5, distribution_score: 98, health_grade: 'C' },
    { handle: '@RealTplatform', display_name: 'RealT', engagement_rate_pct: 0.65, impressions_per_post: 2800, bookmarks_per_post: 2.0, distribution_score: 78, health_grade: 'C-' },
    { handle: '@polymaboronkov', display_name: 'Polymesh', engagement_rate_pct: 0.55, impressions_per_post: 2200, bookmarks_per_post: 1.5, distribution_score: 62, health_grade: 'C-' },
    { handle: '@figuremarkets', display_name: 'Figure Markets', engagement_rate_pct: 1.05, impressions_per_post: 8200, bookmarks_per_post: 6.2, distribution_score: 245, health_grade: 'B-' },
    { handle: '@provenancefdn', display_name: 'Provenance Blockchain', engagement_rate_pct: 0.78, impressions_per_post: 5400, bookmarks_per_post: 3.8, distribution_score: 165, health_grade: 'C+' },
    { handle: '@HastraFi', display_name: 'Hastra', engagement_rate_pct: 1.92, impressions_per_post: 3100, bookmarks_per_post: 8.5, distribution_score: 310, health_grade: 'B' },
    { handle: '@securitize', display_name: 'Securitize', engagement_rate_pct: 0.42, impressions_per_post: 1800, bookmarks_per_post: 1.2, distribution_score: 45, health_grade: 'D' },
  ],
};

export const benchmarksRouter = router({
  /**
   * benchmarks.dashboard
   * Returns the full benchmark feed for the Competitors > Benchmarks tab.
   * Falls back to seed data when Redis is empty (before first pipeline run).
   */
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const data = await cachedFetch(CACHE_KEY, BENCHMARK_TTL, async () => null);

    // Use live data from Redis if available, otherwise fall back to seed defaults
    const source = data || SEED_DATA;
    const isSeed = !data;

    return {
      status: 'ok',
      isSeed,
      meta: source.meta,
      benchmarks: source.benchmarks,
      yourAccounts: source.your_accounts,
      comparisons: source.your_accounts_vs_benchmarks,
      universe: source.universe_accounts,
    };
  }),

  /**
   * benchmarks.summary
   * Lightweight endpoint for the metric cards — just the key numbers.
   */
  summary: protectedProcedure.query(async ({ ctx }) => {
    const data = await cachedFetch(CACHE_KEY, BENCHMARK_TTL, async () => null);

    const source = data || SEED_DATA;
    const b = source.benchmarks;
    return {
      generatedAt: source.meta?.generated_at,
      universeSize: source.meta?.universe_size,
      top10PctEngRate: b?.engagement_rate_pct?.top_10_pct?.mean,
      medianEngRate: b?.engagement_rate_pct?.full_universe?.p50_median,
      top10PctImpressions: b?.impressions_per_post?.top_10_pct?.mean,
      medianImpressions: b?.impressions_per_post?.full_universe?.p50_median,
      top10PctBookmarks: b?.bookmarks_per_post?.top_10_pct?.mean,
      medianBookmarks: b?.bookmarks_per_post?.full_universe?.p50_median,
      medianBookmarkRatio: b?.bookmark_ratio?.full_universe?.p50_median,
      top10PctDistScore: b?.distribution_score?.top_10_pct?.mean,
      medianDistScore: b?.distribution_score?.full_universe?.p50_median,
      accounts: (source.your_accounts || []).map((a) => ({
        handle: a.handle,
        displayName: a.display_name,
        engRate: a.engagement_rate_pct,
        impressions: a.impressions_per_post,
        bookmarks: a.bookmarks_per_post,
        distScore: a.distribution_score,
        grade: a.health_grade,
      })),
      comparisons: (source.your_accounts_vs_benchmarks || []).map((c) => ({
        handle: c.handle,
        displayName: c.display_name,
        engVsMedian: c.metrics?.engagement_rate?.vs_median_pct,
        engVsTop10: c.metrics?.engagement_rate?.vs_top_10_pct,
        impVsMedian: c.metrics?.impressions?.vs_median_pct,
        impVsTop10: c.metrics?.impressions?.vs_top_10_pct,
        bkmkVsMedian: c.metrics?.bookmarks?.vs_median_pct,
        bkmkVsTop10: c.metrics?.bookmarks?.vs_top_10_pct,
      })),
    };
  }),
});
