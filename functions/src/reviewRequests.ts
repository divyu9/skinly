import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { queueWhatsApp } from "./orderNotifications";

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
/** How far back to look, so a run missed yesterday still catches up. */
const WINDOW_DAYS = 4;

export async function sendReviewRequests(
  db: admin.firestore.Firestore,
  opts: { dryRun?: boolean } = {}
): Promise<{ eligible: number; queued: number; orders: string[] }> {
  const now = Date.now();
  const youngest = now - ASK_AFTER_DAYS * 86400000;
  const oldest = now - (ASK_AFTER_DAYS + WINDOW_DAYS) * 86400000;

  const snap = await db
    .collection("orders")
    .where("deliveredAt", ">=", oldest)
    .where("deliveredAt", "<=", youngest)
    .limit(200)
    .get();

  const out = { eligible: 0, queued: 0, orders: [] as string[] };

  for (const d of snap.docs) {
    const o = d.data() as any;
    if (o.isDeleted === true || o.reviewAskedAt) continue;
    const phone = String(o.shippingAddress?.phone || o.phone || "");
    if (!phone) continue;

    out.eligible++;
    const orderNumber = String(o.orderNumber || d.id);
    out.orders.push(orderNumber);
    if (opts.dryRun) continue;

    const items = Array.isArray(o.items) ? o.items : [];
    /*
     * Marked before the message is queued, not after. A double ask is the
     * kind of thing that turns a good review into a complaint, and losing one
     * request to a failed queue write costs nothing by comparison.
     */
    await d.ref.update({ reviewAskedAt: Date.now() });

    const ok = await queueWhatsApp(
      db,
      "review_request",
      phone,
      {
        customer_name: o.shippingAddress?.fullName || o.customerName || "there",
        order_number: orderNumber,
        product_name: items.map((i: any) => i?.productTitle).filter(Boolean).join(", "),
        product_url: `https://goskinly.com/orders/${d.id}`,
        shop_url: "https://goskinly.com",
        company_name: "Skinly",
      },
      d.id
    ).catch(() => false);

    if (ok) out.queued++;
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
