import { onCall, onRequest, HttpsError } from "firebase-functions/v1/https";
import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { isConfirmedOrder } from "./materials";

/**
 * Admin › Contacts: everyone the shop has a WhatsApp number for, one row per
 * number, built from what already exists — orders, model requests, Notify me,
 * abandoned carts and signed-up users. Nothing is typed in by hand, so the
 * list grows by itself with every order and form.
 *
 * Marketing permission is a separate thing: an order message does not give
 * it (Meta policy, and India's DPDP Act). `optIn` / `optOut` live on
 * contacts/{phone} and are only ever set by the customer's own choice (the
 * opt-in checkbox, a STOP); this function reads them and never invents one.
 */

type Contact = {
  phone: string; name: string; email: string; city: string;
  orders: number; spent: number; lastOrderAt: number; firstSeenAt: number; lastSeenAt: number;
  devices: string[]; sources: string[]; requested: string[]; waitingFor: string[];
  abandonedCart: boolean; optIn: boolean | null; optOut: boolean;
};

const ten = (p: unknown) => {
  const d = String(p || "").replace(/\D/g, "").slice(-10);
  return /^[6-9]\d{9}$/.test(d) ? d : "";
};
const ms = (v: any) => Number(v?.toMillis?.() ?? v) || 0;

export const listContacts = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  const db = admin.firestore();
  const [orders, requests, notify, carts, users, prefs] = await Promise.all([
    db.collection("orders").get(),
    db.collection("modelRequests").get(),
    db.collection("stockNotifications").get(),
    db.collection("abandonedCarts").where("contactKey", ">", "").get(),
    db.collection("users").get(),
    db.collection("contacts").get(),
  ]);

  const map = new Map<string, Contact>();
  const cartAt = new Map<string, number>();
  const get = (phone: string, at: number): Contact => {
    let c = map.get(phone);
    if (!c) {
      c = { phone, name: "", email: "", city: "", orders: 0, spent: 0, lastOrderAt: 0, firstSeenAt: at || Date.now(), lastSeenAt: at,
        devices: [], sources: [], requested: [], waitingFor: [], abandonedCart: false, optIn: null, optOut: false };
      map.set(phone, c);
    }
    if (at) { c.firstSeenAt = Math.min(c.firstSeenAt, at); c.lastSeenAt = Math.max(c.lastSeenAt, at); }
    return c;
  };
  const add = (list: string[], v: unknown) => { const s = String(v || "").trim(); if (s && !list.includes(s)) list.push(s); };

  for (const d of orders.docs) {
    const o = d.data() as any;
    if (o.isDeleted) continue;
    const phone = ten(o.shippingAddress?.phone || o.phone);
    if (!phone) continue;
    const at = ms(o.createdAt);
    const c = get(phone, at);
    add(c.sources, "order");
    // A sale the way the dashboard counts one, so the two never disagree.
    const confirmed = isConfirmedOrder(o) && o.status !== "cancelled" && !o.testOrder && !o.addOnTo && !o.isReplacement;
    if (confirmed) {
      c.orders++;
      c.spent += Number(o.total ?? o.amountPayable) || 0;
      c.lastOrderAt = Math.max(c.lastOrderAt, at);
    }
    // The latest order's name, email and city win.
    if (at >= c.lastSeenAt || !c.name) {
      c.name = String(o.shippingAddress?.fullName || o.customerName || c.name);
      c.city = [o.shippingAddress?.city, o.shippingAddress?.state].filter(Boolean).join(", ") || c.city;
      c.email = String(o.email || o.customerEmail || c.email || "");
    }
    for (const i of Array.isArray(o.items) ? o.items : []) {
      if (i?.phoneModel) add(c.devices, [i.phoneBrand, i.phoneModel].filter(Boolean).join(" "));
    }
  }
  for (const d of requests.docs) {
    const r = d.data() as any;
    const phone = ten(r.whatsappPhone);
    if (!phone) continue;
    const c = get(phone, ms(r.requestedAt || r.createdAt || r._creationTime));
    add(c.sources, "model request");
    add(c.requested, [r.brandName, r.modelName].filter(Boolean).join(" "));
    if (!c.name && r.customerName) c.name = String(r.customerName);
    if (!c.email && r.userEmail) c.email = String(r.userEmail);
  }
  for (const d of notify.docs) {
    const n = d.data() as any;
    const phone = ten(n.phoneNumber);
    if (!phone) continue;
    const c = get(phone, ms(n.createdAt));
    add(c.sources, "notify me");
    if (n.status === "waiting") add(c.waitingFor, n.productTitle);
    if (!c.email && n.userEmail) c.email = String(n.userEmail);
  }
  for (const d of carts.docs) {
    const a = d.data() as any;
    const phone = ten(a.userPhone);
    if (!phone) continue;
    const at = ms(a.abandonedAt || a.createdAt);
    const c = get(phone, at);
    add(c.sources, "cart");
    if (a.status !== "recovered") { c.abandonedCart = true; cartAt.set(phone, Math.max(cartAt.get(phone) || 0, at)); }
    if (!c.name && a.userName) c.name = String(a.userName);
    if (!c.email && a.userEmail) c.email = String(a.userEmail);
  }
  for (const d of users.docs) {
    const u = d.data() as any;
    const phone = ten(u.phone || u.phoneNumber);
    if (!phone) continue;
    const c = get(phone, ms(u.createdAt));
    add(c.sources, "account");
    if (!c.name && (u.name || u.fullName || u.displayName)) c.name = String(u.name || u.fullName || u.displayName);
    if (!c.email && u.email) c.email = String(u.email);
  }
  for (const d of prefs.docs) {
    const p = d.data() as any;
    const c = map.get(d.id);
    if (!c) continue;
    if (typeof p.optIn === "boolean") c.optIn = p.optIn;
    c.optOut = p.optOut === true;
  }
  // Bought since the cart was left: not an abandoner any more.
  for (const c of map.values()) if (c.abandonedCart && c.lastOrderAt >= (cartAt.get(c.phone) || 0)) c.abandonedCart = false;

  const contacts = [...map.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  return { contacts, builtAt: Date.now() };
});

// ── Marketing permission (opt-in / opt-out) ─────────────────────────────────

/*
 * contacts/{phone}: { optIn, optInAt, optInSource, optOut, optOutAt, optOutSource }.
 * Only the customer's own action writes these: the unticked checkbox at
 * checkout, in the model-request form and on Notify me (setWhatsAppOptIn /
 * placeOrder), a STOP reply (whatsappInbound), or an admin recording what the
 * customer asked for on the Contacts page (setContactMarketing).
 */
export async function recordOptIn(phone10: string, source: string) {
  const phone = ten(phone10);
  if (!phone) return;
  await admin.firestore().collection("contacts").doc(phone).set(
    { optIn: true, optInAt: Date.now(), optInSource: source, optOut: false },
    { merge: true },
  );
}

async function recordOptOut(phone10: string, source: string) {
  const phone = ten(phone10);
  if (!phone) return;
  await admin.firestore().collection("contacts").doc(phone).set(
    { optOut: true, optOutAt: Date.now(), optOutSource: source },
    { merge: true },
  );
}

/**
 * Whether a marketing WhatsApp may go to this number. `needOptIn` for
 * promotions nobody asked for (abandoned cart); without it only a STOP blocks
 * (back in stock, which they asked for; a review request about their order).
 */
export async function marketingAllowed(phone10: string, needOptIn: boolean): Promise<boolean> {
  const phone = ten(phone10);
  if (!phone) return false;
  const c = (await admin.firestore().collection("contacts").doc(phone).get()).data() as any;
  if (c?.optOut === true) return false;
  return needOptIn ? c?.optIn === true : true;
}

/*
 * The model-request and Notify-me forms write their own documents (Firestore
 * rules keep those to a fixed set of fields), then call this when the box was
 * ticked. It only accepts a number that filed that form in the last 15
 * minutes, so nobody can sign a stranger's number up for offers.
 */
export const setWhatsAppOptIn = onCall(async (data: any) => {
  const phone = ten(data?.phoneNumber);
  const source = data?.source === "notify_me" ? "notify_me" : data?.source === "model_request" ? "model_request" : "";
  if (!phone || !source) throw new HttpsError("invalid-argument", "phone and source are required");
  const db = admin.firestore();
  const since = Date.now() - 15 * 60 * 1000;
  let found = false;
  if (source === "notify_me") {
    const s = await db.collection("stockNotifications").where("phoneNumber", "==", phone).get();
    // A repeat Notify me keeps its first document, so any waiting one counts.
    found = s.docs.some((d) => ms((d.data() as any).createdAt) >= since || (d.data() as any).status === "waiting");
  } else {
    // whatsappPhone is stored as typed ("+91…", "98…"), so match on the last ten digits.
    const s = await db.collection("modelRequests").orderBy("_creationTime", "desc").limit(50).get();
    found = s.docs.some((d) => {
      const r = d.data() as any;
      return ten(r.whatsappPhone) === phone && ms(r._creationTime || r.requestedAt || r.createdAt) >= since;
    });
  }
  if (!found) throw new HttpsError("failed-precondition", "No recent request from this number");
  await recordOptIn(phone, source);
  return { success: true };
});

/** Admin › Contacts: record what the customer asked for (e.g. "stop sending me offers" on a call). */
export const setContactMarketing = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const phone = ten(data?.phone);
  if (!phone) throw new HttpsError("invalid-argument", "Invalid phone");
  if (data?.optOut === true) await recordOptOut(phone, "admin");
  else if (data?.optIn === true) await recordOptIn(phone, "admin");
  else if (data?.optOut === false) {
    await admin.firestore().collection("contacts").doc(phone).set({ optOut: false, optOutAt: null }, { merge: true });
  }
  return { success: true };
});

const STOP_WORDS = /^\s*(stop|stop promotions|unsubscribe|stop all|band karo|band|no more|opt ?out)\s*[.!]*\s*$/i;

/** Every string in a webhook body, with its key path, so an unknown payload shape still yields the sender and the text. */
function strings(v: any, path = "", out: Array<[string, string]> = []): Array<[string, string]> {
  if (v == null) return out;
  if (typeof v === "string" || typeof v === "number") { out.push([path, String(v)]); return out; }
  if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  else if (typeof v === "object") for (const [k, x] of Object.entries(v)) strings(x, path ? `${path}.${k}` : k, out);
  return out;
}

/*
 * Replies to the business number (Fast2SMS webhook, set in its WhatsApp
 * dashboard to the URL Admin › Contacts shows). A "STOP" — typed, or Meta's
 * "Stop promotions" button — marks the sender opted out. Every payload is
 * kept in whatsappInbound so the shape can be checked; the provider's format
 * was not documented when this was written, hence the tolerant parsing.
 */
export const whatsappInbound = onRequest(async (req, res) => {
  const token = process.env.WHATSAPP_INBOUND_TOKEN || "";
  const given = String(req.query.token || req.get("x-webhook-token") || "");
  if (!token || given.length !== token.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token))) {
    res.status(401).send("unauthorized");
    return;
  }
  const body = typeof req.body === "object" && req.body ? req.body : { raw: String(req.body || "") };
  const all = strings({ ...body, ...req.query, token: undefined });
  const fromKeys = /(^|\.)(from|sender|mobile|phone|wa_id|msisdn|number|contact)$/i;
  const textKeys = /(^|\.)(text|body|message|msg|content|payload|title|button_text|reply)$/i;
  const sender = all.filter(([k]) => fromKeys.test(k)).map(([, v]) => ten(v)).find(Boolean) || "";
  const texts = all.filter(([k]) => textKeys.test(k)).map(([, v]) => v);
  const isStop = texts.some((t) => STOP_WORDS.test(t));
  const db = admin.firestore();
  await db.collection("whatsappInbound").add({
    receivedAt: Date.now(), sender, isStop, body: JSON.stringify(body).slice(0, 5000),
  }).catch((e) => console.error("[whatsappInbound] log failed:", e));
  if (sender && isStop) await recordOptOut(sender, "whatsapp_stop");
  res.status(200).send("ok");
});

/** Admin › Contacts: the URL to paste into the provider's webhook setting. */
export const whatsappInboundUrl = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  const token = process.env.WHATSAPP_INBOUND_TOKEN || "";
  return { url: token ? `https://us-central1-skinly-3003b.cloudfunctions.net/whatsappInbound?token=${token}` : "" };
});
