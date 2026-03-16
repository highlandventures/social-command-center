import { put } from '@vercel/blob';

const QUICKCHART_URL = 'https://quickchart.io/chart';
const CHART_WIDTH = 600;
const CHART_HEIGHT = 300;

const COLORS = [
  '#4F46E5', // indigo
  '#0EA5E9', // sky
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
];

/**
 * Render a single chart spec via QuickChart.io and upload the resulting PNG
 * to Vercel Blob storage.
 *
 * @param {{ id: string, config: object, label: string, width?: number, height?: number }} spec
 * @returns {Promise<{ specId: string, imageUrl: string|null }>}
 */
export async function renderChart(spec) {
  try {
    const response = await fetch(QUICKCHART_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chart: spec.config,
        width: spec.width || CHART_WIDTH,
        height: spec.height || CHART_HEIGHT,
        backgroundColor: 'white',
        format: 'png',
        version: 4,
      }),
    });

    if (!response.ok) {
      console.error(`QuickChart error ${response.status} for spec ${spec.id}`);
      return { specId: spec.id, imageUrl: null };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const timestamp = Date.now();
    const blob = await put(`reports/charts/${spec.id}-${timestamp}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
    });

    return { specId: spec.id, imageUrl: blob.url };
  } catch (error) {
    console.error(`Chart render failed for ${spec.id}:`, error.message);
    return { specId: spec.id, imageUrl: null };
  }
}

/**
 * Render multiple chart specs in parallel.
 *
 * @param {Array<{ id: string, config: object, label: string }>} specs
 * @returns {Promise<Array<{ specId: string, imageUrl: string|null }>>}
 */
export async function renderCharts(specs) {
  return Promise.all(specs.map(renderChart));
}

/**
 * Build a Chart.js line chart spec for engagement trend over time.
 *
 * @param {Array<{ date: string, engagementRate: number }>} dailyData
 * @returns {{ id: string, config: object, label: string }}
 */
export function buildEngagementTrendSpec(dailyData) {
  return {
    id: 'engagement-trend',
    label: 'Engagement Trend',
    config: {
      type: 'line',
      data: {
        labels: dailyData.map((d) => d.date),
        datasets: [
          {
            label: 'Engagement Rate (%)',
            data: dailyData.map((d) => d.engagementRate),
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        scales: {
          y: { beginAtZero: true },
        },
      },
    },
  };
}

/**
 * Build a Chart.js horizontal bar chart spec for content type breakdown.
 *
 * @param {Array<{ type: string, count: number }>} typeCounts
 * @returns {{ id: string, config: object, label: string }}
 */
export function buildContentTypeSpec(typeCounts) {
  return {
    id: 'content-type-breakdown',
    label: 'Content Type Breakdown',
    config: {
      type: 'bar',
      data: {
        labels: typeCounts.map((t) => t.type),
        datasets: [
          {
            label: 'Posts',
            data: typeCounts.map((t) => t.count),
            backgroundColor: typeCounts.map((_, i) => COLORS[i % COLORS.length]),
          },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: { beginAtZero: true },
        },
      },
    },
  };
}

/**
 * Build a Chart.js doughnut chart spec for sentiment distribution.
 *
 * @param {{ positive: number, negative: number, neutral: number }} sentimentCounts
 * @returns {{ id: string, config: object, label: string }}
 */
export function buildSentimentDistSpec(sentimentCounts) {
  return {
    id: 'sentiment-distribution',
    label: 'Sentiment Distribution',
    config: {
      type: 'doughnut',
      data: {
        labels: ['Positive', 'Negative', 'Neutral'],
        datasets: [
          {
            data: [sentimentCounts.positive, sentimentCounts.negative, sentimentCounts.neutral],
            backgroundColor: ['#10B981', '#EF4444', '#9CA3AF'],
          },
        ],
      },
    },
  };
}
