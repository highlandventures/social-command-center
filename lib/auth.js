import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './db';

// ---------------------------------------------------------------------------
// Custom Prisma Adapter
// ---------------------------------------------------------------------------
// Our Prisma schema does NOT have a NextAuth-style Account model.
// The "Account" model is reserved for social-platform accounts (X, Reddit).
// This adapter only maps User and Session so NextAuth can persist those two
// models while leaving the Account table untouched.
// ---------------------------------------------------------------------------

function CustomPrismaAdapter() {
  return {
    // ---- User methods ----
    async createUser(data) {
      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name ?? null,
          avatarUrl: data.image ?? null,
        },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl,
        emailVerified: null,
        role: user.role,
      };
    },

    async getUser(id) {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl,
        emailVerified: null,
        role: user.role,
      };
    },

    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl,
        emailVerified: null,
        role: user.role,
      };
    },

    async getUserByAccount({ provider, providerAccountId }) {
      // We don't store NextAuth provider accounts in the DB.
      // With JWT strategy this is rarely called, but return null to be safe.
      return null;
    },

    async updateUser({ id, ...data }) {
      const updateData = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.image !== undefined) updateData.avatarUrl = data.image;

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl,
        emailVerified: null,
        role: user.role,
      };
    },

    async deleteUser(id) {
      await prisma.user.delete({ where: { id } });
    },

    // ---- Account (OAuth provider) methods ----
    // We intentionally skip persisting OAuth provider accounts since we use
    // JWT sessions and our Account table is reserved for social accounts.
    async linkAccount(data) {
      return data;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      return undefined;
    },

    // ---- Session methods ----
    // With JWT strategy these are not actively used, but we implement them
    // for completeness so the adapter satisfies the full interface contract.
    async createSession(data) {
      const session = await prisma.session.create({
        data: {
          sessionToken: data.sessionToken,
          userId: data.userId,
          expires: data.expires,
        },
      });
      return session;
    },

    async getSessionAndUser(sessionToken) {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });
      if (!session) return null;
      return {
        session: {
          id: session.id,
          sessionToken: session.sessionToken,
          userId: session.userId,
          expires: session.expires,
        },
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.avatarUrl,
          emailVerified: null,
          role: session.user.role,
        },
      };
    },

    async updateSession({ sessionToken, ...data }) {
      const session = await prisma.session.update({
        where: { sessionToken },
        data,
      });
      return session;
    },

    async deleteSession(sessionToken) {
      await prisma.session.delete({ where: { sessionToken } });
    },

    // ---- Verification token methods ----
    // Not needed — we don't use email/magic-link sign-in.
    async createVerificationToken(data) {
      return data;
    },

    async useVerificationToken({ identifier, token }) {
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// NextAuth configuration
// ---------------------------------------------------------------------------

export const authOptions = {
  adapter: CustomPrismaAdapter(),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
