-- Row Level Security. The server (service-role key) bypasses RLS for trusted
-- writes via the RPCs; these policies govern what the public/anon and signed-in
-- users may read or do directly with the anon key.

alter table public.events        enable row level security;
alter table public.ticket_tiers  enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.tickets       enable row level security;
alter table public.reservations  enable row level security;

-- Events & tiers are public catalog data: anyone may read.
drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events
  for select using (true);

drop policy if exists "tiers_public_read" on public.ticket_tiers;
create policy "tiers_public_read" on public.ticket_tiers
  for select using (true);

-- Organizers manage their own events.
drop policy if exists "events_owner_write" on public.events;
create policy "events_owner_write" on public.events
  for all using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);

-- Buyers may read their own orders and the tickets attached to them.
drop policy if exists "orders_owner_read" on public.orders;
create policy "orders_owner_read" on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists "tickets_owner_read" on public.tickets;
create policy "tickets_owner_read" on public.tickets
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = tickets.order_id and o.user_id = auth.uid()
    )
  );

-- order_items and reservations have no public/anon access; all writes flow
-- through the security-definer RPCs (which run with the function owner's rights).

-- Expose availability to the catalog (read-only).
grant select on public.tier_availability to anon, authenticated;
