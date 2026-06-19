import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSupabaseBrowserClient } from "../supabase/client";
import { getSupabaseAdmin } from "../supabase/server";

// --- Reserve (10-min hold, concurrency-safe via reserve_tickets RPC) ----------

export const reserveTickets = createServerFn({ method: "POST" })
  .validator(z.object({ tierId: z.string().min(1), qty: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error("Ticket reservations require Supabase server credentials.");
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
  .validator(
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
      throw new Error("Order confirmation requires Supabase server credentials.");
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
  status: "valid" | "already_used" | "not_found" | "forbidden";
  holder?: string;
  eventId?: string;
};

export const checkInTicket = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }): Promise<CheckInResult> => {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error("Ticket scanning requires Supabase server credentials.");
    }

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select(
        `
        id, status, holder_name,
        tier:ticket_tiers ( event_id )
      `,
      )
      .eq("qr_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) return { status: "not_found" };

    if (ticket.status === "used") {
      return { status: "already_used", holder: ticket.holder_name };
    }

    const { error: updErr, count } = await supabase
      .from("tickets")
      .update({ status: "used", used_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", ticket.id)
      .eq("status", "valid");
    if (updErr) throw new Error(updErr.message);
    if (count === 0) {
      return { status: "already_used", holder: ticket.holder_name };
    }

    const eventId = (ticket.tier as { event_id: string } | null)?.event_id;
    return { status: "valid", holder: ticket.holder_name, eventId };
  });

export async function checkInTicketClient(token: string): Promise<CheckInResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured. Ticket scanning is disabled.");

  const { data, error } = await supabase.rpc("check_in_ticket", { p_token: token });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { status: "not_found" };
  return {
    status: row.status as CheckInResult["status"],
    holder: row.holder ?? undefined,
    eventId: row.event_id ?? undefined,
  };
}

// --- Pesapal Integration ----------------------------------------------------

async function getPesapalToken(apiUrl: string, key: string, secret: string): Promise<string> {
  const res = await fetch(`${apiUrl}/Auth/RequestToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pesapal token request failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return data.token;
}

async function registerPesapalIpn(apiUrl: string, token: string, ipnUrl: string): Promise<string> {
  const res = await fetch(`${apiUrl}/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      url: ipnUrl,
      ipn_notification_type: "GET",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pesapal IPN registration failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return data.ipn_id;
}

export const initiatePesapalPayment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      reservationId: z.string().min(1),
      amount: z.number().positive(),
      email: z.string().email(),
      phone: z.string(),
      name: z.string(),
      callbackUrl: z.string().url(),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.PESAPAL_CONSUMER_KEY;
    const secret = process.env.PESAPAL_CONSUMER_SECRET;
    const apiUrl = process.env.PESAPAL_API_URL;
    const ipnUrl = process.env.PESAPAL_IPN_URL;

    if (!key || !secret || !apiUrl || !ipnUrl) {
      throw new Error("Pesapal environment variables are not fully configured.");
    }

    const token = await getPesapalToken(apiUrl, key, secret);
    const ipnId = await registerPesapalIpn(apiUrl, token, ipnUrl);

    // Format phone to be alphanumeric or simple string
    const cleanPhone = data.phone.replace(/[^0-9+]/g, "");

    const payload = {
      id: data.reservationId,
      currency: "UGX",
      amount: data.amount,
      description: `Ticket reservation ${data.reservationId}`,
      callback_url: data.callbackUrl,
      notification_id: ipnId,
      billing_address: {
        email_address: data.email,
        phone_number: cleanPhone,
        first_name: data.name || "Guest",
      },
    };

    const res = await fetch(`${apiUrl}/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pesapal payment submission failed: ${res.status} - ${text}`);
    }

    const result = await res.json();
    return { redirectUrl: result.redirect_url, orderTrackingId: result.order_tracking_id };
  });

export const verifyPesapalPayment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      orderTrackingId: z.string().min(1),
      reservationId: z.string().min(1),
      qty: z.number().int().positive(),
      unitPrice: z.number().int().nonnegative(),
      contactName: z.string(),
      contactEmail: z.string(),
      contactPhone: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.PESAPAL_CONSUMER_KEY;
    const secret = process.env.PESAPAL_CONSUMER_SECRET;
    const apiUrl = process.env.PESAPAL_API_URL;

    if (!key || !secret || !apiUrl) {
      throw new Error("Pesapal environment variables are not fully configured.");
    }

    const token = await getPesapalToken(apiUrl, key, secret);
    const res = await fetch(
      `${apiUrl}/Transactions/GetTransactionStatus?orderTrackingId=${data.orderTrackingId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
        },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pesapal status check failed: ${res.status} - ${text}`);
    }

    const result = await res.json();
    const isCompleted =
      result.payment_status_code === "COMPLETED" ||
      result.status_code === 1 ||
      String(result.payment_status_description).toLowerCase() === "completed";

    if (!isCompleted) {
      throw new Error(`Payment is not completed. Status: ${result.payment_status_description}`);
    }

    // Payment is verified! Confirm the order in Supabase
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error("Order confirmation requires Supabase server credentials.");
    }

    const { data: rows, error } = await supabase.rpc("confirm_reservation", {
      p_reservation_id: data.reservationId,
      p_contact_name: data.contactName,
      p_contact_email: data.contactEmail,
      p_contact_phone: data.contactPhone,
      p_payment_method: `Pesapal (${result.payment_method || "Online"})`,
      p_unit_price: data.unitPrice,
    });

    if (error) {
      // If it fails because it's already confirmed, let's fetch the existing tickets instead of crashing
      if (error.message.includes("Reservation is no longer active") || error.message.includes("already confirmed")) {
        // Since confirm_reservation assigns a new order_id to the reservation,
        // let's fetch the order_id from the confirmed reservation first.
        const { data: resv } = await supabase
          .from("reservations")
          .select("order_id")
          .eq("id", data.reservationId)
          .single();
        if (resv?.order_id) {
          const { data: tix } = await supabase
            .from("tickets")
            .select("qr_token")
            .eq("order_id", resv.order_id);
          if (tix && tix.length > 0) {
            return { orderId: resv.order_id, qrTokens: tix.map((t) => t.qr_token) };
          }
        }
      }
      throw new Error(error.message);
    }

    const row = rows?.[0];
    if (!row) throw new Error("Could not confirm order");
    return { orderId: row.order_id, qrTokens: row.qr_tokens };
  });
