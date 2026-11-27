// Browser-side Supabase client (Supabase Auth: email + password).
//
// Returns null when the Supabase env vars are not set, so pages can show a
// clear "not configured" message instead of crashing.
//
// No invite codes or secrets live here. Codes are checked inside Supabase by
// the validate_invite_code() database function — see
// supabase/migrations/20261127150000_invite_codes.sql. The browser only ever
// sends the code the user typed to that function, and never stores it.
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
