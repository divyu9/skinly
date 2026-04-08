import { useEffect } from "react";
import type { ReactNode } from "react";
import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { useAuth } from "@/hooks/use-auth";

export function UpdateCurrentUserProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  const updateUser = useMutation(api.users.updateCurrentUser);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // Check for stored referral code
    const storedRefCode = localStorage.getItem("referralCode");

    // 🔥 IMPORTANT: Pass referral code if available
    if (storedRefCode) {
      updateUser({
        referralCode: storedRefCode,
      });
    }
  }, [isLoaded, isSignedIn, updateUser]);

  return <>{children}</>;
}
