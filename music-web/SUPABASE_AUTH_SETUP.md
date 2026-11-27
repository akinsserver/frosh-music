# Frosh Music — Supabase Auth setup

Sign-in is invite-only. Only accounts that exist in Supabase Auth can sign in,
and creating an account requires one of your invite codes. The codes live only
in Supabase, stored as SHA-256 hashes — never in the web app, the repo, the
server, or the browser.

## 1. Supabase project

Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
(or reuse an existing one). Then copy two values from **Project Settings → API**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The anon key is safe to ship in the web app — it only lets the app talk to your
project under the Row Level Security rules below. Never use the **service_role**
key in this app.

## 2. Env vars

Local dev — copy the example file and fill it in:

```bash
cd music-web
cp .env.example .env.local
```

Production (Vercel) — add the same two variables in the Vercel project under
**Settings → Environment Variables**, then redeploy. Until they are set, every
page redirects to `/login`, which explains what is missing.

## 3. Run the invite-code migration

In the Supabase Dashboard, open **SQL Editor → New query**, paste the whole
contents of `supabase/migrations/20261127150000_invite_codes.sql`, and run it.
It creates:

- `invite_codes` table (`code_hash`, `note`, `is_active`, `uses`, `created_at`)
  with Row Level Security on and **no** read/write policies — nobody can list
  or read codes through the API, including signed-in users.
- `validate_invite_code(code)` — a `SECURITY DEFINER` function that hashes
  what the user typed and answers only true/false. It never reveals which code
  matched or how many codes exist.
- `record_invite_code_use(code)` — counts one use after a successful sign-up.

## 4. Create your invite codes

Create as many as you like — any active one works. Run this in the SQL Editor,
replacing the code and the note each time. The plain code is hashed inside the
database; it is never stored:

```sql
insert into public.invite_codes (code_hash, note)
values (
  encode(digest(upper(btrim('FROSH-2026-FRIENDS')), 'sha256'), 'hex'),
  'Friends — Nov 2026'
);
```

Tips:

- Make codes long and random-ish, e.g. `FROSH-7K2Q-9X4M-2026`. Short,
  guessable codes are the one thing brute force could find.
- Codes are case-insensitive and surrounding spaces are ignored.
- To revoke a code without deleting it:

  ```sql
  update public.invite_codes
  set is_active = false
  where note = 'Friends — Nov 2026';
  ```

- To see your codes and how often each was used (dashboard only — this query
  never runs in the app):

  ```sql
  select note, is_active, uses, created_at from public.invite_codes order by created_at;
  ```

## 5. Email confirmation (recommended: OFF)

In **Authentication → Providers → Email**, turn **Confirm email OFF** so an
invited user can sign in immediately after signing up — no email round-trip.

If you leave it ON instead, sign-up shows "check your email", and the link in
that email lands on `/auth/callback`, which finishes the sign-in and sends the
user to the homepage. In that case also set:

- **Authentication → URL Configuration → Site URL** to your deployed URL
  (e.g. `https://frosh-music.vercel.app`)
- **Redirect URLs**: add `http://localhost:3000/auth/callback` (local dev) and
  `https://frosh-music.vercel.app/auth/callback` (production, with your real
  domain).

## How the pieces fit

| Piece | What it does |
|---|---|
| `src/app/login/page.tsx` | Sign-in form: email + password, show/hide password button. Only Supabase Auth accounts can sign in. |
| `src/app/signup/page.tsx` | Sign-up form: email + password + invite code. Checks the code first, then creates the account. |
| `src/app/auth/callback/route.ts` | Finishes email-confirmation links (only used when Confirm email is ON). |
| `src/proxy.ts` + `src/lib/supabase/middleware.ts` | Runs before every page: signed-out visitors go to `/login`; signed-in users are sent away from `/login` and `/signup` to the homepage. |
| `src/components/ShellGate.tsx` | Hides the sidebar/player on the auth pages so they render as clean full-screen forms. |
| `src/components/Sidebar.tsx` | Shows the signed-in email and a Sign out button (desktop + mobile). |
| `supabase/migrations/20261127150000_invite_codes.sql` | Invite-code table + validation functions (the only place codes live). |

## What is NOT gated (yet)

The music server itself (`music-server`, proxied at `/api/*`) has no auth —
anyone who knows the API URL can call it directly. The gate above protects the
web app's pages. Adding a token check to the music server is a separate job if
you want the audio API locked down too.
