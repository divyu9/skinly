import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";

/**
 * The admin home's activity log: what just happened, newest first, each with
 * the page (or button) to act on it.
 *
 * Built on request from the collections that already hold these moments, so
 * there is no second copy to keep in step and nothing to backfill:
 *   orders            a new confirmed order; a parcel that failed or came back
 *   modelRequests     a shopper asked for a model we don't list
 *   reviews           a review came in (pending ones can be approved in place)
 *   stockNotifications someone wants a sold-out variant back
 *   cartSnapshots     a checkout left with a phone number
 * Each source reads only its newest few documents (single-field order, no
 * composite index), so a call costs a handful of reads.
 */

type Event = {
  id: string;
  kind: "order" | "delivery" | "model" | "review" | "stock" | "cart";
  at: number;
  title: string;
  sub?: string;
  link: string;
  status?: string;
  /** Present when the event can be settled from the log itself. */
  reviewId?: string;
};

const inr = (n: unknown) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const num = (...v: unknown[]) => v.map(Number).find((x) => Number.isFinite(x) && x > 0) || 0;
const phone10 = (p: unknown) => String(p || "").replace(/\D/g, "").slice(-10);
/** "Lenovo" + "Lenovo idea tab" reads "Lenovo idea tab", not the brand twice. */
const deviceName = (brand: unknown, model: unknown) => {
  const b = String(brand || "").trim(), m = String(model || "").trim();
  return b && m.toLowerCase().startsWith(b.toLowerCase()) ? m : [b, m].filter(Boolean).join(" ");
};

async function newest(db: admin.firestore.Firestore, col: string, field: string, n: number) {
  try {
    return (await db.collection(col).orderBy(field, "desc").limit(n).get()).docs;
  } catch (e: any) {
    console.warn("[adminActivity]", col, e?.message || e);
    return [];
  }
}

export async function adminActivityEvents(db: admin.firestore.Firestore, limit = 20): Promise<Event[]> {
  // Each source reads in proportion to how far back the log is asked to go ("Show more").
  const x = Math.max(1, Math.ceil(limit / 20));
  const [orders, changed, models, reviews, stock, carts] = await Promise.all([
    newest(db, "orders", "createdAt", 40 * x),
    newest(db, "orders", "statusChangedAt", 30 * x),
    newest(db, "modelRequests", "requestedAt", 20 * x),
    newest(db, "reviews", "createdAt", 20 * x),
    newest(db, "stockNotifications", "subscribedAt", 15 * x),
    // By checkoutAt, which only a checkout (or a cart saved with a phone) sets: read by updatedAt,
    // the plain carts of a busy morning pushed every checkout left before ~11am out of the log.
    newest(db, "cartSnapshots", "checkoutAt", 40 * x),
  ]);
  const out: Event[] = [];
  // When each phone last ordered, so a checkout that did end in an order
  // (its snapshot never moved to "ordered") is not shown as left.
  const orderedAt = new Map<string, number>();
  for (const d of orders) {
    const o = d.data() as any;
    const p = phone10(o.shippingAddress?.phone || o.phone);
    const t = num(o.createdAt);
    if (p && o.orderNumber && t > (orderedAt.get(p) || 0)) orderedAt.set(p, t);
  }

  for (const d of orders) {
    const o = d.data() as any;
    if (o.isDeleted || !o.orderNumber) continue; // unpaid checkouts are the cart events below
    const items = Array.isArray(o.items) ? o.items : [];
    const n = items.reduce((s: number, i: any) => s + (Number(i?.quantity) || 1), 0);
    out.push({
      id: `order-${d.id}`, kind: "order", at: num(o.confirmedAt, o.createdAt),
      title: `New order ${o.orderNumber} for ${inr(o.total ?? o.amountPayable)}`,
      sub: [o.shippingAddress?.fullName || o.customerName, `${n} item${n === 1 ? "" : "s"}`,
        String(o.paymentMethod || "").toLowerCase() === "cod" ? "COD" : "Prepaid", o.source === "manual" ? "manual" : ""].filter(Boolean).join(" · "),
      link: `/backend-skinly/orders/${d.id}`, status: String(o.status || ""),
    });
  }

  // Direct-UPI clearance orders waiting for the admin to check the money (clearance.ts).
  for (const d of orders) {
    const o = d.data() as any;
    if (o.paymentMethod !== "upi_direct" || o.paymentStatus === "success" || o.status === "cancelled" || o.isDeleted) continue;
    out.push({
      id: `upi-${d.id}`, kind: "delivery", at: num(o.upiSubmittedAt, o.createdAt),
      title: o.upiUtr ? `UPI payment to verify: ${inr(o.upiPay?.amount ?? o.total)} (UTR ${o.upiUtr})` : `Clearance order waiting for UPI payment: ${inr(o.upiPay?.amount ?? o.total)}`,
      sub: [o.shippingAddress?.fullName || o.customerName, o.checkoutRef].filter(Boolean).join(" · "),
      link: `/backend-skinly/orders/${d.id}`, status: "pending_payment",
    });
  }

  for (const d of changed) {
    const o = d.data() as any;
    if (o.isDeleted || !["undelivered", "rto"].includes(String(o.status))) continue;
    out.push({
      id: `delivery-${d.id}-${o.status}`, kind: "delivery", at: num(o.statusChangedAt),
      title: o.status === "rto" ? `Order ${o.orderNumber || ""} is coming back (RTO)` : `Delivery failed for ${o.orderNumber || "an order"}`,
      sub: [o.shippingAddress?.fullName || o.customerName, o.shippingStatus].filter(Boolean).join(" · "),
      link: `/backend-skinly/orders/${d.id}`, status: String(o.status),
    });
  }

  for (const d of models) {
    const r = d.data() as any;
    out.push({
      id: `model-${d.id}`, kind: "model", at: num(r.requestedAt, r._creationTime),
      title: `${phone10(r.whatsappPhone) || "Someone"} requested ${deviceName(r.brandName, r.modelName)}`,
      sub: [r.category, r.requestNumber ? `#${r.requestNumber}` : ""].filter(Boolean).join(" · "),
      link: "/backend-skinly/models?tab=requests", status: String(r.status || "pending"),
    });
  }

  for (const d of reviews) {
    const r = d.data() as any;
    const photos = Array.isArray(r.imageUrls) ? r.imageUrls.length : 0;
    out.push({
      id: `review-${d.id}`, kind: "review", at: num(r.createdAt, r._creationTime),
      title: `New ${"★".repeat(Math.max(1, Math.min(5, Number(r.rating) || 0)))} review by ${r.userName || "a customer"}`,
      sub: [r.productTitle, photos ? `${photos} photo${photos === 1 ? "" : "s"}` : "", r.comment ? `“${String(r.comment).slice(0, 80)}”` : ""].filter(Boolean).join(" · "),
      link: "/backend-skinly/reviews", status: String(r.status || "pending"),
      ...(String(r.status || "pending") === "pending" ? { reviewId: d.id } : {}),
    });
  }

  for (const d of stock) {
    const s = d.data() as any;
    out.push({
      id: `stock-${d.id}`, kind: "stock", at: num(s.subscribedAt, s._creationTime),
      title: `${phone10(s.phoneNumber) || "Someone"} wants ${s.productTitle || "a product"} back in stock`,
      sub: [s.variantTitle, s.sku].filter(Boolean).join(" · "),
      link: "/backend-skinly/stock-notifications", status: String(s.status || "waiting"),
    });
  }

  for (const d of carts) {
    const c = d.data() as any;
    if (c.stage !== "checkout" || !c.phone) continue;
    const left = num(c.checkoutAt, c.updatedAt);
    if ((orderedAt.get(phone10(c.phone)) || 0) > left - 3600_000) continue;
    out.push({
      id: `cart-${d.id}`, kind: "cart", at: num(c.checkoutAt, c.updatedAt),
      title: `Checkout left by ${c.name || c.phone} for ${inr(c.total)}`,
      sub: [`${c.itemCount || (c.items || []).length} item${(c.itemCount || 0) === 1 ? "" : "s"}`, c.phoneVerified ? "number verified" : "", c.phone].filter(Boolean).join(" · "),
      link: `/backend-skinly/abandoned-carts?checkout=${encodeURIComponent(d.id)}`,
    });
  }

  return out.filter((e) => e.at > 0).sort((a, b) => b.at - a.at).slice(0, limit);
}

export const adminActivity = functionsV1
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    const { requireAdmin } = await import("./auth");
    await requireAdmin(context);
    const limit = Math.max(5, Math.min(200, Number(data?.limit) || 20));
    return { events: await adminActivityEvents(admin.firestore(), limit), at: Date.now() };
  });
