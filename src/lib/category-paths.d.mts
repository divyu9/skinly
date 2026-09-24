export const SITE: string;
export const CATEGORY_PAGES: Record<string, { path: string; title: string; description: string; heading: string }>;
export const GADGET_PAGES: Record<string, string>;
export function categoryForPath(pathname: string): string | null;
export function canonicalListingPath(productType?: string | null, gadget?: string | null): string;
export const CATALOGUE_CLAIMS: { models: number; designs: number; brands: number };
export function claim(n: number): string;
export const HOME_META: { title: string; description: string; heading: string };
export const PRODUCTS_META: { title: string; description: string };
