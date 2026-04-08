import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  const fetchAccessToken = async ({ forceRefreshToken = false }: { forceRefreshToken?: boolean } = {}) => {
    if (!user) return null;
    return await user.getIdToken(forceRefreshToken);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return {
    // Convex-required shape (temporarily keeping these for backward compatibility during migration)
    isLoading: !isLoaded,
    isAuthenticated: !!user,
    fetchAccessToken,

    // App usage
    user,
    isLoaded,
    isSignedIn: !!user,
    signOut,
  };
}
