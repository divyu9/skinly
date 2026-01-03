import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";
import { useCallback } from "react";

export function useAuth() {
  const clerkAuth = useClerkAuth();
  const { user, isLoaded } = useUser();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      return clerkAuth.getToken({ template: "convex", skipCache: forceRefreshToken }) ?? null;
    },
    [clerkAuth]
  );

  return {
    // 🔹 Convex-required shape
    isLoading: !isLoaded,
    isAuthenticated: !!user,
    fetchAccessToken,

    // 🔹 App usage
    user,
    isLoaded,
    isSignedIn: !!user,
    signOut: clerkAuth.signOut,
  };
}
