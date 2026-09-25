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
  checkoutRef?: string | null;
}): string {
  const number = String(order?.orderNumber || "").trim();
  if (number) return number.startsWith("#") ? number : `#${number}`;

  // An unpaid checkout has no order number yet — numbers are issued on
  // confirmation so the sequence has no gaps (functions/src/orderConfirm.ts).
  const ref = String(order?.checkoutRef || "").trim();
  if (ref) return ref;

  const failed = String(order?.failedOrderNumber || "").trim();
  if (failed) return failed;

  const id = String(order?._id || "");
  return id ? `Ref ${id.slice(-6).toUpperCase()}` : "Pending";
}

/**
 * The order status, in words a customer would use.
 *
 * The stored values are the database's own vocabulary, and the account page
 * printed them raw — a shopper looking at their orders saw the literal string
 * "pending_payment", underscore and all.
 */
export function orderStatusLabel(status?: string | null): string {
  switch (String(status || "").toLowerCase()) {
    case "pending_payment": return "Payment pending";
    case "pending": return "Payment pending";
    case "processing": return "Preparing";
    case "ready_to_ship": return "Packed";
    case "shipped": return "On the way";
    case "out_for_delivery": return "Out for delivery";
    // Said as what happens next, not as what went wrong: the courier tried and
    // will try again, and "Undelivered" on its own reads like a dead end.
    case "undelivered": return "Delivery attempted";
    case "delivered": return "Delivered";
    case "cancelled": return "Cancelled";
    case "failed": return "Payment failed";
    case "rto": return "Returned to us";
    default: return String(status || "").replace(/_/g, " ") || "—";
  }
}

/**
 * What the admin calls each status, and how it is coloured.
 *
 * One list, because it was three: the order detail header, the orders list's
 * tabs and the bulk dialog each hard-coded their own set, so adding a status
 * meant remembering all three and a shopper could land on a status the admin
 * screen could not even display.
 */
export const ADMIN_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending Payment",
  processing: "Processing",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  undelivered: "Undelivered",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rto: "RTO",
};

export const adminStatusLabel = (status?: string | null): string =>
  ADMIN_STATUS_LABELS[String(status || "").toLowerCase()] || orderStatusLabel(status);

/** Badge classes per status: one hue per stage, warnings in amber and red. */
export const STATUS_BADGE: Record<string, string> = {
  pending_payment: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  processing: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  ready_to_ship: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  shipped: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  out_for_delivery: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  undelivered: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  delivered: "bg-green-500/10 text-green-600 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  rto: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
};

/**
 * The active-state classes for a status tab.
 *
 * Written out in full rather than assembled from the status name, because
 * Tailwind reads the source for class names and a string it never sees written
 * down is a class it never generates.
 */
export const STATUS_TAB: Record<string, string> = {
  pending_payment: "data-[state=active]:bg-yellow-500/10 dark:data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-600 data-[state=active]:shadow-none",
  processing: "data-[state=active]:bg-purple-500/10 dark:data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-600 data-[state=active]:shadow-none",
  ready_to_ship: "data-[state=active]:bg-sky-500/10 dark:data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-600 data-[state=active]:shadow-none",
  shipped: "data-[state=active]:bg-indigo-500/10 dark:data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none",
  out_for_delivery: "data-[state=active]:bg-teal-500/10 dark:data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-600 data-[state=active]:shadow-none",
  undelivered: "data-[state=active]:bg-amber-500/10 dark:data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-600 data-[state=active]:shadow-none",
  delivered: "data-[state=active]:bg-green-500/10 dark:data-[state=active]:bg-green-500/20 data-[state=active]:text-green-600 data-[state=active]:shadow-none",
  cancelled: "data-[state=active]:bg-red-500/10 dark:data-[state=active]:bg-red-500/20 data-[state=active]:text-red-600 data-[state=active]:shadow-none",
  rto: "data-[state=active]:bg-orange-500/10 dark:data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-600 data-[state=active]:shadow-none",
};

/** The dot beside a status in the pipeline row. */
export const STATUS_DOT: Record<string, string> = {
  pending_payment: "bg-yellow-500",
  processing: "bg-purple-500",
  ready_to_ship: "bg-sky-500",
  shipped: "bg-indigo-500",
  out_for_delivery: "bg-teal-500",
  undelivered: "bg-amber-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
  rto: "bg-orange-500",
};
