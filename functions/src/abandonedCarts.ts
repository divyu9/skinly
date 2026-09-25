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
  // A zero discount is "no coupon", not a code worth nothing: the template
  // prints whatever code it is given, and a customer who types one in and
  // gets nothing off is worse than one who was never offered it.
  if (!(Number(s.couponDiscountValue) > 0)) return null;
  try {
    const code = `${s.couponPrefix || "COMEBACK"}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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

const SITE = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");
const rupees = (n: unknown) => Math.round(Number(n) || 0).toLocaleString("en-IN");
/** A picture the mail can show; the old Cloudinary account answers 401. */
const mailImage = (u: unknown) => {
  const url = String(u || "");
  // Mockup keys carry spaces ("mockups/Apple/iPhone 17/…"), which some mail
  // clients will not fetch unencoded.
  return /^https:\/\//.test(url) && !url.includes("res.cloudinary.com") ? url.replace(/ /g, "%20") : "";
};

/**
 * Everything the reminder template can print.
 *
 * The template in MSG91 asked for customerName, productName, amount,
 * couponCode, couponDescription and cartLink, and this sent customer_name,
 * cart_total, item_count and coupon_code — so every reminder went out with
 * the name, the products and the code blank. Both spellings are sent now, and
 * the redesigned template adds up to three item rows with pictures.
 */
const reminderVariables = (cart: any, couponCode: string | null, s: Settings) => {
  const items: any[] = Array.isArray(cart.items) ? cart.items : [];
  const first = String(cart.userName || "").trim().split(/\s+/)[0] || "";
  const titles = items.map((i) => String(i?.productTitle || "").trim()).filter(Boolean);
  const productName = titles.length <= 1 ? (titles[0] || "your skins")
    : `${titles[0]} and ${titles.length - 1} more`;
  const off = s.couponDiscountType === "fixed"
    ? `₹${rupees(s.couponDiscountValue)} off`
    : `${Number(s.couponDiscountValue)}% off`;
  const vars: Record<string, string> = {
    // the original names
    customer_name: first || "there",
    cart_total: String(cart.cartTotal ?? ""),
    item_count: String(items.length),
    coupon_code: couponCode || "",
    // the template's names
    customerName: first || "there",
    productName,
    amount: rupees(cart.cartTotal),
    itemCount: String(items.length),
    itemWord: items.length === 1 ? "item" : "items",
    couponCode: couponCode || "",
    couponOff: couponCode ? off : "",
    couponDescription: couponCode
      ? `${off} your order · valid for ${Number(s.couponValidityDays) || 7} days · one use`
      : "",
    cartLink: `${SITE}/cart?utm_source=email&utm_medium=abandoned_cart&utm_campaign=reminder_${Number(cart.reminderCount) || 1}`,
    shopLink: `${SITE}/products?utm_source=email&utm_medium=abandoned_cart`,
  };
  items.slice(0, 3).forEach((it, i) => {
    const n = i + 1;
    vars[`item${n}Name`] = String(it?.productTitle || "Skin");
    const variant = String(it?.variant || "").trim();
    vars[`item${n}Variant`] = /^default title$/i.test(variant) ? "" : variant;
    vars[`item${n}Image`] = mailImage(it?.productImage);
    vars[`item${n}Price`] = it?.price != null ? rupees(Number(it.price) * (Number(it.quantity) || 1)) : "";
    vars[`item${n}Qty`] = String(Number(it?.quantity) || 1);
  });
  vars.moreItems = items.length > 3 ? `+ ${items.length - 3} more in your cart` : "";
  return vars;
};

const sendReminderEmail = async (cart: any, couponCode: string | null, s: Settings): Promise<boolean> => {
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
      variables: reminderVariables(cart, couponCode, s),
    }],
    from: { email: "noreply@mail.goskinly.com", name: "GoSkinly" },
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

/* ------------------------------------------------------------- detection */

/*
 * Finding the abandoned carts in the first place.
 *
 * Nothing had created one since 3 April. On Convex a job scanned every cart
 * each half hour and wrote these rows; the move to Firebase brought across the
 * half that sends reminders and the admin page that lists them, and left the
 * half that finds them behind. So the reminder job ran every thirty minutes
 * over an empty queue, and the admin page showed April.
 *
 * Two places a customer walks away, both with a way to reach them:
 *
 *   An order that was never paid for. The customer filled in their name,
 *   email and phone and chose what they wanted, then PhonePe failed or they
 *   closed the tab. Twelve of the last forty orders ended this way — one
 *   customer three times over at the same amount. These are the warmest
 *   carts there are.
 *
 *   A signed-in customer's cart with things in it and no order since. Their
 *   account has the email. A guest's cart has no contact at all, so it is
 *   left alone — there is nobody to write to.
 *
 * One row per customer, keyed by email (phone when there is none), so three
 * failed attempts are one reminder, not three. Somebody who came back and
 * paid is not a lost cart, and an open row for them is marked recovered.
 * Nothing older than a week is picked up, so switching reminders on does not
 * write to everybody who wandered off in the spring.
 */
const LOOKBACK_MS = 7 * 86400_000;
// Long enough that somebody still on the payment page is not "abandoned".
const IDLE_MS = 60 * 60_000;

const contactKey = (email?: unknown, phone?: unknown) => {
  const e = String(email || "").trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return `e:${e}`;
  const p = String(phone || "").replace(/\D/g, "").slice(-10);
  return p.length === 10 ? `p:${p}` : "";
};
const rowId = (key: string) =>
  `c_${require("crypto").createHash("sha1").update(key).digest("hex").slice(0, 24)}`;

type Found = {
  key: string; userEmail: string; userPhone: string; userName: string; userId: string | null;
  items: any[]; cartTotal: number; abandonedAt: number; source: "checkout" | "cart"; orderId?: string;
};

export async function detectAbandonedCarts(): Promise<{ found: number; created: number; updated: number; recovered: number }> {
  const db = admin.firestore();
  const now = Date.now();
  const since = now - LOOKBACK_MS;

  // Paid orders tell us who came back. Looked at over twice the window, so a
  // customer who paid just before an old failed attempt is still counted.
  const orders = await db.collection("orders").where("createdAt", ">=", since - LOOKBACK_MS).get();
  const paidAt = new Map<string, number>();
  for (const d of orders.docs) {
    const o = d.data() as any;
    const settled = o.paymentStatus === "success" || (o.paymentMethod === "cod" && !o.isDeleted);
    if (!settled) continue;
    for (const k of [contactKey(o.email || o.customerEmail || o.guestEmail), contactKey(null, o.phone || o.shippingAddress?.phone)]) {
      if (k) paidAt.set(k, Math.max(paidAt.get(k) || 0, Number(o.createdAt) || 0));
    }
  }
  const cameBack = (key: string, phoneKey: string, after: number) =>
    (paidAt.get(key) || 0) > after || (!!phoneKey && (paidAt.get(phoneKey) || 0) > after);

  const found = new Map<string, Found>();

  // 1. Checkouts that were never paid for.
  for (const d of orders.docs) {
    const o = d.data() as any;
    const at = Number(o.createdAt) || 0;
    if (at < since || at > now - IDLE_MS || o.isDeleted) continue;
    if (o.paymentMethod === "cod") continue;
    if (o.paymentStatus === "success") continue;
    const email = o.email || o.customerEmail || o.guestEmail;
    const phone = o.phone || o.shippingAddress?.phone;
    const key = contactKey(email, phone);
    if (!key) continue;
    if (cameBack(key, contactKey(null, phone), at)) continue;
    const prev = found.get(key);
    if (prev && prev.abandonedAt >= at) continue; // keep the latest attempt
    found.set(key, {
      key, source: "checkout", orderId: d.id,
      userEmail: String(email || ""), userPhone: String(phone || ""),
      userName: String(o.shippingAddress?.fullName || o.customerName || ""),
      userId: o.userId && !String(o.userId).startsWith("guest") ? String(o.userId) : null,
      items: (o.items || []).map((i: any) => ({
        productId: i.productId, productTitle: i.productTitle, productImage: i.productImage,
        variant: i.variant, price: i.price, quantity: i.quantity,
      })),
      cartTotal: Number(o.total ?? o.amountPayable) || 0,
      abandonedAt: at,
    });
  }

  // 2. Signed-in customers' carts.
  const cart = await db.collection("cart").get();
  const byUser = new Map<string, any[]>();
  for (const d of cart.docs) {
    const r = d.data() as any;
    const uid = String(r.userId || "");
    if (!uid || uid.startsWith("guest")) continue;
    byUser.set(uid, [...(byUser.get(uid) || []), r]);
  }
  for (const [uid, rows] of byUser) {
    const at = Math.max(...rows.map((r) => Number(r.addedAt) || 0));
    if (at < since || at > now - IDLE_MS) continue;
    const u = await db.collection("users").doc(uid).get();
    const user = (u.exists ? u.data() : {}) as any;
    const key = contactKey(user.email, user.phone);
    if (!key || found.has(key)) continue; // a checkout attempt says more than a cart
    if (cameBack(key, contactKey(null, user.phone), at)) continue;
    found.set(key, {
      key, source: "cart", userId: uid,
      userEmail: String(user.email || ""), userPhone: String(user.phone || ""),
      userName: String(user.name || user.fullName || user.displayName || ""),
      items: rows.map((r) => ({
        productId: r.productId, productTitle: r.productTitle, productImage: r.productImage,
        variant: r.variant, price: r.price, quantity: r.quantity,
      })),
      cartTotal: rows.reduce((n, r) => n + (Number(r.price) || 0) * (Number(r.quantity) || 1), 0),
      abandonedAt: at,
    });
  }

  // Write: new rows start a reminder cycle; open rows are refreshed without
  // touching their reminder count; a closed row from an earlier abandonment
  // starts over, because this is a new one.
  let created = 0, updated = 0;
  for (const f of found.values()) {
    const ref = db.collection("abandonedCarts").doc(rowId(f.key));
    const snap = await ref.get();
    const { key, ...fields } = f;
    const base = { ...fields, contactKey: key, lastSeenAt: now };
    if (!snap.exists) {
      await ref.set({ ...base, status: "abandoned", reminderCount: 0, createdAt: now });
      created++;
      continue;
    }
    const cur = snap.data() as any;
    const closed = cur.status === "recovered" || cur.status === "expired";
    if (closed && f.abandonedAt > Number(cur.closedAt || cur.recoveredAt || 0)) {
      await ref.set({ ...base, status: "abandoned", reminderCount: 0, reminderSentAt: null, createdAt: now });
      created++;
    } else if (!closed) {
      await ref.update({ items: f.items, cartTotal: f.cartTotal, lastSeenAt: now, ...(f.orderId ? { orderId: f.orderId } : {}) });
      updated++;
    }
  }

  // Customers who came back and paid since their cart was written down.
  let recovered = 0;
  // Only rows this detector wrote carry a contactKey, which keeps the 4,830
  // rows from before the move out of a query that runs every half hour.
  const open = await db.collection("abandonedCarts").where("contactKey", ">", "").get();
  for (const d of open.docs) {
    const c = d.data() as any;
    if (c.status !== "abandoned" && c.status !== "reminded") continue;
    const key = String(c.contactKey || contactKey(c.userEmail, c.userPhone));
    if (key && cameBack(key, contactKey(null, c.userPhone), Number(c.abandonedAt) || 0)) {
      await d.ref.update({ status: "recovered", recoveredAt: now, closedAt: now });
      recovered++;
    }
  }

  return { found: found.size, created, updated, recovered };
}

const runReminderPass = async (): Promise<{ sent: number; claimed: number; skipped: string }> => {
  // Finding carts is not the same as writing to people about them: it runs
  // whether or not reminders are switched on, so the admin page is true
  // either way.
  try {
    const d = await detectAbandonedCarts();
    console.log("abandoned carts detected", d);
  } catch (e: any) {
    console.error("abandoned cart detection failed", e?.message || e);
  }

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
    if (await sendReminderEmail(cart, coupon, s)) sent++;
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

/** The dashboard's "Scan": finds carts now instead of at the next half hour. */
export const scanAbandonedCarts = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  const d = await detectAbandonedCarts();
  return { ...d, tracked: d.created + d.updated };
});

/**
 * One reminder to one cart, now, from the dashboard.
 *
 * It goes through the same claim as the cron — the per-cart cap still holds,
 * so a button pressed twice cannot mail anyone a third time — but ignores
 * the delay, because asking for it by hand is the point. If the mail does not
 * go out the claim is given back, so the admin can try again once whatever
 * stopped it is fixed; the cron never gives a claim back, which is what keeps
 * it from resending in a loop.
 */
export const sendAbandonedCartReminderNow = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const cartId = String(data?.cartId || "");
  if (!cartId) throw new HttpsError("invalid-argument", "cartId is required");

  const db = admin.firestore();
  const ref = db.collection("abandonedCarts").doc(cartId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Cart not found");
  const before = snap.data() as any;
  if (!before.userEmail) return { success: false, emailSent: false, whatsappSent: false, reason: "This cart has no email address." };

  const count = Number(before.reminderCount || 0);
  const cart = await claimReminderSlot(cartId, count);
  if (!cart) {
    return {
      success: false, emailSent: false, whatsappSent: false,
      reason: count >= MAX_REMINDERS_PER_CART
        ? `Already reminded ${count} times, which is the limit.`
        : "This cart is closed (recovered or expired).",
    };
  }

  const s = await readSettings();
  const giveBack = () => ref.update({
    reminderCount: count,
    reminderSentAt: before.reminderSentAt ?? null,
    status: before.status || "abandoned",
  });
  try {
    await enforceDailyRateLimit({ key: "abandonedCartEmails", limit: s.dailyEmailCap });
  } catch {
    await giveBack();
    return { success: false, emailSent: false, whatsappSent: false, reason: "Today's email limit is reached." };
  }

  const coupon = await createRecoveryCoupon(cart, s);
  const emailSent = await sendReminderEmail(cart, coupon, s);
  if (!emailSent) {
    await giveBack();
    return { success: false, emailSent: false, whatsappSent: false, reason: "The email service refused it; see the function log." };
  }
  return { success: true, emailSent: true, whatsappSent: false, coupon };
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
