-- Launch hardening: role checks, event-scoped promo codes, and atomic scanner
-- check-in for multiple organiser devices.

create table if not exists public.promo_codes (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null references public.events (id) on delete cascade,
  organizer_id uuid references auth.users (id) on delete cascade,
  code        text not null,
  type        text not null check (type in ('percent', 'flat')),
  value       integer not null check (value > 0),
  max_uses    integer check (max_uses is null or max_uses > 0),
  used_count  integer not null default 0 check (used_count >= 0),
  active      boolean not null default true,
  expires_at  date,
  created_at  timestamptz not null default now(),
  unique (event_id, code)
);

create index if not exists promo_codes_event_id_idx on public.promo_codes (event_id);
alter table public.promo_codes enable row level security;

drop policy if exists "promo_admin_all" on public.promo_codes;
create policy "promo_admin_all" on public.promo_codes
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists "promo_organizer_own_events" on public.promo_codes;
create policy "promo_organizer_own_events" on public.promo_codes
  for all
  using (
    exists (
      select 1 from public.events e
      where e.id = promo_codes.event_id
        and e.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = promo_codes.event_id
        and e.organizer_id = auth.uid()
    )
  );

create or replace function public.check_in_ticket(p_token uuid)
returns table (status text, holder text, event_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket_id uuid;
  v_status text;
  v_holder text;
  v_event_id text;
  v_allowed boolean;
  v_role text;
  v_count int;
begin
  select
    t.id,
    t.status,
    t.holder_name,
    tt.event_id
  into v_ticket_id, v_status, v_holder, v_event_id
  from public.tickets t
  join public.ticket_tiers tt on tt.id = t.tier_id
  where t.qr_token = p_token;

  if not found then
    return query select 'not_found'::text, null::text, null::text;
    return;
  end if;

  v_role := auth.jwt() -> 'user_metadata' ->> 'role';
  select
    v_role = 'admin'
    or exists (
      select 1 from public.events e
      where e.id = v_event_id
        and e.organizer_id = auth.uid()
    )
  into v_allowed;

  if not coalesce(v_allowed, false) then
    return query select 'forbidden'::text, v_holder, v_event_id;
    return;
  end if;

  if v_status <> 'valid' then
    return query select 'already_used'::text, v_holder, v_event_id;
    return;
  end if;

  update public.tickets
     set status = 'used', used_at = now()
   where id = v_ticket_id
     and status = 'valid';
  get diagnostics v_count = row_count;

  if v_count = 0 then
    return query select 'already_used'::text, v_holder, v_event_id;
    return;
  end if;

  return query select 'valid'::text, v_holder, v_event_id;
end;
$$;

grant execute on function public.check_in_ticket(uuid) to authenticated;
