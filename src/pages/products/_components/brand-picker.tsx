import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { brandKey, loadCatalogue, type BrandLogo } from "@/lib/catalogue";

let brandLogosPromise: Promise<Record<string, BrandLogo>> | null = null;
const loadBrandLogos = () =>
  (brandLogosPromise ||= loadCatalogue().then((c) => c?.brandLogos || {}).catch(() => ({} as Record<string, BrandLogo>)));

interface BrandOption {
  listingKind: string;
  modelBrands?: string[];
}

interface Chip {
  key: string;
  /** What goes in ?brand= — a real brand, or "Other" for the catch-all listings. */
  filterBrand: string;
  label: string;
  image?: string;
}

/**
 * A tap-through row of brand circles above the skins grid — the same logos the
 * admin sets on the homepage's Explore by Brand section — so picking Apple or
 * Samsung lands on that brand's listings instead of a grid where one design
 * shows as several near-identical cards, one per brand.
 *
 * Chips are keyed by the brand they filter to, not by the listing kind: Xbox
 * Series X, Series S and the Xbox controller listing are all one Xbox chip,
 * and PS5 and the PlayStation controller are one PlayStation chip. A listing
 * that names no brand — Android Phone, Laptop, Tablet — is the "Other" chip;
 * "Other" matches nothing in any named listing's brand list, so it selects
 * exactly the catch-alls.
 */
export function BrandPicker({ brands }: { brands: BrandOption[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logos, setLogos] = useState<Record<string, BrandLogo>>({});

  useEffect(() => {
    let live = true;
    void loadBrandLogos().then((l) => { if (live) setLogos(l); });
    return () => { live = false; };
  }, []);

  const chips = useMemo<Chip[]>(() => {
    const byBrand = new Map<string, Chip>();
    for (const option of brands) {
      const names = (option.modelBrands || []).filter(Boolean);
      if (!names.length) {
        if (!byBrand.has("other")) byBrand.set("other", { key: "other", filterBrand: "Other", label: "Other" });
        continue;
      }
      // A listing often names a brand's aliases together — "One Plus" and
      // "OnePlus", or Dell and Alienware. Whichever of them the admin
      // uploaded a logo for is the one to show; otherwise the first.
      const withLogo = names.find((n) => logos[brandKey(n)]?.image);
      const primary = withLogo || names[0];
      const key = brandKey(primary);
      if (byBrand.has(key)) continue;
      const logo = logos[key];
      byBrand.set(key, {
        key,
        filterBrand: primary,
        label: logo?.name?.trim() || primary,
        image: logo?.image,
      });
    }
    const all = [...byBrand.values()];
    // Named brands first, alphabetically; "Other" always last.
    return all
      .filter((c) => c.key !== "other")
      .sort((a, b) => a.label.localeCompare(b.label))
      .concat(all.filter((c) => c.key === "other"));
  }, [brands, logos]);

  if (chips.length < 2) return null;

  const active = brandKey(searchParams.get("brand"));

  const pick = (chip: Chip) => {
    const next = new URLSearchParams(searchParams);
    if (brandKey(chip.filterBrand) === active) {
      next.delete("brand");
    } else {
      next.set("brand", chip.filterBrand);
    }
    // A model belongs to the brand that was chosen with it — an iPhone 12
    // Mini left in the URL under brand=Samsung claims a fit that is not real.
    next.delete("model");
    next.delete("fromGadgetSelector");
    setSearchParams(next);
  };

  return (
    <div
      className="-mx-4 mb-1 flex gap-3.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:gap-4 sm:px-0 sm:pb-2"
      role="list"
      aria-label="Shop by brand"
    >
      {chips.map((chip) => {
        const isActive = chip.key === active;
        return (
          <button
            key={chip.key}
            type="button"
            role="listitem"
            aria-pressed={isActive}
            onClick={() => pick(chip)}
            className="flex shrink-0 flex-col items-center gap-1.5 text-center"
          >
            <span
              className={`flex size-14 items-center justify-center overflow-hidden rounded-full bg-muted transition-all sm:size-16 ${
                isActive
                  ? "ring-2 ring-brand ring-offset-2 ring-offset-background"
                  : "border border-border hover:border-foreground/30"
              }`}
            >
              {chip.image ? (
                // Filled, not letterboxed: a square brand tile inset inside a
                // circle read as a square photo with white around it.
                <img src={chip.image} alt="" loading="lazy" className="size-full scale-105 object-cover" />
              ) : (
                <span className="text-lg font-bold text-muted-foreground">{chip.label[0]?.toUpperCase()}</span>
              )}
            </span>
            <span
              className={`max-w-16 truncate text-[11px] sm:max-w-20 sm:text-xs ${
                isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground"
              }`}
            >
              {chip.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
