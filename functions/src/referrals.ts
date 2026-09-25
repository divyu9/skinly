import * as functionsV1 from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { getCaller, requireAdmin, requireAuth } from "./auth";
import { enforceDailyRateLimit } from "./rate-limit";
import { isConfirmed } from "./orderConfirm";
import { walletUserRef } from "./userDoc";

/**
 * Refer a friend: the friend gets money off their first order, and whoever
 * sent them gets wallet credit once that order is delivered.
 *
 * The account page promised "Refer & Earn ₹100" and nothing anywhere paid
 * it: since the move to Firebase no code looked at a referral at all, and
 * the only thing the link did was overwrite the friend's own referral code
 * with the referrer's. The amounts are the admin's (settings/referral);
 * everything is decided here, where a browser can't argue with it.
 *
 * - Codes: users/{id}.referralCode, owned through referralCodes/{CODE},
 *   which only this file writes — the user document is the customer's to
 *   edit, so it cannot be what proves a code is theirs.
 * - Who referred an order, and what they are owed, is kept in
 *   orderReferrals/{orderId}, readable by admins only. Orders can be read by
 *   anyone holding the link, so the order itself carries only the friend's
 *   discount.
 * - The friend's discount doesn't stack with a coupon; the referral still
 *   counts, so the referrer is still paid for bringing them.
 * - The reward is paid on delivery, so a cancelled or returned order pays
 *   nothing. It is a fixed sum, or a share of what the friend spent on
 *   items (after discounts, without shipping) — settled when the order is
 *   placed, as the friend's discount is.
 *
 * Abuse. Refused outright (no discount, no reward): the referrer's own
 * account, email or phone; a browser the referrer has used their own link
 * page in; an email, phone or delivery address that has had a confirmed
 * order before — the last is what stops one person ordering again on a
 * second number to the same house. Held for the admin to approve (the friend
 * keeps the discount; the reward waits): a delivery pincode the referrer has
 * had orders delivered to, and a referrer past the monthly cap.
 */

export type ReferralSettings = {
  enabled: boolean;
  friendType: "flat" | "percent";
  friendValue: number;
  friendMaxDiscount: number;
  friendMinOrder: number;
  referrerType: "flat" | "percent";
  /** Rupees, or a percentage of the friend's items when referrerType is percent. */
  referrerReward: number;
  /** The most a percentage reward pays; 0 for no cap. */
  referrerMaxReward: number;
  /** Rewards a referrer earns in 30 days before the rest wait for review; 0 for no cap. */
  monthlyCap: number;
};

export async function referralSettings(db: admin.firestore.Firestore): Promise<ReferralSettings> {
  const s = await db.collection("settings").doc("referral").get();
  const d = (s.data() || {}) as any;
  return {
    enabled: d.enabled === true,
    friendType: d.friendType === "percent" ? "percent" : "flat",
    friendValue: Math.max(0, Number(d.friendValue) || 0),
    friendMaxDiscount: Math.max(0, Number(d.friendMaxDiscount) || 0),
    friendMinOrder: Math.max(0, Number(d.friendMinOrder) || 0),
    referrerType: d.referrerType === "percent" ? "percent" : "flat",
    referrerReward: Math.max(0, Number(d.referrerReward) || 0),
    referrerMaxReward: Math.max(0, Number(d.referrerMaxReward) || 0),
    monthlyCap: d.monthlyCap === undefined ? 10 : Math.max(0, Number(d.monthlyCap) || 0),
  };
}

export const normCode = (c: unknown) => String(c || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
const digits10 = (p: unknown) => String(p || "").replace(/\D/g, "").slice(-10);
const pinOf = (a: any) => String(a?.pincode || "").replace(/\D/g, "").slice(0, 6);
/** A delivery address as a comparable key: pincode and the start of the first line, letters and digits only. */
const addressKey = (a: any) => {
  const pin = pinOf(a);
  const line = String(a?.addressLine1 || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
  return pin && line.length >= 6 ? `${pin}|${line}` : "";
};

/** The friend's discount on a cart of this size, or 0. */
export function friendDiscount(s: ReferralSettings, itemsTotal: number): number {
  if (!s.enabled || !(s.friendValue > 0) || itemsTotal < s.friendMinOrder) return 0;
  let d = s.friendType === "percent" ? Math.floor(itemsTotal * s.friendValue / 100) : s.friendValue;
  if (s.friendType === "percent" && s.friendMaxDiscount > 0) d = Math.min(d, s.friendMaxDiscount);
  return Math.max(0, Math.min(d, itemsTotal));
}

/** What the referrer earns on a friend's order whose items came to `spent` (after discounts). */
export function referrerRewardFor(s: ReferralSettings, spent: number): number {
  if (!(s.referrerReward > 0)) return 0;
  if (s.referrerType !== "percent") return s.referrerReward;
  let r = Math.floor(Math.max(0, spent) * s.referrerReward / 100);
  if (s.referrerMaxReward > 0) r = Math.min(r, s.referrerMaxReward);
  return r;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = () => Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

/**
 * This user's code, made and registered if need be. A code shown before but
 * never stored (the page used to show REF + the start of the sign-in id) is
 * the first choice, so links already shared keep working.
 */
export async function ensureCode(db: admin.firestore.Firestore, userRef: admin.firestore.DocumentReference, uid: string): Promise<string> {
  const data = ((await userRef.get()).data() || {}) as any;
  const candidates = [normCode(data.referralCode), `REF${uid.slice(0, 5).toUpperCase()}`, randomCode(), randomCode(), randomCode()].filter(Boolean);
  for (const code of candidates) {
    const mapRef = db.collection("referralCodes").doc(code);
    const claimed = await db.runTransaction(async (tx) => {
      const m = await tx.get(mapRef);
      if (m.exists && (m.data() as any).userDocId !== userRef.id) return false;
      if (!m.exists) tx.set(mapRef, { userDocId: userRef.id, authUid: uid, createdAt: Date.now() });
      tx.set(userRef, { referralCode: code }, { merge: true });
      return true;
    });
    if (claimed) return code;
  }
  throw new HttpsError("internal", "Could not make a referral code");
}

/** Confirmed, not cancelled or returned. */
const liveOrder = (o: any) => !!o && isConfirmed(o) && !["cancelled", "rto"].includes(String(o.status));

/** The referrer's own orders, by sign-in and by email. */
async function referrerOrders(db: admin.firestore.Firestore, authUid: string, email: string) {
  const docs: admin.firestore.QueryDocumentSnapshot[] = [];
  if (authUid) docs.push(...(await db.collection("orders").where("ownerUid", "==", authUid).limit(50).get()).docs);
  if (email) docs.push(...(await db.collection("orders").where("email", "==", email).limit(50).get()).docs);
  return docs.map((d) => d.data() as any).filter(liveOrder);
}

type Evaluation =
  | {
      ok: true; code: string; referrerUserDocId: string; referrerAuthUid: string; referrerName: string; referrerEmail: string;
      referrerPhone: string; discount: number; reward: number; settings: ReferralSettings; hold: string | null; reason?: string;
    }
  | { ok: false; reason: string };

/**
 * Whether this checkout is a referred first order, and what it gets. Never
 * throws for a bad code: a referral must not be able to stop an order.
 */
export async function evaluateReferral(db: admin.firestore.Firestore, args: {
  code: string; email?: string; phone?: string; uid?: string | null; itemsTotal: number; couponApplied: boolean;
  address?: any; ownCode?: string;
}): Promise<Evaluation> {
  const s = await referralSettings(db);
  if (!s.enabled) return { ok: false, reason: "Referrals are switched off" };
  const code = normCode(args.code);
  if (!code) return { ok: false, reason: "No referral code" };
  const map = await db.collection("referralCodes").doc(code).get();
  if (!map.exists) return { ok: false, reason: "That referral link isn't valid" };
  const { userDocId, authUid } = map.data() as any;

  const ref = ((await db.collection("users").doc(userDocId).get()).data() || {}) as any;
  const refEmail = String(ref.email || "").toLowerCase();
  const email = String(args.email || "").trim().toLowerCase();
  const phone = digits10(args.phone);
  const own = "Your own referral link can't be used on your own order";
  if ((args.uid && args.uid === authUid) || (email && refEmail === email)
      || (phone && digits10(ref.phone || ref.phoneNumber) === phone)) return { ok: false, reason: own };
  // A browser the referrer has opened their own referral page in.
  if (args.ownCode && normCode(args.ownCode) === code) return { ok: false, reason: own };

  // A first order: nothing confirmed before under this email, phone or address.
  const firstOnly = "Referral discounts are for a first order";
  if (email && (await db.collection("orders").where("email", "==", email).limit(20).get()).docs.some((d) => liveOrder(d.data()))) {
    return { ok: false, reason: firstOnly };
  }
  if (phone) {
    const forms = [phone, `+91${phone}`, `91${phone}`, `+91 ${phone}`];
    if ((await db.collection("orders").where("phone", "in", forms).limit(20).get()).docs.some((d) => liveOrder(d.data()))) {
      return { ok: false, reason: firstOnly };
    }
  }
  const key = addressKey(args.address);
  const pin = pinOf(args.address);
  if (key) {
    const samePin = await db.collection("orders").where("shippingAddress.pincode", "==", pin).limit(300).get();
    if (samePin.docs.some((d) => liveOrder(d.data()) && addressKey((d.data() as any).shippingAddress) === key)) {
      return { ok: false, reason: "Referral discounts are for a first order to an address" };
    }
  }

  // Signs worth a person's look: the reward waits for the admin.
  let hold: string | null = null;
  const theirs = await referrerOrders(db, authUid || "", refEmail);
  if (pin && theirs.some((o) => pinOf(o.shippingAddress) === pin)) {
    hold = "Delivers to a pincode the referrer has ordered to";
  }
  if (!hold && s.monthlyCap > 0) {
    const since = Date.now() - 30 * 24 * 3600_000;
    const recent = await db.collection("orderReferrals").where("referrerUserDocId", "==", userDocId).limit(500).get();
    const counted = recent.docs.filter((d) => Number((d.data() as any).createdAt) > since
      && !["cancelled", "rejected"].includes(String((d.data() as any).status)));
    const orders = counted.length ? await db.getAll(...counted.map((d) => db.collection("orders").doc(d.id))) : [];
    if (orders.filter((o) => liveOrder(o.data())).length >= s.monthlyCap) {
      hold = `More than ${s.monthlyCap} referrals in 30 days`;
    }
  }

  const discount = args.couponApplied ? 0 : friendDiscount(s, args.itemsTotal);
  return {
    // The reward on this cart as it stands; placeOrder settles it after any coupon.
    ok: true, code, referrerUserDocId: userDocId, referrerAuthUid: authUid || "",
    referrerName: String(ref.name || ref.fullName || ""), referrerEmail: refEmail, referrerPhone: digits10(ref.phone || ref.phoneNumber),
    discount, reward: referrerRewardFor(s, args.itemsTotal - discount), settings: s, hold,
    ...(args.couponApplied ? { reason: "The referral discount doesn't combine with a coupon" }
      : s.friendMinOrder > 0 && args.itemsTotal < s.friendMinOrder ? { reason: `The referral discount needs a cart of ₹${s.friendMinOrder}` } : {}),
  };
}

/** Checkout asks what a referral is worth before the order is placed. Says nothing about who referred. */
export const checkReferral = functionsV1.https.onCall(async (data: any, context: any) => {
  const { uid } = getCaller(context);
  const ip = String(context?.rawRequest?.ip || "unknown");
  await enforceDailyRateLimit({ key: `refcheck:${uid || ip}`, limit: 300 });
  const db = admin.firestore();
  let code = normCode(data?.code);
  // A signed-in friend who arrived by link earlier keeps it on their account.
  if (!code && uid) {
    const u = await walletUserRef(db, uid, context?.auth?.token?.email);
    code = normCode(u ? ((await u.get()).data() as any)?.referredByCode : "");
  }
  if (!code) return { ok: false };
  const r = await evaluateReferral(db, {
    code, email: data?.email, phone: data?.phone, uid, itemsTotal: Number(data?.itemsTotal) || 0, couponApplied: !!data?.couponApplied,
    address: data?.address, ownCode: data?.ownCode,
  });
  return r.ok ? { ok: true, code: r.code, discount: r.discount, reason: r.reason || null } : { ok: false, code, reason: r.reason };
});

/** placeOrder writes this alongside a referred order. */
export async function recordReferral(db: admin.firestore.Firestore, orderId: string, r: Extract<Evaluation, { ok: true }>, order: {
  friendDiscount: number; reward: number; customerName: string; email: string; phone: string; shippingAddress: any;
}) {
  await db.collection("orderReferrals").doc(orderId).set({
    orderId, code: r.code,
    referrerUserDocId: r.referrerUserDocId, referrerAuthUid: r.referrerAuthUid,
    referrerName: r.referrerName, referrerEmail: r.referrerEmail, referrerPhone: r.referrerPhone,
    friendName: order.customerName, friendEmail: order.email, friendPhone: order.phone,
    friendPincode: pinOf(order.shippingAddress),
    friendDiscount: order.friendDiscount, reward: order.reward,
    status: r.hold ? "held" : "pending", ...(r.hold ? { holdReason: r.hold } : {}),
    createdAt: Date.now(),
  });
}

/* --------------------------------------------------------- telling the referrer */

/**
 * An email and a WhatsApp to the referrer, each only if its usecase has a
 * template and is switched on (Admin › Email / WhatsApp templates):
 *   referral_friend_ordered — {{referrerName}}, {{friendName}}, {{amount}}, {{link}}
 *   referral_reward_paid     — the same, once the money is in the wallet.
 * Until then the referrer sees it all on /account/referrals.
 */
async function tellReferrer(db: admin.firestore.Firestore, ref: any, usecaseKey: string, orderId: string) {
  const site = (process.env.SITE_URL || "https://goskinly.com").replace(/\/+$/, "");
  const vars = {
    referrerName: String(ref.referrerName || "there").split(" ")[0],
    friendName: String(ref.friendName || "Your friend").split(" ")[0],
    amount: `₹${Number(ref.reward) || 0}`,
    link: `${site}/account/referrals`,
  };
  try {
    const authkey = process.env.MSG91_AUTH_TOKEN || "";
    const tpl = await db.collection("emailUsecaseTemplates").where("usecaseKey", "==", usecaseKey).limit(1).get();
    const t = tpl.empty ? null : tpl.docs[0].data();
    if (authkey && t?.enabled === true && t.msg91TemplateId && ref.referrerEmail) {
      const res = await fetch("https://control.msg91.com/api/v5/email/send", {
        method: "POST",
        headers: { authkey, "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: t.msg91TemplateId,
          recipients: [{ to: [{ email: ref.referrerEmail, name: vars.referrerName }], variables: vars }],
          from: { email: "noreply@mail.goskinly.com", name: "GoSkinly" },
          domain: "mail.goskinly.com",
        }),
      });
      await db.collection("emailMessages").add({
        createdAt: Date.now(), recipientEmail: ref.referrerEmail, usecaseKey, relatedOrderId: orderId,
        msg91TemplateId: t.msg91TemplateId, status: res.ok ? "sent" : "failed",
        ...(res.ok ? {} : { errorMessage: (await res.text()).slice(0, 500) }),
      });
    }
  } catch (e: any) {
    console.error("tellReferrer: email failed", { orderId, usecaseKey, error: e?.message || e });
  }
  try {
    if (ref.referrerPhone) {
      const { queueWhatsApp } = await import("./orderNotifications");
      await queueWhatsApp(db, usecaseKey, ref.referrerPhone, vars, orderId);
    }
  } catch (e: any) {
    console.error("tellReferrer: WhatsApp failed", { orderId, usecaseKey, error: e?.message || e });
  }
}

/** Called when an order is confirmed: tells the referrer their friend ordered. Once. */
export async function noteReferredOrderConfirmed(db: admin.firestore.Firestore, orderId: string) {
  const refDoc = db.collection("orderReferrals").doc(orderId);
  const first = await db.runTransaction(async (tx) => {
    const s = await tx.get(refDoc);
    if (!s.exists || (s.data() as any).confirmedAt) return null;
    tx.update(refDoc, { confirmedAt: Date.now() });
    return s.data();
  });
  if (first) await tellReferrer(db, first, "referral_friend_ordered", orderId);
}

/** Pays the referrer, once, if the referral is cleared. */
async function payReferral(db: admin.firestore.Firestore, orderId: string): Promise<boolean> {
  const refDoc = db.collection("orderReferrals").doc(orderId);
  const orderRef = db.collection("orders").doc(orderId);
  const pre = (await refDoc.get()).data() as any;
  if (!pre || pre.status !== "pending" || !pre.referrerUserDocId) return false;
  const amount = Math.round((Number(pre.reward) || 0) * 100) / 100;
  if (!(amount > 0)) {
    await refDoc.update({ status: "rewarded", paidAt: Date.now(), note: "No reward was set" });
    return false;
  }
  const userRef = db.collection("users").doc(String(pre.referrerUserDocId));
  const txRef = db.collection("walletTransactions").doc();
  const paid = await db.runTransaction(async (tx) => {
    const [r, u, o] = await tx.getAll(refDoc, userRef, orderRef);
    const fresh = r.data() as any;
    if (!fresh || fresh.status !== "pending") return false;
    if (!u.exists) { tx.update(refDoc, { status: "no_account" }); return false; }
    const ud = u.data() as any;
    const before = Number(ud.walletBalance) || 0;
    const after = Math.round((before + amount) * 100) / 100;
    tx.update(userRef, {
      walletBalance: after,
      referralCount: (Number(ud.referralCount) || 0) + 1,
      referralEarnings: (Number(ud.referralEarnings) || 0) + amount,
    });
    tx.set(txRef, {
      userId: userRef.id,
      ...(fresh.referrerAuthUid ? { ownerUid: fresh.referrerAuthUid } : {}),
      transactionType: "credit", type: "referral_reward", source: "referral_reward",
      amount, balanceBefore: before, balanceAfter: after,
      description: `Referral reward — ${String(fresh.friendName || "a friend").split(" ")[0]}'s order ${(o.data() as any)?.orderNumber || ""} was delivered`.trim(),
      relatedOrderId: orderId, createdAt: Date.now(),
    });
    tx.update(refDoc, { status: "rewarded", paidAt: Date.now() });
    return true;
  });
  if (paid) await tellReferrer(db, pre, "referral_reward_paid", orderId);
  return paid;
}

/** On delivery. A held referral waits for the admin; it is paid on approval. */
export async function creditReferralOnDelivery(db: admin.firestore.Firestore, orderRef: admin.firestore.DocumentReference) {
  const r = await db.collection("orderReferrals").doc(orderRef.id).get();
  if (!r.exists) return;
  await r.ref.update({ deliveredAt: Date.now() });
  await payReferral(db, orderRef.id);   // only a "pending" one is paid; "held" waits
}

/** A cancelled or returned order earns its referrer nothing. */
export async function cancelReferral(db: admin.firestore.Firestore, orderId: string) {
  const ref = db.collection("orderReferrals").doc(orderId);
  const s = await ref.get();
  if (s.exists && ["pending", "held"].includes(String((s.data() as any).status))) {
    await ref.update({ status: "cancelled", cancelledAt: Date.now() });
  }
}

/** Admin › Referrals: approve or refuse a held reward. An approved one already delivered is paid now. */
export const reviewReferral = functionsV1.https.onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const db = admin.firestore();
  const orderId = String(data?.orderId || "");
  const ref = db.collection("orderReferrals").doc(orderId);
  const s = await ref.get();
  if (!s.exists) throw new HttpsError("not-found", "No referral on that order");
  const r = s.data() as any;
  if (r.status !== "held") throw new HttpsError("failed-precondition", `This referral is ${r.status}, not waiting for review`);
  if (data?.approve !== true) {
    await ref.update({ status: "rejected", reviewedBy: uid, reviewedAt: Date.now() });
    return { status: "rejected" };
  }
  await ref.update({ status: "pending", reviewedBy: uid, reviewedAt: Date.now() });
  const order = (await db.collection("orders").doc(orderId).get()).data() as any;
  if (String(order?.status) === "delivered" || r.deliveredAt) {
    await payReferral(db, orderId);
    return { status: "rewarded" };
  }
  return { status: "pending" };
});

/* --------------------------------------------------------- the account page */

/** The account's referral page: its code, the programme, and who it brought. */
export const myReferrals = functionsV1.https.onCall(async (_data: any, context: any) => {
  const { uid } = requireAuth(context);
  const db = admin.firestore();
  const s = await referralSettings(db);
  const email = String(context?.auth?.token?.email || "").toLowerCase();
  let u = await walletUserRef(db, uid, email);
  // A sign-in with no document yet gets one, so it can hold a code and a wallet.
  if (!u) {
    u = db.collection("users").doc(uid);
    await u.set({ ...(email ? { email } : {}), createdAt: Date.now() }, { merge: true });
  }
  const code = await ensureCode(db, u, uid);
  const refs = await db.collection("orderReferrals").where("referrerUserDocId", "==", u.id).limit(200).get();
  const orders = refs.size ? await db.getAll(...refs.docs.map((d) => db.collection("orders").doc(d.id))) : [];
  const byId = new Map(orders.map((o) => [o.id, o.data() as any]));
  const referrals = refs.docs
    .map((d) => ({ r: d.data() as any, o: byId.get(d.id) }))
    .filter(({ o }) => o && isConfirmed(o))
    .map(({ r, o }) => ({
      name: String(r.friendName || "A friend").split(" ")[0],
      date: Number(r.createdAt) || 0,
      reward: Number(r.reward) || 0,
      // Held reads as on its way: the review is ours, not theirs to worry about.
      status: r.status === "rewarded" ? "paid"
        : ["cancelled", "rejected", "no_account"].includes(r.status) || ["cancelled", "rto"].includes(o.status) ? "cancelled"
        : "pending",
    }))
    .sort((a, b) => b.date - a.date);
  return {
    enabled: s.enabled, settings: publicSettings(s), code,
    referrals,
    earned: referrals.filter((r) => r.status === "paid").reduce((t, r) => t + r.reward, 0),
    pending: referrals.filter((r) => r.status === "pending").reduce((t, r) => t + r.reward, 0),
  };
});

const publicSettings = (s: ReferralSettings) => ({
  friendType: s.friendType, friendValue: s.friendValue, friendMaxDiscount: s.friendMaxDiscount,
  friendMinOrder: s.friendMinOrder, referrerType: s.referrerType, referrerReward: s.referrerReward,
  referrerMaxReward: s.referrerMaxReward,
});

/** Admin › Referrals saves the programme here. */
export const saveReferralSettings = functionsV1.https.onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const s = {
    enabled: data?.enabled === true,
    friendType: data?.friendType === "percent" ? "percent" : "flat",
    friendValue: Math.max(0, Number(data?.friendValue) || 0),
    friendMaxDiscount: Math.max(0, Number(data?.friendMaxDiscount) || 0),
    friendMinOrder: Math.max(0, Number(data?.friendMinOrder) || 0),
    referrerType: data?.referrerType === "percent" ? "percent" : "flat",
    referrerReward: Math.max(0, Number(data?.referrerReward) || 0),
    referrerMaxReward: Math.max(0, Number(data?.referrerMaxReward) || 0),
    monthlyCap: Math.max(0, Math.floor(Number(data?.monthlyCap ?? 10) || 0)),
  };
  if (s.friendType === "percent" && s.friendValue > 90) throw new HttpsError("invalid-argument", "A percentage over 90 is surely a typo");
  if (s.referrerType === "percent" && s.referrerReward > 50) throw new HttpsError("invalid-argument", "A referrer share over 50% is surely a typo");
  await admin.firestore().collection("settings").doc("referral").set({ ...s, updatedAt: Date.now() }, { merge: true });
  return s;
});
