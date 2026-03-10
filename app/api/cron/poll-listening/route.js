/**
 * Cron: Poll Social Listening
 * Schedule: Every 10 minutes (* /10 * * * *)
 *
 * For each active ListeningTopic and its queries, searches for new hits,
 * deduplicates, computes heuristic scores and sentiment, and creates
 * ListeningHit records (+ InboxItem for high-scoring hits).
 *
 * Core logic lives in /lib/listening-scanner.js (shared with on-demand trigger).
 */

import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { scanListeningTopics } from '@/lib/listening-scanner';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await scanListeningTopics(); // scans all active topics
    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('poll-listening cron error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
