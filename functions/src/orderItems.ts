import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { isConfirmedOrder, releaseMaterialForOrder, reserveMaterialForOrder } from "./materials";

/**
 * Admin › Order › Edit items: change what an order contains — another design,
 * another SKU or variant, a quantity — and keep the shelf honest.
 *
 * The editor used to write `items` straight from the browser. Material had
 * already come off for the old lines when the order was confirmed, so a
 * swapped design left the old design's sheet marked as cut and the new one's
 * untouched. Here the old consumption goes back to stock, the new lines are
 * written, and the new consumption comes off — the same reserve/release the
 * order's own lifecycle uses — with a record of what changed and why.
 *
 * Only before the parcel is booked: once an AWB exists the box is packed, and
 * a change after that is a reship (reshipOrder), not an edit.
 */

const LOCKED = new Set(["shipped", "out_for_delivery", "delivered", "undelivered", "rto", "cancelled"]);

const lineOf = (i: any) => ({
  productId: String(i?.productId || ""),
  productTitle: String(i?.productTitle || "Item").slice(0, 200),
  productImage: String(i?.productImage || ""),
  productSlug: String(i?.productSlug || i?.slug || ""),
  variant: String(i?.variant || ""),
  sku: String(i?.sku || ""),
  price: Math.max(0, Number(i?.price) || 0),
  quantity: Math.max(1, Math.min(50, Math.round(Number(i?.quantity) || 1))),
  ...(i?.phoneBrand ? { phoneBrand: String(i.phoneBrand) } : {}),
  ...(i?.phoneModel ? { phoneModel: String(i.phoneModel) } : {}),
  ...(i?.coverage ? { coverage: String(i.coverage) } : {}),
  ...(i?.upsellRuleId ? { upsellRuleId: String(i.upsellRuleId) } : {}),
  ...(i?.upsellSource ? { upsellSource: String(i.upsellSource) } : {}),
});

export const replaceOrderItems = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  const reason = String(data?.reason || "").trim().slice(0, 300);
  const raw: any[] = Array.isArray(data?.items) ? data.items : [];
  if (!orderId) throw new HttpsError("invalid-argument", "orderId is required");
  if (!raw.length) throw new HttpsError("invalid-argument", "An order needs at least one item");
  const items = raw.map(lineOf);
  if (items.some((i) => !i.productId || !i.variant)) throw new HttpsError("invalid-argument", "Every item needs a product and a variant");

  const db = admin.firestore();
  const ref = db.collection("orders").doc(orderId);
  const order = (await ref.get()).data() as any;
  if (!order) throw new HttpsError("not-found", "Order not found");
  if (LOCKED.has(String(order.status)) || order.awbNumber) {
    throw new HttpsError("failed-precondition", "This order is already shipped — use Reship instead of editing it");
  }

  // The SKU each line will be cut and shipped under, from the variant itself.
  for (const it of items) {
    const v = await db.collection("variants").where("productId", "==", it.productId).where("title", "==", it.variant).limit(1).get();
    if (v.empty) throw new HttpsError("invalid-argument", `No variant "${it.variant}" on product ${it.productTitle}`);
    it.sku = String((v.docs[0].data() as any).sku || it.sku || "");
  }

  const before = Array.isArray(order.items) ? order.items : [];
  const itemsTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const oldItemsTotal = before.reduce((s: number, i: any) => s + (Number(i?.price) || 0) * (Number(i?.quantity) || 1), 0);
  const cod = String(order.paymentMethod || "").toLowerCase() === "cod";

  // 2. The new lines, with the totals they imply. A prepaid order's total is
  // what was paid and stays; a COD order's is what the courier collects, so it
  // follows the goods by the same difference.
  const diff = Math.round((itemsTotal - oldItemsTotal) * 100) / 100;
  const change = {
    at: Date.now(), by: uid, reason,
    before: before.map((i: any) => ({ title: i?.productTitle ?? null, variant: i?.variant ?? null, sku: i?.sku ?? null, qty: i?.quantity ?? null, price: i?.price ?? null })),
    after: items.map((i) => ({ title: i.productTitle, variant: i.variant, sku: i.sku, qty: i.quantity, price: i.price })),
    itemsTotalDiff: diff,
  };
  // 1. What the old lines took goes back on the shelf (only if it was taken).
  // Done only now, with everything to write already built and checked, so a
  // bad input can't leave the stock returned and the lines unchanged.
  const hadMaterial = Array.isArray(order.materialConsumed) && order.materialConsumed.length && !order.materialReleasedAt;
  const returned = hadMaterial ? await releaseMaterialForOrder(db, ref) : [];

  await ref.update({
    items,
    itemsTotal,
    ...(cod && diff !== 0 ? { total: Math.max(0, (Number(order.total) || 0) + diff) } : {}),
    itemChanges: admin.firestore.FieldValue.arrayUnion(change),
    // Cleared so the new lines can be reserved, and released later if this is cancelled.
    materialConsumed: admin.firestore.FieldValue.delete(),
    materialClaimedAt: admin.firestore.FieldValue.delete(),
    materialReleasedAt: admin.firestore.FieldValue.delete(),
    updatedAt: Date.now(),
  });

  // 3. The new lines take their material — if the order is confirmed (an
  // unpaid one takes nothing until it is, by the usual trigger).
  let took: any[] = [];
  if (isConfirmedOrder({ ...order, items })) {
    await reserveMaterialForOrder(db, ref, items);
    took = (((await ref.get()).data() as any)?.materialConsumed) || [];
  }

  console.log("replaceOrderItems", { orderId, by: uid, returned: returned.length, took: took.length, diff });
  return { ok: true, returned, took, itemsTotalDiff: diff, totalChanged: cod && diff !== 0 };
});

/**
 * Admin › Order › Reship: a parcel lost in transit or delivered damaged goes
 * out again as a replacement order linked to the original.
 *
 * A new order rather than a second shipment on the old one: the original keeps
 * its AWB, tracking and delivery history (the courier claim needs them), and
 * the replacement has its own — status messages included, so the customer is
 * told the new tracking. It is confirmed and prepaid at once, so the material
 * trigger takes its stock like any order (onOrderConfirmedStock); its lines
 * carry the original prices because the courier needs a declared value, and
 * `isReplacement` keeps it out of sales, revenue and review asks. It is
 * numbered after its parent (#4079-R1) and given no tax invoice of its own.
 */
export const reshipOrder = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  const reason = String(data?.reason || "").trim().slice(0, 300);
  const picks: number[] | null = Array.isArray(data?.lineIndexes) ? data.lineIndexes.map(Number) : null;
  if (!orderId) throw new HttpsError("invalid-argument", "orderId is required");
  if (!reason) throw new HttpsError("invalid-argument", "Say why it is being reshipped (lost, damaged…)");

  const db = admin.firestore();
  const parentRef = db.collection("orders").doc(orderId);
  const parent = (await parentRef.get()).data() as any;
  if (!parent) throw new HttpsError("not-found", "Order not found");
  if (parent.isReplacement) throw new HttpsError("failed-precondition", "Reship the original order, not a replacement");
  if (!isConfirmedOrder(parent)) throw new HttpsError("failed-precondition", "Only a confirmed order can be reshipped");

  const lines = (Array.isArray(parent.items) ? parent.items : [])
    .filter((_: any, i: number) => !picks || picks.includes(i))
    .map((i: any) => ({ ...lineOf(i), quantity: Math.max(1, Number(i?.quantity) || 1) }));
  if (!lines.length) throw new HttpsError("invalid-argument", "Pick at least one item to reship");

  const n = (Array.isArray(parent.replacementOrderIds) ? parent.replacementOrderIds.length : 0) + 1;
  const orderNumber = `${parent.orderNumber}-R${n}`;
  const itemsTotal = lines.reduce((s: number, l: any) => s + l.price * l.quantity, 0);
  const ref = db.collection("orders").doc();
  const now = Date.now();
  await ref.set({
    orderNumber,
    isReplacement: true,
    reshipOf: orderId,
    parentOrderNumber: String(parent.orderNumber || ""),
    reshipReason: reason,
    reshippedBy: uid,
    // No invoice of its own: the original's covers the sale.
    invoiceNumber: `${parent.invoiceNumber || parent.orderNumber}-R${n}`,
    invoiceValue: 0,
    userId: parent.userId || "guest",
    ...(parent.ownerUid ? { ownerUid: parent.ownerUid } : {}),
    customerName: parent.customerName || parent.shippingAddress?.fullName || "Customer",
    email: parent.email || "",
    phone: parent.phone || parent.shippingAddress?.phone || "",
    shippingAddress: parent.shippingAddress || {},
    paymentMethod: "replacement",
    paymentStatus: "success",
    status: "processing",
    itemsTotal, shippingFee: 0, codFee: 0, couponDiscount: 0, walletUsed: 0,
    walletCreditCouponAmount: 0, cashbackAmount: 0, creditOnDelivery: 0,
    total: itemsTotal, amountPayable: 0, prepaidAmount: itemsTotal,
    items: lines,
    ...(parent.packageOverride ? { packageOverride: parent.packageOverride } : {}),
    createdAt: now, confirmedAt: now, updatedAt: now,
  });
  await parentRef.update({
    replacementOrderIds: admin.firestore.FieldValue.arrayUnion(ref.id),
    reships: admin.firestore.FieldValue.arrayUnion({ at: now, by: uid, reason, orderId: ref.id, orderNumber }),
    updatedAt: now,
  });
  console.log("reshipOrder", { parent: parent.orderNumber, replacement: orderNumber, lines: lines.length, reason });
  return { orderId: ref.id, orderNumber };
});
