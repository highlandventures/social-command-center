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
     *  - /auth/*        (sign-in page)
     *  - /api/auth/*    (NextAuth endpoints)
     *  - /_next/*       (Next.js internals)
     *  - /favicon.ico, /robots.txt, static assets
     */
    '/((?!auth|api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)',
  ],
};
