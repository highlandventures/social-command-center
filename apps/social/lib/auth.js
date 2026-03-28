import { getServerSession } from 'next-auth';
import { authOptions } from './next-auth-options';
import { prisma } from './db';

/**
 * Get the current NextAuth session with Prisma user data.
 * Returns a session-like object compatible with the rest of the app:
 *   { user: { id, email, role, name, avatarUrl } }
 *
 * Returns null if not authenticated.
 */
export async function getSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  };
}
