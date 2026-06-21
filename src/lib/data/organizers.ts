import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getSupabaseAdmin } from "../supabase/server";

export type OrganizerProfile = {
  userId: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  phone: string;
  website: string;
  payoutMethod: string;
  payoutAccount: string;
  followerCount: number;
};

export type OrganizerFinance = {
  gross: number;
  fees: number;
  net: number;
  requested: number;
  available: number;
};

export type OrganizerSale = {
  orderId: string;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  tierName: string;
  subtotal: number;
  fees: number;
  total: number;
  purchasedAt: string;
};

export type OrganizerAttendee = {
  ticketId: string;
  eventTitle: string;
  holderName: string;
  tierName: string;
  status: string;
  usedAt: string | null;
  orderId: string;
};

export type PayoutRequestRow = {
  id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  paymentMethod: string;
  paymentAccount: string;
  note: string;
  requestedAt: string;
  resolvedAt: string | null;
};

const accessTokenSchema = z.object({ accessToken: z.string().min(1) });

async function requireUser(accessToken: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Session is invalid.");
  return { supabase, user: data.user };
}

export const getMyOrganizerProfile = createServerFn({ method: "POST" })
  .validator(accessTokenSchema)
  .handler(async ({ data }): Promise<OrganizerProfile> => {
    const { supabase, user } = await requireUser(data.accessToken);
    const { data: profile, error } = await supabase
      .from("organizer_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { count } = await supabase
      .from("organizer_follows")
      .select("*", { count: "exact", head: true })
      .eq("organizer_id", user.id);

    const fallbackName =
      (user.user_metadata?.name as string | undefined) ||
      user.email ||
      user.phone ||
      "Organizer";

    return {
      userId: user.id,
      displayName: profile?.display_name || fallbackName,
      bio: profile?.bio || "",
      avatarUrl: profile?.avatar_url || "",
      phone: profile?.phone || user.phone || "",
      website: profile?.website || "",
      payoutMethod: profile?.payout_method || "MTN Mobile Money",
      payoutAccount: profile?.payout_account || "",
      followerCount: count ?? 0,
    };
  });

export const saveMyOrganizerProfile = createServerFn({ method: "POST" })
  .validator(
    accessTokenSchema.extend({
      displayName: z.string().min(2),
      bio: z.string().max(600).optional(),
      avatarUrl: z.string().optional(),
      phone: z.string().optional(),
      website: z.string().optional(),
      payoutMethod: z.string().min(2),
      payoutAccount: z.string().min(3),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, user } = await requireUser(data.accessToken);
    const payload = {
      user_id: user.id,
      display_name: data.displayName.trim(),
      bio: data.bio?.trim() ?? "",
      avatar_url: data.avatarUrl?.trim() ?? "",
      phone: data.phone?.trim() ?? "",
      website: data.website?.trim() ?? "",
      payout_method: data.payoutMethod.trim(),
      payout_account: data.payoutAccount.trim(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("organizer_profiles").upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    await supabase
      .from("events")
      .update({
        organizer_name: payload.display_name,
        organizer_avatar: payload.avatar_url,
      })
      .eq("organizer_id", user.id);

    return { ok: true };
  });

export const getOrganizerFinance = createServerFn({ method: "POST" })
  .validator(accessTokenSchema)
  .handler(async ({ data }): Promise<OrganizerFinance> => {
    const { supabase, user } = await requireUser(data.accessToken);
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id")
      .eq("organizer_id", user.id);
    if (eventsError) throw new Error(eventsError.message);
    const eventIds = (events ?? []).map((event) => event.id);
    if (eventIds.length === 0) return { gross: 0, fees: 0, net: 0, requested: 0, available: 0 };

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("total, fees, subtotal")
      .eq("status", "paid")
      .in("event_id", eventIds);
    if (ordersError) throw new Error(ordersError.message);

    const { data: payouts, error: payoutsError } = await supabase
      .from("payout_requests")
      .select("amount, status")
      .eq("organizer_id", user.id)
      .neq("status", "rejected");
    if (payoutsError) throw new Error(payoutsError.message);

    const gross = (orders ?? []).reduce((sum, order) => sum + order.total, 0);
    const fees = (orders ?? []).reduce((sum, order) => sum + order.fees, 0);
    const net = (orders ?? []).reduce((sum, order) => sum + order.subtotal, 0);
    const requested = (payouts ?? []).reduce((sum, payout) => sum + payout.amount, 0);
    return { gross, fees, net, requested, available: Math.max(0, net - requested) };
  });

export const requestPayout = createServerFn({ method: "POST" })
  .validator(accessTokenSchema.extend({ amount: z.number().int().positive(), note: z.string().optional() }))
  .handler(async ({ data }) => {
    const { supabase, user } = await requireUser(data.accessToken);
    const finance = await getOrganizerFinance({ data: { accessToken: data.accessToken } });
    if (data.amount > finance.available) {
      throw new Error("Requested amount exceeds your available balance.");
    }
    const { data: profile } = await supabase
      .from("organizer_profiles")
      .select("payout_method, payout_account")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.payout_account) {
      throw new Error("Add payout account details in settings before requesting a payout.");
    }
    const { error } = await supabase.from("payout_requests").insert({
      organizer_id: user.id,
      amount: data.amount,
      payment_method: profile.payout_method || "MTN Mobile Money",
      payment_account: profile.payout_account,
      note: data.note?.trim() ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyPayoutRequests = createServerFn({ method: "POST" })
  .validator(accessTokenSchema)
  .handler(async ({ data }): Promise<PayoutRequestRow[]> => {
    const { supabase, user } = await requireUser(data.accessToken);
    const { data: rows, error } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("organizer_id", user.id)
      .order("requested_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => ({
      id: row.id,
      amount: row.amount,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentAccount: row.payment_account,
      note: row.note,
      requestedAt: row.requested_at,
      resolvedAt: row.resolved_at,
    }));
  });

export const getOrganizerSales = createServerFn({ method: "POST" })
  .validator(accessTokenSchema)
  .handler(async ({ data }): Promise<OrganizerSale[]> => {
    const { supabase, user } = await requireUser(data.accessToken);
    const { data: rows, error } = await supabase
      .from("orders")
      .select(`
        id, contact_name, contact_email, subtotal, fees, total, created_at,
        events!inner ( title, organizer_id ),
        order_items ( quantity, ticket_tiers ( name ) )
      `)
      .eq("status", "paid")
      .eq("events.organizer_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => {
      const item = (row.order_items as unknown as Array<{ quantity: number; ticket_tiers: { name: string } | null }> | null)?.[0];
      const event = row.events as unknown as { title: string } | null;
      return {
        orderId: row.id,
        eventTitle: event?.title ?? "Event",
        buyerName: row.contact_name,
        buyerEmail: row.contact_email,
        quantity: item?.quantity ?? 1,
        tierName: item?.ticket_tiers?.name ?? "Ticket",
        subtotal: row.subtotal,
        fees: row.fees,
        total: row.total,
        purchasedAt: row.created_at,
      };
    });
  });

export const getOrganizerAttendees = createServerFn({ method: "POST" })
  .validator(accessTokenSchema)
  .handler(async ({ data }): Promise<OrganizerAttendee[]> => {
    const { supabase, user } = await requireUser(data.accessToken);
    const { data: rows, error } = await supabase
      .from("tickets")
      .select(`
        id, holder_name, status, used_at, order_id,
        ticket_tiers!inner ( name, events!inner ( title, organizer_id ) )
      `)
      .eq("ticket_tiers.events.organizer_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => {
      const tier = row.ticket_tiers as unknown as { name: string; events: { title: string } | null } | null;
      return {
        ticketId: row.id,
        eventTitle: tier?.events?.title ?? "Event",
        holderName: row.holder_name,
        tierName: tier?.name ?? "Ticket",
        status: row.status,
        usedAt: row.used_at,
        orderId: row.order_id,
      };
    });
  });

export const getPublicOrganizerProfile = createServerFn({ method: "POST" })
  .validator(z.object({ organizerId: z.string().min(1), accessToken: z.string().optional() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data: profile } = await supabase
      .from("organizer_profiles")
      .select("*")
      .eq("user_id", data.organizerId)
      .maybeSingle();
    const { count } = await supabase
      .from("organizer_follows")
      .select("*", { count: "exact", head: true })
      .eq("organizer_id", data.organizerId);
    let isFollowing = false;
    if (data.accessToken) {
      const { data: userData } = await supabase.auth.getUser(data.accessToken);
      if (userData.user) {
        const { data: follow } = await supabase
          .from("organizer_follows")
          .select("organizer_id")
          .eq("organizer_id", data.organizerId)
          .eq("follower_id", userData.user.id)
          .maybeSingle();
        isFollowing = !!follow;
      }
    }
    return {
      profile: profile
        ? {
            userId: profile.user_id,
            displayName: profile.display_name,
            bio: profile.bio,
            avatarUrl: profile.avatar_url,
            phone: profile.phone,
            website: profile.website,
          }
        : null,
      followerCount: count ?? 0,
      isFollowing,
    };
  });

export const toggleOrganizerFollow = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string().min(1), organizerId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { supabase, user } = await requireUser(data.accessToken);
    if (user.id === data.organizerId) throw new Error("You cannot follow yourself.");
    const { data: existing } = await supabase
      .from("organizer_follows")
      .select("organizer_id")
      .eq("organizer_id", data.organizerId)
      .eq("follower_id", user.id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("organizer_follows")
        .delete()
        .eq("organizer_id", data.organizerId)
        .eq("follower_id", user.id);
      if (error) throw new Error(error.message);
      return { isFollowing: false };
    }
    const { error } = await supabase.from("organizer_follows").insert({
      organizer_id: data.organizerId,
      follower_id: user.id,
    });
    if (error) throw new Error(error.message);
    return { isFollowing: true };
  });

export const organizerProfileQueryOptions = (accessToken: string) =>
  queryOptions({ queryKey: ["organizer-profile", accessToken], queryFn: () => getMyOrganizerProfile({ data: { accessToken } }) });

export const organizerFinanceQueryOptions = (accessToken: string) =>
  queryOptions({ queryKey: ["organizer-finance", accessToken], queryFn: () => getOrganizerFinance({ data: { accessToken } }) });

export const organizerSalesQueryOptions = (accessToken: string) =>
  queryOptions({ queryKey: ["organizer-sales", accessToken], queryFn: () => getOrganizerSales({ data: { accessToken } }) });

export const organizerAttendeesQueryOptions = (accessToken: string) =>
  queryOptions({ queryKey: ["organizer-attendees", accessToken], queryFn: () => getOrganizerAttendees({ data: { accessToken } }) });

export const payoutRequestsQueryOptions = (accessToken: string) =>
  queryOptions({ queryKey: ["payout-requests", accessToken], queryFn: () => getMyPayoutRequests({ data: { accessToken } }) });
