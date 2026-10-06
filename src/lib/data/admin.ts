import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  fetchPlatformSettings,
  type PlatformSettings,
} from "./platform";
import { getSupabaseAdmin } from "../supabase/server";
import type { ManualPaymentStatus, ManualVerificationItem } from "../payments/types";
import {
  getIssuedTicketsForOrder,
  sendTicketEmail,
  sendTicketSms,
  sendRejectionEmail,
} from "./tickets";
import { sendTwilioSms, buildRejectionSms } from "../sms/twilio";
import { recordWhatsAppDeliveryFailure, sendTicketWhatsApp } from "../whatsapp.server";
import { formatTicketNumber } from "../format";

export type { PlatformSettings, ManualVerificationItem };

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
  approvalStatus: string;
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

export const verifyAdminLogin = createServerFn({ method: "POST" })
  .validator(adminRequestSchema)
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    return { isAdmin: true };
  });

async function requireAdmin(accessToken: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Admin session is invalid.");
  const { data: adminRole } = await supabase.from("user_roles").select("user_id").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
  if (!adminRole) {
    throw new Error("This account is not authorised for the admin console.");
  }

  return supabase;
}

async function requireAdminUser(accessToken: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Admin session is invalid.");
  const { data: adminRole } = await supabase.from("user_roles").select("user_id").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
  if (!adminRole) {
    throw new Error("This account is not authorised for the admin console.");
  }

  return { supabase, user: data.user };
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
    approvalStatus: string;
  }>();

  const { data: profiles, error: profilesError } = await supabase
    .from("organizer_profiles")
    .select("user_id, approval_status, display_name, created_at");
  if (profilesError) throw new Error(profilesError.message);

  for (const profile of profiles ?? []) {
    if (orgMap.has(profile.user_id)) continue;
    orgMap.set(profile.user_id, {
      id: profile.user_id,
      name: profile.display_name || "Organizer",
      email: "organizer@buzzket.com",
      phone: "-",
      totalGross: 0,
      totalFees: 0,
      totalNet: 0,
      totalTicketsSold: 0,
      totalEvents: 0,
      pendingPayout: 0,
      joinedAt: profile.created_at,
      approvalStatus: profile.approval_status,
    });
  }

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
        approvalStatus:
          profiles?.find((p) => p.user_id === organizerId)?.approval_status || "pending",
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

export const updateOrganizerStatus = createServerFn({ method: "POST" })
  .validator(adminRequestSchema.extend({ organizerId: z.string().min(1), status: z.enum(["pending", "approved", "rejected"]) }))
  .handler(async ({ data: request }) => {
    const supabase = await requireAdmin(request.accessToken);
    const { error } = await supabase
      .from("organizer_profiles")
      .update({ approval_status: request.status })
      .eq("user_id", request.organizerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPlatformSettings = createServerFn({ method: "POST" })
  .validator(adminRequestSchema)
  .handler(async ({ data: request }): Promise<PlatformSettings> => {
    await requireAdmin(request.accessToken);
    return fetchPlatformSettings();
  });

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .validator(adminRequestSchema.extend({
    settings: z.object({
      maintenanceMode: z.boolean(),
      refundPolicy: z.string(),
      slaHours: z.number(),
      emailTemplateSubject: z.string(),
      emailTemplateBody: z.string(),
      smsTemplate: z.string()
    })
  }))
  .handler(async ({ data: request }) => {
    const supabase = await requireAdmin(request.accessToken);
    const { error } = await supabase
      .from("platform_settings")
      .upsert(
        {
          id: 1,
          maintenance_mode: request.settings.maintenanceMode,
          refund_policy: request.settings.refundPolicy,
          sla_hours: request.settings.slaHours,
          email_template_subject: request.settings.emailTemplateSubject,
          email_template_body: request.settings.emailTemplateBody,
          sms_template: request.settings.smsTemplate,
        },
        { onConflict: "id" },
      );

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Payment Verification (Manual Mobile Money) ──────────────────────────────

export const getAdminPaymentVerifications = createServerFn({ method: "POST" })
  .validator(
    adminRequestSchema.extend({
      status: z.string().optional(),
      provider: z.string().optional(),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ data: request }): Promise<ManualVerificationItem[]> => {
    const supabase = await requireAdmin(request.accessToken);

    let query = supabase
      .from("orders")
      .select(`
        id,
        event_id,
        status,
        contact_name,
        contact_email,
        contact_phone,
        whatsapp_number,
        payment_method,
        payment_provider,
        transaction_id,
        merchant_code,
        subtotal,
        fees,
        total,
        rejection_reason,
        created_at,
        verified_at,
        verified_by,
        email_sent_at,
        email_error,
        sms_sent_at,
        sms_error,
        ticket_generation_status,
        ticket_generation_error,
        whatsapp_delivery_status,
        whatsapp_message_sid,
        whatsapp_sent_at,
        whatsapp_delivery_error,
        whatsapp_retry_count,
        event:events (
          id,
          title,
          date,
          venue
        ),
        order_items (
          quantity,
          unit_price,
          tier:ticket_tiers (
            id,
            name
          )
        )
      `)
      .order("created_at", { ascending: false });

    // Status filter
    if (request.status && request.status !== "all") {
      if (request.status === "pending") {
        query = query.in("status", ["payment_submitted", "pending", "pending_payment"]);
      } else if (request.status === "approved") {
        query = query.in("status", ["paid", "payment_approved"]);
      } else if (request.status === "rejected") {
        query = query.eq("status", "payment_rejected");
      } else {
        query = query.eq("status", request.status as ManualPaymentStatus);
      }
    }

    // Provider filter
    if (request.provider && request.provider !== "all") {
      if (request.provider === "mtn") {
        query = query.ilike("payment_method", "%MTN%");
      } else if (request.provider === "airtel") {
        query = query.ilike("payment_method", "%Airtel%");
      }
    }

    const { data: orders, error } = await query;
    if (error) {
      console.error("getAdminPaymentVerifications error:", error);
      throw new Error(error.message);
    }

    // Check duplicates across all statuses, so a pending payment is also
    // flagged when that transaction was already approved or rejected before.
    const { data: transactionRows, error: transactionError } = await supabase
      .from("orders")
      .select("id, transaction_id")
      .not("transaction_id", "is", null);
    if (transactionError) throw new Error(transactionError.message);

    const orderIds = (orders ?? []).map((order) => order.id);
    const ticketNumbersByOrder = new Map<string, string[]>();
    if (orderIds.length) {
      const { data: issued, error: issuedError } = await supabase.from("tickets")
        .select("order_id,id,qr_token").in("order_id", orderIds).order("created_at", { ascending: true });
      if (issuedError) throw new Error(issuedError.message);
      for (const ticket of issued ?? []) {
        const list = ticketNumbersByOrder.get(ticket.order_id) ?? [];
        list.push(formatTicketNumber(ticket.id, ticket.qr_token));
        ticketNumbersByOrder.set(ticket.order_id, list);
      }
    }

    // Duplicate detection map for transaction IDs
    const txCountMap = new Map<string, string[]>();
    for (const ord of transactionRows ?? []) {
      const tx = ord.transaction_id?.trim()?.toLowerCase();
      if (tx) {
        const existing = txCountMap.get(tx) || [];
        existing.push(ord.id);
        txCountMap.set(tx, existing);
      }
    }

    const results: ManualVerificationItem[] = [];
    const searchLower = request.search?.trim()?.toLowerCase();

    for (const ord of orders ?? []) {
      const event = Array.isArray(ord.event) ? ord.event[0] : ord.event;
      const firstItem = ord.order_items?.[0];
      const tier = firstItem ? (Array.isArray(firstItem.tier) ? firstItem.tier[0] : firstItem.tier) : null;
        const totalQty = ord.order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 1;

      const tx = ord.transaction_id?.trim()?.toLowerCase();
      const duplicateList = tx ? txCountMap.get(tx) || [] : [];
      const isDuplicate = duplicateList.length > 1;

      // Filter by search string if provided
      if (searchLower) {
        const matches =
          ord.id.toLowerCase().includes(searchLower) ||
          (ord.transaction_id && ord.transaction_id.toLowerCase().includes(searchLower)) ||
          (ord.contact_name && ord.contact_name.toLowerCase().includes(searchLower)) ||
          (ord.contact_email && ord.contact_email.toLowerCase().includes(searchLower)) ||
          (ord.contact_phone && ord.contact_phone.toLowerCase().includes(searchLower)) ||
          (ord.whatsapp_number && ord.whatsapp_number.toLowerCase().includes(searchLower)) ||
          (event?.title && event.title.toLowerCase().includes(searchLower));

        if (!matches) continue;
      }

      results.push({
        id: ord.id,
        eventId: ord.event_id,
        eventTitle: event?.title ?? "Unknown Event",
        eventDate: event?.date ?? "",
        eventVenue: event?.venue ?? "",
        buyerName: ord.contact_name,
        buyerEmail: ord.contact_email,
        buyerPhone: ord.contact_phone,
        whatsappNumber: ord.whatsapp_number || ord.contact_phone || "",
        ticketTier: tier?.name ?? "General",
        qty: totalQty,
        ticketNumbers: ticketNumbersByOrder.get(ord.id) ?? [],
        unitPrice: firstItem?.unit_price ?? 0,
        total: ord.total,
        subtotal: ord.subtotal,
        fees: ord.fees,
        paymentMethod: ord.payment_method,
        paymentProvider: ord.payment_provider || "manual_momo",
        transactionId: ord.transaction_id || "",
        merchantCode: ord.merchant_code || "",
        status: ord.status,
        rejectionReason: ord.rejection_reason || null,
        createdAt: ord.created_at,
        verifiedAt: ord.verified_at || null,
        verifiedBy: ord.verified_by || null,
        emailSentAt: ord.email_sent_at || null,
        emailError: ord.email_error || null,
        smsSentAt: ord.sms_sent_at || null,
        smsError: ord.sms_error || null,
        ticketGenerationStatus: ord.ticket_generation_status || "pending",
        ticketGenerationError: ord.ticket_generation_error || null,
        whatsappDeliveryStatus: ord.whatsapp_delivery_status || "pending",
        whatsappMessageSid: ord.whatsapp_message_sid || null,
        whatsappSentAt: ord.whatsapp_sent_at || null,
        whatsappDeliveryError: ord.whatsapp_delivery_error || null,
        whatsappRetryCount: ord.whatsapp_retry_count || 0,
        isDuplicateTx: isDuplicate,
        duplicateOrderIds: duplicateList.filter((id) => id !== ord.id),
      });
    }

    return results;
  });

export const approveAdminPayment = createServerFn({ method: "POST" })
  .validator(
    adminRequestSchema.extend({
      orderId: z.string().min(1),
    }),
  )
  .handler(async ({ data: request }) => {
    const { supabase, user } = await requireAdminUser(request.accessToken);

    // Call approve_order_and_mint_tickets RPC
    const { data: rows, error: rpcErr } = await supabase.rpc("approve_order_and_mint_tickets", {
      p_order_id: request.orderId,
      p_admin_id: user.id,
    });

    if (rpcErr) {
      console.error("approve_order_and_mint_tickets error:", rpcErr);
      throw new Error(rpcErr.message);
    }

    const row = rows?.[0];
    if (!row) throw new Error("Could not approve order.");

    // Fetch newly minted tickets
    const tickets = await getIssuedTicketsForOrder(request.orderId);
    let emailStatus: { sent: boolean; message: string } = { sent: false, message: "" };
    let smsStatus: { sent: boolean; message: string } = { sent: false, message: "" };

    let whatsappStatus: { sent: boolean; message: string; messageSid?: string } = { sent: false, message: "" };
    if (tickets.length > 0 && !row.already_approved) {
      // Send Email with PDF attachment
      try {
        emailStatus = await sendTicketEmail(tickets);
        await supabase
          .from("orders")
          .update({
            email_sent_at: emailStatus.sent ? new Date().toISOString() : null,
            email_error: emailStatus.sent ? null : emailStatus.message,
          })
          .eq("id", request.orderId);
      } catch (e) {
        console.error("Error sending approval email:", e);
      }

      // Send Twilio SMS
      try {
        smsStatus = await sendTicketSms(tickets);
        await supabase
          .from("orders")
          .update({
            sms_sent_at: smsStatus.sent ? new Date().toISOString() : null,
            sms_error: smsStatus.sent ? null : smsStatus.message,
          })
          .eq("id", request.orderId);
      } catch (e) {
        console.error("Error sending approval SMS:", e);
      }

      try {
        whatsappStatus = await sendTicketWhatsApp(request.orderId);
      } catch (e) {
        const message = e instanceof Error ? e.message : "WhatsApp delivery failed.";
        whatsappStatus = { sent: false, message };
        await recordWhatsAppDeliveryFailure(request.orderId, message);
      }
    }

    return {
      success: true,
      orderId: request.orderId,
      alreadyApproved: row.already_approved,
      ticketsCount: tickets.length,
      emailStatus,
      smsStatus,
      whatsappStatus,
    };
  });

export const rejectAdminPayment = createServerFn({ method: "POST" })
  .validator(
    adminRequestSchema.extend({
      orderId: z.string().min(1),
      reason: z.string().min(1),
      notifyCustomer: z.boolean().default(true),
    }),
  )
  .handler(async ({ data: request }) => {
    const { supabase, user } = await requireAdminUser(request.accessToken);

    // Call reject_order_and_release_inventory RPC
    const { error: rpcErr } = await supabase.rpc("reject_order_and_release_inventory", {
      p_order_id: request.orderId,
      p_admin_id: user.id,
      p_rejection_reason: request.reason,
    });

    if (rpcErr) {
      console.error("reject_order_and_release_inventory error:", rpcErr);
      throw new Error(rpcErr.message);
    }

    if (request.notifyCustomer) {
      // Fetch order details for notification
      const { data: ord } = await supabase
        .from("orders")
        .select(`
          id,
          contact_name,
          contact_email,
          contact_phone,
          event:events ( title )
        `)
        .eq("id", request.orderId)
        .single();

      if (ord) {
        const eventTitle = (Array.isArray(ord.event) ? ord.event[0]?.title : ord.event?.title) || "Buzzket Event";

        // Send rejection SMS via Twilio
        if (ord.contact_phone) {
          try {
            await sendTwilioSms({
              to: ord.contact_phone,
              message: buildRejectionSms(eventTitle, request.reason, request.orderId),
            });
          } catch (e) {
            console.error("Rejection SMS failed:", e);
          }
        }

        // Send rejection email via Resend
        if (ord.contact_email) {
          try {
            await sendRejectionEmail({
              to: ord.contact_email,
              recipientName: ord.contact_name,
              eventTitle,
              orderId: request.orderId,
              reason: request.reason,
            });
          } catch (e) {
            console.error("Rejection Email failed:", e);
          }
        }
      }
    }

    return { success: true, orderId: request.orderId };
  });

export const resendAdminTicketNotifications = createServerFn({ method: "POST" })
  .validator(
    adminRequestSchema.extend({
      orderId: z.string().min(1),
    }),
  )
  .handler(async ({ data: request }) => {
    const { supabase, user } = await requireAdminUser(request.accessToken);

    const tickets = await getIssuedTicketsForOrder(request.orderId);
    if (!tickets || tickets.length === 0) {
      throw new Error("No issued tickets found for this order. It may not be approved yet.");
    }

    let whatsapp: { sent: boolean; message: string; messageSid?: string };
    try {
      whatsapp = await sendTicketWhatsApp(request.orderId);
    } catch (error) {
      whatsapp = { sent: false, message: error instanceof Error ? error.message : "WhatsApp ticket delivery failed." };
      await recordWhatsAppDeliveryFailure(request.orderId, whatsapp.message);
    }

    const { error: deliveryUpdateError } = await supabase
      .from("orders")
      .update({
        whatsapp_delivery_status: whatsapp.sent ? "sent" : "failed",
        whatsapp_delivery_error: whatsapp.sent ? null : whatsapp.message,
      })
      .eq("id", request.orderId);
    if (deliveryUpdateError) throw new Error(deliveryUpdateError.message);

    // Record audit log
    await supabase.from("payment_audit_logs").insert({
      order_id: request.orderId,
      admin_id: user.id,
      action: "resend_ticket",
      metadata: {
        whatsappResult: whatsapp,
      },
    });

    return { success: true, whatsapp };
  });

