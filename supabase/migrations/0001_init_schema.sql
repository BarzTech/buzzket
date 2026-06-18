-- Buzzket core schema: events, ticket tiers, orders, tickets, reservations.
-- Run with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

create extension if not exists "pgcrypto";

-- Events ----------------------------------------------------------------------
create table if not exists public.events (
  id               text primary key,            -- slug, preserves existing URLs
  title            text not null,
  category         text not null,
  date             timestamptz not null,
  venue            text not null,
  city             text not null,
  image            text not null,
  price_from       integer not null check (price_from >= 0),
  organizer_name   text not null,
  organizer_avatar text not null,
  description      text not null,
  featured         boolean not null default false,
  organizer_id     uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);

-- Ticket tiers ----------------------------------------------------------------
create table if not exists public.ticket_tiers (
  id             uuid primary key default gen_random_uuid(),
  event_id       text not null references public.events (id) on delete cascade,
  name           text not null,
  price          integer not null check (price >= 0),         -- desired (face) price, UGX
  quantity_total integer not null check (quantity_total >= 0),
  quantity_sold  integer not null default 0 check (quantity_sold >= 0),
  created_at     timestamptz not null default now(),
  constraint ticket_tiers_not_oversold check (quantity_sold <= quantity_total)
);
create index if not exists ticket_tiers_event_id_idx on public.ticket_tiers (event_id);

-- Orders ----------------------------------------------------------------------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  event_id       text not null references public.events (id) on delete restrict,
  user_id        uuid references auth.users (id) on delete set null,
  status         text not null default 'pending'
                   check (status in ('pending','paid','cancelled','expired')),
  contact_name   text not null default '',
  contact_email  text not null default '',
  contact_phone  text not null default '',
  payment_method text not null default '',
  subtotal       integer not null default 0,   -- desired amount (organizer net)
  fees           integer not null default 0,   -- buyer-facing service fee
  total          integer not null default 0,   -- grossed-up amount charged
  created_at     timestamptz not null default now(),
  paid_at        timestamptz
);
create index if not exists orders_event_id_idx on public.orders (event_id);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  tier_id    uuid not null references public.ticket_tiers (id) on delete restrict,
  quantity   integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0)
);

-- Tickets (one row per admitted seat; carries the scannable QR token) ---------
create table if not exists public.tickets (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  tier_id     uuid not null references public.ticket_tiers (id) on delete restrict,
  qr_token    uuid not null default gen_random_uuid() unique,  -- cryptographic, unguessable
  holder_name text not null default '',
  status      text not null default 'valid' check (status in ('valid','used','void')),
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);
create index if not exists tickets_order_id_idx on public.tickets (order_id);
create index if not exists tickets_qr_token_idx on public.tickets (qr_token);

-- Reservations (10-minute soft holds that prevent overselling) -----------------
create table if not exists public.reservations (
  id         uuid primary key default gen_random_uuid(),
  tier_id    uuid not null references public.ticket_tiers (id) on delete cascade,
  order_id   uuid references public.orders (id) on delete set null,
  quantity   integer not null check (quantity > 0),
  status     text not null default 'active'
               check (status in ('active','confirmed','expired','cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists reservations_tier_id_idx on public.reservations (tier_id);
create index if not exists reservations_active_idx
  on public.reservations (tier_id, status, expires_at);

-- Enable RLS ------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.ticket_tiers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tickets enable row level security;
alter table public.reservations enable row level security;
