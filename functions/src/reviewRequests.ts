import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { queueWhatsApp } from "./orderNotifications";
import { reviewLinkUrl } from "./reviews";

/**
 * Asking for a review, a few days after the parcel lands.
 *
 * The shop has a reviews collection, an admin page for them, and no way at
 * all for one to arrive: nothing has ever asked a customer for one. For a
 * store selling a £3 skin on looks alone, other people's photographs are the
 * cheapest thing that sells the next one — and every delivered order was a
 * request nobody made.
 *
 * Three days after delivery, not the same evening: the skin has to be on the
 * device before anyone has an opinion worth reading.
 */

const ASK_AFTER_DAYS = 3;
/** One ask per number in this long, however many orders it has. */
const ONE_PER_PHONE_DAYS = 90;
const PER_RUN = 30;
const USECASE = "review_request";

/*
 * What this used to get wrong, found on 25 Sep with four orders marked asked
 * and not one review in the shop:
 *  - It marked the order before queuing, and queueWhatsApp quietly does
 *    nothing when the usecase is missing — as review_request was. The four
 *    customers were never messaged, and would never be asked again.
 *  - It only looked at orders with deliveredAt three to seven days old. 14 of
 *    the 18 delivered orders predate deliveredAt, so none of them ever
 *    qualified. The date now falls back to the order's last update.
 *  - Its link opened the order page, which has nowhere to write a review.
 *    It now opens /review/<order>, signed like the pay link, where a guest
 *    can rate each product and add photos (reviews.ts).
 * With no upper age, switching the usecase on also asks every earlier buyer,
 * once — a skin still on a phone months later is the review worth having.
 */
export async function sendReviewRequests(
  db: admin.firestore.Firestore,
  opts: { dryRun?: boolean } = {}
): Promise<{ eligible: number; queued: number; orders: string[] }> {
  const now = Date.now();
  const out = { eligible: 0, queued: 0, orders: [] as string[] };

  if (!opts.dryRun) {
    const uc = await db.collection("whatsappUsecases").where("usecaseKey", "==", USECASE).limit(1).get();
    if (uc.empty || uc.docs[0].data().enabled !== true) return out;
  }

  const snap = await db.collection("orders").where("status", "==", "delivered").get();
  const byPhone = new Map<string, { d: admin.firestore.QueryDocumentSnapshot; at: number }>();
  for (const d of snap.docs) {
    const o = d.data() as any;
    if (o.isDeleted === true || o.reviewAskedAt || o.reviewedAt) continue;
    // Orders from before the move to Firebase carry _creationTime, not createdAt.
    const at = Number(o.deliveredAt) || Number(o.updatedAt) || Number(o.createdAt) || Number(o._creationTime) || 0;
    if (!at || at > now - ASK_AFTER_DAYS * 86400000) continue;
    const phone = String(o.shippingAddress?.phone || o.phone || "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) continue;
    const prev = byPhone.get(phone);
    if (!prev || at > prev.at) byPhone.set(phone, { d, at });
  }

  for (const [phone, { d }] of byPhone) {
    if (out.queued >= PER_RUN) break;
    const mark = db.collection("reviewAsks").doc(phone);
    const last = Number((await mark.get()).data()?.lastAt) || 0;
    if (last > now - ONE_PER_PHONE_DAYS * 86400000) continue;

    const o = d.data() as any;
    const orderNumber = String(o.orderNumber || d.id);
    out.eligible++;
    out.orders.push(orderNumber);
    if (opts.dryRun) continue;

    const items = Array.isArray(o.items) ? o.items : [];
    const link = reviewLinkUrl(d.id, "whatsapp");
    const ok = await queueWhatsApp(db, USECASE, phone, {
      customer_name: String(o.shippingAddress?.fullName || o.customerName || "there").trim().split(/\s+/)[0],
      order_number: orderNumber.replace(/^#/, ""),
      product_name: String(items[0]?.productTitle || "your skin").slice(0, 60),
      review_link: link,
      product_url: link,
      shop_url: "https://goskinly.com",
      company_name: "GoSkinly",
    }, d.id).catch(() => false);
    if (!ok) continue;

    await d.ref.update({ reviewAskedAt: Date.now() });
    await mark.set({ lastAt: Date.now(), orderId: d.id });
    out.queued++;
  }

  if (out.queued) console.log("sendReviewRequests", out);
  return out;
}

/**
 * Once a day, late morning.
 *
 * 05:30 UTC is 11:00 in Agra — after people are up, well before the evening,
 * and nowhere near the hours when a message reads as spam.
 */
export const dailyReviewRequests = functionsV1
  .runWith({ memory: "256MB", timeoutSeconds: 300 })
  .pubsub.schedule("30 5 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    await sendReviewRequests(admin.firestore());
    return null;
  });
