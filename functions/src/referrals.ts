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
 * - A friend is someone with no confirmed order before, by email or phone,
 *   who isn't the referrer.
 * - The friend's discount doesn't stack with a coupon; the referral still
 *   counts, so the referrer is still paid for bringing them.
 * - The reward is paid on delivery, so a cancelled or returned order pays
 *   nothing. It is a fixed sum, or a share of what the friend spent on
 *   items (after discounts, without shipping) so a bigger cart earns more —
 *   settled when the order is placed, as the friend's discount is.
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
  };
}

/** What the referrer earns on a friend's order whose items came to `spent` (after discounts). */
export function referrerRewardFor(s: ReferralSettings, spent: number): number {
  if (!(s.referrerReward > 0)) return 0;
  if (s.referrerType !== "percent") return s.referrerReward;
  let r = Math.floor(Math.max(0, spent) * s.referrerReward / 100);
  if (s.referrerMaxReward > 0) r = Math.min(r, s.referrerMaxReward);
  return r;
}

export const normCode = (c: unknown) => String(c || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
const digits10 = (p: unknown) => String(p || "").replace(/\D/g, "").slice(-10);

/** The friend's discount on a cart of this size, or 0. */
export function friendDiscount(s: ReferralSettings, itemsTotal: number): number {
  if (!s.enabled || !(s.friendValue > 0) || itemsTotal < s.friendMinOrder) return 0;
  let d = s.friendType === "percent" ? Math.floor(itemsTotal * s.friendValue / 100) : s.friendValue;
  if (s.friendType === "percent" && s.friendMaxDiscount > 0) d = Math.min(d, s.friendMaxDiscount);
  return Math.max(0, Math.min(d, itemsTotal));
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

type Evaluation =
  | { ok: true; code: string; referrerUserDocId: string; referrerAuthUid: string; discount: number; reward: number; settings: ReferralSettings; reason?: string }
  | { ok: false; reason: string };

/**
 * Whether this checkout is a referred first order, and what it gets. Never
 * throws for a bad code: a referral must not be able to stop an order.
 */
export async function evaluateReferral(db: admin.firestore.Firestore, args: {
  code: string; email?: string; phone?: string; uid?: string | null; itemsTotal: number; couponApplied: boolean;
}): Promise<Evaluation> {
  const s = await referralSettings(db);
  if (!s.enabled) return { ok: false, reason: "Referrals are switched off" };
  const code = normCode(args.code);
  if (!code) return { ok: false, reason: "No referral code" };
  const map = await db.collection("referralCodes").doc(code).get();
  if (!map.exists) return { ok: false, reason: "That referral link isn't valid" };
  const { userDocId, authUid } = map.data() as any;

  // Not the referrer themselves.
  const ref = ((await db.collection("users").doc(userDocId).get()).data() || {}) as any;
  const email = String(args.email || "").trim().toLowerCase();
  const phone = digits10(args.phone);
  if ((args.uid && args.uid === authUid) || (email && String(ref.email || "").toLowerCase() === email)
      || (phone && digits10(ref.phone || ref.phoneNumber) === phone)) {
    return { ok: false, reason: "Your own referral link can't be used on your own order" };
  }

  // A first order: nothing confirmed before under this email or phone.
  const prior: admin.firestore.QueryDocumentSnapshot[] = [];
  if (email) prior.push(...(await db.collection("orders").where("email", "==", email).limit(20).get()).docs);
  if (phone) {
    const forms = [phone, `+91${phone}`, `91${phone}`, `+91 ${phone}`];
    prior.push(...(await db.collection("orders").where("phone", "in", forms).limit(20).get()).docs);
  }
  if (prior.some((d) => isConfirmed(d.data()) && !["cancelled", "rto"].includes(String((d.data() as any).status)))) {
    return { ok: false, reason: "Referral discounts are for a first order" };
  }

  const discount = args.couponApplied ? 0 : friendDiscount(s, args.itemsTotal);
  return {
    // The reward on this cart as it stands; placeOrder settles it after any coupon.
    ok: true, code, referrerUserDocId: userDocId, referrerAuthUid: authUid || "", discount,
    reward: referrerRewardFor(s, args.itemsTotal - discount), settings: s,
    ...(args.couponApplied ? { reason: "The referral discount doesn't combine with a coupon" }
      : s.friendMinOrder > 0 && args.itemsTotal < s.friendMinOrder ? { reason: `The referral discount needs a cart of ₹${s.friendMinOrder}` } : {}),
  };
}

/** Checkout asks what a referral is worth before the order is placed. */
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
  });
  return r.ok ? { ok: true, code: r.code, discount: r.discount, reason: r.reason || null } : { ok: false, code, reason: r.reason };
});

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
  const orders = await db.collection("orders").where("referralCode", "==", code).limit(200).get();
  const referrals = orders.docs
    .map((d) => d.data() as any)
    .filter((o) => isConfirmed(o))
    .map((o) => ({
      name: String(o.customerName || "A friend").split(" ")[0],
      date: Number(o.createdAt) || 0,
      reward: Number(o.referral?.reward) || 0,
      status: o.referral?.status === "rewarded" ? "paid" : ["cancelled", "rto"].includes(o.status) ? "cancelled" : "pending",
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

/** Pays the referrer when the friend's order is delivered. Once only. */
export async function creditReferralOnDelivery(db: admin.firestore.Firestore, orderRef: admin.firestore.DocumentReference, order: any) {
  const r = order?.referral;
  if (!r || r.status !== "pending" || !(Number(r.reward) > 0) || !r.referrerUserDocId) return;
  const userRef = db.collection("users").doc(String(r.referrerUserDocId));
  const txRef = db.collection("walletTransactions").doc();
  const amount = Math.round(Number(r.reward) * 100) / 100;
  await db.runTransaction(async (tx) => {
    const [o, u] = await tx.getAll(orderRef, userRef);
    const fresh = (o.data() as any)?.referral;
    if (!fresh || fresh.status !== "pending") return;
    if (!u.exists) {
      tx.update(orderRef, { "referral.status": "no_account", updatedAt: Date.now() });
      return;
    }
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
      ...(r.referrerAuthUid ? { ownerUid: r.referrerAuthUid } : {}),
      transactionType: "credit",
      type: "referral_reward",
      source: "referral_reward",
      amount, balanceBefore: before, balanceAfter: after,
      description: `Referral reward — ${String(order.customerName || "a friend").split(" ")[0]}'s order ${order.orderNumber || ""} was delivered`.trim(),
      relatedOrderId: orderRef.id,
      createdAt: Date.now(),
    });
    tx.update(orderRef, { "referral.status": "rewarded", "referral.paidAt": Date.now() });
  });
  console.log("creditReferralOnDelivery", { order: order?.orderNumber, amount, referrer: r.referrerUserDocId });
}

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
  };
  if (s.friendType === "percent" && s.friendValue > 90) throw new HttpsError("invalid-argument", "A percentage over 90 is surely a typo");
  if (s.referrerType === "percent" && s.referrerReward > 50) throw new HttpsError("invalid-argument", "A referrer share over 50% is surely a typo");
  await admin.firestore().collection("settings").doc("referral").set({ ...s, updatedAt: Date.now() }, { merge: true });
  return s;
});
