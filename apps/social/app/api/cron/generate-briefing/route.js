import { generateWeeklyBriefing } from '@/lib/intelligence-engine';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const briefing = await generateWeeklyBriefing(prisma, 'GENERAL');
    return Response.json({
      ok: true,
      briefingId: briefing.id,
      generatedAt: briefing.generatedAt,
    });
  } catch (error) {
    console.error('[Cron] Briefing generation failed:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
