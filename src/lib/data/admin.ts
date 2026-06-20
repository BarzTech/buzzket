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

  // Get all events.
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, organizer_id, organizer_name, created_at");
  if (eventsError) throw new Error(eventsError.message);

  // Get all orders.
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, event_id, status, total, fees, subtotal, payment_method, created_at");
  if (ordersError) throw new Error(ordersError.message);

  const payouts: Payout[] = [];

  for (const event of events ?? []) {
    const eventOrders = (orders ?? []).filter((o) => o.event_id === event.id && o.status === "paid");
    if (eventOrders.length === 0) continue;

    const grossAmount = eventOrders.reduce((s, o) => s + o.total, 0);
    const platformFee = eventOrders.reduce((s, o) => s + o.fees, 0);
    const netAmount = eventOrders.reduce((s, o) => s + o.subtotal, 0);
    const ticketsSold = eventOrders.length; 

    const lastOrder = eventOrders[eventOrders.length - 1];
    const paymentMethod = lastOrder?.payment_method || "MTN Mobile Money";

    payouts.push({
      id: `${event.id}-payout`,
      organizerId: event.organizer_id || "unknown",
      organizerName: event.organizer_name || "Organizer",
      organizerEmail: "organizer@buzzket.com",
      eventTitle: event.title,
      grossAmount,
      platformFee,
      netAmount,
      ticketsSold,
      status: "pending",
      requestedAt: event.created_at,
      resolvedAt: null,
      paymentMethod: paymentMethod === "card" ? "Bank Transfer" : paymentMethod === "airtel" ? "Airtel Money" : "MTN Mobile Money",
      paymentAccount: "+256 700 000 000",
    });
  }

    return payouts;
  });

export function saveAdminPayouts(payouts: Payout[]): void {
  if (typeof window === "undefined") return;
  const statusMap = payouts.reduce((acc, p) => {
    acc[p.id] = { status: p.status, resolvedAt: p.resolvedAt };
    return acc;
  }, {} as Record<string, { status: PayoutStatus; resolvedAt: string | null }>);
  window.localStorage.setItem("bzk-payout-status", JSON.stringify(statusMap));
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
