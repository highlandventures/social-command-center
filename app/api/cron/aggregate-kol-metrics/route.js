/**
 * Cron: Aggregate KOL Metrics
 * Schedule: Daily at 5:00 AM UTC (0 5 * * *)
 *
 * Rolls up KOLActivation records into weekly KOLMetrics snapshots.
 * For each active KOL, aggregates the current week's activations
 * and upserts a KOLMetrics row with engagement stats.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * Get the Monday 00:00 UTC of the current week (ISO week start).
 */
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { updated: 0, skipped: 0, errors: [] };

  try {
    const activeKOLs = await prisma.kOL.findMany({ where: { active: true } });
    const weekStart = getWeekStart();

    // Also aggregate the previous week if we're early in the week (Mon/Tue)
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);

    const weeksToProcess = [prevWeekStart, weekStart];

    for (const kol of activeKOLs) {
      for (const ws of weeksToProcess) {
        const weekEnd = new Date(ws);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

        try {
          // Fetch activations for this KOL in this week window
          const activations = await prisma.kOLActivation.findMany({
            where: {
              kolId: kol.id,
              detectedAt: { gte: ws, lt: weekEnd },
            },
          });

          if (activations.length === 0) {
            results.skipped++;
            continue;
          }

          // ── Aggregate engagement metrics from metricsAtDetection ──
          let totalLikes = 0;
          let totalRetweets = 0;
          let totalReplies = 0;
          let totalImpressions = 0;
          let totalComments = 0;
          let totalUpvotes = 0;
          let positiveCount = 0;
          let totalWithSentiment = 0;

          for (const act of activations) {
            const m = act.metricsAtDetection || {};

            // X metrics
            totalLikes += m.likes || 0;
            totalRetweets += m.retweets || 0;
            totalReplies += m.replies || 0;
            totalImpressions += m.impressions || 0;

            // Reddit metrics
            totalUpvotes += m.upvotes || m.score || 0;
            totalComments += m.comments || 0;

            // If the activation has a sentiment tag, count it
            if (act.sentiment) {
              totalWithSentiment++;
              if (act.sentiment === 'POSITIVE') positiveCount++;
            }
          }

          // Combined engagement across platforms
          const totalEngagement =
            totalLikes + totalRetweets + totalReplies + totalUpvotes + totalComments;

          // For Reddit, estimate impressions as ~10x upvotes if not available
          const estImpressions =
            totalImpressions > 0
              ? totalImpressions
              : (totalUpvotes + totalComments) * 10;

          const avgEngPerActivation =
            activations.length > 0 ? totalEngagement / activations.length : 0;

          const engagementRate =
            estImpressions > 0 ? (totalEngagement / estImpressions) * 100 : 0;

          const sentimentPct =
            totalWithSentiment > 0
              ? (positiveCount / totalWithSentiment) * 100
              : 50; // default neutral

          // Cost per engagement (if paid)
          const monthlyCost = kol.compensationMonthly || 0;
          const weeklyCost = monthlyCost / 4.33;
          const costPerEng =
            monthlyCost > 0 && totalEngagement > 0
              ? weeklyCost / totalEngagement
              : null;

          // Upsert the KOLMetrics record
          await prisma.kOLMetrics.upsert({
            where: {
              kolId_weekStart: {
                kolId: kol.id,
                weekStart: ws,
              },
            },
            create: {
              kolId: kol.id,
              weekStart: ws,
              followers: kol.baselineFollowers || 0,
              engagementRateBrand: Math.round(engagementRate * 100) / 100,
              engagementRateBaseline: kol.baselineEngRate || 0,
              activationsCount: activations.length,
              totalImpressionsEst: estImpressions,
              avgEngagementPerActivation: Math.round(avgEngPerActivation * 100) / 100,
              sentimentPositivePct: Math.round(sentimentPct * 100) / 100,
              followerGrowthCorrelation: 0, // computed by AI scoring
              costPerEngagement: costPerEng,
            },
            update: {
              followers: kol.baselineFollowers || 0,
              engagementRateBrand: Math.round(engagementRate * 100) / 100,
              activationsCount: activations.length,
              totalImpressionsEst: estImpressions,
              avgEngagementPerActivation: Math.round(avgEngPerActivation * 100) / 100,
              sentimentPositivePct: Math.round(sentimentPct * 100) / 100,
              costPerEngagement: costPerEng,
            },
          });

          results.updated++;
        } catch (kolErr) {
          console.error(`Failed to aggregate metrics for KOL ${kol.id} week ${ws.toISOString()}:`, kolErr.message);
          results.errors.push({ kolId: kol.id, week: ws.toISOString(), error: kolErr.message });
        }
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('aggregate-kol-metrics cron error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
