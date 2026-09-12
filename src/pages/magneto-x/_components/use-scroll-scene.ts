import { useEffect, useRef } from "react";

/**
 * Drives a pinned scene from scroll position.
 *
 * Deliberately does not touch React state. A scroll handler that calls
 * setState runs the whole subtree sixty times a second and the animation
 * stutters on exactly the mid-range Android phones most of this traffic is on.
 * Instead each frame writes one custom property, `--p` (0 → 1), onto the
 * section element, and the scene's CSS does the rest in `calc()`. React
 * renders the scene once; the browser animates it on the compositor.
 *
 * Honours `prefers-reduced-motion` by parking every scene at its resolved
 * state, so the page still reads correctly with the motion switched off.
 */
export function useScrollScene<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) {
      el.style.setProperty("--p", "1");
      return;
    }

    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 as the section's top reaches the top of the viewport, 1 once its
      // last screenful has passed. Scenes are taller than the viewport, so
      // this is the travel available for pinning.
      const travel = Math.max(rect.height - vh, 1);
      const p = Math.min(Math.max(-rect.top / travel, 0), 1);
      el.style.setProperty("--p", p.toFixed(4));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return ref;
}

/**
 * Fades and lifts an element the first time it comes into view. Used for the
 * ordinary copy blocks between the pinned scenes, where a scroll-linked
 * animation would be overkill.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.shown = "true";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.shown = "true";
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}
