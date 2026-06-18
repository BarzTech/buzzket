import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { COMMISSION_FLAT_UGX, COMMISSION_PERCENT } from "../fees";
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

export const fetchDashboardStats = createServerFn({ method: "GET" })
  .validator(z.string().optional())
  .handler(async ({ data: organizerId }): Promise<DashboardStats> => {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error("Dashboard stats require Supabase server credentials.");
    }

    const { data, error } = await supabase.rpc("dashboard_stats", {
      p_organizer_id: organizerId || null,
    });
    if (error) throw new Error(error.message);
    const stats = data?.[0];
    if (!stats) throw new Error("Could not fetch dashboard stats");

    return withDerived({
      totalSales: stats.total_sales,
      ticketsSold: stats.tickets_sold,
      totalEvents: stats.total_events,
      attendees: stats.attendees,
    });
  });

export const dashboardStatsQueryOptions = (organizerId?: string) =>
  queryOptions({
    queryKey: ["dashboard-stats", { organizerId }],
    queryFn: () => fetchDashboardStats({ data: organizerId }),
  });
