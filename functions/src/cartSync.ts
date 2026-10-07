import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import { enforceDailyRateLimit } from "./rate-limit";

/**
 * A guest's cart, as the server sees it.
 *
 * A guest's cart lived only in their browser, so a day with 200 visitors and
 * people adding to cart showed no carts at all: Admin › Abandoned Carts
 * could see only signed-in carts and checkouts that reached Place Order.
 * The storefront now sends the cart here (debounced) to `cartSnapshots/{cartId}`:
 *
 *   stage "cart"      — items only, no contact. Counted on the dashboard; no
 *                       one to remind.
 *   stage "checkout"  — the shopper typed a phone or email at checkout. The
 *                       abandoned-cart detector (abandonedCarts.ts) picks it
 *                       up after an hour without an order, so it gets the same
 *                       reminder as a failed payment.
 *   stage "saved"     — the shopper left a phone number on the cart page to
 *                       get their cart (and a code) on WhatsApp; reminded
 *                       like a checkout.
 *   stage "ordered"   — the order was placed from this cart.
 *
 * Only this function writes the collection and only admin code reads it
 * (no client rule exists, so Firestore refuses clients outright). Prices
 * are the browser's: they are used for counts and the reminder's wording,
 * never to bill (placeOrder prices from the variants).
 */

const STAGES = new Set(["cart", "saved", "checkout", "ordered"]);
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export function cleanItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 30).map((i: any) => ({
    productId: str(i?.productId, 64),
    productTitle: str(i?.productTitle, 160),
    productImage: str(i?.productImage, 500),
    variant: str(i?.variant, 120),
    price: Math.max(0, Math.min(100000, Number(i?.price) || 0)),
    quantity: Math.max(1, Math.min(50, Math.floor(Number(i?.quantity) || 1))),
    ...(str(i?.phoneBrand, 60) ? { phoneBrand: str(i.phoneBrand, 60) } : {}),
    ...(str(i?.phoneModel, 80) ? { phoneModel: str(i.phoneModel, 80) } : {}),
    ...(i?.coverage === "only_back" || i?.coverage === "full_body_wrap" ? { coverage: i.coverage } : {}),
  })).filter((i) => i.productId);
}

export const syncCart = onCall(async (data: any, context: any) => {
  const cartId = str(data?.cartId, 64);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(cartId)) throw new HttpsError("invalid-argument", "Bad cart id");
  const stage = STAGES.has(data?.stage) ? data.stage : "cart";

  // Ceilings, so this cannot be used to fill the database: per cart and per caller.
  const ip = String(context?.rawRequest?.headers?.["x-forwarded-for"] || context?.rawRequest?.ip || "").split(",")[0].trim();
  await enforceDailyRateLimit({ key: `cartSync_${cartId}`, limit: 300 });
  if (ip) await enforceDailyRateLimit({ key: `cartSyncIp_${ip}`, limit: 3000 });

  const items = cleanItems(data?.items);
  const phone = String(data?.phone || "").replace(/\D/g, "").slice(-10);
  const email = str(data?.email, 160).toLowerCase();
  const now = Date.now();
  const ref = admin.firestore().collection("cartSnapshots").doc(cartId);
  const prev = await ref.get();

  const patch: Record<string, unknown> = {
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    total: Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0)),
    updatedAt: now,
    ...(context?.auth?.uid ? { uid: context.auth.uid } : {}),
  };
  if (!prev.exists) patch.createdAt = now;
  // A cart that was ordered stays "ordered" until it fills up again.
  const prevStage = prev.exists ? String((prev.data() as any).stage || "cart") : "cart";
  if (stage === "ordered") {
    patch.stage = "ordered";
    patch.orderedAt = now;
    if (str(data?.orderId, 64)) patch.orderId = str(data.orderId, 64);
  } else if (stage === "checkout" || stage === "saved") {
    // A cart that already reached checkout keeps that stage.
    patch.stage = stage === "saved" && prevStage === "checkout" ? "checkout" : stage;
    patch.checkoutAt = now;
    if (/^[6-9]\d{9}$/.test(phone)) patch.phone = phone;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) patch.email = email;
    if (str(data?.name, 80)) patch.name = str(data.name, 80);
    if (data?.optIn === true) patch.optIn = true;
  } else if (items.length) {
    // Adding to a cart after an order, or before checkout: back to "cart",
    // unless this cart already reached checkout (its contact still counts).
    patch.stage = prevStage === "checkout" || prevStage === "saved" ? prevStage : "cart";
  }
  await ref.set(patch, { merge: true });

  // The offers box ticked at checkout is consent, whether or not they pay;
  // the cart reminder on WhatsApp needs it (contacts/{phone}.optIn).
  if ((stage === "checkout" || stage === "saved") && data?.optIn === true && /^[6-9]\d{9}$/.test(phone)) {
    const { recordOptIn } = await import("./contacts");
    await recordOptIn(phone, stage === "saved" ? "cart_save" : "checkout_draft").catch((e) => console.warn("[syncCart] opt-in:", e?.message || e));
  }
  return { ok: true };
});
