import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  const token = await getToken({ req: request });

  if (!token) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes EXCEPT:
     *  - /auth/*           (sign-in page)
     *  - /api/auth/*       (NextAuth endpoints)
     *  - /api/cron/*       (Vercel cron jobs — authenticated via CRON_SECRET header)
     *  - /api/connect/*    (OAuth initiation & callback routes)
     *  - /api/trpc/*       (tRPC handles its own auth via middleware)
     *  - /_next/*          (Next.js internals)
     *  - /favicon.ico, /robots.txt, static assets
     */
    '/((?!auth|api/auth|api/cron|api/connect|api/trpc|_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)',
  ],
};
