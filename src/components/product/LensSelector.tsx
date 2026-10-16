import { useEffect, useMemo, useState } from "react";
import { SearchIcon, CheckIcon } from "lucide-react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { searchRows } from "@/lib/search-match";

/** A camera listing's variant that includes the lens wrap ("With Lens", not "Without Lens"). */
export const isWithLensVariant = (title?: string) => /\blens\b/i.test(String(title || "")) && !/\bwithout\b/i.test(String(title || ""));

/*
 * The plotter's lens list spells brands its own way ("SIGMA", "TAMRON",
 * "Nikkor" for one Nikon lens, "Vitrox" once for Viltrox). One name each.
 */
const BRAND_ALIASES: Record<string, string> = { nikkor: "Nikon", vitrox: "Viltrox", fuji: "Fujifilm" };
const brandName = (raw: string) => {
  const k = raw.trim().toLowerCase();
  if (BRAND_ALIASES[k]) return BRAND_ALIASES[k];
  return k.replace(/\b[a-z]/g, (c) => c.toUpperCase());
};
// Lens makers that build for every camera mount, offered right after the camera's own brand.
const THIRD_PARTY = ["Sigma", "Tamron", "Samyang", "Viltrox", "Meike", "Tokina", "Yongnuo", "Rokinon"];

/**
 * Which lens the "With Lens" skin is cut for.
 *
 * The finish said "With Lens" but never which lens, so the order reached the
 * plotter without the one thing it needs to cut the lens part. The lenses are
 * the plotter's own list (supportedModels, category "lens"), by brand: the
 * camera's own brand first, then the third-party makers (Sigma, Tamron…) that
 * fit every mount, then the rest. Search looks across all of them, and a lens
 * that isn't listed can be typed in. The value saved is "<Brand> <lens>".
 */
export function LensSelector({ brand, value, onChange }: {
  brand: string;
  value: string;
  onChange: (lens: string) => void;
}) {
  const lenses = useQuery(api.supportedModels.listAll, { category: "lens", isActive: true });
  const [search, setSearch] = useState("");
  const [other, setOther] = useState(false);
  const cameraBrand = brand ? brandName(brand) : "";
  const [tab, setTab] = useState(cameraBrand);
  useEffect(() => { setTab(cameraBrand); }, [cameraBrand]);

  const byBrand = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of (lenses || []) as any[]) {
      const b = brandName(String(l.brandName || ""));
      const n = String(l.modelName || "").trim();
      if (!b || !n) continue;
      if (!m.has(b)) m.set(b, new Set());
      m.get(b)!.add(n);
    }
    return m;
  }, [lenses]);

  const brands = useMemo(() => {
    const rank = (b: string) => (b === cameraBrand ? 0 : THIRD_PARTY.includes(b) ? 1 + THIRD_PARTY.indexOf(b) : 100);
    return [...byBrand.keys()].sort((a, b) => rank(a) - rank(b) || (byBrand.get(b)!.size - byBrand.get(a)!.size));
  }, [byBrand, cameraBrand]);

  const activeTab = byBrand.has(tab) ? tab : brands[0] || "";
  const q = search.trim();
  const rows = useMemo(() => {
    const sortNames = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
    if (q) {
      // The site's own search (lib/search-match): words in any order, spacing
      // and dashes ignored, a typo forgiven, and "24 70 sigma" ranks Sigma's
      // 24-70 first. It looks through every brand.
      const all: { brand: string; name: string }[] = [];
      for (const b of brands) for (const n of byBrand.get(b)!) all.push({ brand: b, name: n });
      return searchRows(all, q, (r) => r.name, (r) => `${r.brand} ${r.name}`).slice(0, 200);
    }
    return [...(byBrand.get(activeTab) || [])].sort(sortNames).map((name) => ({ brand: activeTab, name }));
  }, [q, brands, byBrand, activeTab]);

  const full = (r: { brand: string; name: string }) => `${r.brand} ${r.name}`;

  return (
    <div id="lens-selector" className="space-y-2 rounded-2xl border-2 border-ink/15 bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-semibold">Select your lens</label>
        {value && <span className="truncate text-xs font-semibold text-brand">{value}</span>}
      </div>

      {other ? (
        <div className="space-y-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, 80))}
            placeholder="Brand and lens, e.g. Sigma 18-50mm f/2.8 DC DN"
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
              placeholder="Search any lens, e.g. Sigma 24-70"
              className="w-full rounded-lg border-2 border-ink/15 bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
            />
          </div>

          {!q && brands.length > 0 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" data-drag-scroll>
              {brands.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setTab(b)}
                  className={`shrink-0 rounded-full border-2 px-3 py-1 text-xs font-semibold ${
                    b === activeTab ? "border-ink bg-brand text-brand-foreground" : "border-ink/15 bg-background hover:border-ink/40"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
            {lenses === undefined ? (
              <p className="p-3 text-xs text-muted-foreground">Loading lenses…</p>
            ) : rows.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No lens matches “{search}”. Tap “My lens isn't listed” below.</p>
            ) : (
              rows.map((r) => {
                const v = full(r);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange(v)}
                    className={`flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 ${
                      value === v ? "bg-brand/10 font-semibold" : "hover:bg-muted"
                    }`}
                  >
                    <span>{q && <span className="mr-1.5 text-xs font-semibold text-muted-foreground">{r.brand}</span>}{r.name}</span>
                    {value === v && <CheckIcon className="size-4 shrink-0 text-brand" />}
                  </button>
                );
              })
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
