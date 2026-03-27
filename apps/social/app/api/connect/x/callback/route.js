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
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).trim();
  const clientId = (process.env.X_OFFICIAL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.X_OFFICIAL_CLIENT_SECRET || '').trim();

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
      `${baseUrl}/admin?error=${encodeURIComponent(error)}`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/admin?error=missing_params`
    );
  }

  // Verify CSRF state
  if (state !== storedState) {
    return NextResponse.redirect(
      `${baseUrl}/admin?error=state_mismatch`
    );
  }

  // Verify code verifier exists
  if (!codeVerifier) {
    return NextResponse.redirect(
      `${baseUrl}/admin?error=missing_code_verifier`
    );
  }

  const redirectUri = `${baseUrl}/api/connect/x/callback`;

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
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
        `${baseUrl}/admin?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Fetch user profile from X API (include verified_type for tier detection)
    const userResponse = await fetch(
      'https://api.x.com/2/users/me?user.fields=profile_image_url,public_metrics,verified_type',
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
        `${baseUrl}/admin?error=profile_fetch_failed`
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

    // Detect X subscription tier from verified_type
    // X API returns: "blue" (Premium), "business" (Org), "government", or empty
    const verifiedType = user.verified_type || '';
    let subscriptionTier = 'free';
    let isVerified = false;
    if (verifiedType === 'business') {
      subscriptionTier = 'premium_plus'; // Org accounts have full feature access
      isVerified = true;
    } else if (verifiedType === 'blue' || verifiedType === 'government') {
      subscriptionTier = 'premium'; // Blue/gov = Premium (25K chars, longer video, etc.)
      isVerified = true;
    }
    const followerCount = user.public_metrics?.followers_count ?? null;

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
        subscriptionTier,
        isVerified,
        followerCount,
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
        subscriptionTier,
        isVerified,
        followerCount,
      },
    });

    // Clear PKCE cookies
    cookieStore.delete('x_code_verifier');
    cookieStore.delete('x_oauth_state');

    return NextResponse.redirect(
      `${baseUrl}/admin?success=x_connected`
    );
  } catch (err) {
    console.error('X OAuth callback error:', err);
    return NextResponse.redirect(
      `${baseUrl}/admin?error=internal_error`
    );
  }
}
