import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from './db';
import { kv } from './redis';

/**
 * tRPC Context — available in every procedure
 * Includes: prisma client, Redis KV, and the current user session.
 */
export async function createContext({ req, res }) {
  const session = await getServerSession(authOptions);
  return {
    prisma,
    kv,
    session,
  };
}

/**
 * Initialise tRPC with superjson transformer so Dates, Maps, etc. survive
 * the JSON serialisation round-trip.
 */
const t = initTRPC.context().create({
  transformer: superjson,
});

export const router = t.router;
export const middleware = t.middleware;

/**
 * Public procedure — no auth required.
 */
export const publicProcedure = t.procedure;

/**
 * Middleware that enforces authentication.
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be signed in.' });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

/**
 * Protected procedure — requires a valid session.
 */
export const protectedProcedure = t.procedure.use(enforceAuth);

/**
 * Middleware that enforces ADMIN role.
 */
const enforceAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be signed in.' });
  }
  if (ctx.session.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required.' });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

/**
 * Admin procedure — requires ADMIN role.
 */
export const adminProcedure = t.procedure.use(enforceAdmin);
