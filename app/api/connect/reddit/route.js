import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/connect/reddit
 * Initiates Reddit OAuth 2.0 flow.
 * Generates CSRF state, stores it in a cookie,
 * and redirects the user to Reddit's authorization endpoint.
 */
export async function GET() {
  // Require authenticated session
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/auth/signin`);
  }
  // Generate random state for CSRF protection
  const state = randomBytes(16).toString('hex');

  // Build the redirect URI
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/connect/reddit/callback`;

  // Build Reddit authorization URL
  const authorizeUrl = new URL('https://www.reddit.com/api/v1/authorize');
  authorizeUrl.searchParams.set('client_id', process.env.REDDIT_CLIENT_ID);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('duration', 'permanent');
  authorizeUrl.searchParams.set('scope', 'identity read submit privatemessages mysubreddits');

  // Store state in secure HTTP-only cookie
  const cookieStore = await cookies();

  cookieStore.set('reddit_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  return NextResponse.redirect(authorizeUrl.toString());
}
