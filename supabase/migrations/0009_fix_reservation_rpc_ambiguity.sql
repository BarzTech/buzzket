-- Fix ambiguous PL/pgSQL column references in reservation RPCs.
-- Output columns such as `tier_id` and `order_id` are also PL/pgSQL variables,
-- so table columns must be qualified inside these functions.

create or replace view public.tier_availability as
select
  t.id,
  t.event_id,
  t.quantity_total,
  t.quantity_sold,
  greatest(
    0,
    t.quantity_total - t.quantity_sold - coalesce(r.reserved, 0)
  ) as available
from public.ticket_tiers t
left join lateral (
  select sum(r.quantity)::int as reserved
  from public.reservations r
  where r.tier_id = t.id
    and r.status = 'active'
    and r.expires_at > now()
) r on true;

create or replace function public.reserve_tickets(p_tier_id uuid, p_qty int)
returns table (reservation_id uuid, tier_id uuid, quantity int, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total     int;
  v_sold      int;
  v_reserved  int;
  v_available int;
  v_res       public.reservations;
begin
  if p_qty <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  select t.quantity_total, t.quantity_sold
    into v_total, v_sold
    from public.ticket_tiers t
   where t.id = p_tier_id
     for update;

  if not found then
    raise exception 'Ticket tier % not found', p_tier_id;
  end if;

  update public.reservations r
     set status = 'expired'
   where r.tier_id = p_tier_id
     and r.status = 'active'
     and r.expires_at <= now();

  select coalesce(sum(r.quantity), 0)::int
    into v_reserved
    from public.reservations r
   where r.tier_id = p_tier_id
     and r.status = 'active'
     and r.expires_at > now();

  v_available := v_total - v_sold - v_reserved;

  if v_available < p_qty then
    raise exception 'Only % ticket(s) left for this tier', greatest(v_available, 0)
      using errcode = 'P0001';
  end if;

  insert into public.reservations (tier_id, quantity, status, expires_at)
  values (p_tier_id, p_qty, 'active', now() + interval '10 minutes')
  returning * into v_res;

  return query
    select v_res.id, v_res.tier_id, v_res.quantity, v_res.expires_at;
end;
$$;

create or replace function public.confirm_reservation(
  p_reservation_id uuid,
  p_contact_name   text,
  p_contact_email  text,
  p_contact_phone  text,
  p_payment_method text,
  p_unit_price     int
)
returns table (order_id uuid, qr_tokens uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res         public.reservations;
  v_tier        public.ticket_tiers;
  v_order       public.orders;
  v_subtotal    int;
  v_total       int;
  v_fees        int;
  v_final_per   int;
  v_tokens      uuid[] := '{}';
  v_token       uuid;
  i             int;
begin
  select * into v_res
    from public.reservations r
   where r.id = p_reservation_id
     for update;
  if not found then
    raise exception 'Reservation not found';
  end if;
  if v_res.status <> 'active' then
    raise exception 'Reservation is no longer active';
  end if;
  if v_res.expires_at <= now() then
    update public.reservations r
       set status = 'expired'
     where r.id = v_res.id;
    raise exception 'Reservation has expired';
  end if;

  select * into v_tier
    from public.ticket_tiers t
   where t.id = v_res.tier_id
     for update;
  if v_tier.quantity_sold + v_res.quantity > v_tier.quantity_total then
    raise exception 'Sold out';
  end if;

  v_final_per := ceil((p_unit_price + 500)::numeric / 0.95);
  v_subtotal  := p_unit_price * v_res.quantity;
  v_total     := v_final_per * v_res.quantity;
  v_fees      := v_total - v_subtotal;

  insert into public.orders (
    event_id, status, contact_name, contact_email, contact_phone,
    payment_method, subtotal, fees, total, paid_at
  )
  values (
    v_tier.event_id, 'paid', p_contact_name, p_contact_email, p_contact_phone,
    p_payment_method, v_subtotal, v_fees, v_total, now()
  )
  returning * into v_order;

  insert into public.order_items (order_id, tier_id, quantity, unit_price)
  values (v_order.id, v_res.tier_id, v_res.quantity, p_unit_price);

  update public.ticket_tiers t
     set quantity_sold = t.quantity_sold + v_res.quantity
   where t.id = v_res.tier_id;

  update public.reservations r
     set status = 'confirmed', order_id = v_order.id
   where r.id = v_res.id;

  for i in 1..v_res.quantity loop
    insert into public.tickets (order_id, tier_id, holder_name, status)
    values (v_order.id, v_res.tier_id, p_contact_name, 'valid')
    returning qr_token into v_token;
    v_tokens := array_append(v_tokens, v_token);
  end loop;

  return query select v_order.id, v_tokens;
end;
$$;

create or replace function public.expire_stale_reservations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.reservations r
     set status = 'expired'
   where r.status = 'active'
     and r.expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
