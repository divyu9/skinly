import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";
import { setOrderStatus } from "./orderStatus";

/**
 * RapidShyp shipment creation.
 *
 * This was a stub after the Convex migration: it skipped the API call
 * entirely, wrote the literal AWB "AWB123456789" onto the order, marked it
 * SHIPPED and reported success. The admin saw "Shipment created!" and nothing
 * existed at the courier — the worst possible failure, because it looks like it
 * worked. This is the pre-migration implementation restored, reading the order
 * out of Firestore rather than through Convex queries.
 */

const getRapidShypConfig = () => {
  const apiKey = process.env.RAPIDSHYP_API_KEY || "";
  const apiUrl = process.env.RAPIDSHYP_API_URL || "https://api.rapidshyp.com/rapidshyp/apis/v1/wrapper";
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "RapidShyp API key not configured.");
  }
  // The order-only endpoint sits beside the wrapper: create_order books the
  // order in the panel and leaves the courier to be chosen there.
  const orderUrl = process.env.RAPIDSHYP_ORDER_URL || apiUrl.replace(/\/wrapper\/?$/, "/create_order");
  return { apiKey, apiUrl, orderUrl };
};

/**
 * The pickup point the parcel leaves from, by the name RapidShyp knows it by.
 *
 * It lives in the shipping settings so that renaming a pickup address in the
 * RapidShyp panel is an admin edit, not a redeploy: RapidShyp matches this
 * string exactly and answers "Pickup address not found with pickup address
 * name" when it does not, which is a whole day's shipments stuck.
 */
async function pickupNames(db: admin.firestore.Firestore) {
  const snap = await db.collection("settings").doc("shipping").get();
  const s = snap.exists ? (snap.data() as any) : {};
  return {
    pickup: String(s.rapidshypPickupName || process.env.RAPIDSHYP_PICKUP_NAME || "SKINLY").trim(),
    store: String(s.rapidshypStoreName || process.env.RAPIDSHYP_STORE_NAME || "DEFAULT").trim(),
  };
}

/**
 * RapidShyp answers 200 with {"status":"FAILED"} when it refuses an order, so
 * a failure has to be read out of the body rather than the status code. Left
 * unread, the admin saw the raw JSON and no idea what to fix.
 */
function refusal(result: any, pickup: string): string | null {
  const status = String(result?.status || "").toUpperCase();
  if (status && status !== "SUCCESS" && status !== "SUCCESSFUL") {
    const remarks = String(result?.remarks || result?.message || "RapidShyp refused this order");
    return /pickup address/i.test(remarks)
      ? `${remarks} We sent "${pickup}". Open the RapidShyp panel, copy the pickup location name exactly as it appears there, and save it in Admin → Shipping.`
      : remarks;
  }
  return null;
}

/** A finite number, or null. */
const num = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Orders written by different generations of checkout disagree about their
 * money fields; 43 of them carry no `subtotal` or `shippingFee` at all. The
 * courier needs real figures, so they are derived the same way the admin UI
 * derives them rather than defaulted to zero.
 */
function orderMoney(order: any, items: any[]) {
  const lineTotal = items.reduce(
    (sum, it) => sum + (num(it?.price) ?? 0) * (num(it?.quantity) ?? 1),
    0
  );
  const shippingFee = num(order?.shippingFee) ?? 0;
  const codFee = num(order?.codFee) ?? 0;
  const subtotal =
    num(order?.subtotal) ?? num(order?.itemsTotal) ?? (items.length ? lineTotal : 0);
  const total = num(order?.total) ?? num(order?.amountPayable) ?? subtotal + shippingFee + codFee;
  return { subtotal, shippingFee, codFee, total };
}

function emailOf(order: any): string {
  return String(order?.email || order?.customerEmail || order?.guestEmail || order?.user?.email || "");
}

/** Pulls the readable message out of whatever shape RapidShyp returned. */
function describeError(status: number, body: string): string {
  try {
    const j = JSON.parse(body);
    if (j.message) return String(j.message);
    if (typeof j.error === "string") return j.error;
    if (j.error) return JSON.stringify(j.error);
    if (Array.isArray(j.errors)) {
      return j.errors
        .map((e: any) => (e?.field ? `${e.field}: ${e.message}` : e?.message || JSON.stringify(e)))
        .join(", ");
    }
    if (j.errors) return JSON.stringify(j.errors);
    if (j.details) return typeof j.details === "string" ? j.details : JSON.stringify(j.details);
    return JSON.stringify(j);
  } catch {
    return body || `RapidShyp API error (${status})`;
  }
}

/**
 * Everything RapidShyp needs for one order: the same body for a shipment
 * (wrapper) and for an order on its own (create_order), so the two can never
 * describe the same parcel differently.
 */
async function buildOrderPayload(orderId: string) {
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) throw new HttpsError("not-found", "Order not found");

  const order = orderDoc.data()!;
  const items: any[] = Array.isArray(order.items) ? order.items : [];

  if (!order.shippingAddress?.phone) {
    throw new HttpsError("failed-precondition", "Order is missing a phone number in the shipping address");
  }
  if (!order.shippingAddress?.pincode) {
    throw new HttpsError("failed-precondition", "Order is missing a pincode in the shipping address");
  }
  if (!items.length) {
    throw new HttpsError("failed-precondition", "Order has no items");
  }

  // Weight and dimensions come off the products, not the order lines.
  const productIds = [...new Set(items.map((i) => i?.productId).filter(Boolean))] as string[];
  const productDocs = productIds.length
    ? await db.getAll(...productIds.map((id) => db.collection("products").doc(id)))
    : [];
  const products = new Map<string, any>();
  productDocs.forEach((d) => { if (d.exists) products.set(d.id, d.data()); });

  const physical = items.filter((i) => products.get(String(i?.productId))?.productType !== "digital");
  if (!physical.length) {
    throw new HttpsError("failed-precondition", "Order contains only digital products, no shipment required");
  }

  let totalWeight = 0, totalLength = 0, totalBreadth = 0, totalHeight = 0;
  for (const item of physical) {
    const p = products.get(String(item?.productId)) || {};
    totalWeight += (num(p.weight) ?? 100) * (num(item?.quantity) ?? 1);
    totalLength += num(p.length) ?? 10;
    totalBreadth += num(p.breadth) ?? 10;
    totalHeight += num(p.height) ?? 2;
  }
  const count = physical.length;
  const avgLength = Math.ceil(totalLength / count);
  const avgBreadth = Math.ceil(totalBreadth / count);
  const avgHeight = Math.ceil(totalHeight / count);
  const packageWeightInGrams = Math.max(1, Math.round(totalWeight));

  const money = orderMoney(order, items);
  if (!(money.total > 0)) {
    throw new HttpsError("failed-precondition", "Order total is missing or invalid");
  }
  for (const item of items) {
    if (!(num(item?.price)! > 0)) {
      throw new HttpsError(
        "failed-precondition",
        `Item price is missing or invalid for ${item?.productTitle || "an item"}`
      );
    }
  }

  const isCod = String(order.paymentMethod || "").toLowerCase() === "cod";
  const paymentMethod = isCod ? "COD" : "Prepaid";
  const codValue = isCod ? (num(order.codAmount) ?? money.total) : 0;

  const nameParts = String(order.shippingAddress.fullName || order.customerName || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const phone = String(order.shippingAddress.phone).replace(/^\+/, "");
  const email = emailOf(order);

  const address = {
    firstName,
    lastName,
    addressLine1: order.shippingAddress.addressLine1 || "",
    addressLine2: order.shippingAddress.addressLine2 || "",
    city: order.shippingAddress.city || "",
    state: order.shippingAddress.state || "",
    pinCode: order.shippingAddress.pincode,
    phone,
    email,
  };

  const orderedAt = num(order.createdAt) || num(order._creationTime) || Date.now();
  const names = await pickupNames(db);

  const payload: Record<string, unknown> = {
    orderId: order.orderNumber || orderDoc.id,
    orderDate: new Date(orderedAt).toISOString().split("T")[0],
    pickupAddressName: names.pickup,
    storeName: names.store,
    billingIsShipping: true,
    shippingAddress: address,
    billingAddress: address,
    orderItems: items.map((item: any) => {
      const price = num(item?.price) ?? 0;
      // Prices are GST-inclusive, so the tax component is price × 0.18/1.18.
      return {
        itemName: item.productTitle,
        sku: item.sku || item.variant,
        units: num(item?.quantity) ?? 1,
        unitPrice: price,
        tax: Number((price * (0.18 / 1.18)).toFixed(2)),
        hsn: "39269099",
      };
    }),
    paymentMethod,
    shippingCharges: money.shippingFee,
    totalDiscount: 0,
    ...(isCod ? { codValue } : {}),
    packageDetails: {
      packageLength: avgLength,
      packageBreadth: avgBreadth,
      packageHeight: avgHeight,
      packageWeight: packageWeightInGrams,
    },
  };

  return { orderRef, order, orderDoc, payload, pickup: names.pickup };
}

export const createShipment = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  await enforceDailyRateLimit({
    key: `createShipment_${uid}`,
    limit: Number(process.env.RAPIDSHYP_DAILY_LIMIT || 200),
  });

  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");

  const config = getRapidShypConfig();
  const { orderRef, order, orderDoc, payload: shipmentPayload, pickup } = await buildOrderPayload(orderId);
  // Refuse rather than book a second consignment for one parcel.
  if (order.awbNumber) {
    throw new HttpsError("already-exists", `Shipment already created (AWB ${order.awbNumber})`);
  }

  console.log("RapidShyp createShipment", {
    order: order.orderNumber || orderDoc.id,
    url: config.apiUrl,
    payload: shipmentPayload,
  });

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "rapidshyp-token": config.apiKey },
    body: JSON.stringify(shipmentPayload),
  });

  if (!response.ok) {
    const body = await response.text();
    const message = describeError(response.status, body);
    console.error("RapidShyp createShipment failed", { status: response.status, body });
    throw new HttpsError("unavailable", message);
  }

  const result: any = await response.json();
  console.log("RapidShyp createShipment response", JSON.stringify(result));

  const refused = refusal(result, pickup);
  if (refused) {
    console.error("RapidShyp createShipment refused", JSON.stringify(result));
    throw new HttpsError("failed-precondition", refused);
  }

  const shipment = result?.shipment?.[0];
  if (!shipment) {
    throw new HttpsError("unavailable", `RapidShyp returned no shipment data: ${JSON.stringify(result)}`);
  }
  const awbNumber = shipment.awb;
  if (!awbNumber) {
    throw new HttpsError("unavailable", `RapidShyp returned no AWB number: ${JSON.stringify(shipment)}`);
  }

  const update: Record<string, unknown> = {
    awbNumber,
    trackingUrl: shipment.tracking_link || `https://app.rapidshyp.com/t/${awbNumber}`,
    shippingStatus: "Shipment Created",
    shippingProvider: "rapidshyp",
    updatedAt: Date.now(),
  };
  if (shipment.courierName) update.courierName = shipment.courierName;
  if (shipment.labelURL) update.labelUrl = shipment.labelURL;
  if (shipment.shipmentId) update.shipmentId = shipment.shipmentId;
  await orderRef.update(update);

  /*
   * The order moves too. This used to write `shippingStatus` and stop, so an
   * order with a printed label and a courier assigned still sat in Processing
   * — while cancelling that same shipment did move the status. The parcel is
   * not shipped yet (nobody has picked it up), so it becomes ready to ship,
   * and the courier's first scan turns it into shipped through the webhook.
   */
  const moved = await setOrderStatus(admin.firestore(), orderId, "ready_to_ship", {
    source: "shipment",
    actor: uid,
    reason: `AWB ${awbNumber}`,
  });
  if (moved.blocked) {
    console.warn("createShipment: status left as it was", { orderId, ...moved });
  }

  return {
    success: true,
    awbNumber,
    shipmentId: shipment.shipmentId,
    trackingUrl: update.trackingUrl,
    labelUrl: shipment.labelURL,
    courierName: shipment.courierName,
    message: "Shipment created successfully",
  };
});

/**
 * The order in RapidShyp, and nothing more.
 *
 * Some parcels want a person's eye: an odd address, a heavy box, a courier
 * chosen by hand. This books the order in the panel — no AWB, no courier, no
 * money spent — and leaves the admin to process it there. A shipment can
 * still be created from here afterwards; RapidShyp keys on the order id, so
 * the same order is not booked twice.
 */
export const createRapidshypOrder = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  await enforceDailyRateLimit({
    key: `createRapidshypOrder_${uid}`,
    limit: Number(process.env.RAPIDSHYP_DAILY_LIMIT || 200),
  });

  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");

  const config = getRapidShypConfig();
  const { orderRef, order, payload, pickup } = await buildOrderPayload(orderId);
  if (order.awbNumber) {
    throw new HttpsError("already-exists", `This parcel already has AWB ${order.awbNumber}`);
  }
  if (order.rapidshypOrderId) {
    throw new HttpsError("already-exists", `Already in RapidShyp as order ${order.rapidshypOrderId} — process it there`);
  }

  console.log("RapidShyp createOrder", { order: payload.orderId, url: config.orderUrl, payload });
  const response = await fetch(config.orderUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "rapidshyp-token": config.apiKey },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error("RapidShyp createOrder failed", { status: response.status, body });
    throw new HttpsError("unavailable", describeError(response.status, body));
  }

  const result: any = await response.json();
  console.log("RapidShyp createOrder response", JSON.stringify(result));
  const refused = refusal(result, pickup);
  if (refused) {
    console.error("RapidShyp createOrder refused", JSON.stringify(result));
    throw new HttpsError("failed-precondition", refused);
  }

  const rapidshypOrderId = String(result?.order_id || result?.orderId || payload.orderId);
  const update: Record<string, unknown> = {
    rapidshypOrderId,
    shippingProvider: "rapidshyp",
    shippingStatus: "Order created in RapidShyp",
    updatedAt: Date.now(),
  };
  // Some accounts assign a courier on order creation anyway; take the AWB if
  // one came back rather than leaving the order looking unshipped.
  const shipment = result?.shipment?.[0];
  if (shipment?.awb) {
    update.awbNumber = shipment.awb;
    update.trackingUrl = shipment.tracking_link || `https://app.rapidshyp.com/t/${shipment.awb}`;
    update.shippingStatus = "Shipment Created";
    if (shipment.courierName) update.courierName = shipment.courierName;
    if (shipment.labelURL) update.labelUrl = shipment.labelURL;
    if (shipment.shipmentId) update.shipmentId = shipment.shipmentId;
  }
  await orderRef.update(update);

  // An order booked with no courier is still in the workshop; only an AWB
  // means it is packed and waiting for a pickup.
  if (shipment?.awb) {
    await setOrderStatus(admin.firestore(), orderId, "ready_to_ship", {
      source: "shipment",
      actor: uid,
      reason: `AWB ${shipment.awb}`,
    });
  }

  return {
    success: true,
    rapidshypOrderId,
    awbNumber: shipment?.awb || null,
    message: shipment?.awb
      ? `Order created in RapidShyp · AWB ${shipment.awb}`
      : "Order created in RapidShyp — assign the courier there",
  };
});

export const cancelShipment = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");

  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) throw new HttpsError("not-found", "Order not found");

  const order = orderDoc.data()!;
  if (!order.awbNumber) throw new HttpsError("failed-precondition", "Order has no shipment to cancel");

  const config = getRapidShypConfig();
  const base = config.apiUrl.replace(/\/rapidshyp\/apis\/v1\/wrapper\/?$/, "");
  const response = await fetch(`${base}/v1/external/orders/cancel/${order.awbNumber}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "rapidshyp-token": config.apiKey },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("RapidShyp cancelShipment failed", { status: response.status, body });
    throw new HttpsError("unavailable", describeError(response.status, body));
  }

  await orderRef.update({
    awbNumber: admin.firestore.FieldValue.delete(),
    trackingUrl: admin.firestore.FieldValue.delete(),
    courierName: admin.firestore.FieldValue.delete(),
    labelUrl: admin.firestore.FieldValue.delete(),
    shipmentId: admin.firestore.FieldValue.delete(),
    shippingProvider: admin.firestore.FieldValue.delete(),
    shippingStatus: "",
    updatedAt: Date.now(),
  });

  /*
   * Back to the workshop — but asked for, not asserted. This wrote
   * `status: "processing"` outright, which also reopened orders that had
   * already been delivered or cancelled. The graph refuses those and says so.
   */
  const moved = await setOrderStatus(db, orderId, "processing", {
    source: "shipment",
    actor: uid,
    reason: "Shipment cancelled",
  });

  return {
    success: true,
    message: moved.blocked
      ? `Shipment cancelled. The order is ${moved.from} and was left there.`
      : "Shipment cancelled successfully",
    orderNumber: order.orderNumber,
  };
});

/**
 * Pulls the shipping labels for a batch of orders as base64 PDFs.
 *
 * The fetch happens here rather than in the browser because the label lives on
 * a RapidShyp host that sends no CORS headers — the page can neither read the
 * bytes nor lay them out four-to-a-sheet.
 */
export const bulkFetchLabels = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const orderIds: string[] = Array.isArray(data?.orderIds) ? data.orderIds : [];
  if (!orderIds.length) throw new HttpsError("invalid-argument", "No orders selected");
  if (orderIds.length > 100) throw new HttpsError("invalid-argument", "At most 100 labels at a time");

  const db = admin.firestore();
  const labels: any[] = [];
  const errors: any[] = [];

  const docs = await db.getAll(...orderIds.map((id) => db.collection("orders").doc(id)));
  for (const snap of docs) {
    const order: any = snap.exists ? snap.data() : null;
    const label = String(order?.orderNumber || order?.failedOrderNumber || "Pending");
    if (!order) { errors.push({ orderId: snap.id, orderNumber: label, error: "Order not found" }); continue; }
    if (!order.labelUrl) { errors.push({ orderId: snap.id, orderNumber: label, error: "No label URL found" }); continue; }
    try {
      const res = await fetch(String(order.labelUrl), { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.byteLength) throw new Error("Empty PDF file");
      labels.push({ orderId: snap.id, orderNumber: label, pdfBase64: buf.toString("base64") });
    } catch (e: any) {
      errors.push({ orderId: snap.id, orderNumber: label, error: e?.message || "Fetch failed" });
    }
  }

  return { success: errors.length === 0, labels, errors };
});

/**
 * Tracking typed in by hand, for a parcel that went by some other courier.
 *
 * This lived in the browser shim and decided the status itself:
 *
 *     const statusUpdated = current === 'processing' || current === 'pending_payment';
 *
 * Two faults in one line. `pending_payment` meant an order nobody had paid for
 * could be marked shipped, and the list left out "pending" — the value the
 * live checkout actually writes — so the same button moved some orders and
 * silently ignored others, depending on which generation of checkout had
 * written them. Both disappear by asking setOrderStatus instead: it normalises
 * the stored value first, and the graph has no edge from pending_payment to
 * shipped.
 */
export const saveManualTracking = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  const trackingNumber = String(data?.trackingNumber || "").trim();
  const courierCompany = String(data?.courierCompany || "").trim();

  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");
  if (!trackingNumber) throw new HttpsError("invalid-argument", "Tracking number is required");
  if (!courierCompany) throw new HttpsError("invalid-argument", "Courier company is required");

  const db = admin.firestore();
  const ref = db.collection("orders").doc(orderId);
  if (!(await ref.get()).exists) throw new HttpsError("not-found", "Order not found");

  await ref.update({
    manualTrackingNumber: trackingNumber,
    manualCourierCompany: courierCompany,
    shippingStatus: `Shipped via ${courierCompany}`,
    shippingProvider: "manual",
    updatedAt: Date.now(),
  });

  const moved = await setOrderStatus(db, orderId, "shipped", {
    source: "manual-tracking",
    actor: uid,
    reason: `${courierCompany} ${trackingNumber}`,
  });

  return {
    success: true,
    statusUpdated: moved.changed,
    status: moved.to || moved.from,
    message: moved.changed
      ? "Manual tracking saved — the order is now shipped and the customer has been told."
      : moved.blocked
        ? `Manual tracking saved. The order is ${moved.from}, so its status was left alone.`
        : "Manual tracking saved.",
  };
});
