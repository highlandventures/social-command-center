import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { getSession } from '@/lib/auth';

/**
 * GET /api/connect/google
 * Initiates Google OAuth 2.0 flow for Gmail + Calendar access.
 * Redirects the user to Google's authorization endpoint.
 */
export async function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).trim();
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();

  // Require authenticated session
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.redirect(`${baseUrl}/auth/signin`);
  }

  // Generate random state for CSRF protection
  const state = randomBytes(16).toString('hex');

  const redirectUri = `${baseUrl}/api/connect/google/callback`;

  // Build Google authorization URL
  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'openid',
    'email',
  ].join(' '));
  authorizeUrl.searchParams.set('access_type', 'offline');
  authorizeUrl.searchParams.set('prompt', 'consent');
  authorizeUrl.searchParams.set('state', state);

  // Store state in secure HTTP-only cookie
  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  return NextResponse.redirect(authorizeUrl.toString());
}
