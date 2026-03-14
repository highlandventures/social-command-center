import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { listLateAccounts } from '@/lib/late-reddit';

/**
 * GET /api/connect/reddit/callback
 * Handles the OAuth callback from Late (which wraps Reddit OAuth).
 * After the user authorizes on Reddit via Late, Late redirects here.
 * We then fetch the connected account info from Late and store it locally.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?error=${encodeURIComponent(error)}`
    );
  }

  try {
    // After Late OAuth completes, the Reddit account is connected on Late's side.
    // Fetch the connected accounts from Late to get the Reddit account details.
    const accounts = await listLateAccounts();
    const accountList = accounts?.data || accounts || [];
    const redditAccount = accountList.find((a) => a.platform === 'reddit');

    if (!redditAccount) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/admin?error=${encodeURIComponent('Reddit account not found in Late after OAuth')}`
      );
    }

    // Upsert a local Account record so the app knows Reddit is connected
    await prisma.account.upsert({
      where: {
        platform_platformUserId: {
          platform: 'REDDIT',
          platformUserId: redditAccount._id || redditAccount.id,
        },
      },
      update: {
        username: redditAccount.username || redditAccount.name || 'reddit_user',
        displayName: redditAccount.displayName || redditAccount.username || 'Reddit',
        avatarUrl: redditAccount.avatarUrl || redditAccount.image || null,
        isActive: true,
        connectedAt: new Date(),
        // Store the Late account ID in accessToken field for reference
        accessToken: redditAccount._id || redditAccount.id,
      },
      create: {
        platform: 'REDDIT',
        platformUserId: redditAccount._id || redditAccount.id,
        username: redditAccount.username || redditAccount.name || 'reddit_user',
        displayName: redditAccount.displayName || redditAccount.username || 'Reddit',
        avatarUrl: redditAccount.avatarUrl || redditAccount.image || null,
        // Store the Late account ID — actual auth is handled by Late
        accessToken: redditAccount._id || redditAccount.id,
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?success=reddit_connected`
    );
  } catch (err) {
    console.error('[connect/reddit/callback] Error:', err.message);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin?error=${encodeURIComponent(err.message)}`
    );
  }
}
