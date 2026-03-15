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

export const benchmarksRouter = router({
  /**
   * benchmarks.dashboard
   * Returns the full benchmark feed for the dashboard panel.
   */
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const data = await cachedFetch(CACHE_KEY, BENCHMARK_TTL, async () => null);

    if (!data) {
      return {
        status: 'empty',
        message: 'No benchmark data yet. Run x_analyst_data_pull.py and POST to /api/benchmarks/ingest.',
        meta: null,
        benchmarks: null,
        yourAccounts: [],
        comparisons: [],
        universe: [],
      };
    }

    return {
      status: 'ok',
      meta: data.meta,
      benchmarks: data.benchmarks,
      yourAccounts: data.your_accounts,
      comparisons: data.your_accounts_vs_benchmarks,
      universe: data.universe_accounts,
    };
  }),

  /**
   * benchmarks.summary
   * Lightweight endpoint for the metric cards — just the key numbers.
   */
  summary: protectedProcedure.query(async ({ ctx }) => {
    const data = await cachedFetch(CACHE_KEY, BENCHMARK_TTL, async () => null);

    if (!data) return null;

    const b = data.benchmarks;
    return {
      generatedAt: data.meta?.generated_at,
      universeSize: data.meta?.universe_size,
      top10PctEngRate: b?.engagement_rate_pct?.top_10_pct?.mean,
      medianEngRate: b?.engagement_rate_pct?.full_universe?.p50_median,
      top10PctImpressions: b?.impressions_per_post?.top_10_pct?.mean,
      medianImpressions: b?.impressions_per_post?.full_universe?.p50_median,
      top10PctBookmarks: b?.bookmarks_per_post?.top_10_pct?.mean,
      medianBookmarks: b?.bookmarks_per_post?.full_universe?.p50_median,
      medianBookmarkRatio: b?.bookmark_ratio?.full_universe?.p50_median,
      top10PctDistScore: b?.distribution_score?.top_10_pct?.mean,
      medianDistScore: b?.distribution_score?.full_universe?.p50_median,
      accounts: (data.your_accounts || []).map((a) => ({
        handle: a.handle,
        displayName: a.display_name,
        engRate: a.engagement_rate_pct,
        impressions: a.impressions_per_post,
        bookmarks: a.bookmarks_per_post,
        distScore: a.distribution_score,
        grade: a.health_grade,
      })),
      comparisons: (data.your_accounts_vs_benchmarks || []).map((c) => ({
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
