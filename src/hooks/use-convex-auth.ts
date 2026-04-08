import { useAuth } from "./use-auth";

export function useConvexAuth() {
  const { isLoaded, user, fetchAccessToken } = useAuth();

  return {
    isLoading: !isLoaded,
    isAuthenticated: !!user,
    fetchAccessToken,
  };
}
