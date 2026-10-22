-- Link an active checkout reservation to the verified customer account before
-- payment instructions are returned. Existing guest/expired reservations stay
-- unclaimed and existing order/ticket records are not changed.
alter table public.reservations
  add column if not exists customer_id uuid references auth.users(id) on delete set null;

create index if not exists reservations_customer_id_idx
  on public.reservations(customer_id)
  where customer_id is not null;

comment on column public.reservations.customer_id is
  'Authenticated customer who claimed this checkout after phone OTP verification.';

-- Keep the server-only payment RPC from accepting another customer's claimed
-- reservation, even if a caller bypasses the checkout page.
create or replace function public.submit_manual_payment(
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
  if p_customer_id is null or not exists (
    select 1 from public.reservations r
    where r.id = p_reservation_id and r.customer_id = p_customer_id
      and (
        (r.status = 'active' and r.expires_at > now())
        or (r.status = 'confirmed' and exists (
          select 1 from public.orders o where o.id = r.order_id and o.user_id = p_customer_id
        ))
      )
  ) then raise exception 'Reservation is not active for this customer'; end if;

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
