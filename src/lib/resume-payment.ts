import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

/**
 * Pays for an order that already exists, on PhonePe — never a new order.
 *
 * Used by the reminder link (/pay/:orderId?t=…), the order page and the
 * failure page. Retrying used to go back to checkout, which made a second
 * order each time. The server (resumePayment) decides whether this browser
 * may pay: the signed-in owner, the guest session that placed it, or the
 * link's token.
 */
export async function resumePayment(orderId: string, token?: string | null): Promise<{ alreadyPaid?: boolean }> {
  let sessionId: string | null = null;
  try {
    sessionId = sessionStorage.getItem("skinly_guest_session_id");
  } catch { /* storage blocked */ }

  const res: any = (await httpsCallable(functions, "resumePayment")({
    orderId,
    ...(token ? { t: token } : {}),
    ...(sessionId ? { sessionId } : {}),
  })).data;
  if (res?.alreadyPaid) return { alreadyPaid: true };
  if (!res?.paymentUrl) throw new Error("Could not start the payment. Please try again.");

  // What /payment/callback reads to confirm the result for this order. The
  // token goes too: a link opened in a new browser has no other proof.
  try {
    sessionStorage.setItem("skinly_order_id", orderId);
    sessionStorage.setItem("skinly_merchant_txn_id", res.merchantTransactionId);
    if (token) sessionStorage.setItem("skinly_pay_token", token);
    else sessionStorage.removeItem("skinly_pay_token");
  } catch { /* storage blocked: the callback falls back to reading the order */ }

  window.location.href = res.paymentUrl;
  return {};
}

/** A message a customer can read, from a callable's error. */
export function paymentErrorMessage(e: any): string {
  const m = String(e?.message || "");
  if (e?.code === "functions/permission-denied") return "This payment link is not valid. Please use the link we sent you, or place the order again.";
  if (e?.code === "functions/failed-precondition" && m) return m;
  if (e?.code === "functions/resource-exhausted") return "Too many attempts on this order today. Please try again tomorrow or contact us on WhatsApp.";
  return "Could not start the payment. Please try again.";
}
