import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { collectionKey } from "@/lib/collection-key";

interface Collection {
  _id: string;
  name: string;
}

interface CollectionPillsProps {
  collections: Collection[];
  currentCollection: string;
  onCollectionChange: (collection: string | null) => void;
}

/** How many fit comfortably before the row needs a second line. */
const COLLAPSED_COUNT = 7;

/**
 * Collections, all of them reachable.
 *
 * This was a single `overflow-x-auto no-scrollbar` row holding twenty
 * collections — 1806px of chips in a 409px box. Technically scrollable, but
 * the scrollbar was hidden so nothing said so, and on a desktop with a mouse
 * there is no way to scroll a row sideways at all. Anything past "Nature" —
 * Marvel, DC, Gaming, Anime, fourteen of the twenty — was unreachable.
 *
 * Wrapping all twenty instead would run five rows on a phone, above the
 * products, under a filter strip that is already fixed there. So: seven, then
 * a count of what is left. Opening it wraps the rest, and a chosen collection
 * is always shown whether or not it made the first seven — otherwise selecting
 * "Anime" and collapsing would hide the thing you are looking at.
 */
export const CollectionPills = memo(function CollectionPills({
  collections,
  currentCollection,
  onCollectionChange,
}: CollectionPillsProps) {
  const [expanded, setExpanded] = useState(false);
  /*
   * How many collections the collapsed row shows. Starts at COLLAPSED_COUNT
   * and gives one up whenever "N more" would otherwise wrap onto a line of its
   * own — the button belongs at the end of the last row, where the eye already
   * is, not alone at the left edge underneath.
   */
  const [fit, setFit] = useState(COLLAPSED_COUNT);
  // Bumped on resize, so a reset to a `fit` that has not changed still re-measures.
  const [measure, setMeasure] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  // `?collection=` carries the display name when a chip set it and the slug
  // when the link came from the sitemap, so compare through a shared key.
  const activeKey = collectionKey(currentCollection);
  const isActive = (name: string) => !!activeKey && collectionKey(name) === activeKey;

  const shown = useMemo(() => {
    if (expanded) return collections;
    const head = collections.slice(0, fit);
    // The active one survives the collapse even if it sits further down.
    if (activeKey && !head.some((c) => collectionKey(c.name) === activeKey)) {
      const active = collections.find((c) => collectionKey(c.name) === activeKey);
      if (active) return [...head.slice(0, fit - 1), active];
    }
    return head;
  }, [collections, activeKey, expanded, fit]);

  // Drop one chip at a time until the button shares the last row.
  useLayoutEffect(() => {
    const more = moreRef.current;
    const prev = more?.previousElementSibling as HTMLElement | null;
    if (expanded || !more || !prev) return;
    // Compare the button's middle against the chip's line, not the raw tops:
    // the button is a touch shorter and `items-center` nudges it down a couple
    // of pixels, which read as "wrapped" on every pass.
    const middle = more.offsetTop + more.offsetHeight / 2;
    const wrapped = middle > prev.offsetTop + prev.offsetHeight;
    if (wrapped && fit > 1) setFit((n) => n - 1);
  }, [expanded, fit, shown, measure]);

  // A different width fits a different number, so start over from the top.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    let width = row.clientWidth;
    const ro = new ResizeObserver(() => {
      if (row.clientWidth === width) return;
      width = row.clientWidth;
      setFit(COLLAPSED_COUNT);
      setMeasure((n) => n + 1);
    });
    ro.observe(row);
    return () => ro.disconnect();
  }, []);

  if (!collections || collections.length === 0) return null;

  const hidden = collections.length - shown.length;

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
      active
        ? "border-2 border-ink bg-brand text-brand-foreground"
        : "border-2 border-ink/15 bg-card text-ink/80 hover:border-ink/40"
    }`;

  return (
    <div ref={rowRef} className="mb-2 flex flex-wrap items-center gap-1.5 sm:mb-4">
      <button onClick={() => onCollectionChange(null)} className={chip(!activeKey)}>
        All Collections
      </button>

      {shown.map((col) => (
        <button
          key={col._id}
          onClick={() => onCollectionChange(col.name)}
          className={chip(isActive(col.name))}
        >
          {col.name}
        </button>
      ))}

      {hidden > 0 && !expanded && (
        <button
          ref={moreRef}
          onClick={() => setExpanded(true)}
          className="flex items-center gap-0.5 rounded-full px-1.5 py-1.5 text-xs font-bold whitespace-nowrap text-brand transition-colors hover:text-ink"
        >
          {hidden} more
          <ChevronDownIcon className="size-3.5" strokeWidth={2.5} />
        </button>
      )}

      {expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-brand transition-colors hover:text-ink"
        >
          Show fewer
          <ChevronDownIcon className="size-3.5 rotate-180" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
});
