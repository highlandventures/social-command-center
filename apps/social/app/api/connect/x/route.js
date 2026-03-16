import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';
import { getSession } from '@/lib/auth';

/**
 * GET /api/connect/x
 * Initiates X (Twitter) OAuth 2.0 with PKCE flow.
 * Generates code verifier/challenge, stores PKCE state in cookies,
 * and redirects the user to Twitter's authorization endpoint.
 */
export async function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000').trim();
  const clientId = (process.env.X_OFFICIAL_CLIENT_ID || '').trim();

  // Require authenticated session
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.redirect(`${baseUrl}/auth/signin`);
  }
  // Generate PKCE code verifier (high-entropy random string)
  const codeVerifier = randomBytes(32).toString('base64url');

  // Generate code challenge (SHA-256 hash of verifier, base64url encoded)
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Generate random state for CSRF protection
  const state = randomBytes(16).toString('hex');

  // Build the redirect URI
  const redirectUri = `${baseUrl}/api/connect/x/callback`;

  // Build Twitter authorization URL
  const authorizeUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  // Store PKCE values and state in secure HTTP-only cookies
  const cookieStore = await cookies();

  cookieStore.set('x_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  cookieStore.set('x_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return NextResponse.redirect(authorizeUrl.toString());
}
