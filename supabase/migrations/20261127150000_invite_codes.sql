-- Frosh Music: Access & Invite Codes Schema
--
-- Supports both plain text codes (easy to insert and manage via Supabase Table Editor)
-- and optional SHA-256 hashes.
--
-- Codes are case-insensitive and surrounding whitespace is stripped automatically.
-- RLS is enabled with no select/insert policies for anon, so codes cannot be read or scraped.
--
-- Run this script in the Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

-- 1. Main access_codes table
create table if not exists public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  code_hash text unique,
  note text,
  is_active boolean not null default true,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. invite_codes table (backward compatibility alias)
create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  code_hash text unique,
  note text,
  is_active boolean not null default true,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (no public read/write through REST API)
alter table public.access_codes enable row level security;
alter table public.invite_codes enable row level security;

-- 3. Validation function: checks both access_codes and invite_codes
create or replace function public.validate_access_code(p_code text)
returns boolean
language sql
security definer
stable
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.access_codes
    where is_active
      and (
        upper(btrim(coalesce(code, ''))) = upper(btrim(p_code))
        or (code_hash is not null and code_hash = encode(digest(upper(btrim(p_code))::bytea, 'sha256'::text), 'hex'))
      )
    union all
    select 1 from public.invite_codes
    where is_active
      and (
        upper(btrim(coalesce(code, ''))) = upper(btrim(p_code))
        or (code_hash is not null and code_hash = encode(digest(upper(btrim(p_code))::bytea, 'sha256'::text), 'hex'))
      )
  );
$$;

-- Alias for backward compatibility
create or replace function public.validate_invite_code(p_code text)
returns boolean
language sql
security definer
stable
set search_path = public, extensions
as $$
  select public.validate_access_code(p_code);
$$;

-- 4. Record usage function
create or replace function public.record_access_code_use(p_code text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update public.access_codes
  set uses = uses + 1
  where is_active
    and (
      upper(btrim(coalesce(code, ''))) = upper(btrim(p_code))
      or (code_hash is not null and code_hash = encode(digest(upper(btrim(p_code))::bytea, 'sha256'::text), 'hex'))
    );

  update public.invite_codes
  set uses = uses + 1
  where is_active
    and (
      upper(btrim(coalesce(code, ''))) = upper(btrim(p_code))
      or (code_hash is not null and code_hash = encode(digest(upper(btrim(p_code))::bytea, 'sha256'::text), 'hex'))
    );
$$;

-- Alias for backward compatibility
create or replace function public.record_invite_code_use(p_code text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  select public.record_access_code_use(p_code);
$$;

-- Grant execution to anon and authenticated clients
grant execute on function public.validate_access_code(text) to anon, authenticated;
grant execute on function public.validate_invite_code(text) to anon, authenticated;
grant execute on function public.record_access_code_use(text) to anon, authenticated;
grant execute on function public.record_invite_code_use(text) to anon, authenticated;
