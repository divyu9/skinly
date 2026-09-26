import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";

/**
 * Reviews are moderated, and an approved one pays the customer back.
 *
 * A review arrives "pending" (submitOrderReview) and is public only once an
 * admin approves it in Admin › Reviews. Approving pays cashback into the
 * customer's wallet, at the rules in settings/reviewRewards:
 *
 *   text only         textPct   of the order value (default 5%)
 *   with a photo      photoPct  of the order value (default 10%)
 *   never more than   maxAmount per order          (default ₹50)
 *
 * Per order, not per review: reviewing three products of one order earns the
 * order's reward once, at the photo rate if any approved review of it has a
 * photo. It is paid as a top-up — a text review approved first and a photo
 * review later pays the difference — recorded in orderReviewRewards/{orderId}
 * so nothing is ever paid twice.
 */

export interface ReviewRewardRules { enabled: boolean; textPct: number; photoPct: number; maxAmount: number }

export async function reviewRewardRules(db: admin.firestore.Firestore): Promise<ReviewRewardRules> {
  const s = (await db.collection("settings").doc("reviewRewards").get()).data() as any || {};
  const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  return { enabled: s.enabled !== false, textPct: num(s.textPct, 5), photoPct: num(s.photoPct, 10), maxAmount: num(s.maxAmount, 50) };
}

/** What the order's goods cost the customer: the items, not shipping or COD fees. */
export function orderValue(order: any): number {
  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const lines = items.reduce((s, it) => s + (Number(it?.price) || 0) * (Number(it?.quantity) || 1), 0);
  const v = Number(order?.subtotal ?? order?.itemsTotal ?? lines) || lines;
  return Math.max(0, v - (Number(order?.couponDiscount) || Number(order?.discount) || 0));
}

export function rewardFor(rules: ReviewRewardRules, value: number, withPhoto: boolean): number {
  if (!rules.enabled) return 0;
  const pct = withPhoto ? rules.photoPct : rules.textPct;
  return Math.min(rules.maxAmount, Math.round((value * pct) / 100));
}

/** Pays whatever the order's approved reviews now earn beyond what was paid. */
async function payReviewReward(db: admin.firestore.Firestore, orderId: string, actor: string) {
  const orderRef = db.collection("orders").doc(orderId);
  const order = (await orderRef.get()).data() as any;
  if (!order) return { paid: 0, note: "order not found" };

  const approved = await db.collection("reviews").where("orderId", "==", orderId).where("status", "==", "approved").get();
  if (approved.empty) return { paid: 0, note: "no approved review" };
  const withPhoto = approved.docs.some((d) => ((d.data() as any).imageUrls || []).length > 0);
  const rules = await reviewRewardRules(db);
  const target = rewardFor(rules, orderValue(order), withPhoto);

  const rewardRef = db.collection("orderReviewRewards").doc(orderId);
  const already = Number(((await rewardRef.get()).data() as any)?.paid) || 0;
  const delta = Math.round((target - already) * 100) / 100;
  if (!(delta > 0)) return { paid: 0, total: already, note: target > 0 ? "already paid" : "reward is off or zero" };

  const { walletUserRef } = await import("./userDoc");
  const userRef = (order.walletUserDocId ? db.collection("users").doc(String(order.walletUserDocId)) : null)
    || await walletUserRef(db, order.ownerUid || (String(order.userId || "").startsWith("guest") ? "" : order.userId), order.email);

  if (!userRef) {
    // A guest with no account yet: owed, visible to the admin, paid by hand or on sign-up.
    await rewardRef.set({ orderId, owedNoAccount: target, withPhoto, updatedAt: Date.now() }, { merge: true });
    await orderRef.update({ reviewRewardOwed: target, updatedAt: Date.now() });
    return { paid: 0, owed: delta, note: "no account to pay into — recorded as owed" };
  }

  const txRef = db.collection("walletTransactions").doc();
  await db.runTransaction(async (tx) => {
    const [rs, us] = await tx.getAll(rewardRef, userRef);
    const paidNow = Number((rs.data() as any)?.paid) || 0;
    const d = Math.round((target - paidNow) * 100) / 100;
    if (!(d > 0) || !us.exists) return;
    const before = Number((us.data() as any)?.walletBalance) || 0;
    const after = Math.round((before + d) * 100) / 100;
    tx.update(userRef, { walletBalance: after });
    tx.set(txRef, {
      userId: order.ownerUid || order.userId || "",
      transactionType: "credit",
      amount: d,
      source: "review_reward",
      balanceBefore: before,
      balanceAfter: after,
      description: `Review reward for order ${order.orderNumber || ""}${withPhoto ? " (with photo)" : ""}`.trim(),
      relatedOrderId: orderId,
      createdAt: Date.now(),
    });
    tx.set(rewardRef, { orderId, paid: target, withPhoto, lastPaidAt: Date.now(), approvedBy: actor, owedNoAccount: admin.firestore.FieldValue.delete() }, { merge: true });
    tx.update(orderRef, { reviewRewardPaid: target, reviewRewardOwed: admin.firestore.FieldValue.delete(), updatedAt: Date.now() });
  });
  return { paid: delta, total: target };
}

/** Admin › Reviews: approve (and pay), reject, or send back to pending. */
export const moderateReview = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const reviewId = String(data?.reviewId || "");
  const action = String(data?.action || "");
  if (!reviewId || !["approve", "reject", "pending"].includes(action)) throw new HttpsError("invalid-argument", "Say which review and approve, reject or pending");
  const db = admin.firestore();
  const ref = db.collection("reviews").doc(reviewId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Review not found");
  const review = snap.data() as any;

  const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending";
  await ref.update({ status, moderatedAt: Date.now(), moderatedBy: uid, updatedAt: Date.now() });

  let reward: any = null;
  if (status === "approved" && review.orderId) reward = await payReviewReward(db, String(review.orderId), uid);
  console.log("moderateReview", { reviewId, status, reward });
  return { success: true, status, reward };
});
