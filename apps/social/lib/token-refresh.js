import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';

/**
 * Refresh an X (Twitter) OAuth 2.0 access token using the stored refresh token.
 * Decrypts the current refresh token, exchanges it for new tokens,
 * encrypts and updates the database record.
 *
 * @param {Object} account - The Account record from the database
 * @returns {string} The new plaintext access token
 */
export async function refreshXToken(account) {
  const currentRefreshToken = decrypt(account.refreshToken);

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.X_OFFICIAL_CLIENT_ID}:${process.env.X_OFFICIAL_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`X token refresh failed: ${response.status} ${errorBody}`);
  }

  const tokenData = await response.json();
  const { access_token, refresh_token, expires_in } = tokenData;

  // Encrypt new tokens
  const encryptedAccessToken = encrypt(access_token);
  const encryptedRefreshToken = refresh_token
    ? encrypt(refresh_token)
    : account.refreshToken; // Keep existing if no new refresh token

  const tokenExpiresAt = expires_in
    ? new Date(Date.now() + expires_in * 1000)
    : null;

  // Update the account record in the database
  await prisma.account.update({
    where: { id: account.id },
    data: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt,
    },
  });

  return access_token;
}

/**
 * Refresh a Reddit OAuth 2.0 access token using the stored refresh token.
 * Decrypts the current refresh token, exchanges it for new tokens,
 * encrypts and updates the database record.
 *
 * @param {Object} account - The Account record from the database
 * @returns {string} The new plaintext access token
 */
export async function refreshRedditToken(account) {
  const currentRefreshToken = decrypt(account.refreshToken);

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
      ).toString('base64')}`,
      'User-Agent': 'SocialCommandCenter/1.0',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Reddit token refresh failed: ${response.status} ${errorBody}`);
  }

  const tokenData = await response.json();
  const { access_token, refresh_token, expires_in } = tokenData;

  // Encrypt new tokens
  const encryptedAccessToken = encrypt(access_token);
  const encryptedRefreshToken = refresh_token
    ? encrypt(refresh_token)
    : account.refreshToken; // Keep existing if no new refresh token

  const tokenExpiresAt = expires_in
    ? new Date(Date.now() + expires_in * 1000)
    : null;

  // Update the account record in the database
  await prisma.account.update({
    where: { id: account.id },
    data: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt,
    },
  });

  return access_token;
}

/**
 * Get a valid (non-expired) access token for an account.
 * If the token is within 5 minutes of expiration, it will be refreshed first.
 * Decrypts and returns the plaintext access token.
 *
 * @param {Object} account - The Account record from the database
 * @returns {string} A valid plaintext access token
 */
export async function getValidToken(account) {
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const now = new Date();

  // Check if token needs refreshing (expired or within 5 minutes of expiry)
  const needsRefresh =
    account.tokenExpiresAt &&
    account.tokenExpiresAt.getTime() - now.getTime() < FIVE_MINUTES_MS;

  if (needsRefresh && account.refreshToken) {
    if (account.platform === 'X') {
      return refreshXToken(account);
    } else if (account.platform === 'REDDIT') {
      return refreshRedditToken(account);
    }
  }

  // Token is still valid, decrypt and return it
  return decrypt(account.accessToken);
}
