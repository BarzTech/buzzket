require("dotenv").config();
const express  = require("express");
const twilio   = require("twilio");
const QRCode   = require("qrcode");
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

/* ── Clients ──────────────────────────────────────────────── */
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL   || "missing",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "missing",
});

const supa = process.env.SUPABASE_URL
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

/* ── Env check ────────────────────────────────────────────── */
const REQUIRED = ["TWILIO_ACCOUNT_SID","TWILIO_AUTH_TOKEN","TWILIO_WHATSAPP_NUMBER",
                  "UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN"];
const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length) console.error("❌ MISSING ENV VARS:", missing.join(", "));
else                console.log("✅ All env vars present.");
if (!supa)          console.warn("⚠️  SUPABASE_URL not set — QR codes will not be generated.");

/* ── Supabase helpers ─────────────────────────────────────── */
const camelToSnake = s => s.replace(/([A-Z])/g, "_$1").toLowerCase();
const toSnake = obj => Object.fromEntries(Object.entries(obj).map(([k,v])=>[camelToSnake(k),v]));

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
async function sbGet(table, col, val) {
  if (!supa) return null;
  const { data } = await supa.from(table).select("*").eq(col, val).single();
  return data;
}

/* ── QR code + Supabase Storage ──────────────────────────── */
async function generateAndUploadQR(ticketId, accentColor = "#F97316") {
  if (!supa) return null;
  try {
    /* Generate QR code PNG buffer, coloured with organiser's accent */
    const qrBuffer = await QRCode.toBuffer(ticketId, {
      width: 400, margin: 2,
      color: { dark: accentColor, light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    });

    /* Upload to Supabase Storage bucket "ticket-qrs" */
    const path = `${ticketId}.png`;
    const { error: uploadErr } = await supa.storage
      .from("ticket-qrs")
      .upload(path, qrBuffer, { contentType: "image/png", upsert: true });

    if (uploadErr) { log("[Storage upload]", uploadErr.message); return null; }

    /* Get public URL */
    const { data: urlData } = supa.storage.from("ticket-qrs").getPublicUrl(path);
    return urlData?.publicUrl || null;
  } catch (err) {
    log("[QR generation]", err.message);
    return null;
  }
}

/* ── Redis session/order helpers (with memory fallback) ───── */
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
  try { await redis.set(`order:${id}`, order); } catch { memOrders.set(id, order); }
  try { await redis.lpush("orders:all", id); }   catch {}
  try { await redis.lpush(`orders:${order.wa}`, id); } catch {}
}
async function orderGet(id) {
  try { return await redis.get(`order:${id}`); } catch { return memOrders.get(id) || null; }
}
async function allOrders() {
  try {
    /* Prefer Supabase for a complete cross-device view */
    if (supa) {
      const { data } = await supa.from("orders").select("*").order("created_at", { ascending:false });
      if (data?.length >= 0) {
        /* Map snake_case back to camelCase */
        return data.map(r => ({
          id:r.id, name:r.name, wa:r.wa,
          eventId:r.event_id, eventName:r.event_name, eventDate:r.event_date,
          tierId:r.tier_id, tierName:r.tier_name,
          qty:r.qty, total:r.total, tid:r.tid,
          status:r.status, reason:r.reason, ticketId:r.ticket_id,
          createdAt:r.created_at,
        }));
      }
    }
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

/* ── Static data ──────────────────────────────────────────── */
const EVENTS = [
  { id:1, name:"Afrobeats Night",     venue:"Kampala Serena Hotel", date:"14 June 2025", time:"8:00 PM",  merchantCode:"KE4521" },
  { id:2, name:"Jazz & Wine Evening", venue:"Garden City Rooftop",  date:"28 June 2025", time:"6:00 PM",  merchantCode:"KE4521" },
  { id:3, name:"Comedy Nite Vol. 5",  venue:"Entebbe Resort",        date:"5 July 2025",  time:"7:00 PM",  merchantCode:"NP7823" },
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
   DEBUG ENDPOINT — visit https://your-app.onrender.com/debug
═══════════════════════════════════════════════════════════ */
app.get("/debug", async (_req, res) => {
  const result = {
    server: "running ✅",
    time: new Date().toISOString(),
    env: {
      TWILIO_ACCOUNT_SID:       process.env.TWILIO_ACCOUNT_SID     ? "✅ set" : "❌ MISSING",
      TWILIO_AUTH_TOKEN:        process.env.TWILIO_AUTH_TOKEN       ? "✅ set" : "❌ MISSING",
      TWILIO_WHATSAPP_NUMBER:   process.env.TWILIO_WHATSAPP_NUMBER  || "❌ MISSING",
      UPSTASH_REDIS_REST_URL:   process.env.UPSTASH_REDIS_REST_URL  ? "✅ set" : "❌ MISSING",
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN? "✅ set" : "❌ MISSING",
      SUPABASE_URL:             process.env.SUPABASE_URL            ? "✅ set" : "❌ MISSING",
      SUPABASE_SERVICE_KEY:     process.env.SUPABASE_SERVICE_KEY    ? "✅ set" : "❌ MISSING",
    },
    redis: "testing...", supabase: "testing...", storage: "testing...",
  };
  try {
    await redis.set("__debug__","ok",{ex:30});
    result.redis = (await redis.get("__debug__")) === "ok" ? "✅ connected" : "❌ read/write mismatch";
  } catch(e) { result.redis = `❌ ${e.message}`; }

  if (supa) {
    try {
      const { error } = await supa.from("orders").select("count").limit(1);
      result.supabase = error ? `❌ ${error.message}` : "✅ connected";
    } catch(e) { result.supabase = `❌ ${e.message}`; }
    try {
      const { data } = await supa.storage.listBuckets();
      const hasBucket = data?.some(b => b.name === "ticket-qrs");
      result.storage = hasBucket ? "✅ ticket-qrs bucket found" : "⚠️ ticket-qrs bucket missing — create it in Supabase Storage";
    } catch(e) { result.storage = `❌ ${e.message}`; }
  } else { result.supabase = "⚠️ not configured"; result.storage = "⚠️ not configured"; }

  try {
    await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    result.twilio = "✅ credentials valid";
  } catch(e) { result.twilio = `❌ ${e.message}`; }

  res.json(result);
});

app.get("/", (_req, res) => res.json({ status:"Buzzket bot ✅", tip:"Visit /debug to check connections" }));

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

    if (body.toLowerCase() === "cancel") { sess.step="welcome"; return reply("Restarted. 👋 Reply with *1* to browse events."); }

    /* ══ WELCOME ══ */
    if (sess.step === "welcome") {
      if (body === "1") {
        sess.step = "event_list";
        const list = EVENTS.map((e,i) => `${i+1}. *${e.name}*\n   📍 ${e.venue}\n   📅 ${e.date}`).join("\n\n");
        return reply(`🎉 *Available Events:*\n\n${list}\n\nReply with a number to select.`);
      }
      if (body.toLowerCase() === "my tickets") {
        try {
          const ids = (await redis.lrange(`orders:${from}`, 0, -1)) || [];
          const confirmed = [];
          for (const id of ids) { const o = await orderGet(id); if (o?.status==="approved") confirmed.push(o); }
          if (!confirmed.length) return reply("You have no confirmed tickets yet.\n\nType *1* to browse events.");
          const list = confirmed.map(o=>`🎟 *${o.eventName}*\nTier: ${o.tierName}\nTickets: ${o.qty}x\nDate: ${o.eventDate}`).join("\n\n");
          return reply(`Your confirmed tickets:\n\n${list}`);
        } catch { return reply("You have no confirmed tickets yet.\n\nType *1* to browse events."); }
      }
      if (body==="3"||body.toLowerCase()==="help") return reply(`📞 *Buzzket Support*\n\nPhone: +256700000000\nEmail: help@buzzket.ug\nHours: Mon–Sun 8am–10pm EAT\n\nType *1* to browse events.`);
      sess.step = "welcome";
      return reply(`👋 Welcome to *Buzzket* — Uganda's ticketing platform!\n\nReply with:\n1️⃣ Browse Events\n2️⃣ My Tickets\n3️⃣ Help\n\n_Type "cancel" anytime to restart._`);
    }

    /* ══ EVENT LIST ══ */
    if (sess.step === "event_list") {
      const ev = EVENTS[parseInt(body)-1];
      if (!ev) return reply("Please reply with a valid number from the list.");
      sess.selectedEvent = ev; sess.step = "tier_select";
      const evTiers = TIERS.filter(t=>t.eventId===ev.id);
      const tierList = evTiers.map((t,i)=>`${i+1}. *${t.name}* — ${fmt(t.price)}\n   (${t.total-t.sold} remaining)`).join("\n\n");
      return reply(`🎵 *${ev.name}*\n📍 ${ev.venue}\n📅 ${ev.date} at ${ev.time}\n\n*Ticket Types:*\n\n${tierList}\n\nReply with a number.`);
    }

    /* ══ TIER SELECT ══ */
    if (sess.step === "tier_select") {
      const evTiers = TIERS.filter(t=>t.eventId===sess.selectedEvent.id);
      const tier = evTiers[parseInt(body)-1];
      if (!tier) return reply("Please reply with a valid number.");
      if (tier.sold>=tier.total) return reply(`Sorry, *${tier.name}* is sold out. Please choose another option.`);
      sess.selectedTier = tier; sess.step = "qty";
      return reply(`How many *${tier.name}* tickets do you need?\n\nReply with a number (max 5).`);
    }

    /* ══ QUANTITY ══ */
    if (sess.step === "qty") {
      const n = parseInt(body);
      if (!n||n<1||n>5) return reply("Please enter a number between 1 and 5.");
      if (n>sess.selectedTier.total-sess.selectedTier.sold) return reply(`Only ${sess.selectedTier.total-sess.selectedTier.sold} tickets available.`);
      sess.qty = n; sess.step = "name";
      return reply("Please provide your *full name* as it should appear on the ticket(s).");
    }

    /* ══ NAME ══ */
    if (sess.step === "name") {
      if (body.length<3) return reply("Please enter your full name (at least 3 characters).");
      sess.customerName = body; sess.step = "payment";
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
Dial *165*3# → Pay Bill → Merchant Code: *${sess.selectedEvent.merchantCode}* → Amount: *${total}* → Confirm PIN

*Airtel Money:*
Dial *185*9# → Make Payment → Merchant Code: *${sess.selectedEvent.merchantCode}* → Amount: *${total}* → Confirm

⚠️ After paying, reply here with the *Transaction ID (TID)* from your Mobile Money SMS.`
      );
    }

    /* ══ TID SUBMISSION ══ */
    if (sess.step === "payment") {
      const tid = body.toUpperCase();
      if (!tid.startsWith("TID")) return reply(`Please reply with your *Transaction ID* from your Mobile Money SMS.\n\nIt starts with "TID", e.g. *TID8473625910*`);
      if (await tidExists(tid)) return reply(`⚠️ This TID has already been submitted.\n\nContact support if this is an error:\n📞 +256700000000`);

      const id = newOrdId();
      const order = {
        id, wa:from, name:sess.customerName,
        eventId:sess.selectedEvent.id, eventName:sess.selectedEvent.name, eventDate:sess.selectedEvent.date,
        tierId:sess.selectedTier.id, tierName:sess.selectedTier.name,
        qty:sess.qty, total:sess.selectedTier.price*sess.qty,
        tid, status:"pending", createdAt:new Date().toISOString(),
      };

      await orderSet(id, order);
      await tidSet(tid, id);
      await sbInsert("orders", order);

      sess.orderId=id; sess.step="waiting";
      log(`NEW ORDER id=${id} tid=${tid} name=${sess.customerName} qty=${sess.qty}`);
      return reply(`✅ *Thank you, ${sess.customerName}!*\n\nYour TID *${tid}* has been received and sent for verification. ⏳\n\nYou will receive your ticket(s) here on WhatsApp once payment is confirmed.\n\n_Type "my tickets" to check your status anytime._`);
    }

    /* ══ WAITING ══ */
    if (sess.step === "waiting") {
      if (body.toLowerCase()==="my tickets") {
        const o = sess.orderId ? await orderGet(sess.orderId) : null;
        if (!o) return reply("Could not find your order. Contact support at +256700000000.");
        if (o.status==="approved") return reply(`✅ Payment approved!\n\nCheck your messages above for your ticket(s) with QR codes.`);
        return reply(`Your payment is still being verified. ⏳\n\nWaiting more than 30 min? Contact:\n📞 +256700000000`);
      }
      return reply(`Your payment is being verified. ⏳\n\nType *my tickets* to check status.\nType *cancel* to start a new order.`);
    }

    /* Fallback */
    sess.step="welcome";
    return reply(`👋 Welcome to *Buzzket*!\n\nReply with:\n1️⃣ Browse Events\n2️⃣ My Tickets\n3️⃣ Help`);

  } catch(err) {
    log("❌ UNHANDLED ERROR /whatsapp:", err.message, err.stack);
    try { twimlReply(res,"Sorry, we're experiencing a technical issue. Please try again or contact support at +256700000000."); }
    catch(e2) { res.status(500).end(); }
  }
});

/* ═══════════════════════════════════════════════════════════
   ADMIN: GET ALL ORDERS
═══════════════════════════════════════════════════════════ */
app.get("/admin/orders", async (_req, res) => {
  try { res.json({ orders: await allOrders() }); }
  catch(err) { res.status(500).json({ error:err.message }); }
});

/* ═══════════════════════════════════════════════════════════
   ADMIN: APPROVE — generates one ticket per qty, sends QR
═══════════════════════════════════════════════════════════ */
app.post("/admin/approve", async (req, res) => {
  try {
    const { orderId:id } = req.body;
    if (!id) return res.status(400).json({ error:"orderId required" });

    const order = await orderGet(id);
    if (!order)                      return res.status(404).json({ error:"Order not found" });
    if (order.status==="approved")   return res.status(400).json({ error:"Already approved" });

    /* Fetch organiser's ticket template for this event */
    let accentColor = "#F97316"; // default orange
    if (supa) {
      const tplRow = await sbGet("templates","event_id",order.eventId);
      if (tplRow?.accent) accentColor = tplRow.accent;
    }

    /* Generate ONE unique ticket per qty purchased */
    const ticketIds = Array.from({ length: order.qty }, () => newTktId());
    const primaryTicketId = ticketIds[0]; // used for order record

    order.status     = "approved";
    order.ticketId   = ticketIds.join(","); // store all IDs comma-separated
    order.approvedAt = new Date().toISOString();

    await orderSet(id, order);
    await sessSet(order.wa, { step:"welcome" });
    await sbUpdate("orders", id, { status:"approved", ticketId:order.ticketId, approvedAt:order.approvedAt });

    /* Insert each ticket into Supabase (real-time updates scanner on all devices) */
    for (const tktId of ticketIds) {
      await sbInsert("tickets", {
        id:tktId, orderId:id, name:order.name,
        eventId:order.eventId, tierId:order.tierId, tierName:order.tierName,
        used:false,
      });
    }

    /* Generate QR codes and send one WhatsApp message per ticket */
    const sentTickets = [];
    for (let i = 0; i < ticketIds.length; i++) {
      const tktId = ticketIds[i];

      /* Generate QR code PNG in organiser's accent colour */
      const qrUrl = await generateAndUploadQR(tktId, accentColor);

      const msgBody =
`🎟️ *Ticket ${i+1} of ${order.qty} — ${order.name}*
━━━━━━━━━━━━━━━━━━
🎵 *${order.eventName}*
📍 ${order.eventDate}
🏷️  Tier: *${order.tierName}*
🔢 Ticket ID: *${tktId}*
━━━━━━━━━━━━━━━━━━
${qrUrl ? "Scan the QR code image above at the entrance." : "Show this Ticket ID at the entrance."}

_Powered by Buzzket_`;

      const msgOptions = {
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to:   order.wa,
        body: msgBody,
      };
      if (qrUrl) msgOptions.mediaUrl = [qrUrl];

      await client.messages.create(msgOptions);
      sentTickets.push(tktId);
      log(`TICKET SENT ${tktId} (${i+1}/${order.qty}) → ${order.wa}`);
    }

    log(`APPROVED order=${id} tickets=[${ticketIds.join(",")}]`);
    res.json({ success:true, ticketIds });

  } catch(err) {
    log("ERROR /admin/approve:", err.message);
    res.status(500).json({ error:err.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   ADMIN: REJECT
═══════════════════════════════════════════════════════════ */
app.post("/admin/reject", async (req, res) => {
  try {
    const { orderId:id, reason } = req.body;
    if (!id) return res.status(400).json({ error:"orderId required" });

    const order = await orderGet(id);
    if (!order) return res.status(404).json({ error:"Order not found" });

    order.status="rejected"; order.reason=reason||"Payment not verified"; order.rejectedAt=new Date().toISOString();
    await orderSet(id, order);
    await tidDel(order.tid);
    await sessSet(order.wa, { step:"welcome" });
    await sbUpdate("orders", id, { status:"rejected", reason:order.reason, rejectedAt:order.rejectedAt });

    await client.messages.create({
      from:`whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to:order.wa,
      body:`❌ *Payment Not Verified*\n\nWe could not verify your payment (TID: ${order.tid}).\n\nReason: _${order.reason}_\n\nPlease check your TID and try again, or contact support:\n📞 +256700000000\n📧 help@buzzket.ug\n\nType *1* to start a new order.`,
    });

    log(`REJECTED order=${id} reason="${order.reason}"`);
    res.json({ success:true });
  } catch(err) {
    log("ERROR /admin/reject:", err.message);
    res.status(500).json({ error:err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => log(`🎟️  Buzzket bot running on port ${PORT}`));
