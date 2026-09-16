import { memo, useMemo, useState } from "react";
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

  // `?collection=` carries the display name when a chip set it and the slug
  // when the link came from the sitemap, so compare through a shared key.
  const activeKey = collectionKey(currentCollection);
  const isActive = (name: string) => !!activeKey && collectionKey(name) === activeKey;

  const shown = useMemo(() => {
    if (expanded) return collections;
    const head = collections.slice(0, COLLAPSED_COUNT);
    // The active one survives the collapse even if it sits further down.
    if (activeKey && !head.some((c) => collectionKey(c.name) === activeKey)) {
      const active = collections.find((c) => collectionKey(c.name) === activeKey);
      if (active) return [...head.slice(0, COLLAPSED_COUNT - 1), active];
    }
    return head;
  }, [collections, activeKey, expanded]);

  if (!collections || collections.length === 0) return null;

  const hidden = collections.length - shown.length;

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
      active
        ? "border-2 border-ink bg-brand text-brand-foreground"
        : "border-2 border-ink/15 bg-card text-ink/80 hover:border-ink/40"
    }`;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:mb-4">
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
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-brand transition-colors hover:text-ink"
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
