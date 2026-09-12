import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";

/**
 * The shop's categories, as the homepage already curates them.
 *
 * Two collections describe categories and neither is complete on its own.
 * `categoryDisplaySettings` is the curated one the homepage explorer draws:
 * it carries the order, the artwork and any custom link, but its label field
 * is empty on all six rows. `productCategoriesConfig` carries the names and
 * the product counts but nothing visual.
 *
 * Joining them here means the Shop sheet shows exactly the categories the
 * homepage shows, in the same order, with the names used everywhere else —
 * and adding a category in the admin still only has to be done once.
 */
export interface ShopCategory {
  id: string;
  label: string;
  imageUrl?: string;
  href: string;
}

const prettify = (id: string) =>
  id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export function useShopCategories(): ShopCategory[] | undefined {
  const curated = useQuery(api.homepage.getActiveCategoryDisplaySettings) as
    | Array<{ categoryName: string; buttonText?: string; displayName?: string; imageUrl?: string; linkUrl?: string; order?: number }>
    | undefined;
  // Named "withCounts", but the handler returns no count — only the names are
  // taken from here.
  const named = useQuery(api.productCategories.listAllWithCounts, {}) as
    | Array<{ id: string; displayName: string }>
    | undefined;

  if (curated === undefined) return undefined;

  const byId = new Map((named || []).map((c) => [c.id, c]));

  return [...curated]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((c) => {
      const match = byId.get(c.categoryName);
      return {
        id: c.categoryName,
        // buttonText is what the homepage card prints; displayName is blank on
        // every row, so the catalogue's own name is the reliable fallback.
        label: c.buttonText?.trim() || c.displayName?.trim() || match?.displayName || prettify(c.categoryName),
        imageUrl: c.imageUrl,
        href: c.linkUrl || `/products?productType=${c.categoryName}`,
      };
    });
}
