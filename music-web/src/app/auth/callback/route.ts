// Email-confirmation callback: Supabase sends the user here from the
// confirmation link with a `code`, which is exchanged for a session.
// Only used when "Confirm email" is turned on in Supabase Auth settings.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const authError = searchParams.get('error');

  if (code && !authError) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  // Missing/expired code or a failed exchange: send the user to sign-in.
  // A fresh sign-in works even when the emailed link has expired.
  return NextResponse.redirect(new URL('/login', request.url));
}
