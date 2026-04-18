import { prisma } from '@/lib/db';
import { calculateKPIs, calculateDelta, getPreviousPeriod } from './report-engine';

/**
 * Resolve a comparison period from coverage dates and comparison type.
 * Uses getPreviousPeriod to mirror the coverage duration backward.
 *
 * @param {string|Date} coverageStart
 * @param {string|Date} coverageEnd
 * @param {'WoW'|'MoM'|'QoQ'|'YoY'} comparisonType
 * @returns {{ start: Date, end: Date }|null}
 */
export function resolveComparisonPeriod(coverageStart, coverageEnd, comparisonType) {
  const validTypes = ['WoW', 'MoM', 'QoQ', 'YoY'];
  if (!validTypes.includes(comparisonType)) return null;

  const start = new Date(coverageStart);
  const end = new Date(coverageEnd);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  return getPreviousPeriod(start, end);
}

/**
 * Fetch period data (posts, account metrics, listening hits) for a date range.
 * Mirrors the data-fetching pattern from generateEnrichedReport in report-engine.js.
 *
 * @param {Date} start
 * @param {Date} end
 * @returns {Promise<{ posts: Array, accountMetrics: Array, listeningHits: Array }>}
 */
async function fetchPeriodData(start, end) {
  const [posts, accountMetrics, listeningHits] = await Promise.all([
    prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: start, lte: end },
      },
      include: { metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 } },
    }),
    prisma.accountMetrics.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    }),
    prisma.listeningHit.findMany({
      where: { detectedAt: { gte: start, lte: end } },
    }),
  ]);

  return { posts, accountMetrics, listeningHits };
}

/**
 * Compute benchmark deltas between a coverage period and a benchmark period.
 * Fetches data for both periods, calculates KPIs, and computes deltas.
 *
 * @param {{ start: Date, end: Date }} coveragePeriod
 * @param {{ start: Date, end: Date }} benchmarkPeriod
 * @returns {Promise<{ kpis: Array, benchmarkPeriod: { start: Date, end: Date }, noData?: boolean }>}
 */
export async function computeBenchmarkDeltas(coveragePeriod, benchmarkPeriod) {
  const [currentData, previousData] = await Promise.all([
    fetchPeriodData(coveragePeriod.start, coveragePeriod.end),
    fetchPeriodData(benchmarkPeriod.start, benchmarkPeriod.end),
  ]);

  // calculateKPIs returns { kpis, channelBreakdown } — destructure to the flat array
  const { kpis: currentKpis } = calculateKPIs(
    currentData.posts,
    currentData.accountMetrics,
    currentData.listeningHits
  );

  const { kpis: previousKpis } = calculateKPIs(
    previousData.posts,
    previousData.accountMetrics,
    previousData.listeningHits
  );

  // Check if previous period has any meaningful data
  const hasData = previousKpis.some(
    (kpi) => typeof kpi.value === 'number' && kpi.value !== 0 && kpi.value !== null
  );

  // Compute deltas for numeric KPIs
  const kpisWithDeltas = currentKpis.map((kpi, i) => {
    if (kpi.format === 'number' || kpi.format === 'percent' || kpi.format === 'delta') {
      const delta = calculateDelta(
        typeof kpi.value === 'number' ? kpi.value : 0,
        typeof previousKpis[i].value === 'number' ? previousKpis[i].value : 0
      );
      return {
        ...kpi,
        delta: delta.value,
        direction: delta.direction,
      };
    }
    return kpi;
  });

  return {
    kpis: kpisWithDeltas,
    benchmarkPeriod: {
      start: benchmarkPeriod.start,
      end: benchmarkPeriod.end,
    },
    ...(hasData ? {} : { noData: true }),
  };
}
