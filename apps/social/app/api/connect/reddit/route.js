import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRedditConnectUrl } from '@/lib/late-reddit';

/**
 * GET /api/connect/reddit
 * Initiates Reddit OAuth via Late API.
 * Late handles all Reddit OAuth complexity — no Reddit app registration needed.
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  // Require authenticated session
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.redirect(`${baseUrl}/auth/signin`);
  }

  if (!process.env.LATE_API_KEY) {
    return NextResponse.redirect(
      `${baseUrl}/admin?error=${encodeURIComponent('LATE_API_KEY not configured')}`
    );
  }

  try {
    const redirectUrl = `${baseUrl}/api/connect/reddit/callback`;
    const result = await getRedditConnectUrl(redirectUrl);

    if (!result?.authUrl) {
      throw new Error('Late API did not return an authUrl');
    }

    return NextResponse.redirect(result.authUrl);
  } catch (err) {
    console.error('[connect/reddit] Late OAuth error:', err.message);
    return NextResponse.redirect(
      `${baseUrl}/admin?error=${encodeURIComponent(err.message)}`
    );
  }
}
