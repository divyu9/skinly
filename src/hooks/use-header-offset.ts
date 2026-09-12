import { useEffect, useState } from "react";

/**
 * How far down the page has to start to clear the fixed header.
 *
 * Three places already compute this as `announcementHeight + 64`, and the
 * product page had guessed `72` — which is neither, so its breadcrumb spent
 * its life twenty pixels behind the header and only appeared if you
 * overscrolled. The arithmetic is easy to get wrong because the announcement
 * bar is a separate fixed element that the header positions itself under, and
 * a visitor can dismiss it.
 *
 * So measure it. The header is `position: fixed`, so its bottom edge in
 * viewport coordinates is the offset, whatever is stacked above it, and it
 * does not move as you scroll. Re-measured when the header resizes and when
 * the bar above it comes or goes.
 */
export function useHeaderOffset(fallback = 92): number {
  const [offset, setOffset] = useState(fallback);

  useEffect(() => {
    const measure = () => {
      const header = document.querySelector("header");
      if (!header) return;
      const bottom = Math.round(header.getBoundingClientRect().bottom);
      // A collapsed or not-yet-painted header would otherwise pull the page up
      // under itself; keep the last good value instead.
      if (bottom > 0) setOffset(bottom);
    };

    measure();
    const header = document.querySelector("header");
    const ro = new ResizeObserver(measure);
    if (header) ro.observe(header);
    // The announcement bar mounts, and can be dismissed, independently of the
    // header — both change where the header's bottom edge lands.
    const mo = new MutationObserver(measure);
    mo.observe(document.body, { childList: true, subtree: false });
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return offset;
}
