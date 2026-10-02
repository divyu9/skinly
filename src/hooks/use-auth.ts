import { useState, useEffect } from "react";
import type { User } from "firebase/auth";

/*
 * Who is signed in. The Auth SDK is fetched here, once the app has drawn,
 * rather than shipped in the first download (lib/firebase-auth.ts); until it
 * answers, isLoaded is false, which is the state every caller already handles.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    let unsubscribe = () => {};
    import("@/lib/firebase-auth").then((m) => {
      if (!live) return;
      unsubscribe = m.onAuthStateChanged(m.auth, (currentUser) => {
        setUser(currentUser);
        setIsLoaded(true);
      });
    });
    return () => { live = false; unsubscribe(); };
  }, []);

  const fetchAccessToken = async ({ forceRefreshToken = false }: { forceRefreshToken?: boolean } = {}) => {
    if (!user) return null;
    return await user.getIdToken(forceRefreshToken);
  };

  const signOut = async () => {
    const m = await import("@/lib/firebase-auth");
    await m.signOut(m.auth);
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
