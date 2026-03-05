import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

/**
 * GET /api/connect/x/callback
 * Handles the OAuth 2.0 callback from Twitter/X.
 * Exchanges the authorization code for tokens, fetches user profile,
 * encrypts tokens, and upserts the Account record.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('x_oauth_state')?.value;
  const codeVerifier = cookieStore.get('x_code_verifier')?.value;

  // Handle OAuth errors from Twitter
  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?error=${encodeURIComponent(error)}`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?error=missing_params`
    );
  }

  // Verify CSRF state
  if (state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?error=state_mismatch`
    );
  }

  // Verify code verifier exists
  if (!codeVerifier) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?error=missing_code_verifier`
    );
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/connect/x/callback`;

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.X_OFFICIAL_CLIENT_ID}:${process.env.X_OFFICIAL_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('X token exchange failed:', errorBody);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/admin?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Fetch user profile from X API
    const userResponse = await fetch(
      'https://api.x.com/2/users/me?user.fields=profile_image_url,public_metrics',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!userResponse.ok) {
      const errorBody = await userResponse.text();
      console.error('X user profile fetch failed:', errorBody);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/admin?error=profile_fetch_failed`
      );
    }

    const userData = await userResponse.json();
    const user = userData.data;

    // Encrypt tokens before storage
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    // Calculate token expiration time
    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000)
      : null;

    // Upsert account record (update if same platform + platformUserId exists)
    await prisma.account.upsert({
      where: {
        platform_platformUserId: {
          platform: 'X',
          platformUserId: user.id,
        },
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        username: user.username,
        displayName: user.name,
        avatarUrl: user.profile_image_url || null,
        isActive: true,
        connectedAt: new Date(),
      },
      create: {
        platform: 'X',
        platformUserId: user.id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        username: user.username,
        displayName: user.name,
        avatarUrl: user.profile_image_url || null,
      },
    });

    // Clear PKCE cookies
    cookieStore.delete('x_code_verifier');
    cookieStore.delete('x_oauth_state');

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?success=x_connected`
    );
  } catch (err) {
    console.error('X OAuth callback error:', err);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?error=internal_error`
    );
  }
}
