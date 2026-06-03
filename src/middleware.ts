import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Skip API routes except main application routes
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api/auth') ||
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;
  const user = token ? await verifyJWT(token) : null;

  // Protect Admin dashboard
  if (path.startsWith('/admin')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', path);
      return NextResponse.redirect(loginUrl);
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/seller', request.url));
    }
  }

  // Protect Seller dashboard
  if (path.startsWith('/seller')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', path);
      return NextResponse.redirect(loginUrl);
    }
    if (user.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // Root or Login page redirection
  if (path === '/' || path === '/login') {
    if (user) {
      if (user.role === 'ADMIN') {
        return NextResponse.redirect(new URL('/admin', request.url));
      } else {
        return NextResponse.redirect(new URL('/seller', request.url));
      }
    }
    if (path === '/') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on all paths except static files or auth API endpoints
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
