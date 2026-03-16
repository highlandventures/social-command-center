/**
 * Shared cron authentication helper.
 * Verifies that incoming cron requests carry a valid CRON_SECRET bearer token.
 */

export function verifyCronAuth(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return authHeader === expected;
}
