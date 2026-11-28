-- Frosh Music invite codes.
--
-- Codes are stored ONLY as SHA-256 hashes. The plain code is never stored in
-- the database, the web app, or the browser. Sign-up checks a code by hashing
-- what the user typed and comparing hashes inside this database.
--
-- Run this file once in the Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  note text,
  is_active boolean not null default true,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);

-- No direct access: RLS is on and there are no policies, so nobody (anon or
-- logged-in) can read, list, add, or change codes through the API. The only
-- way to check a code is the validate_invite_code() function below.
alter table public.invite_codes enable row level security;

-- Checks whether a code matches any active invite code. Codes are
-- case-insensitive and surrounding spaces are ignored. Returns true/false
-- only — it never reveals which code matched or how many codes exist.
create or replace function public.validate_invite_code(p_code text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.invite_codes
    where is_active
      and code_hash = encode(digest(upper(btrim(p_code)), 'sha256'), 'hex')
  );
$$;

-- Counts one use of a code after a successful sign-up. Best-effort: the
-- sign-up page calls it and ignores failures.
create or replace function public.record_invite_code_use(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.invite_codes
  set uses = uses + 1
  where is_active
    and code_hash = encode(digest(upper(btrim(p_code)), 'sha256'), 'hex');
$$;

grant execute on function public.validate_invite_code(text) to anon, authenticated;
grant execute on function public.record_invite_code_use(text) to anon, authenticated;
