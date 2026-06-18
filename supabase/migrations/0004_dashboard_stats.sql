create or replace function dashboard_stats()
returns table (
  total_sales bigint,
  tickets_sold bigint,
  total_events bigint,
  attendees bigint,
  platform_commission bigint,
  organizer_payout bigint
)
as $$
declare
  total_sales_value bigint;
  tickets_sold_value bigint;
  commission_percent_value double precision := 0.05;
  commission_flat_ugx_value bigint := 500;
  platform_commission_value bigint;
begin
  select sum(total) into total_sales_value from public.orders where status = 'paid';
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
end;
$$ language plpgsql stable;
