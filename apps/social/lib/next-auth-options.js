import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './db';

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
    async signIn({ user, account, profile }) {
      // Allow all Google sign-ins (you can restrict by domain later)
      return true;
    },

    async session({ session, token }) {
      // Attach Prisma user data to session
      if (token?.prismaUser) {
        session.user.id = token.prismaUser.id;
        session.user.role = token.prismaUser.role;
        session.user.avatarUrl = token.prismaUser.avatarUrl;
      }
      return session;
    },

    async jwt({ token, user, account, profile }) {
      // On first sign-in, sync to Prisma
      if (account && user) {
        const email = user.email;
        let prismaUser = await prisma.user.findUnique({ where: { email } });

        if (!prismaUser) {
          const userCount = await prisma.user.count();
          prismaUser = await prisma.user.create({
            data: {
              email,
              name: user.name || null,
              avatarUrl: user.image || null,
              role: userCount === 0 ? 'ADMIN' : 'INTERNAL',
            },
          });
        } else {
          await prisma.user.update({
            where: { id: prismaUser.id },
            data: {
              name: user.name || prismaUser.name,
              avatarUrl: user.image || prismaUser.avatarUrl,
              lastActiveAt: new Date(),
            },
          });
        }

        token.prismaUser = {
          id: prismaUser.id,
          role: prismaUser.role,
          avatarUrl: prismaUser.avatarUrl,
        };
      }

      return token;
    },
  },

  session: {
    strategy: 'jwt',
  },
};
