import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "./supabase/server";
import { formatTicketNumber } from "./format";
import { generateTicketPdfBytes, sanitizeTicketFilename } from "./ticket-pdf";
import { getIssuedTicketsForOrder, type IssuedTicket } from "./data/tickets";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function applicationOrigin() {
  const value = process.env.APP_BASE_URL || process.env.VITE_APP_URL || process.env.VITE_SITE_URL;
  if (!value) throw new Error("APP_BASE_URL must be configured for WhatsApp ticket links.");
  return new URL(value).origin;
}

export async function ensureOrderTicketPdf(orderId: string, tickets?: IssuedTicket[]) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Ticket storage is not configured.");
  const { data: order, error } = await supabase.from("orders")
    .select("id,status,pdf_storage_path,ticket_generation_status")
    .eq("id", orderId).single();
  if (error || !order) throw new Error(error?.message || "Order not found.");
  if (!['paid','payment_approved'].includes(order.status)) throw new Error("Tickets are available only after payment approval.");
  if (order.pdf_storage_path) {
    const { data: storedFile } = await supabase.storage.from("ticket-pdfs").download(order.pdf_storage_path);
    if (storedFile) return order.pdf_storage_path;
  }
  const issued = tickets ?? await getIssuedTicketsForOrder(orderId);
  if (!issued.length) throw new Error("No tickets have been generated for this order.");
  try {
    const bytes = await generateTicketPdfBytes(issued, applicationOrigin());
    const path = `${orderId}/tickets.pdf`;
    const { error: uploadError } = await supabase.storage.from("ticket-pdfs").upload(path, bytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (uploadError) throw new Error(uploadError.message);
    const { error: updateError } = await supabase.from("orders").update({
      pdf_storage_path: path, ticket_generation_status: "generated", ticket_generation_error: null,
    }).eq("id", orderId).in("status", ["paid", "payment_approved"]);
    if (updateError) throw new Error(updateError.message);
    return path;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ticket PDF generation failed.";
    await supabase.from("orders").update({ ticket_generation_status: "failed", ticket_generation_error: message }).eq("id", orderId);
    throw error;
  }
}

export async function createTicketDownloadUrl(orderId: string, ticket: IssuedTicket) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Ticket download service is not configured.");
  const raw = randomBytes(32).toString("base64url");
  const { error } = await supabase.from("ticket_download_tokens").insert({ order_id: orderId, token_hash: hashToken(raw) });
  if (error) throw new Error(error.message);
  return {
    url: `${applicationOrigin()}/api/tickets/download/${raw}`,
    ticketNumber: formatTicketNumber(ticket.id, ticket.qrToken),
  };
}

export function ticketWhatsAppTemplateVariables(tickets: IssuedTicket[], url: string) {
  const first = tickets[0];
  if (!first) throw new Error("No issued ticket found.");
  const ticketNumber = formatTicketNumber(first.id, first.qrToken);
  return { "1": first.holder || "there", "2": first.event.title, "3": url, "4": ticketNumber };
}

export async function recordWhatsAppDeliveryFailure(orderId: string, message: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("orders").update({ whatsapp_delivery_status: "failed", whatsapp_delivery_error: message }).eq("id", orderId);
  await supabase.from("payment_audit_logs").insert({ order_id: orderId, action: "whatsapp_failed", metadata: { error: message } });
}

export async function sendTicketWhatsApp(orderId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("WhatsApp delivery service is not configured.");
  const { data: order, error } = await supabase.from("orders")
    .select("id,status,whatsapp_number,pdf_storage_path,whatsapp_retry_count")
    .eq("id", orderId).single();
  if (error || !order) throw new Error(error?.message || "Order not found.");
  if (!['paid','payment_approved'].includes(order.status)) throw new Error("WhatsApp delivery is allowed only after payment approval.");
  if (!order.whatsapp_number) throw new Error("This order has no WhatsApp number.");
  const tickets = await getIssuedTicketsForOrder(orderId);
  if (!tickets.length) throw new Error("No issued ticket exists for this order.");
  await ensureOrderTicketPdf(orderId, tickets);
  const { url, ticketNumber } = await createTicketDownloadUrl(orderId, tickets[0]);
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;
  if (!sid || !auth || !from || !contentSid) throw new Error("Configure Twilio WhatsApp credentials, sender, and approved content template.");
  const callback = `${applicationOrigin()}/api/webhooks/twilio/whatsapp`;
  const params = new URLSearchParams({
    To: `whatsapp:${order.whatsapp_number}`,
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(ticketWhatsAppTemplateVariables(tickets, url)),
    StatusCallback: callback,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST", headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    }, body: params,
  });
  const body = await response.json().catch(() => ({})) as { sid?: string; message?: string; code?: number };
  const now = new Date().toISOString();
  if (!response.ok || !body.sid) {
    const message = body.message || `Twilio WhatsApp request failed (${response.status}).`;
    await supabase.from("orders").update({
      whatsapp_delivery_status: "failed", whatsapp_delivery_error: message,
      whatsapp_retry_count: (order.whatsapp_retry_count || 0) + 1,
    }).eq("id", orderId);
    await supabase.from("payment_audit_logs").insert({ order_id: orderId, action: "whatsapp_failed", metadata: { error: message } });
    return { sent: false, message };
  }
  await supabase.from("orders").update({
    whatsapp_delivery_status: "sent", whatsapp_message_sid: body.sid,
    whatsapp_sent_at: now, whatsapp_delivery_error: null,
    whatsapp_retry_count: (order.whatsapp_retry_count || 0) + 1,
  }).eq("id", orderId);
  await supabase.from("payment_audit_logs").insert({
    order_id: orderId, action: "whatsapp_sent", metadata: { messageSid: body.sid, ticketNumber },
  });
  return { sent: true, messageSid: body.sid, message: "WhatsApp ticket link sent." };
}

export async function downloadTicketPdfByToken(token: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const { data: row } = await supabase.from("ticket_download_tokens")
    .select("order_id,expires_at,revoked_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!row || row.revoked_at || (row.expires_at && new Date(row.expires_at) <= new Date())) return null;
  const { data: order } = await supabase.from("orders").select("status,pdf_storage_path")
    .eq("id", row.order_id).maybeSingle();
  if (!order || !['paid','payment_approved'].includes(order.status) || !order.pdf_storage_path) return null;
  const { data: tickets } = await supabase.from("tickets").select("id").eq("order_id", row.order_id).in("status", ["valid", "used"]).limit(1);
  if (!tickets?.length) return null;
  const { data: file, error } = await supabase.storage.from("ticket-pdfs").download(order.pdf_storage_path);
  if (error || !file) return null;
  return { bytes: new Uint8Array(await file.arrayBuffer()), filename: sanitizeTicketFilename("Buzzket-Tickets", row.order_id.slice(0, 8)) };
}

export async function updateTwilioWhatsAppStatus(form: URLSearchParams, signature: string | null) {
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const origin = applicationOrigin();
  if (!auth || !signature) return false;
  const url = `${origin}/api/webhooks/twilio/whatsapp`;
  let data = url;
  for (const key of [...new Set([...form.keys()])].sort()) data += key + (form.get(key) || "");
  const expected = createHmac("sha1", auth).update(data).digest("base64");
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a,b)) return false;
  const sid = form.get("MessageSid"); const messageStatus = form.get("MessageStatus") || form.get("SmsStatus");
  if (!sid || !messageStatus) return false;
  const statuses: Record<string,string> = { delivered:"delivered", read:"delivered", sent:"sent", queued:"sent", accepted:"sent", sending:"sent", failed:"failed", undelivered:"failed", canceled:"failed" };
  const status = statuses[messageStatus.toLowerCase()];
  if (!status) return true;
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  await supabase.from("orders").update({
    whatsapp_delivery_status: status as "pending" | "sent" | "delivered" | "failed",
    whatsapp_delivery_error: status === "failed" ? [form.get("ErrorCode"),form.get("ErrorMessage")].filter(Boolean).join(": ") || "WhatsApp delivery failed." : null,
  }).eq("whatsapp_message_sid", sid);
  return true;
}
