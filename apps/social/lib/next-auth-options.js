import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './db';

// How often to re-sync the Prisma user onto the JWT (role/avatar can change in DB).
// Used by shouldSyncPrismaUser() below.
const PRISMA_SYNC_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Domain allowlist for NextAuth signIn.
// PRD §6.C: "SSO-gated to @figure.com identities". Non-figure.com domains
// (e.g. agency partners or team members with non-Figure Google accounts) must
// be listed explicitly in ALLOWED_EMAIL_DOMAINS. Phase 17-01 Task 5.
const DEFAULT_ALLOWED_DOMAIN = 'figure.com';

/**
 * Pure predicate — exported for testability. Returns true when `email`'s
 * domain is `figure.com` or appears in the comma-separated `allowlistEnv`.
 * Matching is case-insensitive on the domain part only.
 */
export function isDomainAllowed(email, allowlistEnv) {
  if (!email || typeof email !== 'string') return false;
  const atIdx = email.lastIndexOf('@');
  if (atIdx < 0 || atIdx === email.length - 1) return false;
  const domain = email.slice(atIdx + 1).toLowerCase().trim();
  if (!domain) return false;

  if (domain === DEFAULT_ALLOWED_DOMAIN) return true;

  if (!allowlistEnv) return false;
  const allowed = allowlistEnv
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(domain);
}

/**
 * Decide whether the next jwt() call should re-read the Prisma user into the token.
 * This is the fix for the "signed in but not authorized" loop: previously prismaUser
 * was only populated on first sign-in, so stale JWTs (post-deploy, cookie refresh)
 * had no user id and every protectedProcedure returned UNAUTHORIZED.
 *
 * TODO(user): Implement the decision logic. Return true when the token needs a
 * fresh sync, false when the cached copy is fine.
 *
 * Consider:
 *  - isFirstSignIn → always sync (authoritative fresh data)
 *  - token.prismaUser?.id missing → MUST sync (this is the bug we're fixing)
 *  - token.prismaSyncedAt older than PRISMA_SYNC_TTL_MS → stale, sync
 *  - otherwise → skip the DB round-trip
 */
function shouldSyncPrismaUser({ token, isFirstSignIn }) {
  if (isFirstSignIn) return true;
  if (!token.prismaUser?.id) return true;
  const age = Date.now() - (token.prismaSyncedAt || 0);
  return age > PRISMA_SYNC_TTL_MS;
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },

  callbacks: {
    async signIn({ user }) {
      // PRD §6.C + Phase 17-01 Task 5 — gate SSO to @figure.com plus domains
      // listed in ALLOWED_EMAIL_DOMAINS env (comma-separated). Rejected users
      // are redirected to /auth/signin?error=AccessDenied by NextAuth.
      return isDomainAllowed(user?.email, process.env.ALLOWED_EMAIL_DOMAINS);
    },

    async session({ session, token }) {
      if (token?.prismaUser) {
        session.user.id = token.prismaUser.id;
        session.user.role = token.prismaUser.role;
        session.user.avatarUrl = token.prismaUser.avatarUrl;
        return session;
      }

      const email = session?.user?.email || token?.email;
      if (email) {
        const prismaUser = await prisma.user.findUnique({ where: { email } });
        if (prismaUser) {
          session.user.id = prismaUser.id;
          session.user.role = prismaUser.role;
          session.user.avatarUrl = prismaUser.avatarUrl;
        }
      }
      return session;
    },

    async jwt({ token, user, account, profile }) {
      const isFirstSignIn = Boolean(account && user);
      const email = user?.email || token.email;

      // Decide whether we need to (re)sync the Prisma user onto the token.
      // See shouldSyncPrismaUser() below — this is the core decision point.
      const needsSync = shouldSyncPrismaUser({ token, isFirstSignIn });

      if (needsSync && email) {
        let prismaUser = await prisma.user.findUnique({ where: { email } });

        if (!prismaUser && isFirstSignIn) {
          const userCount = await prisma.user.count();
          prismaUser = await prisma.user.create({
            data: {
              email,
              name: user.name || null,
              avatarUrl: user.image || null,
              role: userCount === 0 ? 'ADMIN' : 'INTERNAL',
            },
          });
        } else if (prismaUser && isFirstSignIn) {
          await prisma.user.update({
            where: { id: prismaUser.id },
            data: {
              name: user.name || prismaUser.name,
              avatarUrl: user.image || prismaUser.avatarUrl,
              lastActiveAt: new Date(),
            },
          });
        }

        if (prismaUser) {
          token.prismaUser = {
            id: prismaUser.id,
            role: prismaUser.role,
            avatarUrl: prismaUser.avatarUrl,
          };
          token.prismaSyncedAt = Date.now();
        }
      }

      return token;
    },
  },

  session: {
    strategy: 'jwt',
  },
};
