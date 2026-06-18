-- Scoped dashboard stats RPC
create or replace function public.dashboard_stats(p_organizer_id uuid default null)
returns table (
  total_sales bigint,
  tickets_sold bigint,
  total_events bigint,
  attendees bigint,
  platform_commission bigint,
  organizer_payout bigint
)
security definer
set search_path = public
as $$
declare
  total_sales_value bigint;
  tickets_sold_value bigint;
  commission_percent_value double precision := 0.05;
  commission_flat_ugx_value bigint := 500;
  platform_commission_value bigint;
begin
  if p_organizer_id is not null then
    select coalesce(sum(o.total), 0) into total_sales_value
      from public.orders o
      join public.events e on e.id = o.event_id
     where o.status = 'paid'
       and e.organizer_id = p_organizer_id;

    select count(*) into tickets_sold_value
      from public.tickets t
      join public.ticket_tiers tt on tt.id = t.tier_id
      join public.events e on e.id = tt.event_id
     where e.organizer_id = p_organizer_id;

    platform_commission_value := (total_sales_value * commission_percent_value) + (tickets_sold_value * commission_flat_ugx_value);

    return query
      select
        total_sales_value,
        tickets_sold_value,
        (select count(*) from public.events where organizer_id = p_organizer_id),
        (select count(*) from public.tickets t
           join public.ticket_tiers tt on tt.id = t.tier_id
           join public.events e on e.id = tt.event_id
          where t.status = 'used' and e.organizer_id = p_organizer_id),
        platform_commission_value,
        total_sales_value - platform_commission_value;
  else
    select coalesce(sum(total), 0) into total_sales_value from public.orders where status = 'paid';
    select count(*) into tickets_sold_value from public.tickets;

    platform_commission_value := (total_sales_value * commission_percent_value) + (tickets_sold_value * commission_flat_ugx_value);

    return query
      select
        total_sales_value,
        tickets_sold_value,
        (select count(*) from public.events),
        (select count(*) from public.tickets where status = 'used'),
        platform_commission_value,
        total_sales_value - platform_commission_value;
  end if;
end;
$$ language plpgsql stable;

grant execute on function public.dashboard_stats(uuid) to authenticated;
