import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './db';

// ---------------------------------------------------------------------------
// NextAuth configuration
// Uses CredentialsProvider with a shared team access code (TEAM_PASSWORD env var).
// No email sending required — perfect for internal tools.
// ---------------------------------------------------------------------------

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Team Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        accessCode: { label: 'Access Code', type: 'password' },
      },
      async authorize(credentials) {
        const { email, accessCode } = credentials ?? {};

        // Validate access code against env var
        const teamPassword = process.env.TEAM_PASSWORD;
        if (!teamPassword) {
          throw new Error('TEAM_PASSWORD not configured on server');
        }
        if (accessCode !== teamPassword) {
          throw new Error('Invalid access code');
        }
        if (!email) {
          throw new Error('Email is required');
        }

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          // Auto-create new users on first sign-in
          const userCount = await prisma.user.count();
          user = await prisma.user.create({
            data: {
              email,
              role: userCount === 0 ? 'ADMIN' : 'INTERNAL',
            },
          });
        }

        // Auto-promote first user to ADMIN if they somehow got INTERNAL
        if (user.role !== 'ADMIN') {
          const userCount = await prisma.user.count();
          if (userCount <= 1) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { role: 'ADMIN' },
            });
          }
        }

        // Update last active timestamp
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
  },

  pages: {
    signIn: '/auth/signin',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
