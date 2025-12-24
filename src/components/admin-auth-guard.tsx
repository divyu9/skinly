import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

export function AdminAuthGuard({ children }: { children: ReactNode }) {
  const authStatus = useQuery(api.users.isCurrentUserAdmin);

  // Loading state
  if (authStatus === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-950">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to sign in
  if (!authStatus.isAuthenticated) {
    return <Navigate to="/backend-skinly/unauthorized" replace />;
  }

  // Not an admin - redirect to unauthorized page
  if (!authStatus.isAdmin) {
    return <Navigate to="/backend-skinly/unauthorized" replace />;
  }

  // Authenticated and admin - render children
  return <>{children}</>;
}
