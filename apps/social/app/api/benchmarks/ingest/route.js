import { NextResponse } from 'next/server';
import { kv } from '@/lib/redis';

/**
 * POST /api/benchmarks/ingest
 *
 * Accepts the x_benchmarks_dashboard.json payload from the data pull script
 * and stores it in Redis for the benchmarks tRPC router to serve.
 *
 * Auth: Bearer token via BENCHMARKS_INGEST_KEY env var.
 * This keeps it simple — the Python script POSTs here after each run.
 *
 * Usage from the data pull script:
 *   curl -X POST https://your-app.vercel.app/api/benchmarks/ingest \
 *     -H "Authorization: Bearer YOUR_INGEST_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d @x_benchmarks_dashboard.json
 */

const CACHE_KEY = 'benchmarks:dashboard:latest';
const BENCHMARK_TTL = 60 * 60 * 24 * 8; // 8 days

export async function POST(req) {
  // Verify ingest key
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const expectedKey = process.env.BENCHMARKS_INGEST_KEY;

  if (!expectedKey || token !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized. Set BENCHMARKS_INGEST_KEY env var and pass as Bearer token.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    // Basic validation — must have meta and benchmarks
    if (!body.meta || !body.benchmarks) {
      return NextResponse.json(
        { error: 'Invalid payload. Expected { meta, benchmarks, your_accounts, ... }' },
        { status: 400 }
      );
    }

    // Store in Redis with TTL
    await kv.set(CACHE_KEY, body, { ex: BENCHMARK_TTL });

    return NextResponse.json({
      status: 'ok',
      message: 'Benchmark data ingested successfully.',
      generated_at: body.meta.generated_at,
      universe_size: body.meta.universe_size,
      accounts_tracked: body.your_accounts?.length ?? 0,
    });
  } catch (err) {
    console.error('[benchmarks/ingest] Error:', err);
    return NextResponse.json(
      { error: 'Failed to ingest benchmark data.', detail: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/benchmarks/ingest
 * Health check — returns the timestamp of the last ingest.
 */
export async function GET(req) {
  try {
    const data = await kv.get(CACHE_KEY);
    if (!data) {
      return NextResponse.json({ status: 'empty', message: 'No benchmark data ingested yet.' });
    }
    return NextResponse.json({
      status: 'ok',
      generated_at: data.meta?.generated_at,
      universe_size: data.meta?.universe_size,
      accounts: data.your_accounts?.length ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
