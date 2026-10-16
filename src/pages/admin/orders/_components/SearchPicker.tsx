import { useMemo, useState } from "react";
import { ChevronsUpDownIcon, CheckIcon, SearchIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Button } from "@/components/ui/button.tsx";
import { searchRows } from "@/lib/search-match";

/**
 * A picker with a search box, for long lists in admin forms (thousands of
 * products, thousands of models). A plain <Select> made the manual order's
 * product a scroll through every listing. Matching is the storefront's own
 * (lib/search-match): words in any order, spacing ignored, a typo forgiven,
 * "a73" = "A7 III". Shows the closest 60.
 */
export function SearchPicker<T>({
  rows, value, onPick, label, sub, placeholder, searchPlaceholder, full, emptyText = "Nothing matches.",
}: {
  rows: T[] | undefined;
  /** The label shown on the button for the current choice, or "". */
  value: string;
  onPick: (row: T) => void;
  /** What a row is called (searched first) and shown. */
  label: (row: T) => string;
  /** A second, smaller line for a row (price, brand…). */
  sub?: (row: T) => string;
  /** Everything else a row may be found by (brand, tags, SKUs). Defaults to its label. */
  full?: (row: T) => string;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const list = rows || [];
    if (!q.trim()) return list.slice(0, 60);
    return searchRows(list, q, label, full || label).slice(0, 60);
  }, [rows, q, label, full]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>{value || placeholder}</span>
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start">
        <div className="relative border-b">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder || "Search…"}
            className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {rows === undefined ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{emptyText}</p>
          ) : (
            shown.map((r, i) => {
              const l = label(r);
              return (
                <button
                  key={`${l}-${i}`}
                  type="button"
                  onClick={() => { onPick(r); setOpen(false); setQ(""); }}
                  className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <CheckIcon className={`mt-0.5 size-4 shrink-0 ${l === value ? "opacity-100" : "opacity-0"}`} />
                  <span className="min-w-0">
                    <span className="block truncate">{l}</span>
                    {sub && sub(r) && <span className="block truncate text-xs text-muted-foreground">{sub(r)}</span>}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
