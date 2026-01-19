import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export function ReferralTracker() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      localStorage.setItem("referralCode", refCode);
      // Optional: Add expiry or validation here if needed
    }
  }, [searchParams]);

  return null;
}
