import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";

/**
 * An order gets its number, and its GST invoice, when it is confirmed — not
 * when someone presses Pay.
 *
 * placeOrder used to take the next order number before the payment, so every
 * checkout abandoned or failed at PhonePe used one up: 25 confirmed orders
 * carried numbers from #4003 to #4044 with 33 unpaid attempts in between.
 * Order numbers now go only to confirmed orders, from the same counter, so
 * they run without gaps; an unpaid checkout has a checkoutRef instead.
 *
 * A tax invoice number (GST Rule 46: consecutive, unique within the financial
 * year, at most 16 characters) is issued at the same moment, from a counter
 * per financial year: MHM-GS/2627/0001. And the order's GST is worked out and
 * stored — nothing did that before, so the tax export showed ₹0.
 *
 * Confirmed means: paid (paymentStatus success), or cash on delivery — a COD
 * order is confirmed when placed, as it always has been (the advance the
 * checkout can show for COD is never actually collected). Everything runs in one transaction, so two
 * confirmations of one order (the PhonePe webhook and the status check) give
 * it one number, and two orders confirming at once get two.
 */

const DEFAULT_PREFIX = "MHM-GS";
/*
 * Invoices start with FY 2026-27 (1 Apr 2026, India time). Orders placed
 * before it belong to a year whose invoices, if any, were issued elsewhere,
 * and must never be given this year's numbers because something touched them.
 */
export const INVOICE_START = Date.parse("2026-03-31T18:30:00Z");
const GST_RATE = 0.18;

export const isConfirmed = (o: any) =>
  !o?.isDeleted && (o?.paymentStatus === "success" || String(o?.paymentMethod || "").toLowerCase() === "cod");

/** "2627" for any day from 1 Apr 2026 to 31 Mar 2027, in India time. */
export function financialYear(ms: number): string {
  const d = new Date(ms + 5.5 * 3600_000);
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${String(y % 100).padStart(2, "0")}${String((y + 1) % 100).padStart(2, "0")}`;
}

/** GST on a tax-inclusive total: CGST + SGST inside Uttar Pradesh, IGST elsewhere. */
export function gstFor(total: number, state: unknown) {
  const s = String(state || "").trim().toLowerCase().replace(/\s+/g, "");
  const intra = s === "uttarpradesh" || s === "up" || s === "u.p.";
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const taxable = r2(total / (1 + GST_RATE));
  const gst = r2(total - taxable);
  return intra
    ? { taxableAmount: taxable, gstRate: 18, cgstRate: 9, sgstRate: 9, igstRate: 0, cgstAmount: r2(gst / 2), sgstAmount: r2(gst - r2(gst / 2)), igstAmount: 0, totalGstAmount: gst, placeOfSupply: "intra-state" }
    : { taxableAmount: taxable, gstRate: 18, cgstRate: 0, sgstRate: 0, igstRate: 18, cgstAmount: 0, sgstAmount: 0, igstAmount: gst, totalGstAmount: gst, placeOfSupply: "inter-state" };
}

/** The value the invoice is for: what the customer was charged, shipping included. */
export const invoiceValue = (o: any) => Number(o?.total ?? o?.amountPayable ?? 0) || 0;

export async function confirmOrder(db: admin.firestore.Firestore, orderId: string, at = Date.now()) {
  const result = await numberOrder(db, orderId, at);
  // A confirmed order pays with the wallet money it used — once (userDoc.ts).
  if (result) {
    try {
      const { debitWalletForOrder } = await import("./userDoc");
      await debitWalletForOrder(db, db.collection("orders").doc(orderId));
    } catch (e: any) {
      console.error("confirmOrder: wallet debit failed", { orderId, error: e?.message || e });
    }
    // A referred order: tell whoever referred it (referrals.ts). Once.
    try {
      const { noteReferredOrderConfirmed } = await import("./referrals");
      await noteReferredOrderConfirmed(db, orderId);
    } catch (e: any) {
      console.error("confirmOrder: referral note failed", { orderId, error: e?.message || e });
    }
  }
  return result;
}

async function numberOrder(db: admin.firestore.Firestore, orderId: string, at: number) {
  const prefixSnap = await db.collection("settings").doc("INVOICE_PREFIX").get();
  const prefix = String((prefixSnap.data() as any)?.value || DEFAULT_PREFIX).trim() || DEFAULT_PREFIX;
  const orderRef = db.collection("orders").doc(orderId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return null;
    const o = snap.data() as any;
    if (!isConfirmed(o)) return null;
    if (Number(o.createdAt || o._creationTime || at) < INVOICE_START) return null;
    if (o.invoiceNumber) return { orderNumber: o.orderNumber as string, invoiceNumber: o.invoiceNumber as string, already: true };

    const fy = financialYear(at);
    const orderCounter = db.collection("settings").doc("order_counter");
    const invoiceCounter = db.collection("settings").doc(`invoice_counter_${fy}`);
    const [oc, ic] = await Promise.all([tx.get(orderCounter), tx.get(invoiceCounter)]);

    const patch: Record<string, any> = { confirmedAt: at };
    let orderNumber = String(o.orderNumber || "");
    if (!orderNumber) {
      const next = Number((oc.data() as any)?.value) || 1;
      orderNumber = `#${next}`;
      tx.set(orderCounter, { value: next + 1 }, { merge: true });
      patch.orderNumber = orderNumber;
    }
    const n = (Number((ic.data() as any)?.value) || 0) + 1;
    const invoiceNumber = `${prefix}/${fy}/${String(n).padStart(4, "0")}`;
    tx.set(invoiceCounter, { value: n, fy }, { merge: true });
    Object.assign(patch, {
      invoiceNumber, invoiceDate: at, invoiceFy: fy, invoiceSeq: n,
      invoiceValue: invoiceValue(o), ...gstFor(invoiceValue(o), o.shippingAddress?.state),
    });
    tx.update(orderRef, patch);
    return { orderNumber, invoiceNumber, already: false };
  });
}

/*
 * The safety net: any order that becomes confirmed by a path that did not
 * call confirmOrder itself — an admin marking it paid, a manual order, a
 * status changed in bulk — is numbered here, seconds later.
 */
export const onOrderConfirmed = functionsV1.firestore
  .document("orders/{id}")
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after || after.invoiceNumber || !isConfirmed(after)) return null;
    try {
      await confirmOrder(admin.firestore(), context.params.id);
    } catch (e) {
      console.error("onOrderConfirmed failed", context.params.id, e);
    }
    return null;
  });
