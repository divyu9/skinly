import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { brandKey, loadCatalogue, type BrandLogo } from "@/lib/catalogue";

/** A catch-all listing's own name reads awkwardly as a brand chip ("Android
 * Phone" sitting next to "Apple", "Samsung"). These read the way a shopper
 * actually thinks of "everyone else". */
const CATCHALL_LABEL: Record<string, string> = {
  "android phone": "Other Android",
  "laptop": "Other Laptop",
  "tablet": "Other Tablet",
  "charger": "Other Charger",
  "camera lens": "Other Lens",
  "gimbal": "Other Gimbal",
  "playstation controller": "PlayStation",
  "xbox controller": "Xbox",
};

let brandLogosPromise: Promise<Record<string, BrandLogo>> | null = null;
const loadBrandLogos = () =>
  (brandLogosPromise ||= loadCatalogue().then((c) => c?.brandLogos || {}).catch(() => ({} as Record<string, BrandLogo>)));

interface BrandOption {
  listingKind: string;
  modelBrands?: string[];
}

/**
 * A tap-through row of brand circles at the top of the skins grid — the same
 * logos as the homepage's Explore by Brand section — so picking "Apple" or
 * "Samsung" goes straight to that brand's listings instead of scrolling a
 * grid where one design shows as five near-identical cards.
 *
 * Shown while browsing skins with no brand chosen yet; hidden once one is,
 * since the grid itself is the picker at that point.
 */
export function BrandPicker({ brands }: { brands: BrandOption[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logos, setLogos] = useState<Record<string, BrandLogo>>({});

  useEffect(() => {
    let live = true;
    void loadBrandLogos().then((l) => { if (live) setLogos(l); });
    return () => { live = false; };
  }, []);

  if (searchParams.get("brand") || brands.length < 2) return null;

  const chips = brands.map((b) => {
    const brandName = b.modelBrands?.length === 1 ? b.modelBrands[0] : null;
    const key = brandName ? brandKey(brandName) : "";
    const logo = key ? logos[key] : undefined;
    const label = brandName || CATCHALL_LABEL[b.listingKind.toLowerCase()] || b.listingKind;
    return { key: b.listingKind, filterBrand: brandName || b.listingKind, label, logo };
  });

  const goToBrand = (filterBrand: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("brand", filterBrand);
    setSearchParams(next);
  };

  return (
    <div className="-mx-4 mb-2 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-2" role="list" aria-label="Shop by brand">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          role="listitem"
          onClick={() => goToBrand(c.filterBrand)}
          className="flex shrink-0 flex-col items-center gap-1.5 text-center"
        >
          <span className="flex size-14 items-center justify-center overflow-hidden rounded-full border border-border bg-muted transition-transform group-hover:scale-105 sm:size-16">
            {c.logo?.image ? (
              <img src={c.logo.image} alt="" loading="lazy" className="size-9 object-contain sm:size-10" />
            ) : (
              <span className="text-lg font-bold text-muted-foreground">{c.label[0]?.toUpperCase()}</span>
            )}
          </span>
          <span className="max-w-16 truncate text-[11px] font-medium text-foreground sm:max-w-20 sm:text-xs">{c.label}</span>
        </button>
      ))}
    </div>
  );
}
