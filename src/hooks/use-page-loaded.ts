import { useEffect, useState } from "react";

/**
 * True once the window's load event has fired.
 *
 * For pictures that are near the screen but not on it. The browser's own
 * lazy loading starts anything within a thousand-odd pixels, which on a phone
 * is the whole top of the homepage, so those pictures downloaded alongside the
 * hero — the page's largest paint — and slowed it. Holding them until load
 * costs nothing anyone can see: by then the hero is up.
 */
export function usePageLoaded(): boolean {
  const [loaded, setLoaded] = useState(() => document.readyState === "complete");
  useEffect(() => {
    if (loaded) return;
    const go = () => setLoaded(true);
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, [loaded]);
  return loaded;
}
