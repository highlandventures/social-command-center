import { prisma } from '@/lib/db';

/**
 * Fetches and condenses the latest intel from AIInsight cache
 * for inclusion in the co-pilot system prompt (~500 tokens).
 */
export async function getCondensedIntelSummary() {
  const [perfS, compS, xContextS] = await Promise.allSettled([
    prisma.aIInsight.findFirst({
      where: { insightType: 'PERFORMANCE_PATTERN', dismissed: false },
      orderBy: { generatedAt: 'desc' },
    }),
    prisma.aIInsight.findFirst({
      where: { insightType: 'COMPETITOR_STRATEGY', dismissed: false },
      orderBy: { generatedAt: 'desc' },
    }),
    prisma.aIInsight.findFirst({
      where: { insightType: 'X_COCREATOR_CONTEXT', dismissed: false },
      orderBy: { generatedAt: 'desc' },
    }),
  ]);

  const perfInsight = perfS.status === 'fulfilled' ? perfS.value : null;
  const compInsight = compS.status === 'fulfilled' ? compS.value : null;
  const xContext = xContextS.status === 'fulfilled' ? xContextS.value : null;

  const sections = [];
  if (perfInsight?.content) {
    sections.push(`Performance: ${summarize(perfInsight.content, 150)}`);
  }
  if (compInsight?.content) {
    sections.push(`Competitors: ${summarize(compInsight.content, 150)}`);
  }
  // Inject weekly X analyst context if available (from x-analyst cron)
  if (xContext?.content) {
    const contextText = typeof xContext.content === 'object'
      ? (xContext.content.context || JSON.stringify(xContext.content))
      : xContext.content;
    sections.push(`X Weekly Intelligence:\n${summarize(contextText, 500)}`);
  }

  return sections.length > 0
    ? sections.join('\n\n')
    : 'No intel data available yet. Run the daily analysis cron to populate insights.';
}

function summarize(content, maxChars) {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return text.length > maxChars ? text.slice(0, maxChars) + '...' : text;
}
