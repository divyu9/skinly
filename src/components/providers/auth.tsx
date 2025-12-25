import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={() => ({
      isLoading: false,
      isAuthenticated: false,
    })}>
      {children}
    </ConvexProviderWithAuth>
  );
}
