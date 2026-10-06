import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSupabaseBrowserClient } from "../supabase/client";
import { getSupabaseAdmin } from "../supabase/server";
import {
  applyNotificationTemplate,
  assertPlatformOperational,
  fetchPlatformSettings,
} from "./platform";
import { generateTicketPdfBytes, sanitizeTicketFilename } from "../ticket-pdf";
import { sendTwilioSms, buildApprovalSms } from "../sms/twilio";
import { getMobileMoneyConfig } from "../payments/manual-momo";
import { normalizeWhatsAppNumber } from "../payments/phone";

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
  whatsappNumber?: string;
  event: {
    id: string;
    title: string;
    category: string;
    date: string;
    venue: string;
    city: string;
    image: string;
  };
  seat?: string;
  row?: string;
  gate?: string;
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
    whatsapp_number?: string | null;
  } | null;
  tier: {
    name: string;
    price: number;
    event: {
      id: string;
      title: string;
      category: string;
      date: string;
      venue: string;
      city: string;
      image: string;
    } | null;
  } | null;
};

export async function getIssuedTicketsForOrder(orderId: string): Promise<IssuedTicket[]> {
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
        contact_phone,
        whatsapp_number
      ),
      tier:ticket_tiers!tickets_tier_id_fkey (
        name,
        price,
        event:events!ticket_tiers_event_id_fkey (
          id,
          title,
          category,
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

  return ((data ?? []) as unknown as TicketRow[]).map((row) => {
    const tierName = row.tier?.name ?? "General Admission";
    const isVip = /vip/i.test(tierName);
    return {
      id: row.id,
      qrToken: row.qr_token,
      status: row.status,
      holder: row.holder_name,
      tier: tierName,
      price: row.tier?.price ?? 0,
      orderId: row.order?.id ?? row.order_id,
      orderTotal: row.order?.total ?? 0,
      contactEmail: row.order?.contact_email ?? "",
      contactPhone: row.order?.contact_phone ?? "",
      whatsappNumber: row.order?.whatsapp_number ?? row.order?.contact_phone ?? "",
      seat: "GA",
      row: "N/A",
      gate: isVip ? "VIP" : "MAIN",
      event: {
        id: row.tier?.event?.id ?? "",
        title: row.tier?.event?.title ?? "Buzzket Event",
        category: row.tier?.event?.category ?? "Event",
        date: row.tier?.event?.date ?? new Date().toISOString(),
        venue: row.tier?.event?.venue ?? "Confirmed venue",
        city: row.tier?.event?.city ?? "",
        image: row.tier?.event?.image ?? "",
      },
    };
  });
}

export async function sendTicketEmail(tickets: IssuedTicket[]): Promise<{ sent: boolean; message: string }> {
  const to = tickets[0]?.contactEmail;
  if (!to) return { sent: false, message: "No customer email was provided." };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TICKET_EMAIL_FROM || "Buzzket <tickets@buzzket.com>";

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
      <p style="margin-top:20px;color:#4b5563;">Your official tickets are attached to this email as a PDF. Present the QR code on the attached ticket at the gate for entry.</p>
    </div>
  `;

  if (!apiKey) {
    console.info(`[Resend Email Preview] To: ${to} | Subject: "${subject}" | (API Key missing)`);
    return { sent: false, message: "Email service not configured. Add RESEND_API_KEY to enable delivery." };
  }

  // Generate landscape PDF attachment
  let attachments: Array<{ filename: string; content: string }> | undefined;
  try {
    const pdfBytes = await generateTicketPdfBytes(tickets);
    const filename = sanitizeTicketFilename(first.event.title, `Order-${first.orderId.slice(0, 8)}`);
    attachments = [
      {
        filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
        content: Buffer.from(pdfBytes).toString("base64"),
      },
    ];
  } catch (pdfErr) {
    console.error("Failed to generate PDF attachment for email:", pdfErr);
  }

  const payload: Record<string, unknown> = {
    from,
    to,
    subject,
    html,
  };
  if (attachments && attachments.length > 0) {
    payload.attachments = attachments;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return { sent: false, message: `Ticket email failed: ${res.status} ${text}` };
  }

  return { sent: true, message: "Ticket email sent with PDF attachment." };
}

export async function sendRejectionEmail({
  to,
  recipientName,
  eventTitle,
  orderId,
  reason,
}: {
  to: string;
  recipientName: string;
  eventTitle: string;
  orderId: string;
  reason: string;
}): Promise<{ sent: boolean; message: string }> {
  if (!to) return { sent: false, message: "No customer email provided." };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TICKET_EMAIL_FROM || "Buzzket Support <support@buzzket.com>";
  const subject = `Payment Verification Update: ${eventTitle} (Ref: ${orderId.slice(0, 8)})`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;">
      <h2 style="color:#b91c1c;">Payment Verification Notice</h2>
      <p>Hello ${recipientName || "there"},</p>
      <p>We were unable to verify your mobile-money payment for <strong>${eventTitle}</strong>.</p>
      <div style="background:#fee2e2;border:1px solid #f87171;padding:12px 16px;border-radius:8px;margin:16px 0;">
        <strong>Reason:</strong> ${reason}
      </div>
      <p><strong>Order Reference:</strong> ${orderId}</p>
      <p>If you believe this is an error or if you need assistance, please reply to this email or contact Buzzket support with your mobile-money transaction receipt.</p>
    </div>
  `;

  if (!apiKey) {
    console.info(`[Resend Rejection Email Preview] To: ${to} | Subject: "${subject}"`);
    return { sent: false, message: "Resend API key not configured." };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { sent: false, message: `Rejection email failed: ${res.status} ${text}` };
  }

  return { sent: true, message: "Rejection email sent." };
}

export async function sendTicketSms(tickets: IssuedTicket[]): Promise<{ sent: boolean; message: string }> {
  const phone = tickets[0]?.contactPhone;
  if (!phone || phone.replace(/\D/g, "").length < 9) {
    return { sent: false, message: "No valid customer phone number was provided." };
  }

  const first = tickets[0];
  const smsBody = buildApprovalSms(
    first.event.title,
    tickets.length,
    first.tier,
    first.orderId,
    first.contactEmail,
  );

  const twilioRes = await sendTwilioSms({ to: phone, message: smsBody });
  if (twilioRes.sent) {
    return { sent: true, message: "Twilio SMS notification sent." };
  }

  // Fallback to legacy SMS webhook if configured
  const smsUrl = process.env.SMS_WEBHOOK_URL;
  if (smsUrl) {
    try {
      const res = await fetch(smsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone, message: smsBody }),
      });
      if (res.ok) return { sent: true, message: "SMS notification sent via webhook." };
    } catch {
      // Ignore webhook fallback error
    }
  }

  return {
    sent: false,
    message: twilioRes.error || "SMS delivery could not be completed.",
  };
}

export async function sendTicketNotifications(tickets: IssuedTicket[]) {
  const [email, sms] = await Promise.all([sendTicketEmail(tickets), sendTicketSms(tickets)]);
  return { email, sms };
}


// --- Reserve (10-min hold, concurrency-safe via reserve_tickets RPC) ----------

export const reserveTickets = createServerFn({ method: "POST" })
  .validator(z.object({ tierId: z.string().uuid(), qty: z.number().int().min(1).max(20) }))
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

// --- Manual Mobile Money (MTN & Airtel) ---------------------------------------

export const submitManualMomoOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      reservationId: z.string().min(1),
      network: z.enum(["mtn", "airtel"]),
      transactionId: z.string().trim().min(3, "Transaction reference / ID is required").max(120),
      contactName: z.string().min(1, "Name is required"),
      contactEmail: z.string().email("A valid email address is required"),
      contactPhone: z.string().min(8, "Phone number is required"),
      statusToken: z.string().regex(/^[a-f0-9]{64}$/i),
      promoCode: z.string().max(80).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await assertPlatformOperational();
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error("Supabase server client is not configured.");
    }

    const trimmedTx = data.transactionId.trim();

    // Prevent duplicate transaction ID abuse if already verified on another order
    const { data: existingApproved } = await supabase
      .from("orders")
      .select("id, status")
      .ilike("transaction_id", trimmedTx)
      .in("status", ["paid", "payment_approved"])
      .maybeSingle();

    if (existingApproved) {
      throw new Error(
        "This Transaction ID has already been approved for another order. Please verify your mobile money receipt or contact support.",
      );
    }

    const normalizedPhone = normalizeWhatsAppNumber(data.contactPhone);
    const config = getMobileMoneyConfig(data.network);
    if (!config.merchantCode) throw new Error("This Mobile Money provider is not configured on the server.");

    const { data: rows, error } = await supabase.rpc("submit_manual_payment", {
      p_reservation_id: data.reservationId,
      p_contact_name: data.contactName.trim(),
      p_contact_email: data.contactEmail.trim().toLowerCase(),
      p_whatsapp_number: normalizedPhone,
      p_payment_method: data.network === "mtn" ? "MTN Mobile Money" : "Airtel Money",
      p_transaction_id: trimmedTx,
      p_merchant_code: config.merchantCode,
      p_status_token: data.statusToken,
      p_promo_code: data.promoCode?.trim() || null,
    });

    if (error) {
      console.error("submit_manual_payment error:", error);
      throw new Error(error.message);
    }

    const row = rows?.[0];
    if (!row) throw new Error("Could not process order submission.");

    return { orderId: row.order_id, statusToken: row.status_token };
  });

export const getManualOrderStatus = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: z.string().uuid(), statusToken: z.string().regex(/^[a-f0-9]{64}$/i) }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(data.statusToken).digest("hex");
    const { data: order, error } = await supabase
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
        created_at,
        paid_at,
        rejection_reason,
        event:events (
          id,
          title,
          category,
          date,
          venue,
          city,
          image
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
      .eq("id", data.orderId)
      .eq("guest_status_token_hash", tokenHash)
      .single();

    if (error || !order) {
      throw new Error(`Order not found: ${error?.message || ""}`);
    }

    const isPaid = order.status === "paid" || order.status === "payment_approved";
    let tickets: IssuedTicket[] | null = null;
    if (isPaid) {
      tickets = await getIssuedTicketsForOrder(order.id);
    }

    return {
      order,
      tickets,
      isPaid,
      isPending:
        order.status === "payment_submitted" ||
        order.status === "pending" ||
        order.status === "pending_payment",
      isRejected: order.status === "payment_rejected",
    };
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

async function verifyPesapalAmountAndReference(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  reservationId: string,
  result: { merchant_reference?: string; amount?: string | number; currency?: string },
) {
  const { data: reservation, error } = await supabase.from("reservations")
    .select("quantity,unit_price").eq("id", reservationId).single();
  if (error || !reservation || reservation.unit_price === null) throw new Error("Payment does not match a valid reservation.");
  if (result.merchant_reference !== reservationId) throw new Error("Pesapal transaction reference does not match this reservation.");
  const expectedAmount = Math.ceil((reservation.unit_price + 500) / 0.95) * reservation.quantity;
  if (String(result.currency).toUpperCase() !== "UGX" || Number(result.amount) !== expectedAmount) {
    throw new Error("The verified Pesapal amount does not match the reserved ticket total.");
  }
  return reservation;
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
      reservationId: z.string().uuid(),
      email: z.string().email(),
      phone: z.string().min(8),
      name: z.string().min(1),
      callbackUrl: z.string().url(),
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
    if (!supabase) throw new Error("Supabase is not configured.");
    const phone = normalizeWhatsAppNumber(data.phone);
    const { data: reservation, error: reservationError } = await supabase.from("reservations")
      .select("id,tier_id,quantity,status,expires_at").eq("id", data.reservationId).single();
    if (reservationError || !reservation || reservation.status !== "active" || new Date(reservation.expires_at) <= new Date()) {
      throw new Error("Reservation is unavailable or expired.");
    }
    const { data: tier, error: tierError } = await supabase.from("ticket_tiers").select("price").eq("id", reservation.tier_id).single();
    if (tierError || !tier) throw new Error("Ticket tier is unavailable.");
    const unitPrice = tier.price;
    const amount = Math.ceil((unitPrice + 500) / 0.95) * reservation.quantity;
    const { error: updErr } = await supabase.from("reservations").update({
      contact_name: data.name.trim(), contact_email: data.email.trim().toLowerCase(),
      contact_phone: phone, unit_price: unitPrice,
    }).eq("id", data.reservationId).eq("status", "active");
    if (updErr) throw new Error(updErr.message);

    const token = await getPesapalToken(apiUrl, key, secret);
    const ipnId = await registerPesapalIpn(apiUrl, token, ipnUrl);

    // Format phone to be alphanumeric or simple string
    const cleanPhone = phone;

    const payload = {
      id: data.reservationId,
      currency: "UGX",
      amount,
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

  const verifiedReservation = await verifyPesapalAmountAndReference(supabase, reservationId, result);

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
    p_unit_price: verifiedReservation.unit_price || 0,
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

    const verifiedReservation = await verifyPesapalAmountAndReference(supabase, data.reservationId, result);

    const { data: rows, error } = await supabase.rpc("confirm_reservation", {
      p_reservation_id: data.reservationId,
      p_contact_name: data.contactName,
      p_contact_email: data.contactEmail,
      p_contact_phone: data.contactPhone,
      p_payment_method: `Pesapal (${result.payment_method || "Online"})`,
      p_unit_price: verifiedReservation.unit_price || 0,
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

export type TicketVerificationData = {
  valid: boolean;
  status: "valid" | "used" | "void" | "not_found";
  ticketNumber: string;
  holderName: string;
  tierName: string;
  price: number;
  eventName: string;
  category: string;
  eventDate: string;
  venue: string;
  city: string;
  image: string;
  usedAt?: string | null;
  seat: string;
  row: string;
  gate: string;
};

export const getTicketVerification = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }): Promise<TicketVerificationData> => {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select(
        `
        id,
        qr_token,
        status,
        holder_name,
        used_at,
        tier:ticket_tiers!tickets_tier_id_fkey (
          name,
          price,
          event:events!ticket_tiers_event_id_fkey (
            id,
            title,
            category,
            date,
            venue,
            city,
            image
          )
        )
      `,
      )
      .eq("qr_token", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!ticket) {
      return {
        valid: false,
        status: "not_found",
        ticketNumber: "UNKNOWN",
        holderName: "",
        tierName: "",
        price: 0,
        eventName: "",
        category: "EVENT",
        eventDate: "",
        venue: "",
        city: "",
        image: "",
        seat: "GA",
        row: "N/A",
        gate: "MAIN",
      };
    }

    const tier = ticket.tier as unknown as {
      name: string;
      price: number;
      event: {
        id: string;
        title: string;
        category: string;
        date: string;
        venue: string;
        city: string;
        image: string;
      } | null;
    } | null;

    const isVip = /vip/i.test(tier?.name ?? "");
    const cleanId = ticket.id.replace(/-/g, "").slice(0, 8).toUpperCase();

    return {
      valid: ticket.status === "valid",
      status: ticket.status as "valid" | "used" | "void",
      ticketNumber: `BZK-${cleanId}`,
      holderName: ticket.holder_name || "Guest",
      tierName: tier?.name ?? "General Admission",
      price: tier?.price ?? 0,
      eventName: tier?.event?.title ?? "Buzzket Event",
      category: tier?.event?.category ?? "EVENT",
      eventDate: tier?.event?.date ?? new Date().toISOString(),
      venue: tier?.event?.venue ?? "Confirmed Venue",
      city: tier?.event?.city ?? "",
      image: tier?.event?.image ?? "",
      usedAt: ticket.used_at,
      seat: "GA",
      row: "N/A",
      gate: isVip ? "VIP" : "MAIN",
    };
  });
