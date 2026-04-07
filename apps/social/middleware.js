import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

const publicPaths = [
  '/auth/signin',
  '/auth/signup',
  '/auth/verify',
  '/api/auth',      // NextAuth routes
  '/api/cron',
  '/api/connect',
  '/api/webhooks',
  '/ylds',          // Public YLDS wireframe
];

const bypassAuth = (process.env.BYPASS_AUTH === 'true' || process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') && process.env.NODE_ENV === 'development';

export default async function middleware(request) {
  if (bypassAuth) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
