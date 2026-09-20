import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { queueWhatsApp, sendUsecaseEmail } from "./orderNotifications";

/**
 * The one place an order's status is decided and written.
 *
 * Before this, six routes wrote `status` directly and each carried its own
 * rules: the manual-tracking dialog shipped an order that had not been paid
 * for, `createShipment` wrote no status at all while `cancelShipment` wrote
 * one, a replayed pickup webhook could walk a delivered order back to
 * processing, and nothing at all told the customer when any of it happened.
 * They disagreed because each was written against the case in front of it.
 *
 * So the decision lives here, once: normalise what is stored, check the move
 * against the graph below, record who asked for it, and fire the side effects
 * a move implies. Every route now calls this and none of them writes `status`
 * itself.
 */

export const ORDER_STATUSES = [
  "pending_payment",
  "processing",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
  "undelivered",
  "delivered",
  "cancelled",
  "rto",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const IS_STATUS = new Set<string>(ORDER_STATUSES as readonly string[]);

/**
 * What a stored status means, whatever generation of checkout wrote it.
 *
 * Three writers disagreed. `placeOrder` writes "pending" for every order
 * including COD, the older `createOrder` writes "pending_payment" for prepaid
 * and "processing" for COD, and the browser reconciled the two on the way out
 * of Firestore — which left the server reading the raw value and acting on it.
 * That is why the same button behaved differently on two orders placed a week
 * apart. Reconciling happens here now, on the server, before anything decides
 * anything.
 *
 * "failed" was never an order status: it describes the payment, which has its
 * own field, and an order whose payment failed is simply still awaiting it.
 */
export function normalizeOrderStatus(
  raw: any,
  paymentStatus?: any,
  opts?: { paymentMethod?: any; prepaidAmount?: any }
): OrderStatus {
  const v = String(raw || "").trim().toLowerCase();
  const paid = String(paymentStatus || "").trim().toLowerCase() === "success";

  /*
   * A COD order is not waiting for money.
   *
   * `placeOrder` writes "pending" for every order, COD included, so reading
   * that as "unpaid" put COD orders in Pending Payment — where nobody packs
   * them, because that tab is the one you ignore. The shop owes them a
   * parcel; they owe the courier at the door. The exception is partial COD,
   * where a slice really is due up front and really has not arrived.
   */
  const isCod = String(opts?.paymentMethod || "").trim().toLowerCase() === "cod";
  const prepaidDue = Number(opts?.prepaidAmount) > 0;
  const settled = paid || (isCod && !prepaidDue);

  if (!v || v === "pending" || v === "pending_payment" || v === "failed") {
    return settled ? "processing" : "pending_payment";
  }
  if (IS_STATUS.has(v)) return v as OrderStatus;

  // Nothing else has ever been written. Said out loud rather than silently
  // treated as one of the nine, because a tenth value means someone added a
  // writer that does not go through here.
  console.warn("normalizeOrderStatus: unknown status", { raw });
  return settled ? "processing" : "pending_payment";
}

/**
 * Which moves are allowed, and therefore which are not.
 *
 * What this exists to stop is an order walking *backwards*. Couriers replay
 * events and deliver them out of order, so "picked up" arriving after
 * "delivered" is normal traffic, not a bug, and the three end states have no
 * exits at all — an admin who genuinely needs one takes the override, which is
 * recorded as an override.
 *
 * Skipping forward is not the same thing and is allowed throughout. A parcel
 * whose intermediate scans never arrived is still delivered; a parcel handed
 * over at the counter never has an AWB here at all. The first version of this
 * refused ready_to_ship → delivered, which is a real Tuesday afternoon and not
 * a fault — the admin knows the thing arrived.
 *
 * The one forward move still refused is out of pending_payment, because
 * "shipped" on an order nobody has paid for is the bug this table was written
 * for in the first place.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["processing", "cancelled"],
  processing: ["ready_to_ship", "shipped", "out_for_delivery", "delivered", "cancelled"],
  ready_to_ship: ["shipped", "out_for_delivery", "delivered", "processing", "cancelled"],
  shipped: ["out_for_delivery", "undelivered", "delivered", "rto", "cancelled"],
  out_for_delivery: ["delivered", "undelivered", "rto"],
  undelivered: ["out_for_delivery", "shipped", "delivered", "rto"],
  delivered: [],
  cancelled: [],
  rto: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  from === to || TRANSITIONS[from]?.includes(to) === true;

/** The moment fields a status implies, so reports never re-derive them. */
const STAMP: Partial<Record<OrderStatus, string>> = {
  processing: "confirmedAt",
  ready_to_ship: "readyToShipAt",
  shipped: "shippedAt",
  out_for_delivery: "outForDeliveryAt",
  delivered: "deliveredAt",
  cancelled: "cancelledAt",
  rto: "rtoAt",
};

/** Which message a status sends, where one exists. */
const NOTICE: Partial<Record<OrderStatus, { email: string; whatsapp: string }>> = {
  shipped: { email: "order_dispatched", whatsapp: "order_dispatched" },
  delivered: { email: "order_delivered", whatsapp: "order_delivered" },
  cancelled: { email: "order_cancelled", whatsapp: "order_cancelled" },
};

export interface SetStatusOptions {
  /** Who asked: "webhook", "shipment", "manual-tracking", "admin", "payment". */
  source: string;
  reason?: string;
  /** The admin's uid, where a person asked for it. */
  actor?: string;
  /** Take a move the graph refuses. Recorded as an override. */
  force?: boolean;
  /**
   * Whether the customer hears about it.
   *
   * Automatic moves notify; an admin moving the status by hand does not,
   * because that screen opens its own dialog to send the mail and choose
   * whether WhatsApp goes with it.
   */
  notify?: boolean;
}

export interface SetStatusResult {
  changed: boolean;
  from: OrderStatus | null;
  to: OrderStatus | null;
  /** Set when the graph refused the move. */
  blocked?: boolean;
  message: string;
}

/**
 * Moves one order, or explains why it did not move.
 *
 * The decision is taken inside a transaction against the status as it is at
 * that instant, because two webhook deliveries for one parcel arrive together
 * often enough to matter. Side effects run after it commits, and each is
 * guarded on its own flag, so a retry of this call is free.
 */
export async function setOrderStatus(
  db: admin.firestore.Firestore,
  orderId: string,
  next: OrderStatus,
  opts: SetStatusOptions
): Promise<SetStatusResult> {
  if (!IS_STATUS.has(next)) {
    return { changed: false, from: null, to: null, message: `"${next}" is not an order status` };
  }
  const ref = db.collection("orders").doc(orderId);

  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "missing" as const };

    const order = snap.data() as any;
    const from = normalizeOrderStatus(order.status, order.paymentStatus, order);

    // Already there. The stored string may still be a legacy spelling of it,
    // so it is rewritten in the canonical one and nothing else happens.
    if (from === next) {
      if (String(order.status || "") !== next) {
        tx.update(ref, { status: next, updatedAt: Date.now() });
      }
      return { kind: "same" as const, from, order };
    }

    if (!canTransition(from, next) && !opts.force) {
      return { kind: "blocked" as const, from };
    }

    const now = Date.now();
    const stamp = STAMP[next];
    tx.update(ref, {
      status: next,
      statusChangedAt: now,
      updatedAt: now,
      ...(stamp ? { [stamp]: now } : {}),
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        at: now,
        from,
        to: next,
        source: opts.source,
        ...(opts.reason ? { reason: opts.reason } : {}),
        ...(opts.actor ? { actor: opts.actor } : {}),
        ...(opts.force && !canTransition(from, next) ? { override: true } : {}),
      }),
    });
    return { kind: "moved" as const, from, order };
  });

  if (outcome.kind === "missing") {
    return { changed: false, from: null, to: null, message: "Order not found" };
  }
  if (outcome.kind === "blocked") {
    return {
      changed: false,
      from: outcome.from,
      to: next,
      blocked: true,
      message: `An order that is ${outcome.from} cannot become ${next}`,
    };
  }
  if (outcome.kind === "same") {
    return { changed: false, from: outcome.from, to: next, message: `Already ${next}` };
  }

  // ── Side effects ──────────────────────────────────────────────────────────
  // Each is guarded by its own once-only flag and each is allowed to fail on
  // its own: an order's status must not depend on MSG91 being reachable.
  const order = outcome.order;

  if (next === "cancelled" || next === "rto") {
    try {
      const { releaseMaterialForOrder } = await import("./materials");
      await releaseMaterialForOrder(db, ref);
    } catch (e: any) {
      console.error("setOrderStatus: stock release failed", { orderId, error: e?.message || e });
    }
  }

  if (next === "delivered") {
    try {
      await creditWalletOnDelivery(db, ref, order);
    } catch (e: any) {
      console.error("setOrderStatus: wallet credit failed", { orderId, error: e?.message || e });
    }
  }

  if (opts.notify !== false) {
    try {
      await notifyOrderStatus(db, orderId, next);
    } catch (e: any) {
      console.error("setOrderStatus: notify failed", { orderId, status: next, error: e?.message || e });
    }
  }

  console.log("setOrderStatus", {
    orderId,
    order: order?.orderNumber,
    from: outcome.from,
    to: next,
    source: opts.source,
  });
  return { changed: true, from: outcome.from, to: next, message: `Moved to ${next}` };
}

/**
 * Tells the customer their order moved, once per status.
 *
 * Notifications used to hang off the admin screen's dropdown, which meant the
 * two moments that matter most — dispatched and delivered, both of which
 * arrive from the courier and not from a person — reached nobody at all. The
 * `statusNotified` list is what stops a parcel that bounces between "out for
 * delivery" and "undelivered" sending the same message four times.
 */
export async function notifyOrderStatus(
  db: admin.firestore.Firestore,
  orderId: string,
  status: OrderStatus
): Promise<{ email: boolean; whatsapp: boolean }> {
  const notice = NOTICE[status];
  if (!notice) return { email: false, whatsapp: false };

  const ref = db.collection("orders").doc(orderId);
  const order = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const data = snap.data() as any;
    if ((data.statusNotified || []).includes(status)) return null;
    tx.update(ref, { statusNotified: admin.firestore.FieldValue.arrayUnion(status) });
    return data;
  });
  if (!order) return { email: false, whatsapp: false };

  const items = Array.isArray(order.items) ? order.items : [];
  const [wa, mail] = await Promise.all([
    queueWhatsApp(db, notice.whatsapp, order.shippingAddress?.phone || order.phone || "", {
      customer_name: order.shippingAddress?.fullName || order.customerName || "Customer",
      order_number: String(order.orderNumber || order.failedOrderNumber || "Pending"),
      order_total: (Number(order.total ?? order.amountPayable) || 0).toFixed(2),
      product_name: items.map((i: any) => i?.productTitle).filter(Boolean).join(", "),
    }, orderId).catch(() => false),
    sendUsecaseEmail(db, order, orderId, notice.email).catch(() => false),
  ]);

  console.log("notifyOrderStatus", { orderId, status, whatsapp: wa, email: mail });
  return { email: !!mail, whatsapp: !!wa };
}

/**
 * Pays what the order earned into the customer's wallet when it lands, once.
 *
 * Two promises are settled here, and neither was being kept. A wallet-credit
 * coupon ("₹100 back on delivery") was read from `walletCreditCouponAmount`,
 * a field `placeOrder` had never written — so the payout could not fire for
 * anybody. And product cashback ("earn ₹40 back") was worked out in the
 * browser for display only and thrown away at checkout. Both are now recorded
 * on the order when it is placed, at the rules in force that day, and both
 * are paid from here.
 *
 * This also used to live inside the RapidShyp webhook, so a delivery recorded
 * any other way — by hand, or by a courier we have no webhook for — silently
 * owed the customer money. It belongs to the status, not to the route that
 * reported it.
 */
async function creditWalletOnDelivery(
  db: admin.firestore.Firestore,
  orderRef: admin.firestore.DocumentReference,
  order: any
): Promise<void> {
  const coupon = Number(order?.walletCreditCouponAmount) || 0;
  const cashback = Number(order?.cashbackAmount) || 0;
  const amount = Math.round((coupon + cashback) * 100) / 100;
  if (!(amount > 0) || order?.walletCreditCredited) return;

  if (!order?.userId || String(order.userId).startsWith("guest")) {
    /*
     * A guest has no wallet to pay into. Said out loud and marked on the
     * order rather than dropped, because the customer was promised this at
     * checkout and somebody has to be able to see who is owed what.
     */
    await orderRef.update({ creditOwedNoAccount: amount, updatedAt: Date.now() });
    console.warn("creditWalletOnDelivery: no account to credit", {
      order: order?.orderNumber, amount,
    });
    return;
  }

  const userRef = db.collection("users").doc(String(order.userId));
  const txRef = db.collection("walletTransactions").doc();
  const parts = [
    coupon > 0 ? `coupon ₹${coupon}` : "",
    cashback > 0 ? `cashback ₹${cashback}` : "",
  ].filter(Boolean).join(" + ");

  await db.runTransaction(async (tx) => {
    const [orderSnap, userSnap] = await tx.getAll(orderRef, userRef);
    // Re-read inside the transaction: two webhook deliveries for one parcel is
    // normal, and paying twice is not recoverable by an apology.
    if ((orderSnap.data() as any)?.walletCreditCredited) return;
    if (!userSnap.exists) return;

    const before = Number((userSnap.data() as any)?.walletBalance) || 0;
    const after = Math.round((before + amount) * 100) / 100;
    tx.update(userRef, { walletBalance: after });
    tx.set(txRef, {
      userId: order.userId,
      transactionType: "credit",
      amount,
      source: coupon > 0 && cashback > 0 ? "delivery_credit" : coupon > 0 ? "coupon_credit" : "cashback",
      balanceBefore: before,
      balanceAfter: after,
      description: `Delivered order ${order.orderNumber || ""} — ${parts}`.trim(),
      relatedOrderId: orderRef.id,
      ...(order.couponId ? { relatedCouponId: order.couponId } : {}),
      createdAt: Date.now(),
    });
    tx.update(orderRef, {
      walletCreditCredited: true,
      walletCreditPaid: amount,
      walletCreditPaidAt: Date.now(),
    });
  });

  console.log("creditWalletOnDelivery", { order: order?.orderNumber, amount, parts });
}

/* ------------------------------------------------------------- callables */

/**
 * The admin screen's status dropdown, and its bulk equivalent.
 *
 * It used to write Firestore straight from the browser and return the order
 * id, while the page read `result.whatsappErrors` off that string — always
 * undefined, so the page reported "status updated and WhatsApp notification
 * sent" on every change, having sent nothing. It now reports what happened.
 */
export const setOrderStatusAdmin = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const ids: string[] = Array.isArray(data?.orderIds)
    ? data.orderIds.map(String)
    : data?.orderId ? [String(data.orderId)] : [];
  if (!ids.length) throw new HttpsError("invalid-argument", "Missing orderId");
  if (ids.length > 300) throw new HttpsError("invalid-argument", "At most 300 orders at a time");

  const next = String(data?.status || "") as OrderStatus;
  if (!IS_STATUS.has(next)) throw new HttpsError("invalid-argument", `"${next}" is not an order status`);

  const db = admin.firestore();
  const results: Array<SetStatusResult & { orderId: string }> = [];
  for (const orderId of ids) {
    const r = await setOrderStatus(db, orderId, next, {
      source: "admin",
      actor: uid,
      reason: data?.reason ? String(data.reason) : undefined,
      force: data?.force === true,
      // The admin screen sends its own mail from the dialog that opens next.
      notify: data?.notify === true,
    });
    results.push({ orderId, ...r });
  }

  const changed = results.filter((r) => r.changed);
  const blocked = results.filter((r) => r.blocked);
  return {
    success: blocked.length === 0,
    status: next,
    updatedCount: changed.length,
    blockedCount: blocked.length,
    // One sentence the page can show as it is, rather than each caller
    // inventing its own wording for the same outcome.
    message: blocked.length
      ? `${changed.length} moved to ${next}; ${blocked.length} refused (${blocked[0].message})`
      : `${changed.length} order${changed.length === 1 ? "" : "s"} moved to ${next}`,
    results,
  };
});

/**
 * Rewrites every legacy status into the canonical vocabulary, once.
 *
 * Until this runs, orders written by `placeOrder` sit at the literal "pending"
 * — including COD orders, which are not waiting on payment at all — and every
 * rule keyed on "processing" skips them. Safe to run more than once: an order
 * already in the vocabulary is left alone, and nothing here notifies anyone.
 */
export const backfillOrderStatuses = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const dryRun = data?.dryRun === true;
  const db = admin.firestore();

  const snap = await db.collection("orders").get();
  const changes: Array<{ id: string; orderNumber: string; from: string; to: string }> = [];

  for (const d of snap.docs) {
    const o = d.data() as any;
    const from = String(o.status || "");
    const to = normalizeOrderStatus(from, o.paymentStatus, o);
    if (from === to) continue;
    changes.push({ id: d.id, orderNumber: String(o.orderNumber || o.failedOrderNumber || d.id), from: from || "(blank)", to });
  }

  if (!dryRun) {
    for (let i = 0; i < changes.length; i += 400) {
      const batch = db.batch();
      for (const c of changes.slice(i, i + 400)) {
        batch.update(db.collection("orders").doc(c.id), { status: c.to, updatedAt: Date.now() });
      }
      await batch.commit();
    }
  }

  /*
   * Second pass: a parcel with an AWB is not still being made.
   *
   * `createShipment` wrote no status at all until this week, so every order
   * booked with a courier before then sits in Processing with a label already
   * printed — the tracking page shows "Preparing" beside a live AWB. These are
   * lifted to ready_to_ship, and the courier's next scan carries them on from
   * there. Quietly: the customer was not told when it happened and would not
   * thank us for hearing about it now.
   */
  const labelled: Array<{ id: string; orderNumber: string }> = [];
  for (const d of snap.docs) {
    const o = d.data() as any;
    if (o.isDeleted === true) continue;
    const hasAwb = !!String(o.awbNumber || o.manualTrackingNumber || "").trim();
    if (!hasAwb) continue;
    // Against the status it will have after the first pass, not the one on disk.
    const after = changes.find((c) => c.id === d.id)?.to || normalizeOrderStatus(o.status, o.paymentStatus, o);
    if (after !== "processing") continue;
    labelled.push({ id: d.id, orderNumber: String(o.orderNumber || d.id) });
  }

  if (!dryRun) {
    for (const l of labelled) {
      await setOrderStatus(db, l.id, "ready_to_ship", {
        source: "backfill",
        reason: "Has a courier AWB",
        notify: false,
      });
    }
  }

  const byMove: Record<string, number> = {};
  for (const c of changes) byMove[`${c.from} → ${c.to}`] = (byMove[`${c.from} → ${c.to}`] || 0) + 1;
  if (labelled.length) byMove["processing → ready_to_ship (has AWB)"] = labelled.length;

  const total = changes.length + labelled.length;
  return {
    success: true,
    scanned: snap.size,
    changed: dryRun ? 0 : total,
    wouldChange: total,
    byMove,
    dryRun,
    message: dryRun
      ? `${total} of ${snap.size} orders would be rewritten`
      : `${total} of ${snap.size} orders rewritten`,
  };
});
