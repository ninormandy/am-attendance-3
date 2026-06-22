import { NextResponse } from 'next/server';
import { COOKIE_NAME } from './lib/auth';

// Lightweight, edge-runtime presence check only (no crypto verification
// here). API routes are the source of truth and fully verify the JWT on
// every request via withAdminAuth — this just gives logged-out users a
// fast redirect instead of a flash of protected UI.
export function middleware(req) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = req.cookies.get(COOKIE_NAME);
    if (!token) {
      const loginUrl = new URL('/admin/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
