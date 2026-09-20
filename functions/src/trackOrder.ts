import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { enforceDailyRateLimit } from "./rate-limit";
import { normalizeOrderStatus, type OrderStatus } from "./orderStatus";

/**
 * "Where is my order?", answered without an account.
 *
 * Most of this shop's orders are placed by guests, and a guest had no way at
 * all to see one again — the only order pages this site has are behind a
 * login, so the answer to "where is my parcel" was an email to the shop.
 *
 * Two things decide the shape of this. Order numbers are sequential (#4001,
 * #4002…), so the number alone is not a secret and cannot be the credential;
 * the email or phone the order was placed with is. And whatever comes back is
 * read by whoever typed those two things, so it carries what a courier's
 * tracking page would carry and nothing more — no address, no email, no phone,
 * no other order.
 */

/** Both spellings of an order number: "#4025" and "4025". */
function numberVariants(input: string): string[] {
  const raw = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
  const bare = raw.replace(/^#/, "");
  if (!bare) return [];
  return [...new Set([`#${bare}`, bare, raw])];
}

/** The last ten digits of anything that looks like an Indian mobile number. */
const digits10 = (v: any) => String(v || "").replace(/\D/g, "").slice(-10);

/**
 * Does this contact belong to this order?
 *
 * Compared against every field an order has ever carried the customer's
 * details in, because six generations of checkout disagree about the names —
 * an order written in 2024 keeps the email under `customerEmail`, a guest
 * order under `guestEmail`, and the phone sits on the shipping address as
 * often as on the order.
 */
function contactMatches(order: any, contact: string): boolean {
  const c = String(contact || "").trim().toLowerCase();
  if (!c) return false;

  const emails = [order?.email, order?.customerEmail, order?.guestEmail, order?.user?.email]
    .map((e) => String(e || "").trim().toLowerCase())
    .filter(Boolean);
  if (emails.includes(c)) return true;

  const asPhone = digits10(c);
  if (asPhone.length === 10) {
    const phones = [order?.phone, order?.shippingAddress?.phone, order?.customerPhone]
      .map(digits10)
      .filter((p) => p.length === 10);
    if (phones.includes(asPhone)) return true;
  }
  return false;
}

/** The stages a shopper is shown, in order, with the one it has reached. */
const JOURNEY: OrderStatus[] = [
  "pending_payment",
  "processing",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
  "delivered",
];

/**
 * Whatever goes wrong, the shopper gets a sentence.
 *
 * A callable that throws anything other than an HttpsError answers the browser
 * with the bare word "internal", which is what a customer typing their order
 * number saw. Everything unexpected is logged with its real cause and
 * answered with something a person can act on.
 */
export const trackOrder = onCall(async (data: any, _context: any) => {
  try {
    return await lookUpOrder(data);
  } catch (e: any) {
    if (e instanceof HttpsError) throw e;
    console.error("trackOrder failed", {
      orderNumber: String(data?.orderNumber || "").slice(0, 32),
      error: e?.message || e,
      stack: e?.stack,
    });
    throw new HttpsError(
      "internal",
      "Something went wrong at our end, not yours. Try again in a moment, or message us on WhatsApp with your order number."
    );
  }
});

async function lookUpOrder(data: any) {
  const orderNumber = String(data?.orderNumber || "").trim();
  const contact = String(data?.contact || "").trim();

  if (!orderNumber) throw new HttpsError("invalid-argument", "Enter your order number");
  if (!contact) throw new HttpsError("invalid-argument", "Enter the email or phone number you ordered with");
  if (orderNumber.length > 32 || contact.length > 120) {
    throw new HttpsError("invalid-argument", "That does not look like an order number");
  }

  /*
   * Two ceilings, because there are two ways to abuse this. One caps how
   * hard a single contact can be tried against many orders; the other caps
   * how many contacts can be tried against one order, which is the attack
   * that matters when the numbers run in sequence.
   */
  const contactKey = contact.toLowerCase().replace(/[^a-z0-9@.]/g, "").slice(0, 64);
  await enforceDailyRateLimit({ key: `track_c_${contactKey}`, limit: Number(process.env.TRACK_DAILY_LIMIT || 60) });
  await enforceDailyRateLimit({ key: `track_o_${numberVariants(orderNumber)[0]}`, limit: 30 });

  const db = admin.firestore();
  let doc: admin.firestore.QueryDocumentSnapshot | undefined;
  for (const variant of numberVariants(orderNumber)) {
    const snap = await db.collection("orders").where("orderNumber", "==", variant).limit(1).get();
    if (!snap.empty) { doc = snap.docs[0]; break; }
  }
  // A checkout that failed part-way keeps its number under another name.
  if (!doc) {
    for (const variant of numberVariants(orderNumber)) {
      const snap = await db.collection("orders").where("failedOrderNumber", "==", variant).limit(1).get();
      if (!snap.empty) { doc = snap.docs[0]; break; }
    }
  }

  /*
   * One message whether the order does not exist or the contact does not
   * match it, so this cannot be used to find out which order numbers are
   * real.
   */
  const refuse = () => {
    throw new HttpsError("not-found", "We could not find an order with those details. Check the order number and the email or phone you ordered with.");
  };

  if (!doc) refuse();
  const order = doc!.data() as any;
  if (order.isDeleted === true) refuse();
  if (!contactMatches(order, contact)) refuse();

  const status = normalizeOrderStatus(order.status, order.paymentStatus);
  const items = (Array.isArray(order.items) ? order.items : []).map((i: any) => ({
    title: String(i?.productTitle || "Item"),
    quantity: Number(i?.quantity) || 1,
    image: String(i?.productImage || "").includes("res.cloudinary.com") ? "" : String(i?.productImage || ""),
    // "Default" / "Default Title" is a Shopify-era placeholder, not a choice
    // the shopper made; showing it under the product name reads as a fault.
    variant: /^default(\s*title)?$/i.test(String(i?.variant || "").trim())
      ? String(i?.phoneModel || "")
      : String(i?.variant || i?.phoneModel || ""),
  }));

  // Only the moves a shopper would recognise, and only what they say.
  const history = (Array.isArray(order.statusHistory) ? order.statusHistory : [])
    .map((h: any) => ({ at: Number(h?.at) || 0, to: String(h?.to || "") }))
    .filter((h: any) => h.at && h.to)
    .sort((a: any, b: any) => a.at - b.at);

  return {
    found: true,
    orderNumber: String(order.orderNumber || order.failedOrderNumber || ""),
    orderId: doc!.id,
    status,
    journey: JOURNEY,
    placedAt: Number(order.createdAt) || 0,
    deliveredAt: Number(order.deliveredAt) || 0,
    total: Number(order.total ?? order.amountPayable) || 0,
    paymentMethod: String(order.paymentMethod || ""),
    paymentStatus: String(order.paymentStatus || ""),
    items,
    history,
    // The courier's own page is the freshest thing there is, so it is offered
    // rather than mirrored: RapidShyp updates it before it calls our webhook.
    courierName: String(order.courierName || order.manualCourierCompany || ""),
    awbNumber: String(order.awbNumber || order.manualTrackingNumber || ""),
    trackingUrl: String(order.trackingUrl || ""),
    shippingStatus: String(order.shippingStatus || ""),
    lastEventAt: Number(order.lastTrackingEventAt) || 0,
    // Where it is going, to the city only — enough to recognise the order,
    // not enough to be an address.
    city: String(order.shippingAddress?.city || ""),
    creditOnDelivery: Number(order.creditOnDelivery) || 0,
    creditPaid: order.walletCreditCredited === true,
  };
}
