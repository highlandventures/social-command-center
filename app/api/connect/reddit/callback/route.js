import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

/**
 * GET /api/connect/reddit/callback
 * Handles the OAuth 2.0 callback from Reddit.
 * Exchanges the authorization code for tokens, fetches user profile,
 * encrypts tokens, and upserts the Account record.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('reddit_oauth_state')?.value;

  // Handle OAuth errors from Reddit
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

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/connect/reddit/callback`;

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Reddit token exchange failed:', errorBody);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/admin?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Fetch user profile from Reddit API
    const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'User-Agent': 'SocialCommandCenter/1.0',
      },
    });

    if (!userResponse.ok) {
      const errorBody = await userResponse.text();
      console.error('Reddit user profile fetch failed:', errorBody);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/admin?error=profile_fetch_failed`
      );
    }

    const me = await userResponse.json();

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
          platform: 'REDDIT',
          platformUserId: me.id,
        },
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        username: me.name,
        displayName: me.subreddit?.title || me.name,
        avatarUrl: me.icon_img || me.snoovatar_img || null,
        isActive: true,
        connectedAt: new Date(),
      },
      create: {
        platform: 'REDDIT',
        platformUserId: me.id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        username: me.name,
        displayName: me.subreddit?.title || me.name,
        avatarUrl: me.icon_img || me.snoovatar_img || null,
      },
    });

    // Clear state cookie
    cookieStore.delete('reddit_oauth_state');

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?success=reddit_connected`
    );
  } catch (err) {
    console.error('Reddit OAuth callback error:', err);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?error=internal_error`
    );
  }
}
