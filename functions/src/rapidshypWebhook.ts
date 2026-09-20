import { onRequest } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { setOrderStatus, type OrderStatus } from "./orderStatus";

/**
 * RapidShyp's tracking webhook.
 *
 * Without it a shipment is booked and then never heard from again: the order
 * sits on "Shipment Created" through pickup, transit and delivery, and someone
 * has to watch the courier's dashboard to know anything.
 *
 * Three things it got wrong, all of them the kind that only show up in
 * production: it accepted unauthenticated calls whenever the shared secret was
 * not configured; it read `records[0]` only, so a batched delivery quietly
 * dropped every parcel but the first and answered 200 so nothing was retried;
 * and its pickup arm could walk a delivered order back to processing, because
 * couriers replay events and the guard only excluded "processing" itself.
 *
 * The status decision now belongs to setOrderStatus, which owns the graph, the
 * history and the messages. This file's job is narrower: prove the call is
 * RapidShyp's, read every shipment in it, and translate the courier's
 * vocabulary into ours.
 *
 * Point RapidShyp at:
 *   https://us-central1-<project>.cloudfunctions.net/rapidshypWebhook
 * with an Authorization header of `Bearer <RAPIDSHYP_WEBHOOK_TOKEN>`.
 */

/** The shared secret, from env or the admin settings doc. */
async function expectedToken(): Promise<string> {
  if (process.env.RAPIDSHYP_WEBHOOK_TOKEN) return process.env.RAPIDSHYP_WEBHOOK_TOKEN;
  const snap = await admin.firestore().collection("settings").doc("rapidshyp_webhook_token").get();
  return snap.exists ? String(snap.data()?.value || "") : "";
}

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // Length must be compared separately; timingSafeEqual throws on a mismatch.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * RapidShyp's status vocabulary, mapped onto ours.
 *
 * Read most specific first: an RTO delivery is a delivery, and "out for
 * delivery" contains neither more nor less than the transit words do. What
 * this returns is a request, not a decision — setOrderStatus checks it against
 * the graph, so a replayed pickup event on a delivered parcel is refused there
 * rather than guarded against here, one arm at a time.
 *
 * NDR ("undelivered") and "out for delivery" used to fall through unmapped and
 * were thrown away, which is why a failed delivery attempt was invisible.
 */
function courierStatus(code: string, shipmentStatus: string): OrderStatus | null {
  const c = code.toUpperCase();
  const s = shipmentStatus.toUpperCase();

  if (c === "RTO_DEL" || c.startsWith("RTO") || s.includes("RTO")) return "rto";
  if (s.includes("CANCEL")) return "cancelled";
  // Before "delivered", because UNDELIVERED contains DELIVERED and a failed
  // delivery attempt read as a delivery is the worst way to get this wrong.
  if (c === "UND" || c === "NDR" || s.includes("UNDELIVERED") || s.includes("NOT_DELIVERED") || s.includes("NDR")) {
    return "undelivered";
  }
  if (c === "OFD" || s.includes("OUT_FOR_DELIVERY") || s.includes("OUT FOR DELIVERY")) return "out_for_delivery";
  if (c === "DEL" || s.includes("DELIVERED")) return "delivered";
  if (["PUC", "SPD", "INT", "RAD"].includes(c) || s.includes("TRANSIT") || s.includes("PICKED")) return "shipped";
  if (c === "PSH" || c === "NA" || s.includes("PICKUP") || s.includes("BOOKED")) return "ready_to_ship";
  return null;
}

/** When the courier says this happened, in ms, or now if it will not say. */
function eventTime(shipment: any, record: any): number {
  const candidates = [
    shipment?.current_tracking_status_time,
    shipment?.status_time,
    shipment?.event_time,
    shipment?.updated_at,
    record?.event_time,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c < 1e12 ? c * 1000 : c;
    const t = c ? Date.parse(String(c)) : NaN;
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

/** One shipment out of the payload, applied to the order it belongs to. */
async function applyShipment(
  db: admin.firestore.Firestore,
  record: any,
  shipment: any
): Promise<Record<string, unknown>> {
  const awbNumber = String(shipment?.awb || "");
  const orderNumber = record?.seller_order_id ? String(record.seller_order_id) : "";
  const shipmentStatus = String(shipment?.shipment_status || "");
  const statusCode = String(shipment?.current_tracking_status_code || "");
  const statusDesc = String(shipment?.current_tracking_status_desc || "");

  if (!awbNumber && !orderNumber) return { ok: false, message: "No AWB or order number" };

  let doc = awbNumber
    ? (await db.collection("orders").where("awbNumber", "==", awbNumber).limit(1).get()).docs[0]
    : undefined;

  // Fall back to the order number: a shipment booked outside this admin has an
  // AWB we have never stored, and losing the update would be worse than
  // adopting it.
  let adoptedAwb = false;
  if (!doc && orderNumber) {
    doc = (await db.collection("orders").where("orderNumber", "==", orderNumber).limit(1).get()).docs[0];
    if (doc && awbNumber) adoptedAwb = true;
  }
  if (!doc) {
    console.warn("rapidshypWebhook: no order for", { awbNumber, orderNumber });
    return { ok: false, awb: awbNumber, orderNumber, message: "Order not found" };
  }

  const order = doc.data() as any;
  const at = eventTime(shipment, record);
  /*
   * Events arrive out of order. A late "in transit" must not overwrite the
   * delivery text with something older, so an event that predates the one on
   * file is recorded and otherwise ignored. The status itself is protected
   * separately by the transition graph, which is why this only guards the text.
   */
  const lastAt = Number(order.lastTrackingEventAt) || 0;
  const stale = at < lastAt;

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (adoptedAwb) update.awbNumber = awbNumber;
  if (!stale) {
    if (statusDesc || shipmentStatus) update.shippingStatus = statusDesc || shipmentStatus;
    update.lastTrackingEventAt = at;
    update.lastTrackingEvent = {
      at,
      receivedAt: Date.now(),
      awb: awbNumber,
      code: statusCode,
      status: shipmentStatus,
      description: statusDesc,
    };
  }
  await doc.ref.update(update);

  const target = stale ? null : courierStatus(statusCode, shipmentStatus);
  let moved: any = null;
  if (target) {
    moved = await setOrderStatus(db, doc.id, target, {
      source: "webhook",
      reason: `${statusCode || shipmentStatus}${statusDesc ? ` — ${statusDesc}` : ""}`,
    });
  }

  console.log("rapidshypWebhook", {
    order: order.orderNumber,
    awb: awbNumber,
    code: statusCode,
    shipmentStatus,
    stale,
    asked: target,
    changed: moved?.changed ?? false,
    blocked: moved?.blocked ?? false,
  });

  return {
    ok: true,
    awb: awbNumber,
    orderNumber: order.orderNumber || doc.id,
    stale,
    status: moved?.to || moved?.from || String(order.status || ""),
    changed: moved?.changed ?? false,
  };
}

export const rapidshypWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  /*
   * Fail closed. This used to skip the check entirely when no secret was
   * configured, which made an unauthenticated POST enough to mark any order
   * delivered — and a delivery pays out a wallet-credit coupon. An unconfigured
   * secret is a deployment fault, and the honest answer to it is to refuse the
   * call, not to trust it.
   */
  const expected = await expectedToken();
  if (!expected) {
    console.error("rapidshypWebhook: no RAPIDSHYP_WEBHOOK_TOKEN configured — refusing");
    res.status(503).json({ success: false, message: "Webhook is not configured" });
    return;
  }
  const given = String(req.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!given || !tokenMatches(given, expected)) {
    console.error("rapidshypWebhook: bad token");
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  let data: any;
  try {
    data = typeof req.body === "object" && req.body ? req.body : JSON.parse(raw);
  } catch {
    res.status(400).json({ success: false, message: "Body is not JSON" });
    return;
  }

  // { records: [{ seller_order_id, shipment_details: [{ awb, shipment_status, … }] }] }
  const records: any[] = Array.isArray(data?.records) ? data.records : [];
  const pairs: Array<{ record: any; shipment: any }> = [];
  for (const record of records) {
    const shipments = Array.isArray(record?.shipment_details) ? record.shipment_details : [];
    for (const shipment of shipments) pairs.push({ record, shipment });
  }

  if (!pairs.length) {
    console.error("rapidshypWebhook: no records/shipment_details", raw.slice(0, 1000));
    res.status(400).json({ success: false, message: "No shipment details in payload" });
    return;
  }

  const results: any[] = [];
  for (const { record, shipment } of pairs) {
    try {
      results.push(await applyShipment(admin.firestore(), record, shipment));
    } catch (e: any) {
      console.error("rapidshypWebhook: shipment failed", { awb: shipment?.awb, error: e?.message || e });
      results.push({ ok: false, awb: String(shipment?.awb || ""), message: e?.message || "Failed" });
    }
  }

  /*
   * 200 even where an order was not found, deliberately: a 4xx makes RapidShyp
   * retry a parcel we will never have, forever. The body carries what happened
   * to each one so a missed update is visible in their logs and ours.
   */
  res.status(200).json({
    success: results.every((r) => r.ok),
    handled: results.length,
    results,
  });
});
