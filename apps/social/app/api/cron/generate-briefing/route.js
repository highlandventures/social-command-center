import { generateWeeklyBriefing } from '@/lib/intelligence-engine';
import { prisma } from '@/lib/db';

export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
