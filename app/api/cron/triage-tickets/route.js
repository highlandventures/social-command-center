import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { prisma } from '@/lib/db';
import { generateInsight } from '@/lib/ai';

export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 10;

const TRIAGE_SYSTEM_PROMPT = `You are a senior software engineer triaging bug reports for a Next.js social media management platform called Social Command.

Analyze the bug report and respond with valid JSON matching this schema:
{
  "summary": "Brief technical summary of the bug",
  "likelyAffectedAreas": ["list of likely affected files, components, or systems"],
  "suggestedFix": "Concise description of the recommended fix approach",
  "severity": "critical | high | medium | low",
  "confidence": "high | medium | low",
  "category": "ui | api | data | auth | performance | integration | other"
}`;

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      type: 'BUG',
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      aiAnalysis: null,
    },
    take: BATCH_LIMIT,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  if (tickets.length === 0) {
    return NextResponse.json({ ok: true, ticketsTriaged: 0 });
  }

  let triaged = 0;
  const errors = [];

  for (const ticket of tickets) {
    try {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'AI_REVIEWING' },
      });

      const context = [
        `**Bug Report: ${ticket.title}**`,
        `Priority: ${ticket.priority}`,
        `Description: ${ticket.description}`,
        ticket.screenshots?.length
          ? `Screenshots attached: ${ticket.screenshots.length} image(s)`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const analysis = await generateInsight('ticket_triage', context, {
        maxTokens: 1024,
        systemPrompt: TRIAGE_SYSTEM_PROMPT,
      });

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { aiAnalysis: analysis, status: 'OPEN' },
      });

      const commentText = [
        `**AI Triage Summary**`,
        ``,
        analysis.summary || 'No summary available.',
        ``,
        analysis.suggestedFix ? `**Suggested Fix:** ${analysis.suggestedFix}` : '',
        analysis.likelyAffectedAreas?.length
          ? `**Affected Areas:** ${analysis.likelyAffectedAreas.join(', ')}`
          : '',
        analysis.severity ? `**Severity:** ${analysis.severity}` : '',
        analysis.confidence ? `**Confidence:** ${analysis.confidence}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await prisma.ticketComment.create({
        data: {
          ticketId: ticket.id,
          authorName: 'Claude AI',
          content: commentText,
        },
      });

      triaged++;
    } catch (err) {
      console.error(`Triage failed for ticket ${ticket.id}:`, err.message);
      errors.push({ ticketId: ticket.id, error: err.message });
      // Reset status on failure
      await prisma.ticket
        .update({ where: { id: ticket.id }, data: { status: 'OPEN' } })
        .catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, ticketsTriaged: triaged, errors });
}
