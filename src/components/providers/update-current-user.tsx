import { useEffect, useState, useRef } from "react";
import { api } from "@/convex/_generated/api.js";
import { useConvexAuth, useMutation } from "convex/react";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "../ui/spinner";

const GUEST_CART_KEY = "skinly_guest_cart";

// This will automatically run and store the user
function useUpdateCurrentUserEffect() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useAuth();
  const sub = user?.profile.sub;
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);
  const syncGuestCart = useMutation(api.cart.syncGuestCart);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userCreated, setUserCreated] = useState(false);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setUserCreated(false);
      hasRunRef.current = false;
      return;
    }
    
    // Prevent multiple runs
    if (hasRunRef.current) {
      return;
    }
    
    hasRunRef.current = true;
    
    async function createUser() {
      setIsCreatingUser(true);
      try {
        await updateCurrentUser();
        
        // Sync guest cart if exists
        const guestCartData = localStorage.getItem(GUEST_CART_KEY);
        if (guestCartData) {
          try {
            const guestCart = JSON.parse(guestCartData);
            if (Array.isArray(guestCart) && guestCart.length > 0) {
              console.log("Syncing guest cart with", guestCart.length, "items");
              await syncGuestCart({ guestCartItems: guestCart });
              console.log("Guest cart sync successful");
              // Clear guest cart after successful sync
              localStorage.removeItem(GUEST_CART_KEY);
            }
          } catch (err) {
            console.error("Failed to sync guest cart:", err);
            // Don't clear localStorage on error so user doesn't lose cart
          }
        }
        
        setUserCreated(true);
      } catch (err) {
        console.error("Failed to create/update user:", err);
        hasRunRef.current = false; // Allow retry on error
      } finally {
        setIsCreatingUser(false);
      }
    }
    createUser();
  }, [isAuthenticated, updateCurrentUser, syncGuestCart]);

  return { isCreatingUser, userCreated };
}

function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-svh">
      <Spinner className="size-8" />
    </div>
  );
}

// Component that automatically stores the user when authenticated
export function UpdateCurrentUserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useConvexAuth();
  const { isCreatingUser, userCreated } = useUpdateCurrentUserEffect();

  // State 1: User unauthenticated - render children
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // State 2: User authenticated but not in DB yet - don't render
  if (isAuthenticated && (!userCreated || isCreatingUser)) {
    return <LoadingPage />;
  }

  // State 3: User authenticated and exists in DB - render children
  return <>{children}</>;
}
