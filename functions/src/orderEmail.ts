import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { sendUsecaseEmail } from "./orderNotifications";

/**
 * Admin › Orders › an order: correct the customer's email.
 *
 * A typo at checkout sends the confirmation nowhere, and the customer cannot
 * sign in to find the order either: "My Orders" lists what their account owns,
 * and an order is claimed into an account by its *verified* email
 * (claimGuestOrders, orders.ts). Changing the email therefore also re-files
 * the order so it follows the new address:
 *
 *   an account already exists for the new email  → it owns the order now
 *   none yet                                      → the order becomes claimable,
 *                                                   and is claimed the moment
 *                                                   they sign in with it
 *
 * The old address is kept in emailChanges, and the confirmation can be sent
 * again to the new one.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The customer card's Save: name and phone (on the shipping address, where the
 * courier and every message read them) and, when it changed, the email — with
 * the re-filing above. The browser wrote `customerName` and `email` from
 * arguments it never sent, so every save failed on an undefined value.
 */
export const updateOrderCustomer = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");
  const db = admin.firestore();
  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found");
  const order = snap.data() as any;

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  const fullName = typeof data?.fullName === "string" ? data.fullName.trim().slice(0, 100) : "";
  const phone = typeof data?.phone === "string" ? data.phone.replace(/[^\d+]/g, "").slice(0, 15) : "";
  if (fullName && fullName !== order.shippingAddress?.fullName) { update["shippingAddress.fullName"] = fullName; update.customerName = fullName; }
  if (phone && phone !== order.shippingAddress?.phone) { update["shippingAddress.phone"] = phone; update.phone = phone; }
  if (Object.keys(update).length > 1) await ref.update(update);

  const email = String(data?.email || "").trim().toLowerCase();
  const before = String(order.email || order.customerEmail || order.guestEmail || "").toLowerCase();
  let emailResult: any = null;
  if (email && email !== before) emailResult = await applyEmailChange(db, orderId, email, uid, data?.resend === true);
  return { success: true, email: emailResult };
});

export const changeOrderEmail = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");
  return { success: true, ...(await applyEmailChange(admin.firestore(), orderId, String(data?.email || "").trim().toLowerCase(), uid, data?.resend === true)) };
});

async function applyEmailChange(db: admin.firestore.Firestore, orderId: string, email: string, uid: string, resend: boolean) {
  if (!EMAIL.test(email)) throw new HttpsError("invalid-argument", "That does not look like an email address");
  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found");
  const order = snap.data() as any;
  const before = String(order.email || order.customerEmail || order.guestEmail || "");
  if (before.toLowerCase() === email) throw new HttpsError("already-exists", "The order already has that email");

  let account: admin.auth.UserRecord | null = null;
  try { account = await admin.auth().getUserByEmail(email); } catch { account = null; }

  const update: Record<string, unknown> = {
    email,
    ...(order.customerEmail !== undefined ? { customerEmail: email } : {}),
    ...(order.guestEmail !== undefined ? { guestEmail: email } : {}),
    emailChanges: admin.firestore.FieldValue.arrayUnion({ from: before, to: email, at: Date.now(), by: uid }),
    updatedAt: Date.now(),
  };
  if (account) {
    update.ownerUid = account.uid;
    update.userId = account.uid;
  } else {
    // Nobody signs in with this email yet: file it so the next sign-in with it claims it.
    update.ownerUid = admin.firestore.FieldValue.delete();
    update.userId = `guest-emailchange-${orderId}`;
  }
  await ref.update(update);

  let resent = false;
  if (resend) {
    const fresh = (await ref.get()).data();
    resent = await sendUsecaseEmail(db, fresh, orderId, "order_confirmed").catch(() => false);
  }
  console.log("changeOrderEmail", { order: order.orderNumber, from: before, to: email, linked: !!account, resent });
  return { linkedToAccount: !!account, resent };
}
