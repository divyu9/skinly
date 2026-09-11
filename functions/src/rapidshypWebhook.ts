import { onRequest } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

/**
 * RapidShyp's tracking webhook.
 *
 * Without it a shipment is booked and then never heard from again: the order
 * sits on "Shipment Created" through pickup, transit and delivery, and someone
 * has to watch the courier's dashboard to know anything. The route existed
 * before the Convex migration and was not carried across, which is why
 * RAPIDSHYP_WEBHOOK_TOKEN is configured with nothing reading it.
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
 * The guard on each arm is what stops a late or out-of-order event walking a
 * finished order backwards — couriers replay events, and "in transit" arriving
 * after "delivered" must not un-deliver the order.
 */
function nextStatus(code: string, shipmentStatus: string, current: string): string | null {
  const s = shipmentStatus.toUpperCase();

  if (code === "PSH" || code === "NA" || s.includes("PICKUP")) {
    return current !== "processing" ? "processing" : null;
  }
  if (["PUC", "SPD", "INT", "RAD", "OFD"].includes(code) || s.includes("TRANSIT") || s.includes("BOOKED") || s.includes("OUT_FOR_DELIVERY")) {
    return current === "processing" ? "shipped" : null;
  }
  if (code === "DEL" || s === "DELIVERED") {
    return current !== "delivered" ? "delivered" : null;
  }
  if (code === "RTO_DEL" || s === "RTO_DELIVERED") {
    return current !== "rto" ? "rto" : null;
  }
  if (["RTO", "RTO_INT", "RTO_OFD"].includes(code) || (s.includes("RTO") && !s.includes("RTO_DELIVERED"))) {
    return current !== "rto" && current !== "cancelled" ? "rto" : null;
  }
  if (s.includes("CANCEL")) {
    return current !== "cancelled" && current !== "rto" ? "cancelled" : null;
  }
  // UND / NDR and anything unrecognised: record the text, leave the status be.
  return null;
}

export const rapidshypWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const expected = await expectedToken();
  if (expected) {
    const given = String(req.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!given || !tokenMatches(given, expected)) {
      console.error("rapidshypWebhook: bad token");
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
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
  const record = (data.records || [])[0];
  const shipment = (record?.shipment_details || [])[0];
  if (!record || !shipment) {
    console.error("rapidshypWebhook: no records/shipment_details", raw.slice(0, 1000));
    res.status(400).json({ success: false, message: "No shipment details in payload" });
    return;
  }

  const awbNumber = String(shipment.awb || "");
  const orderNumber = record.seller_order_id ? String(record.seller_order_id) : "";
  const shipmentStatus = String(shipment.shipment_status || "");
  const statusCode = String(shipment.current_tracking_status_code || "");
  const statusDesc = String(shipment.current_tracking_status_desc || "");

  if (!awbNumber) {
    res.status(400).json({ success: false, message: "Missing AWB number" });
    return;
  }

  const db = admin.firestore();
  let doc = (await db.collection("orders").where("awbNumber", "==", awbNumber).limit(1).get()).docs[0];

  // Fall back to the order number: a shipment booked outside this admin has an
  // AWB we have never stored, and losing the update would be worse than
  // adopting it.
  let adoptedAwb = false;
  if (!doc && orderNumber) {
    doc = (await db.collection("orders").where("orderNumber", "==", orderNumber).limit(1).get()).docs[0];
    if (doc) adoptedAwb = true;
  }

  if (!doc) {
    // 200, deliberately: a 4xx makes RapidShyp retry an order we will never
    // have, forever.
    console.warn("rapidshypWebhook: no order for", { awbNumber, orderNumber });
    res.status(200).json({ success: false, message: "Order not found" });
    return;
  }

  const order = doc.data() as any;
  const current = String(order.status || "");
  const target = nextStatus(statusCode, shipmentStatus, current);

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (adoptedAwb) update.awbNumber = awbNumber;
  if (statusDesc || shipmentStatus) update.shippingStatus = statusDesc || shipmentStatus;
  if (target) update.status = target;
  update.lastTrackingEvent = {
    at: Date.now(),
    awb: awbNumber,
    code: statusCode,
    status: shipmentStatus,
    description: statusDesc,
  };

  await doc.ref.update(update);

  // A wallet-credit coupon pays out when the parcel lands, once.
  if (target === "delivered" && !order.walletCreditCredited && order.walletCreditCouponAmount && order.userId) {
    try {
      await creditWallet(db, doc.ref, order);
    } catch (e: any) {
      console.error("rapidshypWebhook: wallet credit failed", { order: order.orderNumber, error: e?.message || e });
    }
  }

  console.log("rapidshypWebhook", {
    order: order.orderNumber,
    awb: awbNumber,
    code: statusCode,
    shipmentStatus,
    from: current,
    to: target || current,
  });

  res.status(200).json({
    success: true,
    orderNumber: order.orderNumber,
    previousStatus: current,
    status: target || current,
  });
});

/** Idempotent: the flag is set inside the same transaction that moves money. */
async function creditWallet(
  db: admin.firestore.Firestore,
  orderRef: admin.firestore.DocumentReference,
  order: any
): Promise<void> {
  const amount = Number(order.walletCreditCouponAmount) || 0;
  if (!(amount > 0)) return;

  const userRef = db.collection("users").doc(String(order.userId));
  const txRef = db.collection("walletTransactions").doc();

  await db.runTransaction(async (tx) => {
    const [orderSnap, userSnap] = await tx.getAll(orderRef, userRef);
    // Re-read inside the transaction: two webhook deliveries for one parcel is
    // normal, and paying twice is not recoverable by an apology.
    if ((orderSnap.data() as any)?.walletCreditCredited) return;
    if (!userSnap.exists) return;

    const before = Number((userSnap.data() as any)?.walletBalance) || 0;
    const after = before + amount;
    tx.update(userRef, { walletBalance: after });
    tx.set(txRef, {
      userId: order.userId,
      transactionType: "credit",
      amount,
      source: "coupon_credit",
      balanceBefore: before,
      balanceAfter: after,
      description: `Wallet credit from coupon on order ${order.orderNumber || ""}`.trim(),
      relatedOrderId: orderRef.id,
      ...(order.couponId ? { relatedCouponId: order.couponId } : {}),
      createdAt: Date.now(),
    });
    tx.update(orderRef, { walletCreditCredited: true });
  });
}
