import * as functionsV1 from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { normalizeOrderStatus, setOrderStatus } from "./orderStatus";

/**
 * Orders nobody ever paid for, closed on a schedule.
 *
 * `placeOrder` takes the sheets and metres an order needs the moment it is
 * written — before the payment, deliberately, so a customer who pays cannot
 * find the stock gone. The cost of that is an order abandoned at the PhonePe
 * page holds its material for ever, because nothing ever closed it. Of 148
 * orders on file, over a hundred had never been paid, and every one of them
 * was still holding stock off the shelf.
 *
 * Cancelling returns it: releaseMaterialForOrder runs from setOrderStatus on
 * the way into "cancelled".
 *
 * Off by default. The window is a judgement about your own customers — how
 * long someone might reasonably take to come back and finish paying — and
 * nobody should discover it running by finding their orders cancelled.
 */

const SETTING_KEY = "AUTO_CANCEL_UNPAID_HOURS";

/** Hours before an unpaid order is closed, or 0 for never. */
async function autoCancelHours(db: admin.firestore.Firestore): Promise<number> {
  const snap = await db.collection("settings").doc(SETTING_KEY).get();
  const raw = snap.exists ? (snap.data() as any)?.value : 0;
  const n = Number(raw);
  // A floor of one hour: a shopper who takes twenty minutes over a payment
  // page is normal, and a misplaced "1" meaning minutes must not cancel them.
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 0;
}

export interface SweepResult {
  hours: number;
  scanned: number;
  cancelled: number;
  orders: Array<{ orderNumber: string; ageHours: number }>;
  skipped: number;
}

/**
 * Closes what is genuinely unpaid, and nothing else.
 *
 * Three things are left alone on purpose: COD orders, which are not waiting
 * on money at all; anything whose payment did land, however the status reads;
 * and orders already deleted, which are somebody else's decision.
 */
export async function sweepUnpaidOrders(
  db: admin.firestore.Firestore,
  opts: { hours?: number; dryRun?: boolean; actor?: string } = {}
): Promise<SweepResult> {
  const hours = opts.hours ?? (await autoCancelHours(db));
  if (!hours) return { hours: 0, scanned: 0, cancelled: 0, orders: [], skipped: 0 };

  const cutoff = Date.now() - hours * 3600 * 1000;
  /*
   * Oldest first, in bites. A single-field index on createdAt exists without
   * being declared; a compound query on status as well would need one
   * deployed, and the status has to be normalised in here anyway.
   */
  const snap = await db
    .collection("orders")
    .where("createdAt", "<", cutoff)
    .orderBy("createdAt", "asc")
    .limit(200)
    .get();

  const out: SweepResult = { hours, scanned: snap.size, cancelled: 0, orders: [], skipped: 0 };

  for (const d of snap.docs) {
    const o = d.data() as any;
    if (o.isDeleted === true) { out.skipped++; continue; }
    if (String(o.paymentStatus || "").toLowerCase() === "success") { out.skipped++; continue; }
    if (normalizeOrderStatus(o.status, o.paymentStatus, o) !== "pending_payment") { out.skipped++; continue; }

    const ageHours = Math.round((Date.now() - (Number(o.createdAt) || 0)) / 3600000);
    out.orders.push({ orderNumber: String(o.orderNumber || o.failedOrderNumber || d.id), ageHours });
    if (opts.dryRun) continue;

    const moved = await setOrderStatus(db, d.id, "cancelled", {
      source: "auto-cancel",
      reason: `Unpaid for ${ageHours} hours`,
      ...(opts.actor ? { actor: opts.actor } : {}),
      // Silent. Telling someone their abandoned basket has been cancelled is
      // a message nobody wants; the abandoned-cart reminders are the ones
      // that belong to this moment and they have already gone out.
      notify: false,
    });
    if (moved.changed) out.cancelled++;
  }

  if (out.cancelled) console.log("sweepUnpaidOrders", { hours, cancelled: out.cancelled });
  return out;
}

/** Hourly, so an order is never more than an hour past its window. */
export const unpaidOrderSweep = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .pubsub.schedule("every 60 minutes")
  .onRun(async () => {
    const db = admin.firestore();
    await sweepUnpaidOrders(db);
    return null;
  });

/**
 * The same sweep on demand, and a dry run of it.
 *
 * A dry run is how the window gets chosen: try 24 hours, see whose orders
 * would go, try 48.
 */
export const runUnpaidSweep = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .https.onCall(async (data: any, context: any) => {
    const { uid } = await requireAdmin(context);
    const hours = data?.hours === undefined ? undefined : Number(data.hours);
    if (hours !== undefined && (!Number.isFinite(hours) || hours < 1)) {
      throw new HttpsError("invalid-argument", "The window must be at least one hour");
    }
    const out = await sweepUnpaidOrders(admin.firestore(), {
      hours,
      dryRun: data?.dryRun === true,
      actor: uid,
    });
    if (!out.hours) {
      return { ...out, message: "Auto-cancel is switched off — set a window first, or pass one to try it." };
    }
    return {
      ...out,
      message: data?.dryRun === true
        ? `${out.orders.length} unpaid orders are older than ${out.hours} hours`
        : `${out.cancelled} unpaid orders cancelled, their stock back on the shelf`,
    };
  });
