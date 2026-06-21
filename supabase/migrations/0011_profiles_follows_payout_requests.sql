-- Organizer profiles, follower relationships, and organizer payout requests.

create table if not exists public.organizer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text not null default '',
  phone text not null default '',
  website text not null default '',
  payout_method text not null default 'MTN Mobile Money',
  payout_account text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizer_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  organizer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, organizer_id),
  check (follower_id <> organizer_id)
);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  payment_method text not null default '',
  payment_account text not null default '',
  note text not null default '',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists organizer_follows_organizer_id_idx on public.organizer_follows (organizer_id);
create index if not exists payout_requests_organizer_id_idx on public.payout_requests (organizer_id);
create index if not exists payout_requests_status_idx on public.payout_requests (status);

alter table public.organizer_profiles enable row level security;
alter table public.organizer_follows enable row level security;
alter table public.payout_requests enable row level security;

drop policy if exists "organizer_profiles_public_read" on public.organizer_profiles;
create policy "organizer_profiles_public_read" on public.organizer_profiles
  for select using (true);

drop policy if exists "organizer_profiles_owner_write" on public.organizer_profiles;
create policy "organizer_profiles_owner_write" on public.organizer_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "organizer_follows_owner_read" on public.organizer_follows;
create policy "organizer_follows_owner_read" on public.organizer_follows
  for select using (auth.uid() = follower_id or auth.uid() = organizer_id);

drop policy if exists "organizer_follows_owner_insert" on public.organizer_follows;
create policy "organizer_follows_owner_insert" on public.organizer_follows
  for insert with check (auth.uid() = follower_id);

drop policy if exists "organizer_follows_owner_delete" on public.organizer_follows;
create policy "organizer_follows_owner_delete" on public.organizer_follows
  for delete using (auth.uid() = follower_id);

drop policy if exists "payout_requests_owner_read" on public.payout_requests;
create policy "payout_requests_owner_read" on public.payout_requests
  for select using (
    auth.uid() = organizer_id
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "payout_requests_owner_insert" on public.payout_requests;
create policy "payout_requests_owner_insert" on public.payout_requests
  for insert with check (auth.uid() = organizer_id);

drop policy if exists "payout_requests_admin_update" on public.payout_requests;
create policy "payout_requests_admin_update" on public.payout_requests
  for update using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

insert into storage.buckets (id, name, public)
values ('organizer-avatars', 'organizer-avatars', true)
on conflict (id) do nothing;

drop policy if exists "Organizer avatar public read" on storage.objects;
create policy "Organizer avatar public read" on storage.objects
  for select using (bucket_id = 'organizer-avatars');

drop policy if exists "Organizer avatar authenticated insert" on storage.objects;
create policy "Organizer avatar authenticated insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'organizer-avatars');

drop policy if exists "Organizer avatar owner update" on storage.objects;
create policy "Organizer avatar owner update" on storage.objects
  for update to authenticated using (bucket_id = 'organizer-avatars' and owner = auth.uid())
  with check (bucket_id = 'organizer-avatars' and owner = auth.uid());
