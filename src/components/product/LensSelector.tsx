import { useMemo, useState } from "react";
import { SearchIcon, CheckIcon } from "lucide-react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";

/** A camera listing's variant that includes the lens wrap ("With Lens", not "Without Lens"). */
export const isWithLensVariant = (title?: string) => /\blens\b/i.test(String(title || "")) && !/\bwithout\b/i.test(String(title || ""));

/**
 * Which lens the "With Lens" skin is cut for.
 *
 * The finish said "With Lens" but never which lens, so the order reached the
 * plotter without the one thing it needs to cut the lens part. The lenses are
 * the plotter's own list (supportedModels, category "lens"), narrowed to the
 * camera's brand; a lens that isn't listed can be typed in.
 */
export function LensSelector({ brand, value, onChange }: {
  brand: string;
  value: string;
  onChange: (lens: string) => void;
}) {
  const lenses = useQuery(api.supportedModels.listAll, { category: "lens", isActive: true });
  const [search, setSearch] = useState("");
  const [other, setOther] = useState(false);

  const list = useMemo(() => {
    const b = brand.trim().toLowerCase();
    const names = (lenses || [])
      .filter((m: any) => !b || String(m.brandName || "").toLowerCase() === b)
      .map((m: any) => String(m.modelName || "").trim())
      .filter(Boolean);
    const q = search.trim().toLowerCase().replace(/\s+/g, "");
    return [...new Set(names)]
      .filter((n) => !q || n.toLowerCase().replace(/\s+/g, "").includes(q))
      .sort((a, b2) => a.localeCompare(b2, undefined, { numeric: true }));
  }, [lenses, brand, search]);

  return (
    <div id="lens-selector" className="space-y-2 rounded-2xl border-2 border-ink/15 bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-semibold">Select your lens{brand ? ` (${brand})` : ""}</label>
        {value && <span className="truncate text-xs font-semibold text-brand">{value}</span>}
      </div>

      {other ? (
        <div className="space-y-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, 80))}
            placeholder="Type your lens, e.g. NIKKOR Z 24-70mm f/4 S"
            className="w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button type="button" onClick={() => { setOther(false); onChange(""); }} className="text-xs font-semibold text-brand underline">
            Pick from the list instead
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lens, e.g. 24-70"
              className="w-full rounded-lg border-2 border-ink/15 bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
            {lenses === undefined ? (
              <p className="p-3 text-xs text-muted-foreground">Loading lenses…</p>
            ) : list.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No lens matches “{search}”.</p>
            ) : (
              list.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onChange(name)}
                  className={`flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 ${
                    value === name ? "bg-brand/10 font-semibold" : "hover:bg-muted"
                  }`}
                >
                  <span>{name}</span>
                  {value === name && <CheckIcon className="size-4 shrink-0 text-brand" />}
                </button>
              ))
            )}
          </div>
          <button type="button" onClick={() => { setOther(true); onChange(""); }} className="text-xs font-semibold text-brand underline">
            My lens isn't listed
          </button>
        </>
      )}
    </div>
  );
}
