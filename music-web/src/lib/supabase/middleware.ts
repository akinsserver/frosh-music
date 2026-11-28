// Session refresh + route gate, run by src/proxy.ts before every page.
//
// Only accounts that exist in Supabase Auth can hold a valid session, so
// `getUser()` is the sign-in check: an unknown user can never get in,
// and there is no user list anywhere in this app to compare against.

const PUBLIC_PATHS = ['/login', '/signup'];
const PUBLIC_PREFIXES = ['/auth/'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  // Supabase is not configured: fail closed. Everyone lands on /login, where
  // the page explains which env vars are missing.
  if (!url || !key) {
    if (isPublicPath(pathname)) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase: SupabaseClient = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  try {
    // Revalidates the session with Supabase Auth.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user && !isPublicPath(pathname)) {
      // Graceful offline check: if network fails but auth cookie exists, do not kick offline users
      const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
      if (error && hasAuthCookie && error.message.toLowerCase().includes('fetch')) {
        return supabaseResponse;
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Signed-in users never need the auth pages.
    if (user && (pathname === '/login' || pathname === '/signup')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  } catch {
    const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
    if (!hasAuthCookie && !isPublicPath(pathname)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return supabaseResponse;
}
