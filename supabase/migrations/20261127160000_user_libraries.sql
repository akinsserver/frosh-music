-- Frosh Music: Cross-Device Cloud Sync for User Libraries
--
-- Stores Liked Songs, Playlists, and Listening History per authenticated user.
-- Enables instant synchronization between iPhone, Laptop, and TV.

create table if not exists public.user_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  liked_songs jsonb not null default '[]'::jsonb,
  playlists jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_libraries enable row level security;

drop policy if exists "Users can view own library" on public.user_libraries;
create policy "Users can view own library" on public.user_libraries
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own library" on public.user_libraries;
create policy "Users can insert own library" on public.user_libraries
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own library" on public.user_libraries;
create policy "Users can update own library" on public.user_libraries
  for update using (auth.uid() = user_id);
