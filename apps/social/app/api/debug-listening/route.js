/**
 * Debug: Check actionType distribution in ListeningHit table.
 * DELETE THIS after diagnosis.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [total, byActionType, recentSample, nullActionCount] = await Promise.all([
    prisma.listeningHit.count(),
    prisma.listeningHit.groupBy({
      by: ['actionType'],
      _count: true,
    }),
    prisma.listeningHit.findMany({
      orderBy: { detectedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        detectedAt: true,
        actionType: true,
        sentiment: true,
        aiRelevance: true,
        authorUsername: true,
        platform: true,
        content: true,
      },
    }),
    prisma.listeningHit.count({ where: { actionType: null } }),
  ]);

  return NextResponse.json({
    total,
    nullActionCount,
    actionTypeDistribution: byActionType,
    recentSample: recentSample.map(h => ({
      ...h,
      content: h.content?.slice(0, 100),
    })),
  });
}
