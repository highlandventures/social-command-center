import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { getSession } from '@/lib/auth';

/**
 * GET /api/connect/google/callback
 * Handles the OAuth 2.0 callback from Google.
 * Exchanges the authorization code for tokens, encrypts them,
 * and upserts the GoogleOAuthToken record.
 */
export async function GET(request) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).trim();
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_oauth_state')?.value;

  // Handle OAuth errors from Google
  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent(error)}`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/?error=missing_params`);
  }

  // Verify CSRF state
  if (state !== storedState) {
    return NextResponse.redirect(`${baseUrl}/?error=state_mismatch`);
  }

  // Require authenticated session
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.redirect(`${baseUrl}/auth/signin`);
  }

  const redirectUri = `${baseUrl}/api/connect/google/callback`;

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Google token exchange failed:', errorBody);
      return NextResponse.redirect(`${baseUrl}/?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Fetch Google user email via userinfo
    let googleEmail = null;
    try {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (userinfoRes.ok) {
        const userinfo = await userinfoRes.json();
        googleEmail = userinfo.email;
      }
    } catch {
      // Non-critical — we can proceed without the email
    }

    // Encrypt tokens before storage
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000)
      : null;

    // Upsert Google OAuth token record
    await prisma.googleOAuthToken.upsert({
      where: { userId: session.user.id },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken || undefined,
        tokenExpiresAt,
        scopes: scope || '',
        googleEmail,
      },
      create: {
        userId: session.user.id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken || '',
        tokenExpiresAt,
        scopes: scope || '',
        googleEmail,
      },
    });

    // Clear state cookie
    cookieStore.delete('google_oauth_state');

    return NextResponse.redirect(`${baseUrl}/?success=google_connected`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(`${baseUrl}/?error=internal_error`);
  }
}
