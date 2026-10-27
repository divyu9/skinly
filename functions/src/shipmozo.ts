import * as functionsV1 from "firebase-functions/v1";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";
import { setOrderStatus, type OrderStatus } from "./orderStatus";
import { buildOrderPayload, orderMoney } from "./rapidshyp";
import { isConfirmedOrder } from "./materials";

/**
 * Shipping through Shipmozo, beside RapidShyp and Delhivery Direct.
 *
 * Shipmozo is an aggregator: its rate calculator prices every courier on the
 * lane (XpressBees, Shadowfax, Delhivery, Amazon…) and a shipment is booked in
 * three calls — push the order, assign the chosen courier, read back the AWB
 * (scheduling the pickup only for couriers that don't do it themselves).
 * The parcel is described once, by buildOrderPayload, like the other two; the
 * label names every item "Accessories" (anti-theft) while SKU, price and HSN
 * stay real. `shippingProvider: "shipmozo"` tells labels and tracking whom to ask.
 *
 * API: https://shipping-api.com/app/api/v1 (public-key / private-key headers;
 * SHIPMOZO_PUBLIC_KEY and SHIPMOZO_PRIVATE_KEY). The pickup warehouse is
 * settings/shipping.shipmozoWarehouseId, its pincode shipmozoPickupPin.
 */

const BASE = "https://shipping-api.com/app/api/v1";
const LABEL_ITEM_NAME = "Accessories";

async function smz(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  const pub = process.env.SHIPMOZO_PUBLIC_KEY || "", pri = process.env.SHIPMOZO_PRIVATE_KEY || "";
  if (!pub || !pri) throw new HttpsError("failed-precondition", "Shipmozo keys are not configured (SHIPMOZO_PUBLIC_KEY / SHIPMOZO_PRIVATE_KEY)");
  const res = await fetch(`${BASE}/${path.replace(/^\//, "")}`, {
    method: init.method || (init.body ? "POST" : "GET"),
    headers: { "public-key": pub, "private-key": pri, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = null; }
  return { ok: res.ok && String(data?.result) === "1", status: res.status, data, text };
}

const why = (r: { data: any; text: string; status: number }) =>
  String(r.data?.data?.error || r.data?.message || r.text.slice(0, 200) || `HTTP ${r.status}`);

export async function shipmozoSettings(db: admin.firestore.Firestore) {
  const s = (await db.doc("settings/shipping").get()).data() as any || {};
  return {
    warehouseId: String(s.shipmozoWarehouseId || process.env.SHIPMOZO_WAREHOUSE_ID || ""),
    pickupPin: String(s.shipmozoPickupPin || s.delhiveryOriginPin || "").replace(/\D/g, ""),
  };
}

export interface SmzCourier { id: number; name: string; freight: number; edd: string; auto: boolean }

/** Every courier Shipmozo offers on the lane, cheapest first — read-only, nothing booked. */
export async function shipmozoRates(pickupPin: string, pin: string, cod: boolean, value: number, codValue: number, grams: number, dims: { l: number; b: number; h: number }): Promise<SmzCourier[] | { error: string }> {
  if (!process.env.SHIPMOZO_PUBLIC_KEY) return { error: "Shipmozo keys not configured" };
  if (!pickupPin) return { error: "Set the Shipmozo pickup pincode" };
  const r = await smz("rate-calculator", {
    body: {
      order_id: "", pickup_pincode: Number(pickupPin), delivery_pincode: Number(pin),
      payment_type: cod ? "COD" : "PREPAID", shipment_type: "FORWARD", order_amount: Math.round(value),
      type_of_package: "SPS", rov_type: "ROV_OWNER", cod_amount: cod ? String(Math.round(codValue || value)) : "",
      weight: Math.max(50, Math.round(grams)),
      dimensions: [{ no_of_box: "1", length: String(dims.l || 10), width: String(dims.b || 10), height: String(dims.h || 2) }],
    },
  });
  if (!r.ok) return { error: why(r) };
  const list: any[] = Array.isArray(r.data?.data) ? r.data.data : [];
  return list
    .map((c) => ({
      id: Number(c.id), name: String(c.name || ""), freight: Math.round(Number(c.total_charges) * 100) / 100,
      edd: String(c.estimated_delivery || ""), auto: String(c.pickups_automatically_scheduled || "").toUpperCase() === "YES",
    }))
    .filter((c) => c.id && c.freight > 0)
    .sort((a, b) => a.freight - b.freight);
}

/** The order's lane and parcel, as compareShipping and booking both read them. */
async function laneOf(orderId: string) {
  const { orderRef, order, orderDoc, payload } = await buildOrderPayload(orderId);
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const money = orderMoney(order, items);
  const pkg = (payload.packageDetails as any) || {};
  return {
    orderRef, order, orderDoc, payload, money,
    pin: String(order.shippingAddress?.pincode || "").replace(/\D/g, ""),
    cod: payload.paymentMethod === "COD",
    codValue: Number(payload.codValue) || 0,
    grams: Number(pkg.packageWeight) || 100,
    dims: { l: Number(pkg.packageLength) || 10, b: Number(pkg.packageBreadth) || 10, h: Number(pkg.packageHeight) || 2 },
  };
}

/** Shipmozo's couriers for one order (Compare & ship). */
export async function shipmozoQuoteFor(db: admin.firestore.Firestore, orderId: string) {
  const cfg = await shipmozoSettings(db);
  const l = await laneOf(orderId);
  const rates = await shipmozoRates(cfg.pickupPin, l.pin, l.cod, l.money.total, l.codValue, l.grams, l.dims).catch((e) => ({ error: String(e?.message || e) }));
  return Array.isArray(rates)
    ? { couriers: rates.slice(0, 8), ready: !!cfg.warehouseId }
    : { couriers: [], error: rates.error, ready: !!cfg.warehouseId };
}

/** Finds an AWB anywhere in Shipmozo's answer (its order-detail shape isn't documented). */
function findAwb(x: any, depth = 0): string {
  if (!x || depth > 4) return "";
  if (typeof x === "object") {
    for (const k of Object.keys(x)) {
      if (/^awb(_number|_no)?$/i.test(k) && x[k] && String(x[k]).trim()) return String(x[k]).trim();
    }
    for (const v of Object.values(x)) { const a = findAwb(v, depth + 1); if (a) return a; }
  }
  return "";
}

export const createShipmozoShipment = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  await enforceDailyRateLimit({ key: `createShipmozoShipment_${uid}`, limit: Number(process.env.SHIPMOZO_DAILY_LIMIT || 200) });
  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");
  const db = admin.firestore();
  const cfg = await shipmozoSettings(db);
  if (!cfg.warehouseId) throw new HttpsError("failed-precondition", "Set the Shipmozo pickup warehouse first (settings/shipping.shipmozoWarehouseId)");

  const l = await laneOf(orderId);
  const { order, orderDoc, orderRef, payload } = l;
  if (order.awbNumber) throw new HttpsError("already-exists", `Shipment already created (AWB ${order.awbNumber})`);
  if (order?.addOnTo) throw new HttpsError("failed-precondition", `This is an add-on to order ${order.parentOrderNumber || order.addOnTo}: it goes in that parcel and takes its tracking.`);
  if (!isConfirmedOrder(order)) throw new HttpsError("failed-precondition", "This order is not confirmed (unpaid or payment failed) — it cannot be shipped");

  // The courier: the one picked in Compare & ship, else the cheapest on the lane.
  const rates = await shipmozoRates(cfg.pickupPin, l.pin, l.cod, l.money.total, l.codValue, l.grams, l.dims);
  if (!Array.isArray(rates)) throw new HttpsError("failed-precondition", `Shipmozo: ${rates.error}`);
  const wanted = Number(data?.courierId) || 0;
  const courier = rates.find((c) => c.id === wanted) || rates[0];
  if (!courier) throw new HttpsError("failed-precondition", "Shipmozo has no courier for this pincode");

  const a = order.shippingAddress || {};
  // A re-booking after a cancel needs a fresh id: Shipmozo keeps the cancelled one.
  const attempt = Number(order.shipmozoAttempt) || 1;
  // Letters, digits and dashes only: "#4104" was pushed fine but then "not valid" for
  // every later call (assign, detail), so the order could never get a courier.
  const base = String(order.orderNumber || orderDoc.id).replace(/[^A-Za-z0-9-]/g, "") || orderDoc.id;
  let smzOrderId = String(order.shipmozoOrderId || "") || `${base}${attempt > 1 ? `-R${attempt}` : ""}`;
  const lines = (payload.orderItems as any[]) || [];

  // 1. The order, once (a retry after a failed assign must not push it twice).
  if (!order.shipmozoPushedAt) {
    const pushed = await smz("push-order", {
      body: {
        order_id: smzOrderId,
        order_date: new Date(Number(order.createdAt) + 5.5 * 3600e3 || Date.now()).toISOString().slice(0, 10),
        order_type: "NON ESSENTIALS",
        consignee_name: String(a.fullName || order.customerName || "Customer").slice(0, 80),
        consignee_phone: Number(String(a.phone || order.phone || "").replace(/\D/g, "").slice(-10)),
        consignee_email: String(order.email || ""),
        consignee_address_line_one: String(a.addressLine1 || "").slice(0, 200),
        consignee_address_line_two: String(a.addressLine2 || "").slice(0, 200),
        consignee_pin_code: Number(l.pin),
        consignee_city: String(a.city || ""),
        consignee_state: String(a.state || ""),
        product_detail: lines.map((x: any) => ({
          name: LABEL_ITEM_NAME, sku_number: String(x.sku || ""), quantity: Number(x.units) || 1, discount: "",
          hsn: String(x.hsn || "39269099"), unit_price: Number(x.unitPrice) || 0, product_category: "Other",
        })),
        payment_type: l.cod ? "COD" : "PREPAID",
        cod_amount: l.cod ? String(Math.round(l.codValue || l.money.total)) : "",
        weight: Math.max(50, Math.round(l.grams)),
        length: l.dims.l, width: l.dims.b, height: l.dims.h,
        warehouse_id: cfg.warehouseId,
        gst_ewaybill_number: "", gstin_number: "",
      },
    });
    if (!pushed.ok) {
      console.error("Shipmozo push-order refused", { order: smzOrderId, status: pushed.status, body: pushed.text.slice(0, 600) });
      throw new HttpsError("failed-precondition", `Shipmozo: ${why(pushed)}`);
    }
    // Shipmozo answers with the id it filed the order under; every later call uses that.
    const filed = String(pushed.data?.data?.order_id || pushed.data?.data?.reference_id || smzOrderId);
    console.log("Shipmozo push-order", { sent: smzOrderId, filed, reference: pushed.data?.data?.reference_id });
    smzOrderId = filed;
    await orderRef.update({ shipmozoPushedAt: Date.now(), shipmozoOrderId: filed, shipmozoReferenceId: String(pushed.data?.data?.reference_id || "") });
  }

  // 2. The courier (by the filed id; by the reference id if Shipmozo doesn't know the first).
  let assigned = await smz("assign-courier", { body: { order_id: smzOrderId, courier_id: courier.id } });
  const ref2 = String((await orderRef.get()).data()?.shipmozoReferenceId || "");
  if (!assigned.ok && ref2 && ref2 !== smzOrderId && /not valid|not found/i.test(why(assigned))) {
    assigned = await smz("assign-courier", { body: { order_id: ref2, courier_id: courier.id } });
    if (assigned.ok) { smzOrderId = ref2; await orderRef.update({ shipmozoOrderId: ref2 }); }
  }
  if (!assigned.ok) {
    console.error("Shipmozo assign-courier refused", { order: smzOrderId, courier: courier.id, body: assigned.text.slice(0, 600) });
    throw new HttpsError("failed-precondition", `Shipmozo could not assign ${courier.name}: ${why(assigned)}`);
  }

  // 3. The AWB: from the assignment, else the order detail, else by scheduling the pickup.
  let awb = findAwb(assigned.data);
  if (!awb) { const d = await smz(`get-order-detail/${encodeURIComponent(smzOrderId)}`); awb = findAwb(d.data); }
  let pickup = courier.auto ? "Pickup is scheduled automatically by the courier" : "";
  if (!awb || !courier.auto) {
    const p = await smz("schedule-pickup", { body: { order_id: smzOrderId } });
    if (p.ok) { awb = awb || findAwb(p.data); pickup = "Pickup scheduled"; }
    else pickup = `Pickup not scheduled automatically (${why(p)}) — schedule it in the Shipmozo panel`;
  }
  if (!awb) throw new HttpsError("unavailable", `Booked with ${courier.name} on Shipmozo, but no AWB came back yet — open the order in the Shipmozo panel`);

  const { orderLinkFor } = await import("./orderNotifications");
  await orderRef.update({
    awbNumber: awb,
    trackingUrl: orderLinkFor(orderId),
    shippingStatus: "Booked",
    shippingProvider: "shipmozo",
    courierName: courier.name,
    shipmozoCourierId: courier.id,
    // What it cost, from the quote at booking (the dashboard's shipping spend).
    shippingCost: courier.freight, shippingCostCourier: courier.name, shippingCostSource: "shipmozo-quote", shippingCostAt: Date.now(),
    updatedAt: Date.now(),
  });
  const moved = await setOrderStatus(db, orderId, "ready_to_ship", { source: "shipment", actor: uid, reason: `Shipmozo ${courier.name} AWB ${awb}` });
  if (moved.blocked) console.warn("createShipmozoShipment: status left as it was", { orderId, ...moved });
  return { success: true, awbNumber: awb, courier: courier.name, freight: courier.freight, pickup, message: `Shipmozo ${courier.name} booked` };
});

/** Cancels a Shipmozo shipment (cancelShipment in rapidshyp.ts calls this for shipmozo orders). */
export async function cancelShipmozo(order: any, orderRef: admin.firestore.DocumentReference) {
  const r = await smz("cancel-order", {
    body: { order_id: String(order.shipmozoOrderId || order.orderNumber), awb_number: Number(String(order.awbNumber).replace(/\D/g, "")) || String(order.awbNumber) },
  });
  if (!r.ok) throw new HttpsError("unavailable", `Shipmozo could not cancel: ${why(r)}`);
  await orderRef.update({
    shipmozoAttempt: (Number(order.shipmozoAttempt) || 1) + 1,
    shipmozoPushedAt: admin.firestore.FieldValue.delete(),
    shipmozoCourierId: admin.firestore.FieldValue.delete(),
  });
}

/** A Shipmozo label as a PNG data URL (bulk printing in rapidshyp.ts uses it too). */
export async function shipmozoLabelData(awb: string): Promise<string> {
  const r = await smz(`get-order-label/${encodeURIComponent(awb)}`);
  const label = Array.isArray(r.data?.data) ? String(r.data.data[0]?.label || "") : "";
  if (!r.ok || !label.startsWith("data:image")) throw new Error(`Shipmozo did not return a label (${why(r)})`);
  return label;
}

/** The label (Shipmozo returns a PNG data URL). */
export const shipmozoLabel = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const o = (await admin.firestore().collection("orders").doc(String(data?.orderId || "")).get()).data() as any;
  if (!o || o.shippingProvider !== "shipmozo" || !o.awbNumber) throw new HttpsError("failed-precondition", "This order has no Shipmozo shipment");
  const label = await shipmozoLabelData(String(o.awbNumber)).catch((e) => { throw new HttpsError("unavailable", `${e?.message || e} — download it from the Shipmozo panel`); });
  return { label, awb: String(o.awbNumber) };
});

// ── tracking ─────────────────────────────────────────────────────────────────

/** Shipmozo's status text, read into ours; anything unknown is recorded as text only. */
function ourStatus(s: string): OrderStatus | null {
  const t = s.toLowerCase();
  if (/rto|return(ed)? to origin|returned/.test(t)) return "rto";
  if (/^delivered|\bdelivered\b/.test(t) && !/undelivered|not delivered/.test(t)) return "delivered";
  if (/out for delivery/.test(t)) return "out_for_delivery";
  if (/undelivered|not delivered|ndr|delivery attempted|failed attempt/.test(t)) return "undelivered";
  if (/in transit|picked|shipped|dispatched|reached|arrived/.test(t)) return "shipped";
  if (/pickup pending|pending pickup|manifest|booked|pickup scheduled|not picked/.test(t)) return "ready_to_ship";
  return null;
}

const OPEN = new Set(["ready_to_ship", "shipped", "out_for_delivery", "undelivered", "processing"]);

async function trackOne(db: admin.firestore.Firestore, doc: admin.firestore.DocumentSnapshot) {
  const o = doc.data() as any;
  const r = await smz(`track-order?awb_number=${encodeURIComponent(String(o.awbNumber))}`);
  if (!r.ok) return { changed: false, error: why(r) };
  const d = r.data?.data || {};
  const status = String(d.current_status || "");
  const scans: any[] = Array.isArray(d.scan_detail) ? d.scan_detail : [];
  const update: Record<string, unknown> = { updatedAt: Date.now(), shippingStatus: status.slice(0, 200) || o.shippingStatus || "" };
  if (d.expected_delivery_date) { const t = Date.parse(String(d.expected_delivery_date)); if (t) update.expectedDeliveryAt = t; }
  if (scans.length) {
    update.trackScans = scans
      .map((x: any) => ({ at: Date.parse(String(x.date || x.status_time || x.time || "")) || 0, scan: String(x.status || x.remark || x.activity || ""), location: String(x.location || ""), code: String(x.status_code || "") }))
      .filter((x: any) => x.at && x.scan).sort((a: any, b: any) => a.at - b.at).slice(-40);
  }
  const target = ourStatus(status);
  if (target === "undelivered") update.ndr = { code: "shipmozo", reason: status, at: Date.now() };
  await doc.ref.update(update);
  if (!target) return { changed: false };
  const moved = await setOrderStatus(db, doc.id, target, { source: "webhook", reason: `Shipmozo: ${status}` });
  return { changed: !!moved.changed, to: moved.to };
}

/** Every 30 minutes, the open Shipmozo parcels. */
export const shipmozoTrackingSync = functionsV1
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .pubsub.schedule("every 30 minutes")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    if (!process.env.SHIPMOZO_PUBLIC_KEY) return null;
    const db = admin.firestore();
    const snap = await db.collection("orders").where("shippingProvider", "==", "shipmozo").get();
    const open = snap.docs.filter((d) => OPEN.has(String((d.data() as any).status || "")) && (d.data() as any).awbNumber);
    let changed = 0, errors = 0;
    for (const d of open) {
      try { if ((await trackOne(db, d)).changed) changed++; } catch (e) { errors++; console.error("Shipmozo tracking failed", { order: d.id, e }); }
    }
    if (open.length) console.log("shipmozoTrackingSync", { open: open.length, changed, errors });
    return null;
  });

/** The same, for one order, from its page. */
export const refreshShipmozoTracking = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const db = admin.firestore();
  const doc = await db.collection("orders").doc(String(data?.orderId || "")).get();
  const o = doc.data() as any;
  if (!o || o.shippingProvider !== "shipmozo" || !o.awbNumber) throw new HttpsError("failed-precondition", "This order has no Shipmozo shipment");
  const out = await trackOne(db, doc);
  const fresh = (await doc.ref.get()).data() as any;
  return { ...out, status: fresh.status, shippingStatus: fresh.shippingStatus };
});
