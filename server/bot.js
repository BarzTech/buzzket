/**
 * Buzzket — Twilio WhatsApp Bot Server
 * Run: node bot.js
 * Requires: npm install in /server folder first
 */

require("dotenv").config();
const express = require("express");
const twilio  = require("twilio");

const app    = express();
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/* ─── In-memory store (replace with PostgreSQL in production) ── */
// Format: { [whatsappNumber]: { step, selectedEvent, selectedTier, qty, name, orderId } }
const sessions = {};

// Seed events — replace these with real DB queries
const events = [
  { id: 1, name: "Afrobeats Night",    venue: "Kampala Serena Hotel", date: "14 June 2025", time: "8:00 PM", merchant: "KE4521" },
  { id: 2, name: "Jazz & Wine Evening",venue: "Garden City Rooftop",  date: "28 June 2025", time: "6:00 PM", merchant: "KE4521" },
  { id: 3, name: "Comedy Nite Vol. 5", venue: "Entebbe Resort",       date: "5 July 2025",  time: "7:00 PM", merchant: "NP7823" },
];
const tiers = [
  { id: 1, eventId: 1, name: "VIP",     price: 80000,  total: 100, sold: 45 },
  { id: 2, eventId: 1, name: "Regular", price: 30000,  total: 400, sold: 178 },
  { id: 3, eventId: 2, name: "VIP",     price: 120000, total: 50,  sold: 22 },
  { id: 4, eventId: 2, name: "Regular", price: 50000,  total: 150, sold: 67 },
  { id: 5, eventId: 3, name: "VIP",     price: 60000,  total: 80,  sold: 33 },
  { id: 6, eventId: 3, name: "Regular", price: 25000,  total: 270, sold: 121 },
];

// Pending orders — replace with DB in production
const orders = [];

/* ─── Helpers ────────────────────────────────────────────────── */
const fmt = n => `UGX ${Number(n).toLocaleString()}`;

function getSession(from) {
  if (!sessions[from]) sessions[from] = { step: "welcome" };
  return sessions[from];
}

function clearSession(from) {
  sessions[from] = { step: "welcome" };
}

function reply(res, text) {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(text);
  res.type("text/xml").send(twiml.toString());
}

/* ─── Main webhook ───────────────────────────────────────────── */
app.post("/whatsapp", (req, res) => {
  const from = req.body.From;   // e.g. "whatsapp:+256701234567"
  const body = (req.body.Body || "").trim();
  const sess = getSession(from);

  console.log(`[${new Date().toISOString()}] ${from} → "${body}" (step: ${sess.step})`);

  /* ── WELCOME ── */
  if (sess.step === "welcome") {
    if (body === "1") {
      sess.step = "event_list";
      const list = events
        .map((e, i) => `${i + 1}. *${e.name}*\n   📍 ${e.venue}\n   📅 ${e.date}`)
        .join("\n\n");
      return reply(res,
        `🎉 *Available Events:*\n\n${list}\n\nReply with a number to select an event.`
      );
    }
    if (body.toLowerCase() === "my tickets") {
      const mine = orders.filter(o => o.wa === from && o.status === "approved");
      if (mine.length === 0) return reply(res, "You have no confirmed tickets yet. Type *1* to browse events.");
      const list = mine.map(o =>
        `🎟 *${o.eventName}* — ${o.tierName}\nTicket ID: ${o.ticketId}\nDate: ${o.eventDate}`
      ).join("\n\n");
      return reply(res, `Your confirmed tickets:\n\n${list}`);
    }
    if (body === "3" || body.toLowerCase() === "help") {
      return reply(res,
        `📞 *Buzzket Support*\n\nPhone: +256700000000\nEmail: help@buzzket.ug\nHours: Mon–Sun, 8am–10pm EAT\n\nType *1* to browse events.`
      );
    }
    return reply(res,
      `👋 Welcome to *Buzzket* — Uganda's ticketing platform!\n\nReply with a number:\n1️⃣ Browse Events\n2️⃣ My Tickets\n3️⃣ Help\n\n_Type "cancel" anytime to restart._`
    );
  }

  /* ── Cancel at any step ── */
  if (body.toLowerCase() === "cancel") {
    clearSession(from);
    return reply(res, "Restarted. Reply with *1* to browse events.");
  }

  /* ── EVENT LIST ── */
  if (sess.step === "event_list") {
    const idx = parseInt(body) - 1;
    const ev  = events[idx];
    if (!ev) return reply(res, "Please reply with a valid number from the list.");
    sess.selectedEvent = ev;
    sess.step = "tier_select";

    const evTiers = tiers.filter(t => t.eventId === ev.id);
    const tierList = evTiers
      .map((t, i) => `${i + 1}. *${t.name}* — ${fmt(t.price)}\n   (${t.total - t.sold} tickets remaining)`)
      .join("\n\n");

    return reply(res,
      `🎵 *${ev.name}*\n📍 ${ev.venue}\n📅 ${ev.date} at ${ev.time}\n\n*Ticket Types:*\n\n${tierList}\n\nReply with a number to choose your ticket type.`
    );
  }

  /* ── TIER SELECT ── */
  if (sess.step === "tier_select") {
    const evTiers = tiers.filter(t => t.eventId === sess.selectedEvent.id);
    const idx     = parseInt(body) - 1;
    const tier    = evTiers[idx];
    if (!tier) return reply(res, "Please reply with a valid number from the ticket list.");
    if (tier.sold >= tier.total) return reply(res, `Sorry, *${tier.name}* tickets are sold out. Please choose another option.`);
    sess.selectedTier = tier;
    sess.step = "qty";
    return reply(res, `How many *${tier.name}* tickets do you need?\n\nReply with a number (maximum 5 per order).`);
  }

  /* ── QUANTITY ── */
  if (sess.step === "qty") {
    const n = parseInt(body);
    if (!n || n < 1 || n > 5) return reply(res, "Please reply with a number between 1 and 5.");
    const tier = sess.selectedTier;
    const remaining = tier.total - tier.sold;
    if (n > remaining) return reply(res, `Only ${remaining} tickets are available. Please choose a smaller quantity.`);
    sess.qty  = n;
    sess.step = "name";
    return reply(res, `Please provide your *full name* as it should appear on the ticket(s).`);
  }

  /* ── NAME ── */
  if (sess.step === "name") {
    if (body.length < 3) return reply(res, "Please enter your full name (at least 3 characters).");
    sess.customerName = body;
    sess.step = "payment";

    const total    = sess.selectedTier.price * sess.qty;
    const ev       = sess.selectedEvent;
    const merchant = ev.merchant;

    return reply(res,
`✅ *Order Summary*
━━━━━━━━━━━━━━━━━━
Event: ${ev.name}
Tier:  ${sess.selectedTier.name} × ${sess.qty}
Total: *${fmt(total)}*
━━━━━━━━━━━━━━━━━━

💳 *How to Pay*

*MTN Mobile Money:*
1. Dial *165*3#
2. Select "Pay Bill / Merchant"
3. Merchant Code: *${merchant}*
4. Amount: *${total}*
5. Confirm with your PIN

*Airtel Money:*
1. Dial *185*9#
2. Select "Make Payment"
3. Merchant Code: *${merchant}*
4. Amount: *${total}*
5. Confirm

⚠️ After paying, you will receive a *Transaction ID (TID)* in an SMS from MTN or Airtel.

Reply here with that TID to confirm your payment.`
    );
  }

  /* ── PAYMENT / TID SUBMISSION ── */
  if (sess.step === "payment") {
    const tid = body.toUpperCase();

    if (!tid.startsWith("TID")) {
      return reply(res,
        `Please reply with your *Transaction ID* from your Mobile Money SMS confirmation.\n\nIt starts with "TID" followed by numbers, e.g. *TID8473625910*\n\nIf you have not paid yet, complete the payment first.`
      );
    }

    // Check for duplicate TID
    const duplicate = orders.find(o => o.tid === tid);
    if (duplicate) {
      return reply(res,
        `⚠️ This Transaction ID has already been submitted.\n\nIf you believe this is an error, contact support:\nPhone: +256700000000\nEmail: help@buzzket.ug`
      );
    }

    // Create order
    const orderId = `ORD-${Date.now()}`;
    const order   = {
      id:        orderId,
      wa:        from,
      name:      sess.customerName,
      eventId:   sess.selectedEvent.id,
      eventName: sess.selectedEvent.name,
      eventDate: sess.selectedEvent.date,
      tierId:    sess.selectedTier.id,
      tierName:  sess.selectedTier.name,
      qty:       sess.qty,
      total:     sess.selectedTier.price * sess.qty,
      tid,
      status:    "pending",
      createdAt: new Date().toISOString(),
    };
    orders.push(order);
    sess.orderId = orderId;
    sess.step    = "waiting";

    console.log(`[ORDER] New pending order: ${orderId} | TID: ${tid} | ${sess.customerName}`);

    return reply(res,
`✅ *Thank you, ${sess.customerName}!*

Your TID *${tid}* has been received and sent to our team for verification. ⏳

You will receive your ticket(s) here on WhatsApp once payment is confirmed.

This usually takes a few minutes during business hours.

_Type "my tickets" to check your ticket status anytime._`
    );
  }

  /* ── WAITING ── */
  if (sess.step === "waiting") {
    if (body.toLowerCase() === "my tickets") {
      const order = orders.find(o => o.id === sess.orderId);
      if (!order) return reply(res, "Could not find your order. Contact support at +256700000000.");
      if (order.status === "approved") {
        return reply(res, `Your payment was approved! Your ticket should have been sent. Check your WhatsApp messages.`);
      }
      return reply(res, `Your payment is still being verified. Please wait a few minutes.\n\nIf you have been waiting more than 30 minutes, contact:\nPhone: +256700000000`);
    }
    return reply(res,
      `Your payment is still being verified. ⏳\n\nType *my tickets* to check status, or contact support at +256700000000 if you have been waiting long.\n\nType *cancel* to start over.`
    );
  }

  /* ── Fallback ── */
  clearSession(from);
  return reply(res,
    `👋 Welcome to *Buzzket*!\n\nReply with:\n1️⃣ Browse Events\n2️⃣ My Tickets\n3️⃣ Help`
  );
});

/* ─── Admin endpoint: approve payment + send ticket ─────────── */
app.post("/admin/approve", async (req, res) => {
  const { orderId } = req.body;
  const order = orders.find(o => o.id === orderId);

  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status === "approved") return res.status(400).json({ error: "Already approved" });

  order.status   = "approved";
  order.ticketId = `BZK-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // Mark session as done
  if (sessions[order.wa]) sessions[order.wa].step = "done";

  try {
    // Send ticket confirmation to customer via WhatsApp
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to:   order.wa,
      body:
`🎟️ *Your Ticket is Ready, ${order.name}!*

━━━━━━━━━━━━━━━━━━
Event:     ${order.eventName}
Date:      ${order.eventDate}
Tier:      ${order.tierName}
Ticket ID: *${order.ticketId}*
━━━━━━━━━━━━━━━━━━

Show this message (or your QR code) at the entrance.

See you there! 🎉

_Powered by Buzzket_`,
    });

    console.log(`[APPROVED] Order ${orderId} → Ticket ${order.ticketId} sent to ${order.wa}`);
    res.json({ success: true, ticketId: order.ticketId });

  } catch (err) {
    console.error("[TWILIO ERROR]", err.message);
    res.status(500).json({ error: "Failed to send WhatsApp message", details: err.message });
  }
});

/* ─── Admin endpoint: reject payment ────────────────────────── */
app.post("/admin/reject", async (req, res) => {
  const { orderId, reason } = req.body;
  const order = orders.find(o => o.id === orderId);

  if (!order) return res.status(404).json({ error: "Order not found" });

  order.status = "rejected";
  order.reason = reason;
  if (sessions[order.wa]) sessions[order.wa].step = "welcome";

  try {
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to:   order.wa,
      body:
`❌ *Payment Not Verified*

We could not verify your payment (TID: ${order.tid}).

Reason: _${reason || "Payment not found in records"}_

Please check your TID and try again, or contact support:
📞 +256700000000
📧 help@buzzket.ug

Type *1* to start a new order.`,
    });

    console.log(`[REJECTED] Order ${orderId} → reason: ${reason}`);
    res.json({ success: true });

  } catch (err) {
    console.error("[TWILIO ERROR]", err.message);
    res.status(500).json({ error: "Failed to send WhatsApp message", details: err.message });
  }
});

/* ─── View all pending orders ────────────────────────────────── */
app.get("/admin/orders", (req, res) => {
  res.json(orders);
});

/* ─── Health check ───────────────────────────────────────────── */
app.get("/", (req, res) => res.json({ status: "Buzzket bot running ✅" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`\n🎟️  Buzzket WhatsApp Bot running on port ${PORT}\n`));
