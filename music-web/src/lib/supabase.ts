// Deprecated: All Supabase interactions now run server-side via Next.js BFF Route Handlers (/api/auth/*, /api/user/*).
// Neither SUPABASE_URL nor SUPABASE_ANON_KEY is exposed to the browser.
// This prevents third parties from discovering Supabase credentials in client bundles.

export function createClient() {
  return null;
}
