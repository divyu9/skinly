import { useEffect } from "react";
import type { ReactNode } from "react";
import { useUser } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function UpdateCurrentUserProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn } = useUser();

  const updateUser = useMutation(api.users.updateCurrentUser);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // Check for stored referral code
    const storedRefCode = localStorage.getItem("referralCode");

    // 🔥 IMPORTANT: Pass referral code if available
    updateUser({
      referralCode: storedRefCode || undefined,
    });
  }, [isLoaded, isSignedIn, updateUser]);

  return <>{children}</>;
}
