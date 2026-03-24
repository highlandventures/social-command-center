/**
 * On-demand: Reclassify ListeningHits via Claude AI
 *
 * Re-runs AI actionType classification on hits that are currently FYI.
 * Processes in batches of 25 (same as poll-listening) grouped by topic.
 *
 * Query params:
 *   ?limit=500  — max hits to reclassify (default 500)
 *   ?dryRun=true — show what would be reclassified without writing
 *
 * Cost: ~$0.01-0.02 per batch of 25 hits (Claude Haiku)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { batchValidateRelevance, getTopicType } from '@/lib/listening-scanner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '500', 10);
  const dryRun = searchParams.get('dryRun') === 'true';

  const results = {
    totalFYI: 0,
    processed: 0,
    reclassified: 0,
    stayedFYI: 0,
    errors: [],
    breakdown: {},
  };

  try {
    // Get FYI hits grouped with their topic info
    const fyiHits = await prisma.listeningHit.findMany({
      where: { actionType: 'FYI' },
      take: limit,
      orderBy: { detectedAt: 'desc' },
      include: {
        topic: { select: { id: true, name: true } },
      },
    });

    results.totalFYI = fyiHits.length;

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, ...results });
    }

    // Group hits by topic for context-aware classification
    const byTopic = {};
    for (const hit of fyiHits) {
      const topicId = hit.topicId;
      if (!byTopic[topicId]) {
        byTopic[topicId] = {
          topic: hit.topic,
          hits: [],
        };
      }
      byTopic[topicId].hits.push(hit);
    }

    // Process each topic's hits in batches of 25
    for (const [topicId, group] of Object.entries(byTopic)) {
      const { topic, hits } = group;
      const topicType = getTopicType(topic);
      const topicContext = topic.name;

      for (let i = 0; i < hits.length; i += 25) {
        const batch = hits.slice(i, i + 25);

        try {
          const validations = await batchValidateRelevance(
            batch.map(h => ({
              content: h.content,
              authorFollowers: h.authorFollowersOrKarma || 0,
              engagementCount: h.engagementCount || 0,
            })),
            topicContext,
            topicType,
          );

          // Apply classifications
          for (const v of validations) {
            if (v.index >= 0 && v.index < batch.length) {
              const hit = batch[v.index];
              const newActionType = v.actionType || 'FYI';

              if (newActionType !== 'FYI') {
                await prisma.listeningHit.update({
                  where: { id: hit.id },
                  data: {
                    actionType: newActionType,
                    semanticRelevance: v.multiplier || null,
                  },
                });
                results.reclassified++;
                results.breakdown[newActionType] = (results.breakdown[newActionType] || 0) + 1;
              } else {
                results.stayedFYI++;
              }
              results.processed++;
            }
          }

          // Small delay between batches to avoid rate limiting
          await new Promise(r => setTimeout(r, 300));
        } catch (batchErr) {
          console.error(`[reclassify] Batch error for topic ${topicId}:`, batchErr.message);
          results.errors.push({ topicId, error: batchErr.message });
        }
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('[reclassify] Fatal error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
