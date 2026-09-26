import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { linkTokenValid, payLinkValid } from "./payLink";

/**
 * One order, for the storefront's order, payment-return, pay and review pages.
 *
 * Orders were readable by anyone holding the document id (`allow get: if
 * true`), so a forwarded or leaked /orders/<id> link opened the customer's
 * name, phone, address and tracking in any browser. The rule now admits only
 * an admin and the order's owner, and everyone else comes through here:
 *
 *   full view      an admin; the signed-in owner (ownerUid, or the verified
 *                  email the order was placed with); or a link we sent, which
 *                  carries a signed key (?k= for the order link, ?t= for the
 *                  pay link) — how a guest who checked out without an account
 *                  opens their own order from the email or WhatsApp.
 *   limited view   anyone else: order number, status, what was bought and
 *                  what it cost. No name, phone, email, address or tracking.
 */

/** Fields safe to show whoever has the link: nothing that identifies or locates a person. */
const PUBLIC_FIELDS = [
  "orderNumber", "checkoutRef", "invoiceNumber", "status", "paymentStatus", "paymentMethod",
  "subtotal", "itemsTotal", "shippingFee", "codFee", "codAmount", "discount", "couponDiscount", "couponCode",
  "walletUsed", "walletAmountUsed", "total", "amountPayable", "gstAmount", "cgst", "sgst", "igst",
  "cgstRate", "sgstRate", "igstRate", "createdAt", "_creationTime", "updatedAt", "isDeleted",
  "expectedDeliveryAt", "deliveredAt", "shippedAt", "cancelledAt", "courierName", "upsellItems",
  "reviewedAt", "reviewRewardPaid", "reviewRewardOwed",
];
const ITEM_FIELDS = ["productId", "productTitle", "productImage", "variant", "variantId", "sku", "quantity", "price",
  "compareAtPrice", "phoneBrand", "phoneModel", "gadgetType", "finishType", "isUpsell"];

async function isAdminCaller(context: any): Promise<boolean> {
  try { await requireAdmin(context); return true; } catch { return false; }
}

function ownsOrder(context: any, order: any): boolean {
  const uid = context?.auth?.uid;
  if (!uid) return false;
  if (order.ownerUid && order.ownerUid === uid) return true;
  const t = context.auth.token || {};
  const email = String(t.email || "").toLowerCase();
  return !!email && t.email_verified === true && email === String(order.email || order.customerEmail || "").toLowerCase();
}

export const viewOrder = onCall(async (data: any, context: any) => {
  const orderId = String(data?.orderId || "").trim();
  if (!orderId || orderId.length > 64 || orderId.includes("/")) throw new HttpsError("invalid-argument", "Missing orderId");
  const snap = await admin.firestore().collection("orders").doc(orderId).get();
  if (!snap.exists) return null;
  const order = snap.data() as any;

  let viaLink = false;
  try {
    viaLink = linkTokenValid("view", orderId, data?.k) || payLinkValid(orderId, data?.t) || linkTokenValid("review", orderId, data?.t);
  } catch { viaLink = false; }
  const full = viaLink || ownsOrder(context, order) || (await isAdminCaller(context));
  if (full) {
    // This order's own reviews, pending ones included, so the review page can
    // show what was sent (the public can read only approved reviews).
    const mine = await admin.firestore().collection("reviews").where("orderId", "==", orderId).get();
    return { _id: snap.id, ...order, access: "full", myReviews: mine.docs.map((d) => ({ _id: d.id, ...d.data() })) };
  }

  const limited: Record<string, unknown> = { _id: snap.id, access: "limited" };
  for (const f of PUBLIC_FIELDS) if (order[f] !== undefined) limited[f] = order[f];
  limited.items = (Array.isArray(order.items) ? order.items : []).map((it: any) => {
    const out: Record<string, unknown> = {};
    for (const f of ITEM_FIELDS) if (it?.[f] !== undefined) out[f] = it[f];
    return out;
  });
  return limited;
});
