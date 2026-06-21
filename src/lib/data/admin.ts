import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "../supabase/server";

export type PayoutStatus = "pending" | "approved" | "rejected" | "paid";

export type Payout = {
  id: string;
  organizerId: string;
  organizerName: string;
  organizerEmail: string;
  eventTitle: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  ticketsSold: number;
  status: PayoutStatus;
  requestedAt: string;
  resolvedAt: string | null;
  paymentMethod: string;
  paymentAccount: string;
};

export type OrganizerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalGross: number;
  totalFees: number;
  totalNet: number;
  totalTicketsSold: number;
  totalEvents: number;
  pendingPayout: number;
  joinedAt: string;
};

export type PlatformOrder = {
  id: string;
  eventTitle: string;
  organizerName: string;
  buyerName: string;
  buyerEmail: string;
  ticketTier: string;
  qty: number;
  unitPrice: number;
  totalGross: number;
  platformFee: number;
  organizerNet: number;
  paymentMethod: string;
  status: "confirmed" | "refunded" | "cancelled";
  purchasedAt: string;
};

export type AdminStats = {
  totalGrossRevenue: number;
  totalPlatformEarnings: number;
  totalOrganizerPayouts: number;
  pendingPayoutsAmount: number;
  totalTicketsSold: number;
  totalOrganizers: number;
  totalEvents: number;
  totalOrders: number;
};

const adminRequestSchema = z.object({ accessToken: z.string().min(1) });

async function requireAdmin(accessToken: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Admin session is invalid.");
  if (data.user.user_metadata?.role !== "admin") {
    throw new Error("This account is not authorised for the admin console.");
  }

  return supabase;
}

export const getAdminPayouts = createServerFn({ method: "POST" })
  .validator(adminRequestSchema)
  .handler(async ({ data: request }): Promise<Payout[]> => {
    const supabase = await requireAdmin(request.accessToken);

    const { data: payouts, error: payoutsError } = await supabase
      .from("payout_requests")
      .select(`
        id,
        organizer_id,
        amount,
        status,
        payment_method,
        payment_account,
        note,
        requested_at,
        resolved_at
      `)
      .order("requested_at", { ascending: false });

    if (payoutsError) throw new Error(payoutsError.message);

    const organizerIds = Array.from(new Set((payouts ?? []).map(p => p.organizer_id)));
    
    let profiles: Record<string, string> = {};
    if (organizerIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("organizer_profiles")
        .select("user_id, display_name")
        .in("user_id", organizerIds);
        
      if (!profilesError && profilesData) {
        profiles = profilesData.reduce((acc, p) => {
          acc[p.user_id] = p.display_name;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    return (payouts ?? []).map((row) => {
      return {
        id: row.id,
        organizerId: row.organizer_id,
        organizerName: profiles[row.organizer_id] || "Organizer",
        organizerEmail: "organizer@buzzket.com", // Keeping this hardcoded as per original
        eventTitle: "Wallet Payout",
        grossAmount: row.amount,
        platformFee: 0,
        netAmount: row.amount,
        ticketsSold: 0,
        status: row.status as PayoutStatus,
        requestedAt: row.requested_at,
        resolvedAt: row.resolved_at,
        paymentMethod: row.payment_method,
        paymentAccount: row.payment_account,
      };
    });
  });

export const updateAdminPayout = createServerFn({ method: "POST" })
  .validator(
    adminRequestSchema.extend({
      payoutId: z.string().min(1),
      status: z.enum(["pending", "approved", "rejected", "paid"]),
    })
  )
  .handler(async ({ data: request }) => {
    const supabase = await requireAdmin(request.accessToken);

    const { error } = await supabase
      .from("payout_requests")
      .update({
        status: request.status,
        resolved_at: request.status !== "pending" ? new Date().toISOString() : null,
      })
      .eq("id", request.payoutId);

    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const deleteAdminEvent = createServerFn({ method: "POST" })
  .validator(adminRequestSchema.extend({ eventId: z.string().min(1) }))
  .handler(async ({ data: request }) => {
    const supabase = await requireAdmin(request.accessToken);
    const { error } = await supabase.from("events").delete().eq("id", request.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AdminEvent = {
  id: string;
  title: string;
  organizerName: string;
  date: string;
  createdAt: string;
};

export const getAdminEvents = createServerFn({ method: "POST" })
  .validator(adminRequestSchema)
  .handler(async ({ data: request }): Promise<AdminEvent[]> => {
    const supabase = await requireAdmin(request.accessToken);
    const { data, error } = await supabase
      .from("events")
      .select("id, title, organizer_name, date, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      organizerName: row.organizer_name || "Unknown",
      date: row.date,
      createdAt: row.created_at,
    }));
  });

export function saveAdminPayouts(payouts: Payout[]): void {
  // We no longer need local storage since we write to the database
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("bzk-payout-status");
}

export const getAdminOrganizers = createServerFn({ method: "POST" })
  .validator(adminRequestSchema)
  .handler(async ({ data: request }): Promise<OrganizerRow[]> => {
  const supabase = await requireAdmin(request.accessToken);

  // Get all events.
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, organizer_id, organizer_name, created_at");
  if (eventsError) throw new Error(eventsError.message);

  // Get all orders.
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, event_id, status, total, fees, subtotal");
  if (ordersError) throw new Error(ordersError.message);

  // Group events by organizer.
  const orgMap = new Map<string, {
    id: string;
    name: string;
    email: string;
    phone: string;
    totalGross: number;
    totalFees: number;
    totalNet: number;
    totalTicketsSold: number;
    totalEvents: number;
    pendingPayout: number;
    joinedAt: string;
  }>();

  for (const event of events ?? []) {
    const organizerId = event.organizer_id;
    if (!organizerId) continue;

    if (!orgMap.has(organizerId)) {
      orgMap.set(organizerId, {
        id: organizerId,
        name: event.organizer_name || "Organizer",
        email: "organizer@buzzket.com", 
        phone: "-",
        totalGross: 0,
        totalFees: 0,
        totalNet: 0,
        totalTicketsSold: 0,
        totalEvents: 0,
        pendingPayout: 0,
        joinedAt: event.created_at,
      });
    }

    const org = orgMap.get(organizerId)!;
    org.totalEvents += 1;
    if (new Date(event.created_at) < new Date(org.joinedAt)) {
      org.joinedAt = event.created_at;
    }
  }

  // Calculate gross, fees, net from orders.
  for (const order of orders ?? []) {
    if (order.status !== "paid") continue;
    const event = events?.find((e) => e.id === order.event_id);
    if (!event || !event.organizer_id) continue;

    const org = orgMap.get(event.organizer_id);
    if (org) {
      org.totalGross += order.total;
      org.totalFees += order.fees;
      org.totalNet += order.subtotal;
    }
  }

  // Get tickets count.
  const { data: tickets, error: ticketsError } = await supabase
    .from("tickets")
    .select("id, tier_id, ticket_tiers(event_id)");
  if (ticketsError) throw new Error(ticketsError.message);

  const typedTickets = tickets as unknown as Array<{
    id: string;
    tier_id: string;
    ticket_tiers: { event_id: string } | null;
  }> | null;

  for (const ticket of typedTickets ?? []) {
    const eventId = ticket.ticket_tiers?.event_id;
    if (!eventId) continue;
    const event = events?.find((e) => e.id === eventId);
    if (!event || !event.organizer_id) continue;

    const org = orgMap.get(event.organizer_id);
    if (org) {
      org.totalTicketsSold += 1;
    }
  }

    return Array.from(orgMap.values());
  });

export const getAdminOrders = createServerFn({ method: "POST" })
  .validator(adminRequestSchema)
  .handler(async ({ data: request }): Promise<PlatformOrder[]> => {
  const supabase = await requireAdmin(request.accessToken);

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      status,
      contact_name,
      contact_email,
      payment_method,
      total,
      fees,
      subtotal,
      created_at,
      events (
        title,
        organizer_name
      ),
      order_items (
        quantity,
        unit_price,
        ticket_tiers (
          name
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const orderItems = row.order_items as unknown as Array<{
      quantity: number;
      unit_price: number;
      ticket_tiers: { name: string } | null;
    }> | null;
    const firstItem = orderItems?.[0];
    const tierName = firstItem?.ticket_tiers?.name ?? "Regular";
    const qty = firstItem?.quantity ?? 1;
    const unitPrice = firstItem?.unit_price ?? row.subtotal;

    const event = row.events as unknown as { title: string; organizer_name: string } | null;

    return {
      id: row.id,
      eventTitle: event?.title ?? "Unknown Event",
      organizerName: event?.organizer_name ?? "Unknown Organizer",
      buyerName: row.contact_name,
      buyerEmail: row.contact_email,
      ticketTier: tierName,
      qty,
      unitPrice,
      totalGross: row.total,
      platformFee: row.fees,
      organizerNet: row.subtotal,
      paymentMethod: row.payment_method,
      status: (row.status === "paid" ? "confirmed" : "cancelled") as "confirmed" | "refunded" | "cancelled",
      purchasedAt: row.created_at,
    };
    });
  });

export function computeAdminStats(payouts: Payout[], orders: PlatformOrder[]): AdminStats {
  const confirmedOrders = orders.filter((o) => o.status === "confirmed");
  const totalGrossRevenue = confirmedOrders.reduce((s, o) => s + o.totalGross, 0);
  const totalPlatformEarnings = confirmedOrders.reduce((s, o) => s + o.platformFee, 0);
  const totalOrganizerPayouts = confirmedOrders.reduce((s, o) => s + o.organizerNet, 0);
  const pendingPayoutsAmount = payouts
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + p.netAmount, 0);

  const organizersSet = new Set(orders.map((o) => o.organizerName));
  const eventsSet = new Set(orders.map((o) => o.eventTitle));

  return {
    totalGrossRevenue,
    totalPlatformEarnings,
    totalOrganizerPayouts,
    pendingPayoutsAmount,
    totalTicketsSold: confirmedOrders.reduce((s, o) => s + o.qty, 0),
    totalOrganizers: organizersSet.size,
    totalEvents: eventsSet.size,
    totalOrders: orders.length,
  };
}
