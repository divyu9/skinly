import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";
import { useCallback } from "react";

export function useConvexAuth() {
  const clerkAuth = useClerkAuth();
  const { isLoaded, user } = useUser();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      return clerkAuth.getToken({ skipCache: forceRefreshToken }) ?? null;
    },
    [clerkAuth]
  );

  return {
    isLoading: !isLoaded,
    isAuthenticated: !!user,
    fetchAccessToken,
  };
}
