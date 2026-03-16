import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRedditConnectUrl } from '@/lib/late-reddit';

/**
 * GET /api/connect/reddit
 * Initiates Reddit OAuth via Late API.
 * Late handles all Reddit OAuth complexity — no Reddit app registration needed.
 */
export async function GET() {
  // Require authenticated session
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/auth/signin`);
  }

  if (!process.env.LATE_API_KEY) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?error=${encodeURIComponent('LATE_API_KEY not configured')}`
    );
  }

  try {
    const redirectUrl = `${process.env.NEXTAUTH_URL}/api/connect/reddit/callback`;
    const result = await getRedditConnectUrl(redirectUrl);

    if (!result?.authUrl) {
      throw new Error('Late API did not return an authUrl');
    }

    return NextResponse.redirect(result.authUrl);
  } catch (err) {
    console.error('[connect/reddit] Late OAuth error:', err.message);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?error=${encodeURIComponent(err.message)}`
    );
  }
}
