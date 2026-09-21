import { useEffect, useRef, useState } from "react";

/**
 * How tall a dropdown may be without hiding under the phone keyboard.
 *
 * A results panel sized in `vh` is sized against the layout viewport, and on
 * iOS that does not shrink when the keyboard opens — so `max-h-[60vh]` let the
 * list run on beneath the keys, and the models at the bottom of it could be
 * seen but never tapped. `dvh` does not help either: it tracks the browser's
 * own chrome, not the keyboard.
 *
 * `visualViewport` is the one thing that does know. It reports the part of the
 * page a person can actually see, and it fires on every keyboard open, close
 * and resize.
 *
 * @param anchor the element the dropdown hangs below — usually the input
 * @param gap    space to leave beneath the panel, in pixels. The default
 *   allows for the panel's own top margin and border as well as a little
 *   breathing room, measured against the card these two searches use.
 */
export function useDropdownHeight(
  anchor: React.RefObject<HTMLElement | null>,
  gap = 28,
): { maxHeight: number | undefined; ref: React.RefObject<HTMLElement | null> } {
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  const raf = useRef(0);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;

    const measure = () => {
      const el = anchor.current;
      if (!el) return;
      const bottom = el.getBoundingClientRect().bottom;
      // The visible area, in the same coordinates getBoundingClientRect uses.
      const visibleBottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
      const room = Math.round(visibleBottom - bottom - gap);
      /*
       * A floor, because a keyboard on a small phone can leave almost nothing:
       * better a short scrollable list than a panel one row high. Below this
       * the browser's own scrolling brings the rest into view.
       */
      setMaxHeight(Math.max(180, room));
    };

    // Coalesced: iOS fires resize and scroll together as the keyboard animates.
    const onChange = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(measure);
    };

    measure();
    vv?.addEventListener("resize", onChange);
    // visualViewport's own scroll event fires for pinch-zoom, not for an
    // ordinary page scroll — and an ordinary scroll moves the anchor, which
    // is half of the sum. Measured once on open, the panel came out 180px
    // when there was room for 362.
    vv?.addEventListener("scroll", onChange);
    window.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      cancelAnimationFrame(raf.current);
      vv?.removeEventListener("resize", onChange);
      vv?.removeEventListener("scroll", onChange);
      window.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, [anchor, gap]);

  return { maxHeight, ref: anchor };
}
