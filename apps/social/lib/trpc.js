import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { getSession } from './auth';
import { prisma } from './db';
import { kv } from './redis';

/**
 * tRPC Context — available in every procedure
 * Includes: prisma client, Redis KV, and the current user session.
 */
const ctxBypassAuth = (process.env.BYPASS_AUTH === 'true' || process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') && process.env.NODE_ENV === 'development';

export async function createContext({ req, res }) {
  const session = ctxBypassAuth ? null : await getSession();
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
const bypassAuth = process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV === 'development';

const enforceAuth = t.middleware(async ({ ctx, next }) => {
  if (bypassAuth && !ctx.session?.user) {
    // Dev-only: resolve first user from DB as fallback when auth is bypassed
    const devUser = await ctx.prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (devUser) {
      return next({
        ctx: { ...ctx, session: { user: devUser }, user: devUser },
      });
    }
  }
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

/**
 * Middleware that blocks AGENCY role from write/modify operations.
 * ADMIN and INTERNAL can proceed; AGENCY gets FORBIDDEN.
 */
const enforceInternal = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be signed in.' });
  }
  if (ctx.session.user.role === 'AGENCY') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This action requires Internal or Admin access.' });
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
 * Internal procedure — requires ADMIN or INTERNAL role (blocks AGENCY).
 * Use for any write/modify mutation that agency users should not perform.
 */
export const internalProcedure = t.procedure.use(enforceInternal);
