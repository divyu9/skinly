import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useAuth() {
  const user = useQuery(api.users.currentUser);
  
  return {
    user: user,
    isLoading: user === undefined,
    isAuthenticated: !!user,
  };
}
