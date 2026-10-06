-- Guest checkout, WhatsApp delivery, private ticket files, and trusted admin roles.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'organizer')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
insert into public.user_roles(user_id, role)
select id, 'admin' from auth.users where raw_app_meta_data ->> 'role' = 'admin'
on conflict do nothing;
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists(select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- Existing administrator grants must be migrated by a trusted operator. The
-- user_metadata role is intentionally not copied because users can edit it.

alter table public.orders
  add column if not exists whatsapp_number text,
  add column if not exists guest_status_token_hash text,
  add column if not exists pdf_storage_path text,
  add column if not exists ticket_generation_status text not null default 'pending'
    check (ticket_generation_status in ('pending','generated','failed')),
  add column if not exists ticket_generation_error text,
  add column if not exists whatsapp_delivery_status text not null default 'pending'
    check (whatsapp_delivery_status in ('pending','sent','delivered','failed')),
  add column if not exists whatsapp_message_sid text,
  add column if not exists whatsapp_sent_at timestamptz,
  add column if not exists whatsapp_delivery_error text,
  add column if not exists whatsapp_retry_count integer not null default 0;
create unique index if not exists orders_guest_status_token_hash_uidx
  on public.orders(guest_status_token_hash) where guest_status_token_hash is not null;
create index if not exists orders_whatsapp_sid_idx on public.orders(whatsapp_message_sid)
  where whatsapp_message_sid is not null;

create table if not exists public.ticket_download_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);
alter table public.ticket_download_tokens enable row level security;
revoke all on public.ticket_download_tokens from anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-pdfs','ticket-pdfs',false,10485760,array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf'];

-- A trusted caller (service_role) can submit payment, but cannot choose price,
-- quantity, event, total, or status. All price inputs come from locked DB rows.
drop function if exists public.submit_manual_payment(uuid,text,text,text,text,text,text,text,integer);
drop function if exists public.submit_manual_payment(uuid,text,text,text,text,text,text,text,text);
create function public.submit_manual_payment(
  p_reservation_id uuid, p_contact_name text, p_contact_email text,
  p_whatsapp_number text, p_payment_method text, p_transaction_id text,
  p_merchant_code text, p_status_token text, p_promo_code text default null
) returns table(order_id uuid, status_token text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_res public.reservations; v_tier public.ticket_tiers; v_order public.orders;
  v_price integer; v_subtotal integer; v_total integer; v_fees integer;
  v_token text := p_status_token; v_promo record;
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
  v_total := ceil((v_price + 500)::numeric / 0.95)::integer * v_res.quantity;
  v_fees := v_total-v_subtotal;
  insert into public.orders(event_id,status,contact_name,contact_email,contact_phone,whatsapp_number,
    payment_method,payment_provider,transaction_id,merchant_code,subtotal,fees,total,guest_status_token_hash,created_at)
  values(v_tier.event_id,'payment_submitted',btrim(p_contact_name),lower(btrim(p_contact_email)),
    p_whatsapp_number,p_whatsapp_number,p_payment_method,'manual_momo',btrim(p_transaction_id),
    p_merchant_code,v_subtotal,v_fees,v_total,encode(digest(v_token,'sha256'),'hex'),now()) returning * into v_order;
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

-- Payment verification/audit reads and all sensitive admin RLS now use the
-- trusted role table, never user-editable auth.user_metadata.
drop policy if exists "Admins can view payment audit logs" on public.payment_audit_logs;
create policy "Admins can view payment audit logs" on public.payment_audit_logs
  for select using (public.is_admin() or auth.role()='service_role');
drop policy if exists "Admins can delete events" on public.events;
drop policy if exists "events_admin_delete" on public.events;
create policy "Admins can delete events" on public.events for delete using (public.is_admin());
drop policy if exists "promo_admin_all" on public.promo_codes;
create policy "promo_admin_all" on public.promo_codes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "payout_requests_owner_read" on public.payout_requests;
create policy "payout_requests_owner_read" on public.payout_requests for select using (organizer_id=auth.uid() or public.is_admin());
drop policy if exists "payout_requests_admin_update" on public.payout_requests;
create policy "payout_requests_admin_update" on public.payout_requests for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "platform_settings_admin_update" on public.platform_settings;
drop policy if exists "platform_settings_admin_insert" on public.platform_settings;
create policy "platform_settings_admin_update" on public.platform_settings for update using (public.is_admin()) with check (public.is_admin());
create policy "platform_settings_admin_insert" on public.platform_settings for insert with check (public.is_admin());
drop policy if exists "organizer_profiles_admin_update" on public.organizer_profiles;
create policy "organizer_profiles_admin_update" on public.organizer_profiles for update using (public.is_admin()) with check (public.is_admin());

-- Preserve organizer/admin scan authorization while removing the mutable JWT
-- user_metadata privilege check.
create or replace function public.check_in_ticket(p_token uuid)
returns table (status text, holder text, event_id text)
language plpgsql security definer set search_path = public, auth as $$
declare v_ticket_id uuid; v_status text; v_holder text; v_event_id text; v_allowed boolean; v_count int;
begin
  select t.id,t.status,t.holder_name,tt.event_id into v_ticket_id,v_status,v_holder,v_event_id
    from public.tickets t join public.ticket_tiers tt on tt.id=t.tier_id where t.qr_token=p_token;
  if not found then return query select 'not_found'::text,null::text,null::text; return; end if;
  select public.is_admin() or exists(select 1 from public.events e where e.id=v_event_id and e.organizer_id=auth.uid()) into v_allowed;
  if not coalesce(v_allowed,false) then return query select 'forbidden'::text,v_holder,v_event_id; return; end if;
  if v_status <> 'valid' then return query select 'already_used'::text,v_holder,v_event_id; return; end if;
  update public.tickets t set status='used',used_at=now() where t.id=v_ticket_id and t.status='valid';
  get diagnostics v_count=row_count;
  if v_count=0 then return query select 'already_used'::text,v_holder,v_event_id; return; end if;
  return query select 'valid'::text,v_holder,v_event_id;
end $$;
grant execute on function public.check_in_ticket(uuid) to authenticated;

-- Prevent direct anonymous/authenticated use of the old client-price path.
revoke all on function public.confirm_reservation(uuid,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.confirm_reservation(uuid,text,text,text,text,integer) to service_role;
