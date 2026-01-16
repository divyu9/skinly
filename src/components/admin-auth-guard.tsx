import { useQuery } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Navigate } from "react-router-dom";
import { useState, useEffect, useRef, type ReactNode } from "react";

export function AdminAuthGuard({ children }: { children: ReactNode }) {
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const authStatus = useQuery(api.users.isCurrentUserAdmin);

  // Track if we've ever successfully verified admin status
  // This prevents flickering to 404 during brief auth state changes
  const [hasVerifiedAdmin, setHasVerifiedAdmin] = useState(false);
  const verificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Once admin is verified, remember it to prevent flicker
  useEffect(() => {
    if (authStatus?.isAdmin === true) {
      setHasVerifiedAdmin(true);
      // Clear any pending timeout
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
        verificationTimeoutRef.current = null;
      }
    }
  }, [authStatus?.isAdmin]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
      }
    };
  }, []);

  // Wait for Clerk to load first
  if (!clerkLoaded) {
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

  // Clerk says not signed in - redirect to sign-in
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  // Clerk says signed in, but Convex auth status is still loading
  // OR we've verified admin before and status is temporarily undefined (token refresh)
  if (authStatus === undefined) {
    // If we've previously verified admin, keep showing content during brief undefined states
    if (hasVerifiedAdmin) {
      return <>{children}</>;
    }
    // Otherwise show loading skeleton
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

  // Not authenticated according to Convex (but Clerk says signed in)
  // This can happen during token refresh - give it a moment
  if (!authStatus.isAuthenticated) {
    // If we've verified admin before, keep showing content briefly
    if (hasVerifiedAdmin) {
      return <>{children}</>;
    }
    // Otherwise redirect to sign-in
    return <Navigate to="/sign-in" replace />;
  }

  // Logged in but NOT admin
  if (authStatus.isAdmin !== true) {
    // If we've verified admin before, this might be a brief glitch - keep showing content
    if (hasVerifiedAdmin) {
      return <>{children}</>;
    }
    return <Navigate to="/backend-skinly/unauthorized" replace />;
  }

  // Admin verified
  return <>{children}</>;
}
