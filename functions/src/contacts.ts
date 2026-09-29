import { onCall } from "firebase-functions/v1/https";
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
    const confirmed = isConfirmedOrder(o) && o.status !== "cancelled" && !o.testOrder && !o.addOnTo;
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
