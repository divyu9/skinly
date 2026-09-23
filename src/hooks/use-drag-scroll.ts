import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A sideways row that a mouse can move.
 *
 * The homepage rows scroll with `overflow-x-auto` and a hidden scrollbar,
 * which is right on a phone — a finger swipes it — and a dead end on a
 * desktop: nothing says the row continues, a mouse wheel scrolls the page
 * instead, and there is no scrollbar to drag. "Explore by Category" had six
 * cards and a desktop showed four of them, with no way to reach the other two.
 *
 * This gives the row two ways in: arrows that page it by most of its own
 * width, and a press-and-drag that moves it the way a finger would. A drag
 * that actually moved swallows the click that ends it, because every card in
 * these rows is a link and nobody dragging means to open one.
 */
export function useDragScroll<T extends HTMLElement>() {
  // A callback ref, because these rows mount after their data arrives: a
  // plain ref read in an effect that ran during the loading skeleton would
  // never see the row, and both arrows would stay hidden.
  const [el, setEl] = useState<T | null>(null);
  const ref = useRef<T | null>(null);
  ref.current = el;
  const [edges, setEdges] = useState({ start: true, end: true });
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", measure); ro.disconnect(); };
  }, [el, measure]);

  const page = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }, []);

  // Mouse only: touch already scrolls natively, and a pen or finger routed
  // through here would fight the browser's own momentum.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
    drag.current = { down: true, x: e.clientX, left: ref.current.scrollLeft, moved: false };
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.down || !ref.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 5) d.moved = true;
    if (d.moved) {
      // Snap points would yank the row back mid-drag; lift them while held.
      ref.current.style.scrollSnapType = "none";
      ref.current.scrollLeft = d.left - dx;
    }
  }, []);
  const end = useCallback(() => {
    drag.current.down = false;
    if (ref.current) ref.current.style.scrollSnapType = "";
  }, []);
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }, []);

  return {
    ref: setEl,
    canBack: !edges.start,
    canForward: !edges.end,
    page,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerLeave: end,
      onClickCapture,
      // Links and images start a native drag of their own otherwise.
      onDragStart: (e: React.DragEvent) => e.preventDefault(),
    },
  };
}
