-- Replace legacy authorization checks based on user-editable JWT metadata.
-- Role assignments are held in user_roles and are managed by trusted admin
-- operations; organizer approval status cannot be self-modified.


drop policy if exists "promo_admin_all" on public.promo_codes;
create policy "promo_admin_all" on public.promo_codes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payout_requests_admin_update" on public.payout_requests;
create policy "payout_requests_admin_update" on public.payout_requests
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "platform_settings_admin_update" on public.platform_settings;
create policy "platform_settings_admin_update" on public.platform_settings
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "platform_settings_admin_insert" on public.platform_settings;
create policy "platform_settings_admin_insert" on public.platform_settings
  for insert with check (public.is_admin());

drop policy if exists "organizer_profiles_admin_update" on public.organizer_profiles;
create policy "organizer_profiles_admin_update" on public.organizer_profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- The legacy public-read policy exposed payout account fields because RLS
-- cannot hide selected columns. Organizer profile reads are limited to the
-- owner and trusted administrators; public event pages use event data.
drop policy if exists "organizer_profiles_public_read" on public.organizer_profiles;
drop policy if exists "organizer_profiles_owner_read" on public.organizer_profiles;
create policy "organizer_profiles_owner_read" on public.organizer_profiles
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "events_admin_delete" on public.events;
drop policy if exists "Admins can delete events" on public.events;
create policy "events_admin_delete" on public.events
  for delete using (public.is_admin());

drop policy if exists "Admins can view payment audit logs" on public.payment_audit_logs;
create policy "Admins can view payment audit logs" on public.payment_audit_logs
  for select using (public.is_admin() or auth.role() = 'service_role');

create or replace function public.prevent_organizer_self_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin()
     and (new.approval_status = 'approved'
       or (tg_op = 'UPDATE' and new.approval_status is distinct from old.approval_status)) then
    raise exception 'Only an administrator can change organizer approval status';
  end if;
  return new;
end;
$$;
drop trigger if exists organizer_profile_approval_guard on public.organizer_profiles;
create trigger organizer_profile_approval_guard
  before insert or update of approval_status on public.organizer_profiles
  for each row execute function public.prevent_organizer_self_approval();

create or replace function public.sync_organizer_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.approval_status = 'approved' then
    insert into public.user_roles(user_id, role) values(new.user_id, 'organizer') on conflict do nothing;
  else
    delete from public.user_roles where user_id=new.user_id and role='organizer';
  end if;
  return new;
end;
$$;
drop trigger if exists organizer_profile_role_sync on public.organizer_profiles;
create trigger organizer_profile_role_sync
  after insert or update of approval_status on public.organizer_profiles
  for each row execute function public.sync_organizer_role();

-- Backfill only profiles that were already administratively approved.
insert into public.user_roles(user_id, role)
select user_id, 'organizer' from public.organizer_profiles
where approval_status = 'approved'
on conflict do nothing;

-- Wrap the existing server-only submission RPC so order ownership is written
-- in the same database transaction as reservation confirmation and order
-- creation. The caller is service_role only; the server derives this ID from
-- a validated, phone-confirmed Supabase session.
drop function if exists public.submit_manual_payment(uuid,uuid,text,text,text,text,text,text,text,text);
create function public.submit_manual_payment(
  p_customer_id uuid,
  p_reservation_id uuid,
  p_contact_name text,
  p_contact_email text,
  p_whatsapp_number text,
  p_payment_method text,
  p_transaction_id text,
  p_merchant_code text,
  p_status_token text,
  p_promo_code text default null
) returns table(order_id uuid, status_token text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_order_id uuid; v_status_token text;
begin
  if p_customer_id is null then raise exception 'Customer account is required'; end if;
  select submitted.order_id, submitted.status_token
    into v_order_id, v_status_token
    from public.submit_manual_payment(
      p_reservation_id, p_contact_name, p_contact_email, p_whatsapp_number,
      p_payment_method, p_transaction_id, p_merchant_code, p_status_token,
      p_promo_code
    ) as submitted;

  update public.orders
     set user_id = coalesce(user_id, p_customer_id)
   where id = v_order_id
     and contact_phone = p_whatsapp_number
     and (user_id is null or user_id = p_customer_id);
  if not found then raise exception 'Order ownership could not be linked to this customer'; end if;
  return query select v_order_id, v_status_token;
end $$;
revoke all on function public.submit_manual_payment(uuid,uuid,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_manual_payment(uuid,uuid,text,text,text,text,text,text,text,text) to service_role;

create or replace function public.check_in_ticket(p_token uuid)
returns table (status text, holder text, event_id text)
language plpgsql security definer set search_path = public, auth as $$
declare v_ticket_id uuid; v_status text; v_holder text; v_event_id text; v_allowed boolean; v_count int;
begin
  select t.id,t.status,t.holder_name,tt.event_id into v_ticket_id,v_status,v_holder,v_event_id
    from public.tickets t join public.ticket_tiers tt on tt.id=t.tier_id where t.qr_token=p_token;
  if not found then return query select 'not_found'::text,null::text,null::text; return; end if;
  select public.is_admin() or exists(
    select 1 from public.events e where e.id=v_event_id and e.organizer_id=auth.uid()
      and exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='organizer')
  ) into v_allowed;
  if not coalesce(v_allowed,false) then return query select 'forbidden'::text,v_holder,v_event_id; return; end if;
  if v_status <> 'valid' then return query select 'already_used'::text,v_holder,v_event_id; return; end if;
  update public.tickets set status='used',used_at=now() where id=v_ticket_id and status='valid';
  get diagnostics v_count=row_count;
  if v_count=0 then return query select 'already_used'::text,v_holder,v_event_id; return; end if;
  return query select 'valid'::text,v_holder,v_event_id;
end $$;
grant execute on function public.check_in_ticket(uuid) to authenticated;
