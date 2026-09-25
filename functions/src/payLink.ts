import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { queueWhatsApp } from "./orderNotifications";
import { normalizeOrderStatus } from "./orderStatus";
import { enforceDailyRateLimit } from "./rate-limit";

/**
 * "Finish your payment" links, and the WhatsApp that carries one.
 *
 * About six prepaid checkouts in ten fail or are left at PhonePe (September:
 * 17 orders, 7 paid). The customer had chosen, typed their address and got
 * as far as paying; it is the warmest moment the shop gets. Nothing reached
 * them for four hours, and then an email pointing at /cart, whose guest cart
 * lives in the browser they checked out in — not the one the email opens.
 *
 * A link now pays for the order itself, from any browser: /pay/<order id>?t=…
 * The token is an HMAC of the order id, so it cannot be made up from an id
 * seen elsewhere (order ids are readable by whoever holds one: that is how
 * guest tracking works) and nothing needs storing. resumePayment
 * (phonepe.ts) accepts it in place of the sign-in or guest session the
 * checkout's own payment call needs.
 */

const SITE = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");

/** A link token for one purpose on one order ("pay", "review"). */
export function linkToken(purpose: string, orderId: string): string {
  const secret = process.env.PAY_LINK_SECRET || "";
  if (!secret) throw new Error("PAY_LINK_SECRET not configured");
  return crypto.createHmac("sha256", secret).update(`${purpose}:${orderId}`).digest("base64url").slice(0, 16);
}

export function linkTokenValid(purpose: string, orderId: string, token: unknown): boolean {
  if (typeof token !== "string" || token.length !== 16) return false;
  const want = Buffer.from(linkToken(purpose, orderId));
  const got = Buffer.from(token);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export function payLinkToken(orderId: string): string {
  return linkToken("pay", orderId);
}

export function payLinkValid(orderId: string, token: unknown): boolean {
  if (typeof token !== "string" || token.length !== 16) return false;
  const want = Buffer.from(payLinkToken(orderId));
  const got = Buffer.from(token);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export function payLinkUrl(orderId: string, source: string): string {
  return `${SITE}/pay/${encodeURIComponent(orderId)}?t=${payLinkToken(orderId)}` +
    `&utm_source=${encodeURIComponent(source)}&utm_medium=payment_reminder`;
}

const phone10 = (v: unknown) => String(v || "").replace(/\D/g, "").slice(-10);
const email = (v: unknown) => String(v || "").trim().toLowerCase();

/*
 * The WhatsApp, fifteen minutes after an unpaid checkout goes quiet.
 *
 * Fifteen minutes, because a customer still fighting their UPI app should not
 * be told to try again while they are trying; and "gone quiet" is measured
 * from the order's last change, so a second attempt restarts the wait.
 *
 *  - One message per phone, whatever it tried: at 3:25 on 24 Sep one number
 *    made five orders in a second. The latest is the one linked; the others
 *    are marked so they are never picked up.
 *  - Not if that phone or email has paid for anything since.
 *  - Not twice to a number within a day, and 50 a day at most in all.
 *  - Not between 10 pm and 8 am. An order from the night is still sent in
 *    the morning, up to twelve hours after it was placed; older ones are left
 *    to the abandoned-cart email.
 *
 * Needs the `payment_failed` WhatsApp usecase switched on with an approved
 * template (Admin › WhatsApp). Until then this does nothing and costs one
 * read every five minutes.
 */
const WAIT_MS = 15 * 60_000;
const MAX_AGE_MS = 12 * 3600_000;
const PER_RUN = 20;
const USECASE = "payment_failed";

/** With `dryRun`, nothing is sent or written; the result lists what would be. */
export async function sendPaymentNudges(db: admin.firestore.Firestore, now = Date.now(), dryRun = false) {
  const hourIst = new Date(now + 5.5 * 3600_000).getUTCHours();
  if (!dryRun && (hourIst < 8 || hourIst >= 22)) return { sent: 0, reason: "quiet hours" };

  const uc = await db.collection("whatsappUsecases").where("usecaseKey", "==", USECASE).limit(1).get();
  if (!dryRun && (uc.empty || uc.docs[0].data().enabled !== true)) return { sent: 0, reason: "usecase off" };
  const plan: string[] = [];

  // Two days back, so a payment made after an older attempt still counts.
  const snap = await db.collection("orders").where("createdAt", ">=", now - 48 * 3600_000).get();

  const paidAt = new Map<string, number>();
  for (const d of snap.docs) {
    const o = d.data() as any;
    if (o.isDeleted) continue;
    if (o.paymentStatus !== "success" && o.paymentMethod !== "cod") continue;
    for (const k of [phone10(o.phone || o.shippingAddress?.phone), email(o.email)]) {
      if (k) paidAt.set(k, Math.max(paidAt.get(k) || 0, Number(o.createdAt) || 0));
    }
  }

  const groups = new Map<string, admin.firestore.QueryDocumentSnapshot[]>();
  for (const d of snap.docs) {
    const o = d.data() as any;
    const created = Number(o.createdAt) || 0;
    const quietSince = Math.max(created, Number(o.updatedAt) || 0);
    if (o.isDeleted || o.payNudgeAt || o.paymentMethod === "cod") continue;
    if (o.paymentStatus === "success") continue;
    if (normalizeOrderStatus(o.status, o.paymentStatus, o) !== "pending_payment") continue;
    if (!(Number(o.amountPayable ?? o.total) > 0)) continue;
    if (created < now - MAX_AGE_MS || quietSince > now - WAIT_MS) continue;
    const p = phone10(o.phone || o.shippingAddress?.phone);
    if (!/^[6-9]\d{9}$/.test(p)) continue;
    groups.set(p, [...(groups.get(p) || []), d]);
  }

  let sent = 0;
  for (const [p, docs] of groups) {
    if (sent >= PER_RUN) break;
    docs.sort((a, b) => (Number(b.data().createdAt) || 0) - (Number(a.data().createdAt) || 0));
    const latest = docs[0];
    const o = latest.data() as any;
    const earliest = Math.min(...docs.map((d) => Number(d.data().createdAt) || 0));

    const skip = async (why: string) => {
      plan.push(`skip ${o.orderNumber} (${docs.length} orders): ${why}`);
      if (dryRun) return;
      const batch = db.batch();
      for (const d of docs) batch.update(d.ref, { payNudgeAt: now, payNudgeSkipped: why });
      await batch.commit();
    };

    if ((paidAt.get(p) || 0) >= earliest || (paidAt.get(email(o.email)) || 0) >= earliest) {
      await skip("paid another order");
      continue;
    }
    const mark = db.collection("payNudges").doc(p);
    const last = Number((await mark.get()).data()?.lastAt) || 0;
    if (last > now - 24 * 3600_000) {
      await skip("reminded in the last day");
      continue;
    }
    if (dryRun) {
      plan.push(`send ${o.orderNumber} to …${p.slice(-4)} (${docs.length} orders): ${payLinkUrl(latest.id, "whatsapp")}`);
      sent++;
      continue;
    }
    try {
      await enforceDailyRateLimit({ key: "payment_nudge_all", limit: 50 });
    } catch {
      break;
    }

    const items: any[] = Array.isArray(o.items) ? o.items : [];
    const firstName = String(o.shippingAddress?.fullName || o.customerName || "").trim().split(/\s+/)[0] || "there";
    const queued = await queueWhatsApp(db, USECASE, p, {
      customer_name: firstName,
      order_number: String(o.orderNumber || "").replace(/^#/, ""),
      order_amount: `₹${Math.round(Number(o.amountPayable ?? o.total))}`,
      order_total: `₹${Math.round(Number(o.amountPayable ?? o.total))}`,
      product_name: String(items[0]?.productTitle || "your order").slice(0, 60),
      pay_link: payLinkUrl(latest.id, "whatsapp"),
    }, latest.id);
    if (!queued) continue;

    const batch = db.batch();
    batch.update(latest.ref, { payNudgeAt: now, payNudgeVia: "whatsapp" });
    for (const d of docs.slice(1)) batch.update(d.ref, { payNudgeAt: now, payNudgeSkipped: `superseded by ${o.orderNumber || latest.id}` });
    batch.set(mark, { lastAt: now, orderId: latest.id });
    await batch.commit();
    sent++;
  }
  if (sent && !dryRun) console.log("paymentNudges", { sent });
  return { sent, plan };
}

export const paymentNudges = functionsV1
  .runWith({ memory: "256MB", timeoutSeconds: 120 })
  .pubsub.schedule("every 5 minutes")
  .onRun(async () => {
    await sendPaymentNudges(admin.firestore());
    return null;
  });
