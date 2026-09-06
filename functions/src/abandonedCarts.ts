import * as functionsV1 from "firebase-functions/v1";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";

/**
 * At most two emails per cart, ever. This is a constant rather than a setting
 * so a mistyped value in the dashboard can never turn into a send loop.
 */
const MAX_REMINDERS_PER_CART = 2;
const MAX_SENDS_PER_RUN = 50;
const SETTINGS_DOC = "default";

const MSG91_EMAIL_ENDPOINT = "https://control.msg91.com/api/v5/email/send";
const USECASE_KEY = "abandoned_cart";

type Settings = {
  enabled: boolean;
  delayHours: number;
  secondReminderEnabled: boolean;
  secondReminderDelayHours: number;
  dailyEmailCap: number;
  couponPrefix: string;
  couponDiscountType: "percentage" | "fixed";
  couponDiscountValue: number;
  couponValidityDays: number;
};

const DEFAULTS: Settings = {
  enabled: false, // stays off until an admin turns it on
  delayHours: 4,
  secondReminderEnabled: false,
  secondReminderDelayHours: 24,
  dailyEmailCap: 200,
  couponPrefix: "COMEBACK",
  couponDiscountType: "percentage",
  couponDiscountValue: 10,
  couponValidityDays: 7,
};

const readSettings = async (): Promise<Settings> => {
  const snap = await admin.firestore().collection("abandonedCartSettings").doc(SETTINGS_DOC).get();
  return { ...DEFAULTS, ...(snap.exists ? (snap.data() as Partial<Settings>) : {}) };
};

/**
 * Claim the next reminder slot for a cart, atomically.
 *
 * The previous implementation sent the email and then updated the cart in a
 * separate step; any failure in between left the cart matching the same query,
 * so the cron re-sent it every 30 minutes — 5,000 emails to ~20 people. Here
 * the counter moves first, inside a transaction, and the email is only sent if
 * the claim commits. A crash after the claim costs one missed email, which is
 * the safe direction to fail in.
 */
const claimReminderSlot = async (
  cartId: string,
  expectedCount: number
): Promise<FirebaseFirestore.DocumentData | null> => {
  const db = admin.firestore();
  const ref = db.collection("abandonedCarts").doc(cartId);

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;

      const cart = snap.data() as any;
      const count = Number(cart.reminderCount || 0);

      // Someone else claimed it, or the cart moved on since we queried.
      if (count !== expectedCount) return null;
      if (count >= MAX_REMINDERS_PER_CART) return null;
      if (cart.status === "recovered" || cart.status === "expired") return null;

      tx.update(ref, {
        reminderCount: count + 1,
        reminderSentAt: Date.now(),
        status: "reminded",
      });

      return { ...cart, _id: cartId, reminderCount: count + 1 };
    });
  } catch (err) {
    console.error(`claim failed for cart ${cartId}:`, err);
    return null;
  }
};

const createRecoveryCoupon = async (cart: any, s: Settings): Promise<string | null> => {
  try {
    const code = `${s.couponPrefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await admin.firestore().collection("coupons").add({
      code,
      discountType: s.couponDiscountType,
      discountValue: s.couponDiscountValue,
      isActive: true,
      isPublic: false,
      usageLimit: 1,
      usageCount: 0,
      startDate: Date.now(),
      endDate: Date.now() + s.couponValidityDays * 24 * 60 * 60 * 1000,
      source: "abandoned_cart",
      abandonedCartId: cart._id,
      createdAt: Date.now(),
    });
    return code;
  } catch (err) {
    console.error("coupon creation failed:", err);
    return null;
  }
};

const sendReminderEmail = async (cart: any, couponCode: string | null): Promise<boolean> => {
  const authkey = process.env.MSG91_AUTH_TOKEN || "";
  if (!authkey) {
    console.error("MSG91_AUTH_TOKEN not configured — skipping send");
    return false;
  }

  const tpl = await admin.firestore()
    .collection("emailUsecaseTemplates")
    .where("usecaseKey", "==", USECASE_KEY)
    .limit(1)
    .get();
  if (tpl.empty || tpl.docs[0].data().enabled !== true) {
    console.error(`email usecase "${USECASE_KEY}" is missing or disabled — skipping send`);
    return false;
  }

  const body = {
    template_id: tpl.docs[0].data().msg91TemplateId,
    recipients: [{
      to: [{ email: cart.userEmail, name: cart.userName || "" }],
      variables: {
        customer_name: cart.userName || "there",
        cart_total: String(cart.cartTotal ?? ""),
        item_count: String((cart.items || []).length),
        coupon_code: couponCode || "",
      },
    }],
    from: { email: "noreply@mail.goskinly.com", name: "Skinly" },
    domain: "mail.goskinly.com",
  };

  const fetch = require("node-fetch");
  const res = await fetch(MSG91_EMAIL_ENDPOINT, {
    method: "POST",
    headers: { authkey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("MSG91 email failed:", await res.text());
    return false;
  }
  return true;
};

const runReminderPass = async (): Promise<{ sent: number; claimed: number; skipped: string }> => {
  const s = await readSettings();
  if (!s.enabled) return { sent: 0, claimed: 0, skipped: "disabled in settings" };

  const db = admin.firestore();
  const now = Date.now();

  // First reminder: never contacted, and abandoned long enough ago.
  const firstDue = await db.collection("abandonedCarts")
    .where("reminderCount", "==", 0)
    .where("abandonedAt", "<=", now - s.delayHours * 3600_000)
    .limit(MAX_SENDS_PER_RUN)
    .get();

  const candidates: Array<{ id: string; count: number }> =
    firstDue.docs.map((d) => ({ id: d.id, count: 0 }));

  // Second reminder: measured from when the first was actually sent.
  if (s.secondReminderEnabled && candidates.length < MAX_SENDS_PER_RUN) {
    const secondDue = await db.collection("abandonedCarts")
      .where("reminderCount", "==", 1)
      .where("reminderSentAt", "<=", now - s.secondReminderDelayHours * 3600_000)
      .limit(MAX_SENDS_PER_RUN - candidates.length)
      .get();
    secondDue.docs.forEach((d) => candidates.push({ id: d.id, count: 1 }));
  }

  let sent = 0;
  let claimed = 0;
  for (const c of candidates) {
    const cart = await claimReminderSlot(c.id, c.count);
    if (!cart) continue; // already claimed, capped, or no longer eligible
    claimed++;

    if (!cart.userEmail) continue;

    // A global daily ceiling, independent of the per-cart cap.
    try {
      await enforceDailyRateLimit({ key: "abandonedCartEmails", limit: s.dailyEmailCap });
    } catch {
      console.warn("daily abandoned-cart email cap reached; stopping this pass");
      break;
    }

    const coupon = await createRecoveryCoupon(cart, s);
    if (await sendReminderEmail(cart, coupon)) sent++;
  }

  return { sent, claimed, skipped: "" };
};

export const processAbandonedCartReminders = functionsV1.pubsub
  .schedule("every 30 minutes")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    const result = await runReminderPass();
    console.log("abandoned cart pass:", result);
    return null;
  });

/** Same pass, on demand from the dashboard. */
export const runAbandonedCartReminders = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  return runReminderPass();
});

/** Marks a cart recovered so it can never be chased again. */
export const markAbandonedCartRecovered = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  if (!data?.cartId) throw new HttpsError("invalid-argument", "cartId is required");
  await admin.firestore().collection("abandonedCarts").doc(data.cartId).update({
    status: "recovered",
    recoveredAt: Date.now(),
  });
  return { success: true };
});
