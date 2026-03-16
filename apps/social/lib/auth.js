import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from './db';

/**
 * Get the current Clerk auth state and sync to Prisma.
 * Returns a session-like object compatible with the rest of the app:
 *   { user: { id, email, role, name, avatarUrl } }
 *
 * Returns null if not authenticated.
 */
export async function getSession() {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  // Find-or-create the Prisma user, keeping it in sync with Clerk profile data
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const userCount = await prisma.user.count();
    user = await prisma.user.create({
      data: {
        email,
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
        avatarUrl: clerkUser.imageUrl || null,
        role: userCount === 0 ? 'ADMIN' : 'INTERNAL',
      },
    });
  } else {
    // Keep name/avatar in sync and update last active
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || user.name,
        avatarUrl: clerkUser.imageUrl || user.avatarUrl,
        lastActiveAt: new Date(),
      },
    });
  }

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
