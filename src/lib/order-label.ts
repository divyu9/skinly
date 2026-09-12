/**
 * What to call an order in front of a customer.
 *
 * The three customer-facing screens each answered this differently and two of
 * them answered it wrong. The account page showed `order._id.slice(-8)` — the
 * tail of a Firestore document id — so all 96 orders that *do* have a number
 * were displayed as "Order #wd7x0kg0". The orders list printed
 * `order.orderNumber` bare, which is blank on the 48 that have none.
 *
 * Of 144 live orders: 96 carry `orderNumber` ("#4025"), 24 only a
 * `failedOrderNumber` ("F25-001") from a checkout that did not complete, and
 * 24 carry neither. The last group still has to be nameable — a customer
 * ringing up about one needs something to read out — so it falls back to a
 * short reference off the id, labelled as a reference rather than dressed up
 * as an order number it does not have.
 */
export function orderLabel(order: {
  _id?: string;
  orderNumber?: string | null;
  failedOrderNumber?: string | null;
}): string {
  const number = String(order?.orderNumber || "").trim();
  if (number) return number.startsWith("#") ? number : `#${number}`;

  const failed = String(order?.failedOrderNumber || "").trim();
  if (failed) return failed;

  const id = String(order?._id || "");
  return id ? `Ref ${id.slice(-6).toUpperCase()}` : "Pending";
}
