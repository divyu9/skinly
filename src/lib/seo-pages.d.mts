export interface SeoTarget {
  kind: "model" | "family" | "brand" | "unlisted" | "gadget" | "finish" | "theme" | "keyword";
  brand?: string;
  model?: string;
  gadget?: string;
  finish?: string;
  collections?: string[];
  titleWords?: string[];
  models?: Array<{ brand: string; model: string; category?: string }>;
}

export interface SeoSelection {
  total: number;
  inStock: number;
  minPrice: number | null;
  finishes: string[];
  products: Array<Record<string, any>>;
}

export function slugify(s: unknown): string;
export function gadgetLabel(g?: string): string;
export function resolveSeoTarget(
  page: { slug?: string; pageType?: string; h1Heading?: string },
  models: Array<{ brandName?: string; modelName?: string; category?: string; isActive?: boolean }>,
): SeoTarget;
export function selectSeoProducts(
  target: SeoTarget,
  products: Array<Record<string, any>>,
  variantsByProduct: Map<string, Array<Record<string, any>>>,
  collectionsByProduct: Map<string, Set<string>>,
): SeoSelection;
export function seoCopy(
  page: { h1Heading?: string; metaTitle?: string; metaDescription?: string },
  target: SeoTarget,
  stats: SeoSelection,
): { title: string; description: string; listing: string };
