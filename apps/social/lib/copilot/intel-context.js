import { prisma } from '@/lib/db';

/**
 * Fetches and condenses the latest intel from AIInsight cache
 * for inclusion in the co-pilot system prompt (~500 tokens).
 */
export async function getCondensedIntelSummary() {
  const [perfS, compS, audS] = await Promise.allSettled([
    prisma.aIInsight.findFirst({
      where: { insightType: 'PERFORMANCE_PATTERN', dismissed: false },
      orderBy: { generatedAt: 'desc' },
    }),
    prisma.aIInsight.findFirst({
      where: { insightType: 'COMPETITOR_STRATEGY', dismissed: false },
      orderBy: { generatedAt: 'desc' },
    }),
    prisma.aIInsight.findFirst({
      where: { insightType: 'AUDIENCE_QUESTION', dismissed: false },
      orderBy: { generatedAt: 'desc' },
    }),
  ]);

  const perfInsight = perfS.status === 'fulfilled' ? perfS.value : null;
  const compInsight = compS.status === 'fulfilled' ? compS.value : null;
  const audInsight = audS.status === 'fulfilled' ? audS.value : null;

  const sections = [];
  if (perfInsight?.content) {
    sections.push(`Performance: ${summarize(perfInsight.content, 150)}`);
  }
  if (compInsight?.content) {
    sections.push(`Competitors: ${summarize(compInsight.content, 150)}`);
  }
  if (audInsight?.content) {
    sections.push(`Audience Questions: ${summarize(audInsight.content, 150)}`);
  }

  return sections.length > 0
    ? sections.join('\n\n')
    : 'No intel data available yet. Run the daily analysis cron to populate insights.';
}

function summarize(content, maxChars) {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return text.length > maxChars ? text.slice(0, maxChars) + '...' : text;
}
