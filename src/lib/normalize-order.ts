/**
 * One shape for an order, whatever shape it was written in.
 *
 * Orders in this database come from several generations of checkout code and
 * do not agree on what they contain. Of 144 live orders, 43 carry no
 * `subtotal` or `shippingFee` at all, 5 carry no `items`, and one carries
 * `itemsTotal` and `amountPayable` where the others carry `subtotal` and
 * `total`. The admin pages are typed as though every field is always there, so
 * a single missing number took the whole screen white on `subtotal.toFixed(0)`.
 *
 * Guarding each read at the point of use is how you end up fixing this three
 * times, once per field someone happens to click on. So the shape is settled
 * once, here, on the way out of Firestore: every consumer downstream can rely
 * on the money being numbers, `items` being an array, and the two status
 * vocabularies having been reconciled.
 *
 * Derivation beats defaulting where a real figure is recoverable — a missing
 * subtotal is the sum of the lines, not zero — because a confident zero on an
 * order worth ₹249 is worse than a crash: nobody checks it.
 */

export function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

export function normalizePaymentStatus(value: any): string {
  const v = String(value || "").toLowerCase();
  if (v === "paid") return "success";
  if (v === "success") return "success";
  if (v === "pending") return "pending";
  if (v === "failed") return "failed";
  if (v === "pending_payment") return "pending";
  return value;
}

export function normalizeOrderStatus(value: any, paymentStatus?: string): string {
  const v = String(value || "").toLowerCase();
  if (paymentStatus === "success" && (v === "" || v === "pending" || v === "pending_payment")) return "processing";
  if (v === "pending") return "pending_payment";
  if (v === "pending_payment") return "pending_payment";
  if (v === "processing") return "processing";
  if (v === "shipped") return "shipped";
  if (v === "delivered") return "delivered";
  if (v === "cancelled") return "cancelled";
  if (v === "rto") return "rto";
  if (v === "failed") return "failed";
  return value;
}

/** A finite number, or null when the field is absent or unusable. */
function num(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeOrder(order: any): any {
  const paymentStatus = normalizePaymentStatus(order?.paymentStatus || order?.paymentInfo?.status);
  const status = normalizeOrderStatus(order?.status, paymentStatus);
  const createdAt = toMillis(order?.createdAt) || toMillis(order?._creationTime) || 0;

  const items = Array.isArray(order?.items) ? order.items : [];
  const lineTotal = items.reduce(
    (sum: number, it: any) => sum + (num(it?.price) ?? 0) * (num(it?.quantity) ?? 1),
    0
  );

  const shippingFee = num(order?.shippingFee) ?? num(order?.shipping) ?? 0;
  const codFee = num(order?.codFee) ?? 0;
  const discount = (num(order?.couponDiscount) ?? 0) + (num(order?.walletUsed) ?? 0);

  // `itemsTotal` is the newer writer's name for the same figure. Falling back
  // to the lines keeps the summary honest on the orders that carry neither.
  const subtotal =
    num(order?.subtotal) ?? num(order?.itemsTotal) ?? (items.length ? lineTotal : null)
    ?? Math.max(0, (num(order?.total) ?? 0) - shippingFee - codFee + discount);

  const total =
    num(order?.total) ?? num(order?.amountPayable)
    ?? Math.max(0, subtotal + shippingFee + codFee - discount);

  return {
    ...order,
    items,
    paymentStatus,
    status,
    subtotal,
    shippingFee,
    codFee,
    total,
    prepaidAmount: num(order?.prepaidAmount) ?? 0,
    codAmount: num(order?.codAmount) ?? undefined,
    _creationTime: createdAt,
  };
}
