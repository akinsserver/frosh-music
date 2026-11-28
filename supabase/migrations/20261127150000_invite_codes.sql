-- Frosh Music: Unified Access Codes & User Profiles Schema
--
-- 1. access_codes: The single consolidated table for invite/access codes.
-- 2. profiles: Automatically created user profiles linked to auth.users.
--
-- Run this script in the Supabase Dashboard -> SQL Editor (or via Supabase CLI).

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. ACCESS CODES (Single canonical table for invite/access codes)
-- ============================================================================

-- Drop redundant invite_codes table if it exists
drop table if exists public.invite_codes cascade;

create table if not exists public.access_codes (
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

-- Checks whether a code matches any active code in access_codes
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

-- Records usage count
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

grant execute on function public.validate_access_code(text) to anon, authenticated;
grant execute on function public.validate_invite_code(text) to anon, authenticated;
grant execute on function public.record_access_code_use(text) to anon, authenticated;
grant execute on function public.record_invite_code_use(text) to anon, authenticated;


-- ============================================================================
-- 2. USER PROFILES (Linked to auth.users on registration)
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  access_code_used text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Policies: Users can view & update their own profile
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Function & Trigger to automatically insert a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, access_code_used)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'access_code'
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
