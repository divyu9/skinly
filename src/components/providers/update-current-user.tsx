import { useEffect } from "react";
import type { ReactNode } from "react";
import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { useAuth } from "@/hooks/use-auth";
import { storedReferralCode } from "@/components/referral-tracker.tsx";

export function UpdateCurrentUserProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  const updateUser = useMutation(api.users.updateCurrentUser);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    /*
     * The code of whoever referred this visitor (?ref=, kept by
     * ReferralTracker). It is recorded as who referred them — it used to be
     * written over their own referralCode, so a friend who signed up through
     * a link went on to share the referrer's code instead of theirs, and it
     * was rewritten at every sign-in.
     */
    // Kept in the browser too, for checkout; the server falls back to this.
    const storedRefCode = storedReferralCode();
    if (storedRefCode) {
      void Promise.resolve(updateUser({ referredByCode: storedRefCode })).catch(() => { /* next sign-in */ });
    }
  }, [isLoaded, isSignedIn, updateUser]);

  return <>{children}</>;
}
