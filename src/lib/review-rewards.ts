import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * The review-reward rules, as the shopper is told them. The server pays by
 * the same rules (functions/src/reviewRewards.ts, kept in step): per order,
 * textPct of the order's goods for a review, photoPct when a review has a
 * photo, never more than maxAmount. Admin › Reviews edits settings/reviewRewards.
 */
export type ReviewRewardRules = { enabled: boolean; textPct: number; photoPct: number; maxAmount: number };
export const DEFAULT_REVIEW_REWARDS: ReviewRewardRules = { enabled: true, textPct: 5, photoPct: 10, maxAmount: 50 };

export function normaliseRules(s: any): ReviewRewardRules {
  const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  return {
    enabled: s?.enabled !== false,
    textPct: num(s?.textPct, DEFAULT_REVIEW_REWARDS.textPct),
    photoPct: num(s?.photoPct, DEFAULT_REVIEW_REWARDS.photoPct),
    maxAmount: num(s?.maxAmount, DEFAULT_REVIEW_REWARDS.maxAmount),
  };
}

export function useReviewRewardRules(): ReviewRewardRules | null {
  const [rules, setRules] = useState<ReviewRewardRules | null>(null);
  useEffect(() => {
    let live = true;
    getDoc(doc(db, "settings", "reviewRewards"))
      .then((s) => { if (live) setRules(normaliseRules(s.data())); })
      .catch(() => { if (live) setRules(DEFAULT_REVIEW_REWARDS); });
    return () => { live = false; };
  }, []);
  return rules;
}

/** The order's goods, as the server values them for the reward. */
export function orderGoodsValue(order: any): number {
  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const lines = items.reduce((s, it) => s + (Number(it?.price) || 0) * (Number(it?.quantity) || 1), 0);
  const v = Number(order?.subtotal ?? order?.itemsTotal ?? lines) || lines;
  return Math.max(0, v - (Number(order?.couponDiscount) || Number(order?.discount) || 0));
}

export const rewardAmount = (rules: ReviewRewardRules, value: number, withPhoto: boolean) =>
  rules.enabled ? Math.min(rules.maxAmount, Math.round((value * (withPhoto ? rules.photoPct : rules.textPct)) / 100)) : 0;
