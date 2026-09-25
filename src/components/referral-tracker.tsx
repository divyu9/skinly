import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/** How long a friend's link counts after it was followed. */
const REFERRAL_TTL_MS = 30 * 24 * 3600_000;

/** The referral code this visitor arrived with, if it is still fresh. */
export function storedReferralCode(): string {
  try {
    const code = localStorage.getItem("referralCode") || "";
    const at = Number(localStorage.getItem("referralCodeAt")) || 0;
    if (!code) return "";
    if (at && Date.now() - at > REFERRAL_TTL_MS) {
      localStorage.removeItem("referralCode");
      localStorage.removeItem("referralCodeAt");
      return "";
    }
    return code;
  } catch {
    return "";
  }
}

export function clearStoredReferralCode() {
  try {
    localStorage.removeItem("referralCode");
    localStorage.removeItem("referralCodeAt");
  } catch { /* storage blocked */ }
}

/** Keeps ?ref= from a friend's link (functions/src/referrals.ts decides what it is worth). */
export function ReferralTracker() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const refCode = (searchParams.get("ref") || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
    if (refCode) {
      try {
        localStorage.setItem("referralCode", refCode);
        localStorage.setItem("referralCodeAt", String(Date.now()));
      } catch { /* storage blocked */ }
    }
  }, [searchParams]);

  return null;
}
