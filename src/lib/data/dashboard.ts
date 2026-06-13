import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

import { COMMISSION_FLAT_UGX, COMMISSION_PERCENT } from "../fees";
import { SEED_EVENTS_WITH_TIERS } from "../seed";
import { getSupabaseAdmin } from "../supabase/server";

export type DashboardStats = {
  totalSales: number;
  ticketsSold: number;
  totalEvents: number;
  attendees: number;
  platformCommission: number;
  organizerPayout: number;
};

const withDerived = (
  base: Pick<DashboardStats, "totalSales" | "ticketsSold" | "totalEvents" | "attendees">,
): DashboardStats => {
  const platformCommission =
    Math.round(base.totalSales * COMMISSION_PERCENT) + base.ticketsSold * COMMISSION_FLAT_UGX;
  return {
    ...base,
    platformCommission,
    organizerPayout: base.totalSales - platformCommission,
  };
};

export const fetchDashboardStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardStats> => {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      // Demo figures until a Supabase project (with real orders) is connected.
      return withDerived({
        totalSales: 9_420_000,
        ticketsSold: 312,
        totalEvents: SEED_EVENTS_WITH_TIERS.length,
        attendees: 287,
      });
    }

    const [{ data: paidOrders, error: ordersErr }, { count: eventsCount, error: eventsErr }, { count: ticketsCount, error: ticketsErr }, { count: usedCount, error: usedErr }] =
      await Promise.all([
        supabase.from("orders").select("total").eq("status", "paid"),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("tickets").select("id", { count: "exact", head: true }),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "used"),
      ]);

    if (ordersErr) throw new Error(ordersErr.message);
    if (eventsErr) throw new Error(eventsErr.message);
    if (ticketsErr) throw new Error(ticketsErr.message);
    if (usedErr) throw new Error(usedErr.message);

    const totalSales = (paidOrders ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);
    return withDerived({
      totalSales,
      ticketsSold: ticketsCount ?? 0,
      totalEvents: eventsCount ?? 0,
      attendees: usedCount ?? 0,
    });
  },
);

export const dashboardStatsQueryOptions = () =>
  queryOptions({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchDashboardStats(),
  });
