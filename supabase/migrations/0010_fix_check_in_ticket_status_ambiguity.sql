-- Fix ambiguous PL/pgSQL column references in ticket scanner RPC.
-- The output column `status` is also a PL/pgSQL variable, so ticket table
-- columns must be qualified inside the function body.

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

  update public.tickets t
     set status = 'used', used_at = now()
   where t.id = v_ticket_id
     and t.status = 'valid';
  get diagnostics v_count = row_count;

  if v_count = 0 then
    return query select 'already_used'::text, v_holder, v_event_id;
    return;
  end if;

  return query select 'valid'::text, v_holder, v_event_id;
end;
$$;

grant execute on function public.check_in_ticket(uuid) to authenticated;
