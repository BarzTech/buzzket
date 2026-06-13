import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getSupabaseAdmin } from "../supabase/server";

// --- Reserve (10-min hold, concurrency-safe via reserve_tickets RPC) ----------

export const reserveTickets = createServerFn({ method: "POST" })
  .inputValidator(z.object({ tierId: z.string().min(1), qty: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      // Demo fallback: synthesise a hold so checkout works before Supabase.
      return {
        reservationId: randomUUID(),
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      };
    }

    const { data: rows, error } = await supabase.rpc("reserve_tickets", {
      p_tier_id: data.tierId,
      p_qty: data.qty,
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) throw new Error("Could not reserve tickets");
    return { reservationId: row.reservation_id, expiresAt: row.expires_at };
  });

// --- Confirm payment -> paid order + issued tickets (with QR tokens) ----------

export const confirmOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      reservationId: z.string().min(1),
      qty: z.number().int().positive(),
      unitPrice: z.number().int().nonnegative(),
      contactName: z.string(),
      contactEmail: z.string(),
      contactPhone: z.string(),
      paymentMethod: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      // Demo fallback: mint QR tokens locally so the success screen renders.
      return {
        orderId: randomUUID(),
        qrTokens: Array.from({ length: data.qty }, () => randomUUID()),
      };
    }

    const { data: rows, error } = await supabase.rpc("confirm_reservation", {
      p_reservation_id: data.reservationId,
      p_contact_name: data.contactName,
      p_contact_email: data.contactEmail,
      p_contact_phone: data.contactPhone,
      p_payment_method: data.paymentMethod,
      p_unit_price: data.unitPrice,
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) throw new Error("Could not confirm order");
    return { orderId: row.order_id, qrTokens: row.qr_tokens };
  });

// --- Scan / check-in ----------------------------------------------------------

export type CheckInResult = {
  status: "valid" | "already_used" | "not_found" | "demo";
  holder?: string;
  eventId?: string;
};

export const checkInTicket = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }): Promise<CheckInResult> => {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return { status: "demo", holder: "Demo Attendee" };
    }

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select("id, status, holder_name, tier_id")
      .eq("qr_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) return { status: "not_found" };

    if (ticket.status === "used") {
      return { status: "already_used", holder: ticket.holder_name };
    }

    const { error: updErr } = await supabase
      .from("tickets")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", ticket.id);
    if (updErr) throw new Error(updErr.message);

    const { data: tier } = await supabase
      .from("ticket_tiers")
      .select("event_id")
      .eq("id", ticket.tier_id)
      .maybeSingle();
    return { status: "valid", holder: ticket.holder_name, eventId: tier?.event_id };
  });
