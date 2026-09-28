import * as functionsV1 from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { getCaller } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";
import { linkTokenValid, payLinkToken } from "./payLink";
import { isConfirmedOrder } from "./materials";
import { loadSmartRules, smartKindOf, smartLinePrice } from "./smartUpsell";

/**
 * "Add to this parcel": add-ons bought after the order, before it is packed.
 *
 * The customer has already said yes and paid; the parcel has not been packed
 * yet, so one more piece rides in it with no shipping. The add-on is its own
 * small order (`addOnTo` → the parent), paid online through the usual pay link
 * (/pay/<id>?t=…, resumePayment) and confirmed, numbered and invoiced like any
 * other. It is never shipped by itself: shipment calls refuse it, and when the
 * parent gets its AWB or moves on, the add-on follows (mirrorParentShipping).
 *
 * Priced by the Smart Setup rules (settings/smartUpsell), anchored on the
 * parent's skins — the same offer the product page shows. No free gift here:
 * the gift is for building a cart, not for an order already placed.
 */

const MAX_ITEMS = 5;
/** Offered while the parent is waiting to be packed, and not after this long. */
const WINDOW_MS = 72 * 3600 * 1000;

export function addOnEligible(o: any): string | null {
  if (!o || o.isDeleted) return "Order not found";
  if (o.addOnTo) return "This is already an add-on";
  if (!isConfirmedOrder(o)) return "This order is not confirmed yet";
  if (o.awbNumber || !["processing", "pending"].includes(String(o.status || ""))) return "This order has already been packed";
  if (Number(o.confirmedAt || o.createdAt || 0) < Date.now() - WINDOW_MS) return "Too late to add to this order";
  return null;
}

export const createAddOnOrder = functionsV1
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .https.onCall(async (data: any, context: any) => {
    const { uid } = getCaller(context);
    const parentId = typeof data?.orderId === "string" ? data.orderId : "";
    if (!parentId || parentId.includes("/") || parentId.length > 128) throw new HttpsError("invalid-argument", "Invalid order");
    await enforceDailyRateLimit({ key: `createAddOnOrder_${parentId}`, limit: 20 });

    const db = admin.firestore();
    const parentRef = db.collection("orders").doc(parentId);
    const parent = (await parentRef.get()).data() as any;

    // The customer's own order link (?k=), or its signed-in owner.
    const tok = context?.auth?.token || {};
    const byEmail = !!uid && tok.email_verified === true && !!tok.email && String(tok.email).toLowerCase() === String(parent?.email || "").toLowerCase();
    const allowed = linkTokenValid("view", parentId, data?.k) || (!!uid && (parent?.userId === uid || parent?.ownerUid === uid)) || byEmail;
    if (!parent || !allowed) throw new HttpsError("permission-denied", "This order link is not valid");
    const why = addOnEligible(parent);
    if (why) throw new HttpsError("failed-precondition", why);

    const wanted: any[] = Array.isArray(data?.items) ? data.items.slice(0, MAX_ITEMS) : [];
    if (!wanted.length) throw new HttpsError("invalid-argument", "Nothing to add");

    // The parent's products anchor the offer (a skin must be in it).
    const parentItems: any[] = Array.isArray(parent.items) ? parent.items.filter((i: any) => !i?.upsellRuleId) : [];
    const parentProducts = (await Promise.all([...new Set(parentItems.map((i) => String(i.productId || "")).filter(Boolean))]
      .map((id) => db.collection("products").doc(id).get()))).filter((d) => d.exists).map((d) => d.data());
    const restValue = parentItems.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
    const rules = await loadSmartRules(db);
    const noGift = { giftGiven: true };

    const lines: any[] = [];
    for (const w of wanted) {
      const productId = String(w?.productId || "");
      const variant = String(w?.variant || "");
      const claimed = String(w?.upsellRuleId || "");
      const [pdoc, vsnap] = await Promise.all([
        db.collection("products").doc(productId).get(),
        db.collection("variants").where("productId", "==", productId).where("title", "==", variant).limit(1).get(),
      ]);
      const product = pdoc.data();
      const v = vsnap.docs[0]?.data() as any;
      if (!product || !v) throw new HttpsError("invalid-argument", "That item is no longer available");
      if (!(Number(v.inventoryQuantity ?? v.inventory_quantity) > 0)) throw new HttpsError("failed-precondition", `${product.title} is out of stock`);
      const kind = smartKindOf(product);
      if (!kind || claimed !== `smart:${kind}`) throw new HttpsError("invalid-argument", "That item cannot be added to an order");
      const full = Number(v.price) || 0;
      const offer = smartLinePrice(claimed, product, full, 1, parentProducts, restValue, rules, noGift);
      lines.push({
        productId, productTitle: String(product.title || ""), productImage: String(w?.productImage || product.images?.[0]?.url || product.images?.[0] || ""),
        variant, variantId: vsnap.docs[0].id, ...(v.sku ? { sku: String(v.sku) } : {}),
        price: offer ?? full, quantity: 1, upsellRuleId: claimed, upsellSource: "parcel", addOn: true,
        ...(w?.phoneModel ? { phoneBrand: String(w.phoneBrand || ""), phoneModel: String(w.phoneModel) } : {}),
      });
    }

    const itemsTotal = lines.reduce((s, l) => s + l.price, 0);
    const ref = db.collection("orders").doc();
    const now = Date.now();
    await ref.set({
      checkoutRef: `CHK-${ref.id.slice(0, 8).toUpperCase()}`,
      addOnTo: parentId,
      parentOrderNumber: String(parent.orderNumber || ""),
      userId: parent.userId || "guest",
      ...(parent.ownerUid ? { ownerUid: parent.ownerUid } : {}),
      customerName: parent.customerName || parent.shippingAddress?.fullName || "Guest",
      email: parent.email || "",
      phone: parent.phone || parent.shippingAddress?.phone || "",
      shippingAddress: parent.shippingAddress || {},
      paymentMethod: "phonepe",
      status: "pending_payment",
      paymentStatus: "pending",
      itemsTotal, shippingFee: 0, couponId: null, couponCode: null, couponDiscount: 0,
      walletUsed: 0, walletCreditCouponAmount: 0, cashbackAmount: 0, cashbackLines: [], creditOnDelivery: 0,
      codFee: 0, prepaidAmount: 0, total: itemsTotal, amountPayable: itemsTotal,
      items: lines,
      createdAt: now, updatedAt: now,
    });
    await parentRef.update({ addOnOrderIds: admin.firestore.FieldValue.arrayUnion(ref.id) });
    console.log("createAddOnOrder", { parent: parent.orderNumber, child: ref.id, itemsTotal, lines: lines.length });
    return { orderId: ref.id, amount: itemsTotal, payPath: `/pay/${ref.id}?t=${payLinkToken(ref.id)}` };
  });

/**
 * An add-on travels in its parent's parcel, so it takes the parent's AWB,
 * courier and status as they change — its own order page tracks the same
 * parcel, and it never shows as "to pack" once the parcel has gone.
 */
// Not awbNumber itself: the courier webhooks find an order by its AWB, and
// two orders holding one would send the parent's updates to the add-on.
const MIRROR = ["status", "courierName", "trackScans", "expectedDeliveryAt", "statusChangedAt", "shippedAt", "deliveredAt"];

export const mirrorParentShipping = functionsV1.firestore
  .document("orders/{orderId}")
  .onUpdate(async (change) => {
    const before = change.before.data() as any;
    const after = change.after.data() as any;
    const kids: string[] = Array.isArray(after?.addOnOrderIds) ? after.addOnOrderIds : [];
    if (!kids.length) return null;
    const changed = [...MIRROR, "awbNumber"].some((k) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(after?.[k] ?? null));
    if (!changed) return null;
    const db = admin.firestore();
    for (const id of kids) {
      const ref = db.collection("orders").doc(id);
      const kid = (await ref.get()).data() as any;
      // Only paid add-ons ride along; an unpaid one is left to expire.
      if (!kid || !isConfirmedOrder(kid) || ["cancelled", "rto"].includes(String(kid.status))) continue;
      const patch: Record<string, any> = { updatedAt: Date.now() };
      for (const k of MIRROR) if (after[k] !== undefined) patch[k] = after[k];
      if (after.awbNumber) patch.parentAwbNumber = after.awbNumber;
      // A cancelled parent does not cancel a paid add-on by itself: that needs a person (and a refund).
      if (after.status === "cancelled") delete patch.status;
      await ref.update(patch);
    }
    return null;
  });
