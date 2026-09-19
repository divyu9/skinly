import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { brandKey, loadCatalogue, type BrandLogo } from "@/lib/catalogue";

/**
 * The brands that lead the row, in this order — the ones people come looking
 * for. After them the brands we support the most models of for this gadget,
 * so Dell, HP, Lenovo and Asus lead the laptop row and Nikon and Canon the
 * lens one, instead of whatever happens to sort first alphabetically.
 */
const LEAD_BRANDS = ["apple", "samsung", "google", "oneplus", "nothing", "motorola"];

/** Misspellings in the model list that would otherwise show as a second chip. */
const BRAND_ALIASES: Record<string, string> = { snoy: "sony" };

/** Brands whose own spelling is not the one the model list happens to carry. */
const BRAND_NAMES: Record<string, string> = { oneplus: "OnePlus", iqoo: "iQOO", playstation: "PlayStation" };

let brandLogosPromise: Promise<Record<string, BrandLogo>> | null = null;
const loadBrandLogos = () =>
  (brandLogosPromise ||= loadCatalogue().then((c) => c?.brandLogos || {}).catch(() => ({} as Record<string, BrandLogo>)));

export interface BrandOption {
  /** The brand as the models and listings spell it — what goes in ?brand=. */
  brand: string;
  /** Supported models of this gadget from this brand. */
  models: number;
  /** Listings here that fit it — always at least one, or it is not offered. */
  listings: number;
}

interface Chip {
  key: string;
  filterBrand: string;
  label: string;
  models: number;
  image?: string;
}

/** SIGMA and FUJIFILM are shouting; HP, LG and DJI are spelt that way. */
const pretty = (name: string) =>
  /^[A-Z0-9+]{4,}$/.test(name) ? name.charAt(0) + name.slice(1).toLowerCase() : name;

/**
 * A tap-through row of brand circles above the skins grid — the same logos the
 * admin sets on the homepage's Explore by Brand section — so picking Apple or
 * Vivo lands on that brand's listings instead of a grid where one design shows
 * as several near-identical cards, one per brand.
 *
 * Every brand we support models of for this gadget gets a chip, not only the
 * brands a listing was cut specifically for: a Vivo or a Realme phone is fitted
 * by the catch-all Android listings, a Lenovo laptop by the catch-all laptop
 * ones, and a row that named neither read as "we don't do your phone".
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
      const raw = String(option.brand || "").trim();
      if (!raw) continue;
      const key = BRAND_ALIASES[brandKey(raw)] || brandKey(raw);
      if (!key) continue;
      const at = byBrand.get(key);
      if (at) { at.models += option.models; continue; }
      const logo = logos[key];
      byBrand.set(key, {
        key,
        filterBrand: raw,
        label: logo?.name?.trim() || BRAND_NAMES[key] || pretty(raw),
        models: option.models,
        image: logo?.image,
      });
    }
    const rank = (c: Chip) => {
      const lead = LEAD_BRANDS.indexOf(c.key);
      return lead >= 0 ? lead : LEAD_BRANDS.length;
    };
    return [...byBrand.values()].sort(
      (a, b) => rank(a) - rank(b) || b.models - a.models || a.label.localeCompare(b.label)
    );
  }, [brands, logos]);

  if (chips.length < 2) return null;

  const active = BRAND_ALIASES[brandKey(searchParams.get("brand"))] || brandKey(searchParams.get("brand"));

  const pick = (chip: Chip) => {
    const next = new URLSearchParams(searchParams);
    if (chip.key === active) {
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
      /* The top padding is the selected chip's ring: overflow-x-auto clips the
         block axis too, and ring-2 with ring-offset-2 sits 4px outside the
         circle, so the ring came out shaved flat along its top edge. */
      className="-mx-4 mb-1 flex gap-3.5 overflow-x-auto px-4 pb-1 pt-1.5 sm:mx-0 sm:gap-4 sm:px-0 sm:pb-2 sm:pt-2"
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
