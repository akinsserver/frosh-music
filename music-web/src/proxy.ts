// Next.js 16 Proxy (the file convention formerly called "middleware").
// 1. Injects server-to-server secret key (x-api-key) into rewritten /api/* requests.
// 2. Runs Supabase session refresh + route authentication on all app pages.
import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Intercept /api/ calls: inject secret server-to-server key so music-server accepts the proxy request
  if (pathname.startsWith('/api/')) {
    const apiKey = process.env.MUSIC_API_KEY || process.env.FROSH_API_SECRET;
    if (apiKey) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-api-key', apiKey);
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
    return NextResponse.next();
  }

  // User auth session handling for all pages
  return updateSession(request);
}

export const config = {
  matcher: [
    // Include /api/:path* so proxy can attach secret x-api-key to the backend rewrite,
    // and all pages except _next/static, _next/image, and static assets.
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)',
  ],
};
