import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';

/**
 * Refresh a Google OAuth 2.0 access token using the stored refresh token.
 * Follows the same pattern as lib/token-refresh.js for X/Reddit.
 *
 * @param {Object} tokenRecord - The GoogleOAuthToken record from the database
 * @returns {string} The new plaintext access token
 */
export async function refreshGoogleToken(tokenRecord) {
  const currentRefreshToken = decrypt(tokenRecord.refreshToken);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    }).toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google token refresh failed: ${response.status} ${errorBody}`);
  }

  const tokenData = await response.json();
  const { access_token, expires_in } = tokenData;

  const encryptedAccessToken = encrypt(access_token);
  const tokenExpiresAt = expires_in
    ? new Date(Date.now() + expires_in * 1000)
    : null;

  await prisma.googleOAuthToken.update({
    where: { id: tokenRecord.id },
    data: {
      accessToken: encryptedAccessToken,
      tokenExpiresAt,
    },
  });

  return access_token;
}

/**
 * Get a valid (non-expired) Google access token.
 * If the token is within 5 minutes of expiration, it will be refreshed first.
 *
 * @param {Object} tokenRecord - The GoogleOAuthToken record from the database
 * @returns {string} A valid plaintext access token
 */
export async function getValidGoogleToken(tokenRecord) {
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const now = new Date();

  const needsRefresh =
    tokenRecord.tokenExpiresAt &&
    tokenRecord.tokenExpiresAt.getTime() - now.getTime() < FIVE_MINUTES_MS;

  if (needsRefresh && tokenRecord.refreshToken) {
    return refreshGoogleToken(tokenRecord);
  }

  return decrypt(tokenRecord.accessToken);
}
