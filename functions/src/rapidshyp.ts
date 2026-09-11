import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";

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
  return { apiKey, apiUrl };
};

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

export const createShipment = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  await enforceDailyRateLimit({
    key: `createShipment_${uid}`,
    limit: Number(process.env.RAPIDSHYP_DAILY_LIMIT || 200),
  });

  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");

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
  // Refuse rather than book a second consignment for one parcel.
  if (order.awbNumber) {
    throw new HttpsError("already-exists", `Shipment already created (AWB ${order.awbNumber})`);
  }

  const config = getRapidShypConfig();

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

  const shipmentPayload: Record<string, unknown> = {
    orderId: order.orderNumber || orderDoc.id,
    orderDate: new Date(orderedAt).toISOString().split("T")[0],
    pickupAddressName: process.env.RAPIDSHYP_PICKUP_NAME || "SKINLY",
    storeName: process.env.RAPIDSHYP_STORE_NAME || "DEFAULT",
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

export const cancelShipment = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
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
    status: "processing",
    updatedAt: Date.now(),
  });

  return { success: true, message: "Shipment cancelled successfully", orderNumber: order.orderNumber };
});
