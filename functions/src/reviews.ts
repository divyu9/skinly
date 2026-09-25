import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { getCaller } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";
import { linkToken, linkTokenValid } from "./payLink";
import { putR2Object } from "./r2";

/**
 * Reviews come from people who bought the thing, and only from them.
 *
 * The product page let any signed-in Google account post a review of any
 * product, straight into the public collection — one script away from a page
 * of fake five-stars, or fake ones. And real buyers could not post at all:
 * most check out as guests, and the dialog demanded a sign-in.
 *
 * Now a review is written here, for an order that has been delivered, for a
 * product that was in it, by the holder of that order's review link (sent
 * after delivery, reviewRequests.ts) or by the signed-in owner of the order.
 * One review per product per order — sending again edits it. Marked verified,
 * because it is.
 */

const SITE = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");

export function reviewLinkUrl(orderId: string, source: string): string {
  return `${SITE}/review/${encodeURIComponent(orderId)}?t=${linkToken("review", orderId)}` +
    `&utm_source=${encodeURIComponent(source)}&utm_medium=review_request`;
}

/** "Priya Sharma" → "Priya S." — enough to be a person, not enough to find them. */
function displayName(full: unknown): string {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Verified buyer";
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  return parts.length > 1 ? `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : first;
}

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** jpeg / png / webp by their first bytes, whatever the browser claimed. */
function sniff(buf: Buffer): { ext: string; type: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", type: "image/png" };
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

export const submitOrderReview = functions
  .runWith({ memory: "512MB", timeoutSeconds: 60 })
  .https.onCall(async (data: any, context: any) => {
    const { uid } = getCaller(context);
    const orderId = typeof data?.orderId === "string" ? data.orderId : "";
    if (!orderId || orderId.length > 128 || orderId.includes("/")) throw new HttpsError("invalid-argument", "Invalid order");
    await enforceDailyRateLimit({ key: `submitOrderReview_${orderId}`, limit: 15 });

    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Order not found");
    const order = snap.data() as any;

    const allowed = linkTokenValid("review", orderId, data?.t) ||
      (!!uid && (order.userId === uid || order.ownerUid === uid));
    if (!allowed) throw new HttpsError("permission-denied", "This review link is not valid for this order");
    if (order.isDeleted || String(order.status || "") !== "delivered") {
      throw new HttpsError("failed-precondition", "You can review this order once it has been delivered.");
    }

    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const inOrder = new Map<string, any>();
    for (const it of items) if (it?.productId && !inOrder.has(String(it.productId))) inOrder.set(String(it.productId), it);

    const incoming: any[] = Array.isArray(data?.reviews) ? data.reviews.slice(0, 10) : [];
    if (!incoming.length) throw new HttpsError("invalid-argument", "Nothing to review");

    const written: string[] = [];
    for (const r of incoming) {
      const productId = String(r?.productId || "");
      const item = inOrder.get(productId);
      if (!item) throw new HttpsError("invalid-argument", "That product is not in this order");
      const rating = Math.round(Number(r?.rating));
      if (!(rating >= 1 && rating <= 5)) throw new HttpsError("invalid-argument", "Pick a rating from 1 to 5 stars");
      const comment = String(r?.comment || "").trim().slice(0, 1000);
      const title = String(r?.title || "").trim().slice(0, 80);

      const ref = db.collection("reviews").doc(`${orderId}_${productId}`);
      const before = await ref.get();
      const keep: string[] = Array.isArray(r?.keepImageUrls)
        ? (before.data()?.imageUrls || []).filter((u: string) => r.keepImageUrls.includes(u))
        : before.data()?.imageUrls || [];

      const photos: unknown[] = Array.isArray(r?.photos) ? r.photos.slice(0, Math.max(0, MAX_PHOTOS - keep.length)) : [];
      const imageUrls = [...keep];
      for (const [i, p] of photos.entries()) {
        const b64 = String(p || "").replace(/^data:[^,]*,/, "");
        const buf = Buffer.from(b64, "base64");
        if (!buf.length || buf.length > MAX_PHOTO_BYTES) throw new HttpsError("invalid-argument", "Each photo must be under 2 MB");
        const kind = sniff(buf);
        if (!kind) throw new HttpsError("invalid-argument", "Photos must be JPEG, PNG or WebP");
        imageUrls.push(await putR2Object(`reviews/${orderId}/${productId}-${Date.now()}-${i}.${kind.ext}`, buf, kind.type));
      }

      const now = Date.now();
      const created = Number(before.data()?.createdAt) || now;
      await ref.set({
        productId,
        productTitle: String(item.productTitle || ""),
        orderId,
        rating,
        title,
        comment,
        imageUrls,
        userName: displayName(order.shippingAddress?.fullName || order.customerName),
        verified: true,
        device: [item.phoneBrand, item.phoneModel].filter(Boolean).join(" "),
        source: uid && !linkTokenValid("review", orderId, data?.t) ? "order-page" : "review-link",
        createdAt: created,
        _creationTime: created,
        updatedAt: now,
      });
      written.push(productId);
    }

    await orderRef.update({ reviewedAt: Date.now() });
    console.log("submitOrderReview", { order: order.orderNumber, products: written.length });
    return { success: true, reviewed: written };
  });
