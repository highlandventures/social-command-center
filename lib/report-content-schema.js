import { z } from 'zod';

const kpiSchema = z.object({
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  format: z.enum(['number', 'percent', 'delta', 'text']),
  delta: z.number().nullable().optional(),
  direction: z.enum(['up', 'down', 'flat']).nullable().optional(),
  period: z.string().nullable().optional(),
  subValue: z.string().nullable().optional(),
});

const chartSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['line', 'bar', 'doughnut']),
  data: z.object({
    labels: z.array(z.string()),
    datasets: z.array(z.object({
      label: z.string(),
      data: z.array(z.number()),
    }).passthrough()),
  }),
  imageUrl: z.string().nullable(),
});

const sentimentThemesSchema = z.object({
  positive: z.array(z.object({ theme: z.string(), detail: z.string(), volume: z.number() })),
  negative: z.array(z.object({ theme: z.string(), detail: z.string(), volume: z.number() })),
  emerging: z.array(z.object({ topic: z.string(), signals: z.string() })),
});

export const ENRICHED_REPORT_SCHEMA = z.object({
  kpis: z.array(kpiSchema),
  executiveSummary: z.string(),
  sentimentThemes: sentimentThemesSchema.nullable().optional(),
  charts: z.array(chartSchema),
  recommendations: z.array(z.object({
    recommendation: z.string(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    expectedImpact: z.string().optional(),
  })),
  topContent: z.array(z.object({
    postId: z.string().optional(),
    title: z.string(),
    engagementRate: z.number().optional(),
    impressions: z.number().optional(),
    whyItWorked: z.string().optional(),
  })),
  coveragePeriod: z.object({ start: z.string(), end: z.string() }),
  benchmarkPeriod: z.object({ start: z.string(), end: z.string() }).nullable(),
  typeSpecific: z.record(z.any()).optional(),
});

export function validateReportContent(content) {
  return ENRICHED_REPORT_SCHEMA.safeParse(content);
}

export const EMPTY_REPORT_CONTENT = {
  kpis: [],
  executiveSummary: '',
  sentimentThemes: null,
  charts: [],
  recommendations: [],
  topContent: [],
  coveragePeriod: { start: '', end: '' },
  benchmarkPeriod: null,
};
