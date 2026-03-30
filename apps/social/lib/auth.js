import { getServerSession } from 'next-auth';
import { authOptions } from './next-auth-options';

/**
 * Get the current NextAuth session with Prisma user data.
 * Returns a session-like object compatible with the rest of the app:
 *   { user: { id, email, role, name, avatarUrl } }
 *
 * User data (id, role, avatarUrl) is embedded in the JWT by the jwt()
 * callback in next-auth-options.js — no extra DB round-trip needed.
 */
export async function getSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.user.id) return null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      avatarUrl: session.user.avatarUrl,
    },
  };
}
