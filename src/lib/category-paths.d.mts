export const SITE: string;
export const CATEGORY_PAGES: Record<string, { path: string; title: string; description: string; heading: string }>;
export const GADGET_PAGES: Record<string, string>;
export function categoryForPath(pathname: string): string | null;
export function canonicalListingPath(productType?: string | null, gadget?: string | null): string;
