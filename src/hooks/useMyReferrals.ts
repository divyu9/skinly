import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { rememberOwnReferralCode } from "@/components/referral-tracker.tsx";

/** The programme as the admin set it (functions/src/referrals.ts). */
export type ReferralProgramme = {
  friendType: "flat" | "percent";
  friendValue: number;
  friendMaxDiscount: number;
  friendMinOrder: number;
  referrerType: "flat" | "percent";
  referrerReward: number;
  referrerMaxReward: number;
};

export type MyReferrals = {
  enabled: boolean;
  settings: ReferralProgramme;
  code: string | null;
  referrals: Array<{ name: string; date: number; reward: number; status: "paid" | "pending" | "cancelled" }>;
  earned: number;
  pending: number;
};

/** What the friend gets, in words: "₹50 off" or "10% off (up to ₹100)", plus any minimum. */
export function friendOffer(s: ReferralProgramme): string {
  if (!(s.friendValue > 0)) return "";
  const off = s.friendType === "percent"
    ? `${s.friendValue}% off${s.friendMaxDiscount > 0 ? ` (up to ₹${s.friendMaxDiscount})` : ""}`
    : `₹${s.friendValue} off`;
  return `${off} their first order${s.friendMinOrder > 0 ? ` over ₹${s.friendMinOrder}` : ""}`;
}

/** What the referrer earns, in words: "₹100" or "10% of their order (up to ₹200)". */
export function referrerOffer(s: ReferralProgramme): string {
  if (!(s.referrerReward > 0)) return "";
  return s.referrerType === "percent"
    ? `${s.referrerReward}% of their order${s.referrerMaxReward > 0 ? ` (up to ₹${s.referrerMaxReward})` : ""}`
    : `₹${s.referrerReward}`;
}

/** The headline for the referrer: "₹100" or "10%". */
export function referrerHeadline(s: ReferralProgramme): string {
  if (!(s.referrerReward > 0)) return "";
  return s.referrerType === "percent" ? `${s.referrerReward}%` : `₹${s.referrerReward}`;
}

/** The signed-in customer's referral code, programme and referrals; undefined while loading. */
export function useMyReferrals(): MyReferrals | null | undefined {
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<MyReferrals | null | undefined>(undefined);
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setData(null); return; }
    let live = true;
    httpsCallable(functions, "myReferrals")({})
      .then((r) => {
        const d = r.data as MyReferrals;
        if (d?.code) rememberOwnReferralCode(d.code);
        if (live) setData(d);
      })
      .catch(() => { if (live) setData(null); });
    return () => { live = false; };
  }, [isLoaded, isSignedIn]);
  return data;
}
