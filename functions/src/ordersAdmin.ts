import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";

/**
 * Order actions that must not run in the browser.
 *
 * The rest of this app's admin writes go straight to Firestore through the
 * client shim, which is fine for data the admin is allowed to edit anyway. The
 * three here are not that: one moves money into a customer's wallet, one holds
 * the MSG91 credential, and one decides how much is still owed on an order.
 * Each was left unimplemented by the Convex migration, so the buttons have been
 * throwing "function not found" ever since.
 */

const MSG91_EMAIL_ENDPOINT = "https://control.msg91.com/api/v5/email/send";

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Money already collected against an order, however it was collected. */
function paidSoFar(order: any): number {
  if (order.paymentStatus === "success") return num(order.total) || num(order.amountPayable);
  return num(order.prepaidAmount) + num(order.paymentAmountPaise) / 100;
}

/**
 * Re-opens a failed or pending order for payment.
 *
 * Returns what the PhonePe initiation needs rather than starting it here: the
 * browser drives that redirect, and the order must still be worth paying for
 * when it does.
 */
export const retryPayment = onCall(async (data: any, context: any) => {
  const orderId = String(data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");

  const db = admin.firestore();
  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found");
  const order = snap.data()!;

  // The caller must own the order. A guest order has no uid, and its id is
  // unguessable, so possession of the id is the only credential there is.
  const uid = context?.auth?.uid;
  if (order.userId && uid && order.userId !== uid) {
    const email = String(context?.auth?.token?.email || "").toLowerCase();
    const allow = String(process.env.ADMIN_EMAIL_ALLOWLIST || "").toLowerCase();
    if (!email || !allow.includes(email)) throw new HttpsError("permission-denied", "Not your order");
  }

  if (order.paymentStatus === "success") {
    throw new HttpsError("failed-precondition", "This order is already paid");
  }
  if (["cancelled", "delivered", "rto"].includes(String(order.status))) {
    throw new HttpsError("failed-precondition", `This order is ${order.status} and cannot be paid`);
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const lineTotal = items.reduce((s: number, i: any) => s + num(i?.price) * (num(i?.quantity) || 1), 0);
  const total = num(order.total) || num(order.amountPayable) || lineTotal;
  const remainingAmount = Math.max(0, Math.round((total - paidSoFar(order)) * 100) / 100);

  if (!(remainingAmount > 0)) {
    throw new HttpsError("failed-precondition", "Nothing left to pay on this order");
  }

  await ref.update({ paymentRetryAt: Date.now(), updatedAt: Date.now() });

  return {
    success: true,
    orderId,
    orderNumber: order.orderNumber || orderId,
    remainingAmount,
    shippingPhone: order.shippingAddress?.phone || order.phone || "",
  };
});

/**
 * Credits a refund to the customer's wallet.
 *
 * In one transaction, because the balance, the ledger row and the order's
 * refunded flag have to agree: a double-click that credits twice is not
 * something an apology fixes.
 */
export const refundToWallet = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  const refundAmount = num(data?.refundAmount);
  const refundReason = data?.refundReason ? String(data.refundReason) : "";

  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");
  if (!(refundAmount > 0)) throw new HttpsError("invalid-argument", "Refund amount must be positive");

  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);

  const result = await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found");
    const order = orderSnap.data()!;

    if (order.refundedToWallet) {
      throw new HttpsError("already-exists", "This order has already been refunded");
    }
    if (!order.userId) {
      throw new HttpsError("failed-precondition", "Guest orders have no wallet to refund into");
    }
    const total = num(order.total) || num(order.amountPayable);
    if (refundAmount > total) {
      throw new HttpsError("invalid-argument", `Refund exceeds the order total of ₹${total}`);
    }

    const userRef = db.collection("users").doc(String(order.userId));
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError("not-found", "Customer account not found");

    const before = num(userSnap.data()?.walletBalance);
    const after = before + refundAmount;

    tx.update(userRef, { walletBalance: after });
    tx.set(db.collection("walletTransactions").doc(), {
      userId: order.userId,
      transactionType: "credit",
      amount: refundAmount,
      source: "refund",
      balanceBefore: before,
      balanceAfter: after,
      description: `Refund for order ${order.orderNumber || orderId}`,
      relatedOrderId: orderId,
      createdAt: Date.now(),
    });
    tx.update(orderRef, {
      refundedToWallet: true,
      refundAmount,
      refundReason,
      refundedAt: Date.now(),
      refundedBy: uid,
      updatedAt: Date.now(),
    });
    return { balanceAfter: after };
  });

  return { success: true, refundAmount, ...result, message: "Refunded to wallet" };
});

/** Which MSG91 template an order-status mail uses. */
const EMAIL_USECASE: Record<string, string> = {
  order_confirmed: "order_confirmed",
  order_dispatched: "order_dispatched",
  order_delivered: "order_delivered",
  order_cancelled: "order_cancelled",
};

export const sendOrderStatusEmail = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  const emailType = String(data?.emailType || "order_confirmed");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");

  const usecaseKey = EMAIL_USECASE[emailType];
  if (!usecaseKey) throw new HttpsError("invalid-argument", `Unknown email type "${emailType}"`);

  const authkey = process.env.MSG91_AUTH_TOKEN || "";
  if (!authkey) {
    // Said plainly, because the alternative is a button that silently does
    // nothing and an admin who thinks the customer was told.
    throw new HttpsError(
      "failed-precondition",
      "MSG91_AUTH_TOKEN is not configured, so no email can be sent."
    );
  }

  const db = admin.firestore();
  const snap = await db.collection("orders").doc(orderId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found");
  const order = snap.data()!;

  const to = String(order.email || order.customerEmail || order.guestEmail || "");
  if (!to) throw new HttpsError("failed-precondition", "This order has no email address");

  const tpl = await db.collection("emailUsecaseTemplates")
    .where("usecaseKey", "==", usecaseKey).limit(1).get();
  if (tpl.empty) throw new HttpsError("failed-precondition", `No email template for "${usecaseKey}"`);
  const t = tpl.docs[0].data();
  if (t.enabled !== true) throw new HttpsError("failed-precondition", `The "${usecaseKey}" email is switched off`);

  const items = Array.isArray(order.items) ? order.items : [];
  const body = {
    template_id: t.msg91TemplateId,
    recipients: [{
      to: [{ email: to, name: order.customerName || order.shippingAddress?.fullName || "" }],
      variables: {
        customer_name: order.customerName || order.shippingAddress?.fullName || "there",
        order_number: String(order.orderNumber || orderId),
        order_total: String(num(order.total) || num(order.amountPayable)),
        item_count: String(items.length),
        tracking_number: String(order.awbNumber || order.manualTrackingNumber || ""),
        tracking_url: String(order.trackingUrl || ""),
        courier_name: String(order.courierName || order.manualCourierCompany || ""),
      },
    }],
    from: { email: "noreply@mail.goskinly.com", name: "Skinly" },
    domain: "mail.goskinly.com",
  };

  const res = await fetch(MSG91_EMAIL_ENDPOINT, {
    method: "POST",
    headers: { authkey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("sendOrderStatusEmail: MSG91 refused", { status: res.status, text });
    throw new HttpsError("unavailable", `MSG91: ${text.slice(0, 300)}`);
  }

  await db.collection("emailMessages").add({
    createdAt: Date.now(),
    recipientEmail: to,
    recipientUserId: order.userId || null,
    usecaseKey,
    templateName: t.templateName || usecaseKey,
    msg91TemplateId: t.msg91TemplateId,
    relatedOrderId: orderId,
    status: "sent",
    retryCount: 0,
  });

  return { success: true, message: `Email sent to ${to}` };
});
