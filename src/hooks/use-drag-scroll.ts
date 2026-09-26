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

/**
 * The same press-and-drag for every row marked `data-drag-scroll`, installed
 * once for the whole site (App.tsx) rather than wired into each component:
 * the homepage rows — hero, brands, top picks, real cuts, trendy, videos,
 * reviews — are plain overflow-x rows, and only needed a mouse to move them.
 * Touch is left to the browser, which already swipes them.
 */
export function useGlobalDragScroll() {
  useEffect(() => {
    let row: HTMLElement | null = null;
    let startX = 0, startLeft = 0, moved = false;

    const down = (e: PointerEvent) => {
      // Every press starts clean: a drag whose release landed off the row
      // never gets its click, and must not swallow the next real one.
      moved = false;
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const el = (e.target as HTMLElement | null)?.closest?.("[data-drag-scroll]") as HTMLElement | null;
      if (!el || el.scrollWidth <= el.clientWidth) return;
      row = el; startX = e.clientX; startLeft = el.scrollLeft; moved = false;
    };
    const move = (e: PointerEvent) => {
      if (!row) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) { moved = true; row.style.scrollSnapType = "none"; row.style.scrollBehavior = "auto"; row.dataset.dragging = "1"; }
      if (moved) row.scrollLeft = startLeft - dx;
    };
    const up = () => {
      if (!row) return;
      row.style.scrollSnapType = ""; row.style.scrollBehavior = ""; delete row.dataset.dragging;
      row = null;
      // The click (if any) is dispatched right after this pointerup; clear
      // the flag once it has been, so it never outlives this drag.
      setTimeout(() => { moved = false; }, 0);
    };
    // A drag that moved ends in a click on whatever was under the mouse — a
    // link, in every one of these rows. That click is not meant.
    const click = (e: MouseEvent) => {
      if (!moved) return;
      moved = false;
      e.preventDefault(); e.stopPropagation();
    };
    const nativeDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-drag-scroll]")) e.preventDefault();
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("click", click, true);
    window.addEventListener("dragstart", nativeDrag);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("click", click, true);
      window.removeEventListener("dragstart", nativeDrag);
    };
  }, []);
}
