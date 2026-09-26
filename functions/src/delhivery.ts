import * as functionsV1 from "firebase-functions/v1";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";
import { setOrderStatus, type OrderStatus } from "./orderStatus";
import { buildOrderPayload, orderMoney } from "./rapidshyp";
import {
  dlv, delhiverySettings, dlvClean, dlvTime, delhiveryLabelLink, DELHIVERY_TRACK_URL,
} from "./delhiveryApi";

/**
 * Shipping an order with Delhivery directly (see delhiveryApi.ts for why).
 *
 * The parcel is described once, by buildOrderPayload — the same weight, lines
 * and money RapidShyp would be sent — and written the way Delhivery wants it.
 * Once shipped, the order is exactly like a RapidShyp one: awbNumber,
 * trackingUrl, shippingStatus and a status moved through setOrderStatus, so
 * notifications, stock, refunds and referral payouts do not know the
 * difference. `shippingProvider: "delhivery"` is what tells cancel, labels and
 * tracking which courier to ask.
 */

const IST_OFFSET = 5.5 * 3600 * 1000;
const istDate = (t: number) => new Date(t + IST_OFFSET).toISOString().slice(0, 10);

/** Whether Delhivery delivers to a pincode, and takes COD there. */
async function serviceability(pin: string) {
  const r = await dlv(`/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(pin)}`);
  const pc = r.data?.delivery_codes?.[0]?.postal_code;
  if (!pc) return { serviceable: false, cod: false, prepaid: false, note: r.status === 401 ? "Delhivery rejected the API token" : "Delhivery does not deliver to this pincode" };
  const embargo = String(pc.remarks || "").trim();
  return {
    serviceable: !embargo && (pc.pre_paid === "Y" || pc.cod === "Y"),
    cod: pc.cod === "Y" && !embargo,
    prepaid: pc.pre_paid === "Y" && !embargo,
    note: embargo ? `Embargo: ${embargo}` : "",
  };
}

/** Delhivery's own estimate of the charge (its Invoice API; approximate by its own account). */
async function estimate(originPin: string, pin: string, grams: number, cod: boolean, codValue: number, mode: string) {
  if (!originPin) return null;
  const q = new URLSearchParams({
    md: mode === "Express" ? "E" : "S", ss: "Delivered", o_pin: originPin, d_pin: pin,
    cgm: String(Math.max(1, Math.round(grams))), pt: cod ? "COD" : "Pre-paid", ...(cod ? { cod: String(codValue) } : {}),
  });
  const r = await dlv(`/api/kinko/v1/invoice/charges/.json?${q}`);
  const row = Array.isArray(r.data) ? r.data[0] : r.data;
  const total = Number(row?.total_amount);
  return Number.isFinite(total) && total > 0 ? Math.round(total * 100) / 100 : null;
}

/** Rate and serviceability for one order, for the admin's order page. */
export const delhiveryQuote = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");
  const db = admin.firestore();
  const { order, payload } = await buildOrderPayload(orderId);
  const cfg = await delhiverySettings(db);
  const pin = String(order.shippingAddress?.pincode || "").replace(/\D/g, "");
  const isCod = payload.paymentMethod === "COD";
  const grams = Number((payload.packageDetails as any)?.packageWeight) || 100;
  const [svc, charge] = await Promise.all([
    serviceability(pin),
    estimate(cfg.originPin, pin, grams, isCod, Number(payload.codValue) || 0, cfg.mode).catch(() => null),
  ]);
  return {
    ...svc,
    codNeeded: isCod,
    charge,
    grams,
    mode: cfg.mode,
    pickup: cfg.pickup,
    missing: [!cfg.pickup && "pickup location name", !cfg.originPin && "warehouse pincode", !cfg.gstin && "GSTIN"].filter(Boolean),
  };
});

/**
 * Asks Delhivery to collect today's parcels, once a day.
 *
 * Delhivery allows one open pickup per warehouse until it is done, so this
 * books one per IST day (for the afternoon, or tomorrow when the morning has
 * gone) and remembers it, rather than asking again with every shipment.
 * Failing here never fails the shipment: pickups can be booked in the panel.
 */
async function ensurePickup(db: admin.firestore.Firestore, location: string): Promise<string> {
  const now = Date.now();
  const hourIst = new Date(now + IST_OFFSET).getUTCHours();
  const date = istDate(hourIst < 12 ? now : now + 24 * 3600 * 1000);
  const ref = db.collection("settings").doc("delhiveryPickup");
  const seen = await ref.get();
  if (seen.exists && seen.data()?.date === date && seen.data()?.location === location) {
    return `Pickup already requested for ${date}`;
  }
  const waiting = await db.collection("orders").where("shippingProvider", "==", "delhivery").where("status", "==", "ready_to_ship").get();
  const r = await dlv("/fm/request/new/", {
    json: { pickup_time: "14:00:00", pickup_date: date, pickup_location: location, expected_package_count: Math.max(1, waiting.size) },
  });
  if (r.data?.pickup_id) {
    await ref.set({ date, location, pickupId: r.data.pickup_id, requestedAt: now });
    return `Pickup requested for ${date}, 2 pm (ID ${r.data.pickup_id})`;
  }
  const why = r.data ? JSON.stringify(r.data).slice(0, 200) : r.text.slice(0, 200);
  console.warn("Delhivery pickup not booked", { date, status: r.status, why });
  return `Pickup not booked automatically (${why}) — book it in the Delhivery panel if none is scheduled`;
}

export const createDelhiveryShipment = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  await enforceDailyRateLimit({ key: `createDelhiveryShipment_${uid}`, limit: Number(process.env.DELHIVERY_DAILY_LIMIT || 200) });
  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");

  const db = admin.firestore();
  const { orderRef, order, orderDoc, payload } = await buildOrderPayload(orderId);
  if (order.awbNumber) throw new HttpsError("already-exists", `Shipment already created (AWB ${order.awbNumber})`);
  const cfg = await delhiverySettings(db);
  if (!cfg.pickup) throw new HttpsError("failed-precondition", "Set the Delhivery pickup location name in Admin → Shipping first.");

  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const money = orderMoney(order, items);
  const a = order.shippingAddress || {};
  const isCod = payload.paymentMethod === "COD";
  const lines = (payload.orderItems as any[]) || [];
  const pkg = (payload.packageDetails as any) || {};
  const orderNumber = String(order.orderNumber || orderDoc.id);

  const shipment: Record<string, unknown> = {
    name: dlvClean(a.fullName || order.customerName) || "Customer",
    add: dlvClean([a.addressLine1, a.addressLine2].filter(Boolean).join(", ")),
    pin: String(a.pincode || "").replace(/\D/g, ""),
    city: dlvClean(a.city),
    state: dlvClean(a.state),
    country: "India",
    phone: String(a.phone || "").replace(/\D/g, "").slice(-10),
    order: dlvClean(orderNumber),
    payment_mode: isCod ? "COD" : "Prepaid",
    cod_amount: isCod ? Number(payload.codValue) || money.total : 0,
    total_amount: money.total,
    products_desc: dlvClean(lines.map((l) => `${l.itemName} x${l.units}`).join(", ")).slice(0, 250) || "Device skin",
    hsn_code: "39269099",
    quantity: lines.reduce((n, l) => n + (Number(l.units) || 1), 0) || 1,
    weight: Number(pkg.packageWeight) || 100,
    shipment_length: Number(pkg.packageLength) || 10,
    shipment_width: Number(pkg.packageBreadth) || 10,
    shipment_height: Number(pkg.packageHeight) || 2,
    shipping_mode: cfg.mode,
    seller_name: dlvClean(cfg.sellerName),
    ...(cfg.gstin ? { seller_gst_tin: cfg.gstin } : {}),
  };
  const body = { shipments: [shipment], pickup_location: { name: cfg.pickup } };
  console.log("Delhivery create", { order: orderNumber, shipment: { ...shipment, phone: "…", add: "…", name: "…" } });

  const r = await dlv("/api/cmu/create.json", { method: "POST", body: `format=json&data=${JSON.stringify(body)}` });
  const pack = r.data?.packages?.[0];
  if (!r.data?.success || !pack?.waybill || String(pack?.status || "").toLowerCase() !== "success") {
    const remarks = [...(Array.isArray(pack?.remarks) ? pack.remarks : [pack?.remarks]), r.data?.rmk, r.data?.error]
      .filter((x) => x && String(x).trim()).join("; ") || r.text.slice(0, 300) || `HTTP ${r.status}`;
    console.error("Delhivery create refused", { order: orderNumber, status: r.status, body: r.text.slice(0, 800) });
    throw new HttpsError(
      "failed-precondition",
      /warehouse|pickup/i.test(remarks)
        ? `${remarks}. We sent pickup location "${cfg.pickup}" — copy the warehouse name exactly from the Delhivery panel into Admin → Shipping.`
        : remarks
    );
  }

  const awbNumber = String(pack.waybill);
  const labelUrl = await delhiveryLabelLink(awbNumber).catch(() => null);
  await orderRef.update({
    awbNumber,
    trackingUrl: DELHIVERY_TRACK_URL(awbNumber),
    shippingStatus: "Manifested",
    shippingProvider: "delhivery",
    courierName: "Delhivery",
    ...(labelUrl ? { labelUrl } : {}),
    ...(pack.sort_code ? { delhiverySortCode: String(pack.sort_code) } : {}),
    updatedAt: Date.now(),
  });
  const moved = await setOrderStatus(db, orderId, "ready_to_ship", { source: "shipment", actor: uid, reason: `Delhivery AWB ${awbNumber}` });
  if (moved.blocked) console.warn("createDelhiveryShipment: status left as it was", { orderId, ...moved });

  const pickup = await ensurePickup(db, cfg.pickup).catch((e) => `Pickup not booked automatically (${e?.message || e})`);
  return { success: true, awbNumber, trackingUrl: DELHIVERY_TRACK_URL(awbNumber), labelUrl, pickup, message: "Delhivery shipment created" };
});

// ── tracking ─────────────────────────────────────────────────────────────────

/*
 * Delhivery's status, read into ours. StatusType: UD on its way out, DL
 * delivered (or, for "RTO", back with us), RT returning, CN cancelled, LT lost.
 * A failed attempt is a "Pending" scan whose instruction names the reason —
 * that is the only place Delhivery says so on the pull API.
 */
const NDR = /refus|unavailable|not available|door ?lock|premises closed|incomplete address|address (issue|not found)|reschedul|not reachable|unreachable|not responding|no such|future delivery|cod not ready|cash not/i;

function ourStatus(type: string, status: string, instructions: string): OrderStatus | null {
  const t = type.toUpperCase(), s = status.toLowerCase();
  if (t === "DL") return s.includes("rto") ? "rto" : "delivered";
  if (t === "RT") return "rto";
  if (t === "UD") {
    if (s === "dispatched") return "out_for_delivery";
    if (s === "pending" && NDR.test(instructions)) return "undelivered";
    if (s === "in transit" || s === "pending" || s.includes("picked")) return "shipped";
    if (s === "manifested" || s === "not picked" || s === "open" || s === "scheduled") return "ready_to_ship";
  }
  return null; // CN, LT and anything new: recorded as text, the order left alone
}

async function applyTracking(db: admin.firestore.Firestore, doc: admin.firestore.DocumentSnapshot, sh: any) {
  const order = doc.data() as any;
  const st = sh?.Status || {};
  const at = dlvTime(st.StatusDateTime) || Date.now();
  if (at < (Number(order.lastTrackingEventAt) || 0)) return { changed: false, stale: true };

  const status = String(st.Status || ""), type = String(st.StatusType || ""), instructions = String(st.Instructions || "");
  const update: Record<string, unknown> = {
    updatedAt: Date.now(),
    shippingStatus: [status, instructions].filter(Boolean).join(" — ").slice(0, 200),
    lastTrackingEventAt: at,
    lastTrackingEvent: { at, receivedAt: Date.now(), awb: String(sh.AWB || order.awbNumber), code: type, status, description: instructions, location: String(st.StatusLocation || "") },
  };
  const edd = dlvTime(sh.ExpectedDeliveryDate || sh.PromisedDeliveryDate);
  if (edd) update.expectedDeliveryAt = edd;
  const scans = Array.isArray(sh.Scans) ? sh.Scans : [];
  if (scans.length) {
    update.trackScans = scans
      .map((x: any) => x?.ScanDetail || x)
      .map((d: any) => ({ at: dlvTime(d?.ScanDateTime || d?.StatusDateTime), scan: String(d?.Instructions || d?.Scan || ""), location: String(d?.ScannedLocation || d?.StatusLocation || ""), code: String(d?.StatusCode || d?.ScanType || "") }))
      .filter((d: any) => d.at && d.scan)
      .sort((a: any, b: any) => a.at - b.at)
      .slice(-40);
  }
  const target = ourStatus(type, status, instructions);
  if (target === "undelivered") update.ndr = { code: type, reason: instructions, at };
  await doc.ref.update(update);

  if (!target) return { changed: false };
  const moved = await setOrderStatus(db, doc.id, target, { source: "webhook", reason: `Delhivery: ${status}${instructions ? ` — ${instructions}` : ""}` });
  return { changed: !!moved.changed, to: moved.to };
}

const OPEN = new Set(["ready_to_ship", "shipped", "out_for_delivery", "undelivered", "processing"]);

async function syncOrders(db: admin.firestore.Firestore, docs: admin.firestore.DocumentSnapshot[]) {
  const byAwb = new Map<string, admin.firestore.DocumentSnapshot>();
  for (const d of docs) { const awb = String((d.data() as any)?.awbNumber || ""); if (awb) byAwb.set(awb, d); }
  const awbs = [...byAwb.keys()];
  const out = { checked: 0, changed: 0, errors: 0 };
  // Delhivery tracks up to 30 waybills a call; 25 leaves room.
  for (let i = 0; i < awbs.length; i += 25) {
    const chunk = awbs.slice(i, i + 25);
    const r = await dlv(`/api/v1/packages/json/?waybill=${chunk.map(encodeURIComponent).join(",")}`);
    const rows: any[] = Array.isArray(r.data?.ShipmentData) ? r.data.ShipmentData : [];
    if (!rows.length) { out.errors++; console.warn("Delhivery tracking: nothing back", { status: r.status, body: r.text.slice(0, 300) }); continue; }
    for (const row of rows) {
      const sh = row?.Shipment;
      const doc = byAwb.get(String(sh?.AWB || ""));
      if (!doc) continue;
      out.checked++;
      try { if ((await applyTracking(db, doc, sh)).changed) out.changed++; }
      catch (e) { out.errors++; console.error("Delhivery tracking apply failed", { awb: sh?.AWB, e }); }
    }
  }
  return out;
}

/** Every 30 minutes, the open Delhivery parcels. Delhivery's push webhook can replace this later. */
export const delhiveryTrackingSync = functionsV1
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .pubsub.schedule("every 30 minutes")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    if (!process.env.DELHIVERY_API_TOKEN) return null;
    const db = admin.firestore();
    const snap = await db.collection("orders").where("shippingProvider", "==", "delhivery").get();
    const open = snap.docs.filter((d) => OPEN.has(String((d.data() as any).status || "")) && (d.data() as any).awbNumber);
    if (!open.length) return null;
    const out = await syncOrders(db, open);
    console.log("delhiveryTrackingSync", { open: open.length, ...out });
    return null;
  });

/** The same, for one order, from its page. */
export const refreshDelhiveryTracking = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");
  const db = admin.firestore();
  const doc = await db.collection("orders").doc(orderId).get();
  if (!doc.exists) throw new HttpsError("not-found", "Order not found");
  const o = doc.data() as any;
  if (o.shippingProvider !== "delhivery" || !o.awbNumber) throw new HttpsError("failed-precondition", "This order has no Delhivery shipment");
  const out = await syncOrders(db, [doc]);
  const fresh = (await doc.ref.get()).data() as any;
  return { ...out, status: fresh.status, shippingStatus: fresh.shippingStatus };
});

/** A fresh label link (Delhivery's links are short-lived). */
export const delhiveryLabel = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  const doc = await admin.firestore().collection("orders").doc(orderId).get();
  const o = doc.data() as any;
  if (!o || o.shippingProvider !== "delhivery" || !o.awbNumber) throw new HttpsError("failed-precondition", "This order has no Delhivery shipment");
  const url = await delhiveryLabelLink(String(o.awbNumber));
  if (!url) throw new HttpsError("unavailable", "Delhivery did not return a label PDF — download it from the Delhivery panel");
  return { url };
});
