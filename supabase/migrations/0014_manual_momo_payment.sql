-- Migration 0014: Manual Mobile Money (MTN & Airtel) Payment Workflow & Audit Logging

-- 1. Extend orders status constraint to allow manual payment statuses
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (
  status in (
    'pending',
    'pending_payment',
    'payment_submitted',
    'paid',
    'payment_approved',
    'payment_rejected',
    'cancelled',
    'expired'
  )
);

-- 2. Add columns to public.orders for manual payment tracking & verification
alter table public.orders
  add column if not exists transaction_id text,
  add column if not exists merchant_code text,
  add column if not exists payment_provider text default 'manual_momo',
  add column if not exists rejection_reason text,
  add column if not exists verified_by uuid references auth.users (id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text,
  add column if not exists sms_sent_at timestamptz,
  add column if not exists sms_error text;

-- Indexes for fast lookup and duplicate transaction checks
create index if not exists orders_transaction_id_idx on public.orders (transaction_id);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
-- Prevent concurrent submissions from reusing a transaction ID that is
-- awaiting review or has already been approved. Rejected IDs can be corrected
-- and resubmitted in a new order.
create unique index if not exists orders_active_transaction_id_unique_idx
  on public.orders (lower(btrim(transaction_id)))
  where transaction_id is not null
    and status in ('payment_submitted', 'paid', 'payment_approved');

-- 3. Create payment audit logs table
create table if not exists public.payment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null, -- 'submitted', 'approved', 'rejected', 'resend_ticket'
  previous_status text,
  new_status text,
  transaction_id text,
  rejection_reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_audit_logs_order_id_idx on public.payment_audit_logs (order_id);
create index if not exists payment_audit_logs_created_idx on public.payment_audit_logs (created_at desc);

alter table public.payment_audit_logs enable row level security;

create policy "Admins can view payment audit logs"
  on public.payment_audit_logs
  for select
  using (
    auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
    or auth.role() = 'service_role'
  );

-- 4. RPC: submit_manual_payment
-- Creates an order in 'payment_submitted' status, locks inventory, and marks reservation confirmed
create or replace function public.submit_manual_payment(
  p_reservation_id   uuid,
  p_contact_name     text,
  p_contact_email    text,
  p_contact_phone    text,
  p_payment_method   text,
  p_payment_provider text,
  p_transaction_id   text,
  p_merchant_code    text,
  p_unit_price       int
)
returns table (order_id uuid)
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
begin
  if nullif(btrim(p_transaction_id), '') is null then
    raise exception 'Transaction ID is required';
  end if;

  -- Lock and validate reservation
  select * into v_res
    from public.reservations r
   where r.id = p_reservation_id
     for update;

  if not found then
    raise exception 'Reservation not found';
  end if;

  if v_res.status <> 'active' then
    if v_res.status = 'confirmed' and v_res.order_id is not null then
      -- Already submitted previously, return existing order
      return query select v_res.order_id;
      return;
    end if;
    raise exception 'Reservation is no longer active';
  end if;

  if v_res.expires_at <= now() then
    update public.reservations r
       set status = 'expired'
     where r.id = v_res.id;
    raise exception 'Reservation has expired';
  end if;

  -- Serialize attempts using the same transaction reference, then check it
  -- here as well as enforcing it with a partial unique index.
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_transaction_id)), 0));
  if exists (
    select 1
      from public.orders o
     where lower(btrim(o.transaction_id)) = lower(btrim(p_transaction_id))
       and o.status in ('payment_submitted', 'paid', 'payment_approved')
  ) then
    raise exception 'This transaction ID is already attached to an active or approved order';
  end if;

  -- Lock and check ticket tier capacity
  select * into v_tier
    from public.ticket_tiers t
   where t.id = v_res.tier_id
     for update;

  if v_tier.quantity_sold + v_res.quantity > v_tier.quantity_total then
    raise exception 'Sold out';
  end if;

  -- Calculate totals
  v_final_per := ceil((p_unit_price + 500)::numeric / 0.95);
  v_subtotal  := p_unit_price * v_res.quantity;
  v_total     := v_final_per * v_res.quantity;
  v_fees      := v_total - v_subtotal;

  -- Insert order in payment_submitted status
  insert into public.orders (
    event_id,
    status,
    contact_name,
    contact_email,
    contact_phone,
    payment_method,
    payment_provider,
    transaction_id,
    merchant_code,
    subtotal,
    fees,
    total,
    created_at
  )
  values (
    v_tier.event_id,
    'payment_submitted',
    p_contact_name,
    p_contact_email,
    p_contact_phone,
    p_payment_method,
    coalesce(p_payment_provider, 'manual_momo'),
    trim(p_transaction_id),
    p_merchant_code,
    v_subtotal,
    v_fees,
    v_total,
    now()
  )
  returning * into v_order;

  -- Insert order item
  insert into public.order_items (order_id, tier_id, quantity, unit_price)
  values (v_order.id, v_res.tier_id, v_res.quantity, p_unit_price);

  -- Hold inventory by incrementing quantity_sold
  update public.ticket_tiers t
     set quantity_sold = t.quantity_sold + v_res.quantity
   where t.id = v_res.tier_id;

  -- Mark reservation confirmed & attach order_id
  update public.reservations r
     set status = 'confirmed',
         order_id = v_order.id
   where r.id = v_res.id;

  -- Create initial audit log
  insert into public.payment_audit_logs (
    order_id,
    action,
    previous_status,
    new_status,
    transaction_id
  )
  values (
    v_order.id,
    'submitted',
    'pending',
    'payment_submitted',
    trim(p_transaction_id)
  );

  return query select v_order.id;
end;
$$;

-- 5. RPC: approve_order_and_mint_tickets
-- Idempotently approves a payment and mints tickets with unique QR tokens
create or replace function public.approve_order_and_mint_tickets(
  p_order_id uuid,
  p_admin_id uuid
)
returns table (order_id uuid, qr_tokens uuid[], already_approved boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    public.orders;
  v_item     record;
  v_tokens   uuid[] := '{}';
  v_token    uuid;
  i          int;
begin
  -- Lock order
  select * into v_order
    from public.orders o
   where o.id = p_order_id
     for update;

  if not found then
    raise exception 'Order not found';
  end if;

  -- Idempotency check: if already approved/paid, return existing tickets
  if v_order.status in ('paid', 'payment_approved') then
    select coalesce(array_agg(t.qr_token), '{}') into v_tokens
      from public.tickets t
     where t.order_id = p_order_id;
    return query select p_order_id, v_tokens, true;
    return;
  end if;

  if v_order.status <> 'payment_submitted' then
    raise exception 'Only submitted payments can be approved';
  end if;

  -- Update order status to payment_approved
  update public.orders o
     set status = 'payment_approved',
         paid_at = coalesce(o.paid_at, now()),
         verified_by = p_admin_id,
         verified_at = now()
   where o.id = p_order_id;

  -- Mint tickets for each order item
  for v_item in
    select oi.tier_id, oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id
  loop
    for i in 1..v_item.quantity loop
      v_token := gen_random_uuid();
      insert into public.tickets (order_id, tier_id, holder_name, status, qr_token)
      values (p_order_id, v_item.tier_id, v_order.contact_name, 'valid', v_token);
      v_tokens := array_append(v_tokens, v_token);
    end loop;
  end loop;

  -- Record audit log
  insert into public.payment_audit_logs (
    order_id,
    admin_id,
    action,
    previous_status,
    new_status,
    transaction_id
  )
  values (
    p_order_id,
    p_admin_id,
    'approved',
    v_order.status,
    'payment_approved',
    v_order.transaction_id
  );

  return query select p_order_id, v_tokens, false;
end;
$$;

-- 6. RPC: reject_order_and_release_inventory
-- Rejects payment and restores held ticket tier inventory
create or replace function public.reject_order_and_release_inventory(
  p_order_id         uuid,
  p_admin_id         uuid,
  p_rejection_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item  record;
begin
  select * into v_order
    from public.orders o
   where o.id = p_order_id
     for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status in ('paid', 'payment_approved') then
    raise exception 'Cannot reject an already approved payment';
  end if;

  if v_order.status = 'payment_rejected' then
    return true; -- Idempotent
  end if;

  if v_order.status <> 'payment_submitted' then
    raise exception 'Only submitted payments can be rejected';
  end if;

  -- Update order status
  update public.orders o
     set status = 'payment_rejected',
         rejection_reason = p_rejection_reason,
         verified_by = p_admin_id,
         verified_at = now()
   where o.id = p_order_id;

  -- Restore ticket tier inventory
  for v_item in
    select oi.tier_id, oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id
  loop
    update public.ticket_tiers t
       set quantity_sold = greatest(0, t.quantity_sold - v_item.quantity)
     where t.id = v_item.tier_id;
  end loop;

  -- Record audit log
  insert into public.payment_audit_logs (
    order_id,
    admin_id,
    action,
    previous_status,
    new_status,
    transaction_id,
    rejection_reason
  )
  values (
    p_order_id,
    p_admin_id,
    'rejected',
    v_order.status,
    'payment_rejected',
    v_order.transaction_id,
    p_rejection_reason
  );

  return true;
end;
$$;

-- These security-definer RPCs must only be callable through the trusted server
-- client. In particular, callers must not be able to supply a forged admin id.
revoke all on function public.submit_manual_payment(uuid, text, text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.approve_order_and_mint_tickets(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reject_order_and_release_inventory(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_manual_payment(uuid, text, text, text, text, text, text, text, integer) to service_role;
grant execute on function public.approve_order_and_mint_tickets(uuid, uuid) to service_role;
grant execute on function public.reject_order_and_release_inventory(uuid, uuid, text) to service_role;
