require("dotenv").config();
const express = require("express");
const twilio  = require("twilio");
const { Redis } = require("@upstash/redis");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

/* ── Supabase (primary DB — all devices see changes instantly) ── */
const supa = process.env.SUPABASE_URL
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

const camelToSnake = s => s.replace(/([A-Z])/g, "_$1").toLowerCase();
const toSnake = obj => obj
  ? Object.fromEntries(Object.entries(obj).map(([k,v])=>[camelToSnake(k),v]))
  : obj;

async function sbInsert(table, row) {
  if (!supa) return;
  const { error } = await supa.from(table).insert(toSnake(row));
  if (error) log(`[Supabase insert ${table}]`, error.message);
}
async function sbUpdate(table, id, updates) {
  if (!supa) return;
  const { error } = await supa.from(table).update(toSnake(updates)).eq("id", id);
  if (error) log(`[Supabase update ${table}]`, error.message);
}

/* ── Check required env vars on startup ── */
const REQUIRED = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_NUMBER",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];
const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error("❌ MISSING ENVIRONMENT VARIABLES:", missing.join(", "));
  console.error("   Add these in your Render dashboard → Environment tab.");
} else {
  console.log("✅ All environment variables present.");
}

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL   || "missing",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "missing",
});

/* ── In-memory fallback when Redis is unavailable ──
   Sessions survive until Render restarts (~every few hours on free plan).
   Good enough for demos; upgrade to paid Redis for production. */
const memSessions = new Map();
const memOrders   = new Map();
const memTids     = new Set();

async function sessGet(from) {
  try { return (await redis.get(`sess:${from}`)) || { step:"welcome" }; }
  catch { return memSessions.get(from) || { step:"welcome" }; }
}
async function sessSet(from, sess) {
  try { await redis.set(`sess:${from}`, sess, { ex:86400 }); }
  catch { memSessions.set(from, sess); }
}
async function orderSet(id, order) {
  try { await redis.set(`order:${id}`, order); } catch { memOrders.set(id,order); }
  try { await redis.lpush("orders:all", id); }   catch { /* ignored */ }
  try { await redis.lpush(`orders:${order.wa}`, id); } catch { /* ignored */ }
}
async function orderGet(id) {
  try { return await redis.get(`order:${id}`); } catch { return memOrders.get(id)||null; }
}
async function allOrders() {
  try {
    const ids = (await redis.lrange("orders:all", 0, -1)) || [];
    return (await Promise.all(ids.map(id => redis.get(`order:${id}`)))).filter(Boolean);
  } catch {
    return [...memOrders.values()];
  }
}
async function tidExists(tid) {
  try { return !!(await redis.get(`tid:${tid}`)); } catch { return memTids.has(tid); }
}
async function tidSet(tid, orderId) {
  try { await redis.set(`tid:${tid}`, orderId, { ex:604800 }); } catch { memTids.add(tid); }
}
async function tidDel(tid) {
  try { await redis.del(`tid:${tid}`); } catch { memTids.delete(tid); }
}

/* ── Data ── */
const EVENTS = [
  { id:1, name:"Afrobeats Night",     venue:"Kampala Serena Hotel", date:"14 June 2025", time:"8:00 PM",  merchant:"KE4521" },
  { id:2, name:"Jazz & Wine Evening", venue:"Garden City Rooftop",  date:"28 June 2025", time:"6:00 PM",  merchant:"KE4521" },
  { id:3, name:"Comedy Nite Vol. 5",  venue:"Entebbe Resort",        date:"5 July 2025",  time:"7:00 PM",  merchant:"NP7823" },
];
const TIERS = [
  { id:1, eventId:1, name:"VIP",     price:80000,  total:100, sold:45  },
  { id:2, eventId:1, name:"Regular", price:30000,  total:400, sold:178 },
  { id:3, eventId:2, name:"VIP",     price:120000, total:50,  sold:22  },
  { id:4, eventId:2, name:"Regular", price:50000,  total:150, sold:67  },
  { id:5, eventId:3, name:"VIP",     price:60000,  total:80,  sold:33  },
  { id:6, eventId:3, name:"Regular", price:25000,  total:270, sold:121 },
];

const fmt      = n  => `UGX ${Number(n).toLocaleString()}`;
const newOrdId = () => `ORD-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const newTktId = () => `BZK-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
const log      = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);

function twimlReply(res, text) {
  const r = new twilio.twiml.MessagingResponse();
  r.message(text);
  res.type("text/xml").send(r.toString());
}

/* ═══════════════════════════════════════════════════════════
   DEBUG ENDPOINT — visit in browser to diagnose issues
   e.g. https://your-app.onrender.com/debug
═══════════════════════════════════════════════════════════ */
app.get("/debug", async (_req, res) => {
  const result = {
    server: "running ✅",
    time: new Date().toISOString(),
    env: {
      TWILIO_ACCOUNT_SID:       process.env.TWILIO_ACCOUNT_SID    ? "✅ set" : "❌ MISSING",
      TWILIO_AUTH_TOKEN:        process.env.TWILIO_AUTH_TOKEN      ? "✅ set" : "❌ MISSING",
      TWILIO_WHATSAPP_NUMBER:   process.env.TWILIO_WHATSAPP_NUMBER || "❌ MISSING",
      UPSTASH_REDIS_REST_URL:   process.env.UPSTASH_REDIS_REST_URL   ? "✅ set" : "❌ MISSING",
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? "✅ set" : "❌ MISSING",
    },
    redis: "testing...",
    twilio: "not tested",
  };

  /* Test Redis */
  try {
    await redis.set("__debug__", "ok", { ex: 30 });
    const v = await redis.get("__debug__");
    result.redis = v === "ok" ? "✅ connected" : `❌ read/write mismatch (got: ${v})`;
  } catch (err) {
    result.redis = `❌ FAILED — ${err.message}`;
    result.redis_fix = "Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Render → Environment";
  }

  /* Test Twilio (just validate credentials, don't send) */
  try {
    await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    result.twilio = "✅ credentials valid";
  } catch (err) {
    result.twilio = `❌ FAILED — ${err.message}`;
    result.twilio_fix = "Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Render → Environment";
  }

  res.json(result);
});

/* ═══════════════════════════════════════════════════════════
   HEALTH CHECK
═══════════════════════════════════════════════════════════ */
app.get("/", (_req, res) => {
  res.json({ status:"Buzzket bot running ✅", tip:"Visit /debug to check all connections" });
});

/* ═══════════════════════════════════════════════════════════
   WHATSAPP WEBHOOK
═══════════════════════════════════════════════════════════ */
app.post("/whatsapp", async (req, res) => {
  try {
    const from = (req.body.From || "").trim();
    const body = (req.body.Body || "").trim();
    if (!from) return res.status(400).end("Missing From");

    log(`MSG from=${from} body="${body}"`);

    const sess = await sessGet(from);
    log(`SESSION step=${sess.step}`);

    const reply = async (text) => {
      await sessSet(from, sess);
      twimlReply(res, text);
    };

    /* Cancel */
    if (body.toLowerCase() === "cancel") {
      sess.step = "welcome";
      return reply("Restarted. 👋 Reply with *1* to browse events.");
    }

    /* ══ WELCOME ══ */
    if (sess.step === "welcome") {
      if (body === "1") {
        sess.step = "event_list";
        const list = EVENTS
          .map((e,i) => `${i+1}. *${e.name}*\n   📍 ${e.venue}\n   📅 ${e.date}`)
          .join("\n\n");
        return reply(`🎉 *Available Events:*\n\n${list}\n\nReply with a number to select.`);
      }
      if (body.toLowerCase() === "my tickets") {
        try {
          const ids = (await redis.lrange(`orders:${from}`, 0, -1)) || [];
          const confirmed = [];
          for (const id of ids) {
            const o = await orderGet(id);
            if (o?.status === "approved") confirmed.push(o);
          }
          if (!confirmed.length) return reply("You have no confirmed tickets yet.\n\nType *1* to browse events.");
          const list = confirmed.map(o =>
            `🎟 *${o.eventName}*\nTier: ${o.tierName}\nTicket ID: *${o.ticketId}*\nDate: ${o.eventDate}`
          ).join("\n\n");
          return reply(`Your confirmed tickets:\n\n${list}`);
        } catch { return reply("You have no confirmed tickets yet.\n\nType *1* to browse events."); }
      }
      if (body === "3" || body.toLowerCase() === "help") {
        return reply(`📞 *Buzzket Support*\n\nPhone: +256700000000\nEmail: help@buzzket.ug\nHours: Mon–Sun, 8am–10pm EAT\n\nType *1* to browse events.`);
      }
      sess.step = "welcome";
      return reply(
        `👋 Welcome to *Buzzket* — Uganda's ticketing platform!\n\nReply with:\n1️⃣ Browse Events\n2️⃣ My Tickets\n3️⃣ Help\n\n_Type "cancel" anytime to restart._`
      );
    }

    /* ══ EVENT LIST ══ */
    if (sess.step === "event_list") {
      const ev = EVENTS[parseInt(body) - 1];
      if (!ev) return reply("Please reply with a valid number from the list.");
      sess.selectedEvent = ev;
      sess.step = "tier_select";
      const evTiers = TIERS.filter(t => t.eventId === ev.id);
      const tierList = evTiers
        .map((t,i) => `${i+1}. *${t.name}* — ${fmt(t.price)}\n   (${t.total - t.sold} remaining)`)
        .join("\n\n");
      return reply(
        `🎵 *${ev.name}*\n📍 ${ev.venue}\n📅 ${ev.date} at ${ev.time}\n\n*Ticket Types:*\n\n${tierList}\n\nReply with a number.`
      );
    }

    /* ══ TIER SELECT ══ */
    if (sess.step === "tier_select") {
      const evTiers = TIERS.filter(t => t.eventId === sess.selectedEvent.id);
      const tier = evTiers[parseInt(body) - 1];
      if (!tier) return reply("Please reply with a valid number from the list.");
      if (tier.sold >= tier.total) return reply(`Sorry, *${tier.name}* is sold out. Please choose another option.`);
      sess.selectedTier = tier;
      sess.step = "qty";
      return reply(`How many *${tier.name}* tickets do you need?\n\nReply with a number (max 5).`);
    }

    /* ══ QUANTITY ══ */
    if (sess.step === "qty") {
      const n = parseInt(body);
      if (!n || n < 1 || n > 5) return reply("Please enter a number between 1 and 5.");
      if (n > sess.selectedTier.total - sess.selectedTier.sold)
        return reply(`Only ${sess.selectedTier.total - sess.selectedTier.sold} tickets available.`);
      sess.qty  = n;
      sess.step = "name";
      return reply("Please provide your *full name* as it should appear on the ticket(s).");
    }

    /* ══ NAME ══ */
    if (sess.step === "name") {
      if (body.length < 3) return reply("Please enter your full name (at least 3 characters).");
      sess.customerName = body;
      sess.step = "payment";
      const total = sess.selectedTier.price * sess.qty;
      return reply(
`✅ *Order Summary*
━━━━━━━━━━━━━━━━━━
Event: ${sess.selectedEvent.name}
Tier:  ${sess.selectedTier.name} × ${sess.qty}
Total: *${fmt(total)}*
━━━━━━━━━━━━━━━━━━

💳 *How to Pay*

*MTN Mobile Money:*
1. Dial *165*3#
2. Select "Pay Bill / Merchant"
3. Merchant Code: *${sess.selectedEvent.merchant}*
4. Amount: *${total}*
5. Confirm with your PIN

*Airtel Money:*
1. Dial *185*9#
2. Select "Make Payment"
3. Merchant Code: *${sess.selectedEvent.merchant}*
4. Amount: *${total}*
5. Confirm

⚠️ After paying, reply here with the *Transaction ID (TID)* from your Mobile Money SMS.`
      );
    }

    /* ══ TID SUBMISSION ══ */
    if (sess.step === "payment") {
      const tid = body.toUpperCase();
      if (!tid.startsWith("TID"))
        return reply(`Please reply with your *Transaction ID* from your Mobile Money SMS.\n\nIt starts with "TID", e.g. *TID8473625910*`);

      if (await tidExists(tid))
        return reply(`⚠️ This TID has already been submitted.\n\nContact support if this is an error:\n📞 +256700000000`);

      const id = newOrdId();
      const order = {
        id, wa: from,
        name:      sess.customerName,
        eventId:   sess.selectedEvent.id,
        eventName: sess.selectedEvent.name,
        eventDate: sess.selectedEvent.date,
        tierId:    sess.selectedTier.id,
        tierName:  sess.selectedTier.name,
        qty:       sess.qty,
        total:     sess.selectedTier.price * sess.qty,
        tid, status: "pending",
        createdAt: new Date().toISOString(),
      };

      await orderSet(id, order);
      await tidSet(tid, id);
      /* Write to Supabase — appears instantly on admin dashboard */
      await sbInsert("orders", order);
      sess.orderId = id;
      sess.step    = "waiting";

      log(`NEW ORDER id=${id} tid=${tid} name=${sess.customerName}`);
      return reply(
`✅ *Thank you, ${sess.customerName}!*

Your TID *${tid}* has been received and sent for verification. ⏳

You will receive your ticket(s) here on WhatsApp once payment is confirmed.

_Type "my tickets" to check your status anytime._`
      );
    }

    /* ══ WAITING ══ */
    if (sess.step === "waiting") {
      if (body.toLowerCase() === "my tickets") {
        const o = sess.orderId ? await orderGet(sess.orderId) : null;
        if (!o) return reply("Could not find your order. Contact support at +256700000000.");
        if (o.status === "approved")
          return reply(`✅ Payment approved!\nTicket ID: *${o.ticketId}*\n\nCheck your messages above for your full ticket.`);
        return reply(`Your payment is still being verified. ⏳\n\nWaiting more than 30 min? Contact:\n📞 +256700000000`);
      }
      return reply(`Your payment is being verified. ⏳\n\nType *my tickets* to check status.\nType *cancel* to start a new order.`);
    }

    /* Fallback */
    sess.step = "welcome";
    return reply(`👋 Welcome to *Buzzket*!\n\nReply with:\n1️⃣ Browse Events\n2️⃣ My Tickets\n3️⃣ Help`);

  } catch (err) {
    /* Log the REAL error so you can see it in Render logs */
    log("❌ UNHANDLED ERROR in /whatsapp:", err.message);
    log("Stack:", err.stack);
    try {
      twimlReply(res, "Sorry, we're experiencing a technical issue. Please try again in a moment or contact support at +256700000000.");
    } catch (e2) { res.status(500).end(); }
  }
});

/* ═══════════════════════════════════════════════════════════
   ADMIN ENDPOINTS
═══════════════════════════════════════════════════════════ */
app.get("/admin/orders", async (_req, res) => {
  try { res.json({ orders: await allOrders() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/admin/approve", async (req, res) => {
  try {
    const { orderId: id } = req.body;
    if (!id) return res.status(400).json({ error: "orderId required" });
    const order = await orderGet(id);
    if (!order)                      return res.status(404).json({ error: "Order not found" });
    if (order.status === "approved") return res.status(400).json({ error: "Already approved" });

    const tkt = newTktId();
    order.status = "approved"; order.ticketId = tkt; order.approvedAt = new Date().toISOString();
    await orderSet(id, order);
    await sessSet(order.wa, { step:"welcome" });
    /* Sync to Supabase */
    await sbUpdate("orders", id, { status:"approved", ticketId:tkt, approvedAt:order.approvedAt });
    await sbInsert("tickets", { id:tkt, orderId:id, name:order.name,
      eventId:order.eventId, tierId:order.tierId, tierName:order.tierName, used:false });

    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to:   order.wa,
      body:
`🎟️ *Your Ticket is Ready, ${order.name}!*

━━━━━━━━━━━━━━━━━━
🎵 ${order.eventName}
📅 ${order.eventDate}
🏷️  Tier: *${order.tierName}*
🔢 Ticket ID: *${tkt}*
━━━━━━━━━━━━━━━━━━

Show this message at the entrance on the day of the event.

Enjoy the show! 🎉 — Buzzket`,
    });
    log(`APPROVED ${id} → ${tkt}`);
    res.json({ success: true, ticketId: tkt });
  } catch (err) { log("ERROR /admin/approve:", err.message); res.status(500).json({ error: err.message }); }
});

app.post("/admin/reject", async (req, res) => {
  try {
    const { orderId: id, reason } = req.body;
    if (!id) return res.status(400).json({ error: "orderId required" });
    const order = await orderGet(id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = "rejected"; order.reason = reason || "Payment not verified"; order.rejectedAt = new Date().toISOString();
    await orderSet(id, order);
    await tidDel(order.tid);
    await sessSet(order.wa, { step:"welcome" });
    /* Sync to Supabase */
    await sbUpdate("orders", id, { status:"rejected", reason:order.reason, rejectedAt:order.rejectedAt });

    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to:   order.wa,
      body: `❌ *Payment Not Verified*\n\nWe could not verify your payment (TID: ${order.tid}).\n\nReason: _${order.reason}_\n\nPlease check your TID and try again, or contact support:\n📞 +256700000000\n📧 help@buzzket.ug\n\nType *1* to start a new order.`,
    });
    log(`REJECTED ${id}`);
    res.json({ success: true });
  } catch (err) { log("ERROR /admin/reject:", err.message); res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => log(`🎟️  Buzzket bot running on port ${PORT}`));
