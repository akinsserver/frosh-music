// Next.js 16 Proxy (the file convention formerly called "middleware").
// Runs before every matched request and hands off to updateSession, which
// redirects signed-out visitors to /login and signed-in users away from the
// auth pages.
import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Every page except Next.js internals, the music-server API proxy
    // (/api/* is rewritten to the Mini PC in next.config.ts), and public files.
    '/((?!_next/static|_next/image|api|favicon.ico|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)',
  ],
};
