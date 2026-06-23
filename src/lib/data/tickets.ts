import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSupabaseBrowserClient } from "../supabase/client";
import { getSupabaseAdmin } from "../supabase/server";
import {
  applyNotificationTemplate,
  assertPlatformOperational,
  fetchPlatformSettings,
} from "./platform";

export type IssuedTicket = {
  id: string;
  qrToken: string;
  status: string;
  holder: string;
  tier: string;
  price: number;
  orderId: string;
  orderTotal: number;
  contactEmail: string;
  contactPhone: string;
  event: {
    id: string;
    title: string;
    date: string;
    venue: string;
    city: string;
    image: string;
  };
};

type TicketRow = {
  id: string;
  qr_token: string;
  holder_name: string;
  status: string;
  order_id: string;
  order: {
    id: string;
    total: number;
    contact_email: string;
    contact_phone: string | null;
  } | null;
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
};

async function getIssuedTicketsForOrder(orderId: string): Promise<IssuedTicket[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Ticket lookup requires Supabase server credentials.");
  }

  const { data, error } = await supabase
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
        contact_email,
        contact_phone
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
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as TicketRow[]).map((row) => ({
    id: row.id,
    qrToken: row.qr_token,
    status: row.status,
    holder: row.holder_name,
    tier: row.tier?.name ?? "General Admission",
    price: row.tier?.price ?? 0,
    orderId: row.order?.id ?? row.order_id,
    orderTotal: row.order?.total ?? 0,
    contactEmail: row.order?.contact_email ?? "",
    contactPhone: row.order?.contact_phone ?? "",
    event: {
      id: row.tier?.event?.id ?? "",
      title: row.tier?.event?.title ?? "Buzzket Event",
      date: row.tier?.event?.date ?? new Date().toISOString(),
      venue: row.tier?.event?.venue ?? "Confirmed venue",
      city: row.tier?.event?.city ?? "",
      image: row.tier?.event?.image ?? "",
    },
  }));
}

async function sendTicketEmail(tickets: IssuedTicket[]): Promise<{ sent: boolean; message: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TICKET_EMAIL_FROM;
  const to = tickets[0]?.contactEmail;

  if (!to) return { sent: false, message: "No customer email was provided." };
  if (!apiKey || !from) {
    return { sent: false, message: "Ticket email is not configured. Add RESEND_API_KEY and TICKET_EMAIL_FROM." };
  }

  const settings = await fetchPlatformSettings();
  const first = tickets[0];
  const templateVars = {
    eventName: first.event.title,
    userName: first.holder || "there",
    ticketTier: first.tier,
  };
  const subject = applyNotificationTemplate(settings.emailTemplateSubject, templateVars);
  const intro = applyNotificationTemplate(settings.emailTemplateBody, templateVars);

  const ticketRows = tickets
    .map(
      (ticket) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${ticket.holder}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${ticket.tier}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-family:monospace;">${ticket.qrToken}</td>
        </tr>
      `,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;">
      <p style="margin:0 0 20px;">${intro}</p>
      ${first.event.image ? `<img src="${first.event.image}" alt="" style="width:100%;max-width:560px;height:220px;object-fit:cover;border-radius:12px;margin-bottom:20px;" />` : ""}
      <p><strong>Event:</strong> ${first.event.title}</p>
      <p><strong>Date:</strong> ${new Date(first.event.date).toLocaleString("en-UG")}</p>
      <p><strong>Venue:</strong> ${first.event.venue}${first.event.city ? `, ${first.event.city}` : ""}</p>
      <table style="border-collapse:collapse;width:100%;max-width:720px;margin-top:16px;">
        <thead>
          <tr style="background:#f9fafb;text-align:left;">
            <th style="padding:12px;">Holder</th>
            <th style="padding:12px;">Tier</th>
            <th style="padding:12px;">Ticket token</th>
          </tr>
        </thead>
        <tbody>${ticketRows}</tbody>
      </table>
      <p style="margin-top:20px;color:#4b5563;">Open the confirmation page after payment to download the full PDF ticket. The QR token above is the same code scanned at the gate.</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { sent: false, message: `Ticket email failed: ${res.status} ${text}` };
  }

  return { sent: true, message: "Ticket email sent." };
}

async function sendTicketSms(tickets: IssuedTicket[]): Promise<{ sent: boolean; message: string }> {
  const phone = tickets[0]?.contactPhone?.replace(/\D/g, "");
  if (!phone || phone.length < 9) {
    return { sent: false, message: "No customer phone number was provided." };
  }

  const settings = await fetchPlatformSettings();
  const first = tickets[0];
  const message = applyNotificationTemplate(settings.smsTemplate, {
    eventName: first.event.title,
    userName: first.holder || "there",
    ticketTier: first.tier,
  });

  const smsUrl = process.env.SMS_WEBHOOK_URL;
  if (!smsUrl) {
    console.info("[Buzzket SMS preview]", phone, message);
    return { sent: false, message: "SMS notifications are not configured. Add SMS_WEBHOOK_URL to enable delivery." };
  }

  const res = await fetch(smsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: phone, message }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { sent: false, message: `SMS notification failed: ${res.status} ${text}` };
  }

  return { sent: true, message: "SMS notification sent." };
}

async function sendTicketNotifications(tickets: IssuedTicket[]) {
  const [email, sms] = await Promise.all([sendTicketEmail(tickets), sendTicketSms(tickets)]);
  return { email, sms };
}

// --- Reserve (10-min hold, concurrency-safe via reserve_tickets RPC) ----------

export const reserveTickets = createServerFn({ method: "POST" })
  .validator(z.object({ tierId: z.string().min(1), qty: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await assertPlatformOperational();
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
    const tickets = await getIssuedTicketsForOrder(row.order_id);
    const notifications = await sendTicketNotifications(tickets);
    return { orderId: row.order_id, qrTokens: row.qr_tokens, tickets, ...notifications };
  });

export const getOrderTickets = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ data }) => getIssuedTicketsForOrder(data.orderId));

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
      qty: z.number().int().positive(),
      unitPrice: z.number().int().nonnegative(),
    }),
  )
  .handler(async ({ data }) => {
    await assertPlatformOperational();
    const key = process.env.PESAPAL_CONSUMER_KEY;
    const secret = process.env.PESAPAL_CONSUMER_SECRET;
    const apiUrl = process.env.PESAPAL_API_URL;
    const ipnUrl = process.env.PESAPAL_IPN_URL;

    if (!key || !secret || !apiUrl || !ipnUrl) {
      throw new Error("Pesapal environment variables are not fully configured.");
    }

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error: updErr } = await supabase
        .from("reservations")
        .update({
          contact_name: data.name,
          contact_email: data.email,
          contact_phone: data.phone,
          unit_price: data.unitPrice,
        })
        .eq("id", data.reservationId);
      if (updErr) {
        console.error("Failed to update contact details on reservation:", updErr);
      }
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

export async function verifyPesapalPaymentBackground(orderTrackingId: string, reservationId: string) {
  const key = process.env.PESAPAL_CONSUMER_KEY;
  const secret = process.env.PESAPAL_CONSUMER_SECRET;
  const apiUrl = process.env.PESAPAL_API_URL;

  if (!key || !secret || !apiUrl) {
    throw new Error("Pesapal environment variables are not fully configured.");
  }

  const token = await getPesapalToken(apiUrl, key, secret);
  const res = await fetch(
    `${apiUrl}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
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

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Order confirmation requires Supabase server credentials.");
  }

  const { data: reservation, error: resvErr } = await supabase
    .from("reservations")
    .select("status, contact_name, contact_email, contact_phone, unit_price, quantity, order_id")
    .eq("id", reservationId)
    .single();

  if (resvErr || !reservation) {
    throw new Error(`Could not find reservation: ${resvErr?.message || "Not found"}`);
  }

  if (reservation.status === "confirmed") {
    if (reservation.order_id) {
      const tickets = await getIssuedTicketsForOrder(reservation.order_id);
      return { orderId: reservation.order_id, tickets };
    }
    throw new Error("Reservation is confirmed but order_id is missing");
  }

  const { data: rows, error } = await supabase.rpc("confirm_reservation", {
    p_reservation_id: reservationId,
    p_contact_name: reservation.contact_name || "Guest",
    p_contact_email: reservation.contact_email || "",
    p_contact_phone: reservation.contact_phone || "",
    p_payment_method: `Pesapal IPN (${result.payment_method || "Online"})`,
    p_unit_price: reservation.unit_price || 0,
  });

  if (error) {
    if (error.message.includes("Reservation is no longer active") || error.message.includes("already confirmed")) {
      const { data: resv } = await supabase
        .from("reservations")
        .select("order_id")
        .eq("id", reservationId)
        .single();
      if (resv?.order_id) {
        const tickets = await getIssuedTicketsForOrder(resv.order_id);
        const notifications = await sendTicketNotifications(tickets);
        return { orderId: resv.order_id, tickets, ...notifications };
      }
    }
    throw new Error(error.message);
  }

  const row = rows?.[0];
  if (!row) throw new Error("Could not confirm order");
  const tickets = await getIssuedTicketsForOrder(row.order_id);
  const notifications = await sendTicketNotifications(tickets);
  return { orderId: row.order_id, tickets, ...notifications };
}

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
            const tickets = await getIssuedTicketsForOrder(resv.order_id);
            const notifications = await sendTicketNotifications(tickets);
            return { orderId: resv.order_id, qrTokens: tix.map((t) => t.qr_token), tickets, ...notifications };
          }
        }
      }
      throw new Error(error.message);
    }

    const row = rows?.[0];
    if (!row) throw new Error("Could not confirm order");
    const tickets = await getIssuedTicketsForOrder(row.order_id);
    const notifications = await sendTicketNotifications(tickets);
    return { orderId: row.order_id, qrTokens: row.qr_tokens, tickets, ...notifications };
  });

export const validatePromoCode = createServerFn({ method: "POST" })
  .validator(z.object({ eventId: z.string().min(1), code: z.string().min(1) }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: promo, error } = await supabase
      .from("promo_codes")
      .select("id, type, value, max_uses, used_count, active, expires_at")
      .eq("event_id", data.eventId)
      .ilike("code", data.code.trim())
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!promo) throw new Error("Invalid promo code.");
    if (!promo.active) throw new Error("This promo code is no longer active.");
    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
      throw new Error("This promo code has reached its usage limit.");
    }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      throw new Error("This promo code has expired.");
    }

    return { id: promo.id, type: promo.type as "percent" | "flat", value: promo.value };
  });

export const getEventImageBase64 = createServerFn({ method: "POST" })
  .validator(z.object({ url: z.string().url() }))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(data.url);
      if (!res.ok) return { base64: null, contentType: null };
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      return { base64, contentType };
    } catch (e) {
      console.error("Error proxying event image:", e);
      return { base64: null, contentType: null };
    }
  });
