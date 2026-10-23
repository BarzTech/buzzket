-- Event fee responsibility and immutable order snapshot. The default keeps
-- existing events on the current buyer-pays behavior.
alter table public.events
  add column if not exists fee_responsibility text not null default 'customer'
  check (fee_responsibility in ('customer', 'organizer'));
alter table public.orders
  add column if not exists fee_responsibility text not null default 'customer'
  check (fee_responsibility in ('customer', 'organizer'));
alter table public.orders
  add column if not exists sms_delivery_status text not null default 'pending'
  check (sms_delivery_status in ('pending', 'accepted', 'queued', 'sent', 'delivered', 'failed'));
alter table public.reservations
  add column if not exists fee_responsibility text not null default 'customer'
  check (fee_responsibility in ('customer', 'organizer'));

create or replace function public.snapshot_reservation_fee_responsibility()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select coalesce(e.fee_responsibility, 'customer') into new.fee_responsibility
    from public.ticket_tiers t join public.events e on e.id=t.event_id
   where t.id=new.tier_id;
  if new.fee_responsibility is null then new.fee_responsibility := 'customer'; end if;
  return new;
end $$;
drop trigger if exists reservation_fee_responsibility_snapshot on public.reservations;
create trigger reservation_fee_responsibility_snapshot before insert on public.reservations
  for each row execute function public.snapshot_reservation_fee_responsibility();

-- Recovery phone is distinct from the public organiser contact field.
alter table public.organizer_profiles
  add column if not exists recovery_phone text,
  add column if not exists recovery_phone_verified_at timestamptz;
create table if not exists public.organizer_recovery_phone_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_hash text not null,
  changed_at timestamptz not null default now()
);
alter table public.organizer_recovery_phone_audit enable row level security;
revoke all on public.organizer_recovery_phone_audit from public, anon, authenticated;
grant all on public.organizer_recovery_phone_audit to service_role;

create or replace function public.guard_organizer_recovery_phone()
returns trigger language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and
     (new.recovery_phone is distinct from old.recovery_phone or
      new.recovery_phone_verified_at is distinct from old.recovery_phone_verified_at) then
    raise exception 'Recovery phone changes must pass the trusted SMS verification flow';
  end if;
  if new.approval_status = 'approved' and
     (nullif(new.recovery_phone, '') is null or new.recovery_phone_verified_at is null) then
    raise exception 'A verified recovery phone is required before organiser approval';
  end if;
  if tg_op = 'UPDATE' and new.recovery_phone_verified_at is not null and
     (new.recovery_phone is distinct from old.recovery_phone or old.recovery_phone_verified_at is null) then
    insert into public.organizer_recovery_phone_audit(user_id, phone_hash)
      values(new.user_id, encode(digest(new.recovery_phone, 'sha256'), 'hex'));
  end if;
  return new;
end $$;
drop trigger if exists organizer_recovery_phone_guard on public.organizer_profiles;
create trigger organizer_recovery_phone_guard before insert or update on public.organizer_profiles
  for each row execute function public.guard_organizer_recovery_phone();

create or replace function public.submit_manual_payment(
  p_reservation_id uuid, p_contact_name text, p_contact_email text,
  p_whatsapp_number text, p_payment_method text, p_transaction_id text,
  p_merchant_code text, p_status_token text, p_promo_code text default null
) returns table(order_id uuid, status_token text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_res public.reservations; v_tier public.ticket_tiers; v_order public.orders;
  v_price integer; v_subtotal integer; v_total integer; v_fees integer;
  v_fee_responsibility text; v_token text := p_status_token; v_promo record;
begin
  if nullif(btrim(p_contact_name),'') is null or coalesce(p_contact_email,'') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or coalesce(p_whatsapp_number,'') !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Invalid customer details'; end if;
  if nullif(btrim(p_transaction_id),'') is null then raise exception 'Transaction ID is required'; end if;
  if length(btrim(p_transaction_id)) > 120 then raise exception 'Transaction ID is too long'; end if;
  if coalesce(v_token,'') !~ '^[A-Fa-f0-9]{64}$' then raise exception 'Invalid order status token'; end if;
  select * into v_res from public.reservations where id=p_reservation_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if v_res.status='confirmed' and v_res.order_id is not null then
    if exists(select 1 from public.orders where id=v_res.order_id and guest_status_token_hash=encode(digest(v_token,'sha256'),'hex')) then
      return query select v_res.order_id,v_token; return;
    end if;
    raise exception 'Reservation has already been submitted';
  end if;
  if v_res.status <> 'active' then raise exception 'Reservation is no longer active'; end if;
  if v_res.expires_at <= now() then
    update public.reservations set status='expired' where id=v_res.id;
    raise exception 'Reservation has expired';
  end if;
  select * into v_tier from public.ticket_tiers where id=v_res.tier_id for update;
  if v_tier.quantity_sold + v_res.quantity > v_tier.quantity_total then raise exception 'Sold out'; end if;
  v_fee_responsibility := coalesce(v_res.fee_responsibility, 'customer');
  v_price := v_tier.price;
  if p_promo_code is not null and btrim(p_promo_code) <> '' then
    select * into v_promo from public.promo_codes
      where upper(code)=upper(btrim(p_promo_code)) and event_id=v_tier.event_id
        and active=true and (expires_at is null or expires_at >= current_date)
        and (max_uses is null or used_count < max_uses) for update;
    if not found then raise exception 'Promo code is invalid or expired'; end if;
    if v_promo.type='percent' then
      v_price := greatest(0, round(v_price * (1 - v_promo.value::numeric / 100))::integer);
    else
      v_price := greatest(0, v_price - v_promo.value);
    end if;
    update public.promo_codes set used_count=used_count+1 where id=v_promo.id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_transaction_id)),0));
  if exists(select 1 from public.orders where lower(btrim(transaction_id))=lower(btrim(p_transaction_id))
      and status in ('payment_submitted','paid','payment_approved')) then
    raise exception 'This transaction ID is already attached to an active or approved order';
  end if;
  v_subtotal := v_price * v_res.quantity;
  v_fees := (ceil((v_price + 500)::numeric / 0.95)::integer - v_price) * v_res.quantity;
  v_total := case when v_fee_responsibility='customer' then v_subtotal + v_fees else v_subtotal end;
  insert into public.orders(event_id,status,contact_name,contact_email,contact_phone,whatsapp_number,
    payment_method,payment_provider,transaction_id,merchant_code,subtotal,fees,total,
    fee_responsibility,guest_status_token_hash,created_at)
  values(v_tier.event_id,'payment_submitted',btrim(p_contact_name),lower(btrim(p_contact_email)),
    p_whatsapp_number,p_whatsapp_number,p_payment_method,'manual_momo',btrim(p_transaction_id),
    p_merchant_code,v_subtotal,v_fees,v_total,v_fee_responsibility,
    encode(digest(v_token,'sha256'),'hex'),now()) returning * into v_order;
  insert into public.order_items(order_id,tier_id,quantity,unit_price)
    values(v_order.id,v_res.tier_id,v_res.quantity,v_price);
  update public.ticket_tiers set quantity_sold=quantity_sold+v_res.quantity where id=v_res.tier_id;
  update public.reservations set status='confirmed',order_id=v_order.id where id=v_res.id;
  insert into public.payment_audit_logs(order_id,action,previous_status,new_status,transaction_id)
    values(v_order.id,'submitted','pending','payment_submitted',btrim(p_transaction_id));
  return query select v_order.id,v_token;
end $$;
revoke all on function public.submit_manual_payment(uuid,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_manual_payment(uuid,text,text,text,text,text,text,text,text) to service_role;

create or replace function public.dashboard_stats(p_organizer_id uuid default null)
returns table (
  total_sales bigint,
  tickets_sold bigint,
  total_events bigint,
  attendees bigint,
  platform_commission bigint,
  organizer_payout bigint
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if p_organizer_id is null and not public.is_admin() then
    p_organizer_id := auth.uid();
  end if;
  if p_organizer_id is not null and p_organizer_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not authorized to view this organiser dashboard';
  end if;
  return query select
    coalesce(sum(o.total), 0)::bigint,
    (select count(*) from public.tickets t
       join public.ticket_tiers tt on tt.id=t.tier_id
       join public.events e on e.id=tt.event_id
      where p_organizer_id is null or e.organizer_id=p_organizer_id),
    (select count(*) from public.events e where p_organizer_id is null or e.organizer_id=p_organizer_id),
    (select count(*) from public.tickets t
       join public.ticket_tiers tt on tt.id=t.tier_id
       join public.events e on e.id=tt.event_id
      where t.status='used' and (p_organizer_id is null or e.organizer_id=p_organizer_id)),
    coalesce(sum(o.fees), 0)::bigint,
    coalesce(sum(case when o.fee_responsibility='organizer' then o.total-o.fees else o.subtotal end), 0)::bigint
  from public.orders o
  where o.status='paid'
    and (p_organizer_id is null or exists(
      select 1 from public.events e where e.id=o.event_id and e.organizer_id=p_organizer_id
  ));
end;
$$;
grant execute on function public.dashboard_stats(uuid) to authenticated;
