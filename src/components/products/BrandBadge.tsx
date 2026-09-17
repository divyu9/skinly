import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { brandKey, loadCatalogue, type BrandLogo } from "@/lib/catalogue";

/**
 * The brand a listing is for, top-right on its card.
 *
 * The logo is the one the admin uploaded for the homepage's Explore by Brand
 * section, and the badge goes where that card goes — so a brand's identity is
 * kept in one place. Drawn over the photo, never baked into it: product images
 * stay clean for Google Shopping, and a new logo reaches every card at the
 * next build. Without a logo the brand's name stands in.
 */

let logos: Promise<Record<string, BrandLogo>> | null = null;
const loadLogos = () => (logos ||= loadCatalogue().then((c) => c?.brandLogos || {}).catch(() => ({} as Record<string, BrandLogo>)));

export function BrandBadge({ brand }: { brand: string }) {
  const navigate = useNavigate();
  const [logo, setLogo] = useState<BrandLogo | null | undefined>(undefined);
  const [broken, setBroken] = useState(false);
  const key = brandKey(brand);

  useEffect(() => {
    let live = true;
    void loadLogos().then((all) => { if (live) setLogo(all[key] || null); });
    return () => { live = false; };
  }, [key]);

  if (logo === undefined) return null;
  const href = logo?.href || `/products?brand=${encodeURIComponent(key)}`;
  const showImage = !!logo?.image && !broken;

  return (
    <button
      type="button"
      // The card is a link; this is a second destination inside it.
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(href); }}
      className="absolute right-1.5 top-1.5 z-10 flex h-6 max-w-[45%] items-center rounded-full border border-ink/10 bg-white/95 px-2 shadow-sm transition hover:border-ink/40 sm:right-2 sm:top-2 sm:h-8 sm:px-2.5"
      title={`More ${logo?.name || brand} skins`}
      aria-label={`More ${logo?.name || brand} skins`}
    >
      {showImage ? (
        <img
          src={logo!.image}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-3.5 w-auto max-w-full object-contain sm:h-5"
        />
      ) : (
        <span className="truncate text-[9px] font-bold uppercase tracking-wide text-ink/80 sm:text-[11px]">
          {logo?.name || brand}
        </span>
      )}
    </button>
  );
}
