import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getSupabaseAdmin } from "../supabase/server";
import type { IssuedTicket } from "./tickets";

export const getMyTickets = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }): Promise<IssuedTicket[]> => {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: userData, error: userError } = await supabase.auth.getUser(data.accessToken);
    if (userError || !userData.user) throw new Error("Session is invalid.");

    const email = userData.user.email ?? "";
    const phone = userData.user.phone ?? "";
    if (!email && !phone) return [];

    let orderQuery = supabase
      .from("orders")
      .select("id")
      .eq("status", "paid");

    if (email && phone) {
      orderQuery = orderQuery.or(`contact_email.eq.${email},contact_phone.eq.${phone}`);
    } else if (email) {
      orderQuery = orderQuery.eq("contact_email", email);
    } else {
      orderQuery = orderQuery.eq("contact_phone", phone);
    }

    const { data: orders, error: ordersError } = await orderQuery;
    if (ordersError) throw new Error(ordersError.message);
    const orderIds = (orders ?? []).map((order) => order.id);
    if (orderIds.length === 0) return [];

    const { data: rows, error } = await supabase
      .from("tickets")
      .select(
        `
        id,
        qr_token,
        holder_name,
        status,
        order_id,
        order:orders!tickets_order_id_fkey (
          id,
          total,
          contact_email
        ),
        tier:ticket_tiers!tickets_tier_id_fkey (
          name,
          price,
          event:events!ticket_tiers_event_id_fkey (
            id,
            title,
            date,
            venue,
            city,
            image
          )
        )
      `,
      )
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return ((rows ?? []) as unknown as Array<{
      id: string;
      qr_token: string;
      holder_name: string;
      status: string;
      order_id: string;
      order: { id: string; total: number; contact_email: string } | null;
      tier: {
        name: string;
        price: number;
        event: {
          id: string;
          title: string;
          date: string;
          venue: string;
          city: string;
          image: string;
        } | null;
      } | null;
    }>).map((row) => ({
      id: row.id,
      qrToken: row.qr_token,
      status: row.status,
      holder: row.holder_name,
      tier: row.tier?.name ?? "General Admission",
      price: row.tier?.price ?? 0,
      orderId: row.order?.id ?? row.order_id,
      orderTotal: row.order?.total ?? 0,
      contactEmail: row.order?.contact_email ?? "",
      event: {
        id: row.tier?.event?.id ?? "",
        title: row.tier?.event?.title ?? "Buzzket Event",
        date: row.tier?.event?.date ?? new Date().toISOString(),
        venue: row.tier?.event?.venue ?? "Confirmed venue",
        city: row.tier?.event?.city ?? "",
        image: row.tier?.event?.image ?? "",
      },
    }));
  });

export const myTicketsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ["my-tickets", accessToken],
    queryFn: () => getMyTickets({ data: { accessToken } }),
  });
