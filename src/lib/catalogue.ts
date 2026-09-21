/**
 * The storefront's catalogue, from a file instead of Firestore.
 *
 * Several storefront queries read every product document to show a handful:
 * the homepage tag rows (959 reads each), the listing and its filter counts
 * (959 each), the suggested and trending rows on a product page (959 each)
 * and header search (959 per search). With ~27 visitors a day that was over
 * 130k billed reads, about 5,000 per visitor.
 *
 * scripts/prerender.mjs writes /data/catalogue.json at build time — every
 * active product with the fields those views use, and its variants. Views
 * choose from it for free and then re-read, live, only the products they are
 * about to show (see refreshProducts in firebase-hooks.tsx), so price and stock
 * on screen are never older than the page. Products created after the build
 * are picked up by one small query on _creationTime.
 *
 * When the file is missing — `vite dev`, or a build that could not reach
 * Firestore — loadCatalogue resolves to null and callers keep their old path.
 */

export interface CatalogueVariant {
  _id: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  sku?: string;
  inventoryQuantity: number;
}

export interface CatalogueProduct {
  _id: string;
  slug: string;
  title: string;
  status: string;
  productCategory?: string;
  gadgetCategory?: string;
  gadgetTypeId?: string;
  /** Listing is for these device brands only / for all but these. */
  modelBrands?: string[];
  modelBrandsExclude?: string[];
  finishType?: string;
  finishTypeId?: string;
  tags: string[];
  images: Array<{ url: string; alt?: string }>;
  _creationTime: number;
  variants: CatalogueVariant[];
}

export interface BrandLogo {
  href: string;
  image?: string;
  name?: string;
}

/** A style page — a theme or finish somebody can browse by. Biggest first. */
export interface ThemePage {
  slug: string;
  name: string;
  total: number;
  gadget: string | null;
}

export interface Catalogue {
  builtAt: number;
  products: CatalogueProduct[];
  /** From the homepage's Explore by Brand cards, keyed by brandKey(). */
  brandLogos: Record<string, BrandLogo>;
  /** Every style page, written by the build so nothing links to a page that went. */
  themes: ThemePage[];
}

/** "One Plus", "OnePlus" and "oneplus-skins" are one brand. */
export const brandKey = (s: unknown) =>
  String(s ?? "").toLowerCase().replace(/-skins$/, "").replace(/[^a-z0-9]+/g, "");

let pending: Promise<Catalogue | null> | null = null;

export function loadCatalogue(): Promise<Catalogue | null> {
  if (pending) return pending;
  pending = fetch("/data/catalogue.json", { headers: { accept: "application/json" } })
    .then(async (res) => {
      if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return null;
      const body = await res.json();
      if (!body || !Array.isArray(body.products) || typeof body.builtAt !== "number") return null;
      // Tags are stored once, in tagList, and referred to by index.
      const tagList: string[] = Array.isArray(body.tagList) ? body.tagList : [];
      for (const p of body.products) {
        p.tags = Array.isArray(p.tags) ? p.tags.map((t: number | string) => (typeof t === "number" ? tagList[t] : t)).filter(Boolean) : [];
      }
      return {
        builtAt: body.builtAt,
        products: body.products,
        brandLogos: body.brandLogos || {},
        themes: Array.isArray(body.themes) ? body.themes : [],
      } as Catalogue;
    })
    .catch(() => null);
  return pending;
}

export interface CatalogueModel {
  /** "<brand>|<model>" — the file carries no document ids. */
  _id: string;
  brandName: string;
  modelName: string;
  category?: string;
  isActive: true;
  _creationTime: number;
}

let pendingModels: Promise<{ builtAt: number; models: CatalogueModel[] } | null> | null = null;

/**
 * Every active supported model, from /data/models.json. Model search and the
 * model pickers read all ~3,500 model documents on every use; storefront views
 * use this instead (admin pages keep reading Firestore, where edits must show
 * at once). null when the file is missing.
 */
export function loadModelCatalogue() {
  if (pendingModels) return pendingModels;
  pendingModels = fetch("/data/models.json", { headers: { accept: "application/json" } })
    .then(async (res) => {
      if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return null;
      const body = await res.json();
      if (!body || !body.brands || typeof body.builtAt !== "number") return null;
      // { brands: { Apple: [[modelName, category, createdSeconds], …] } }
      const models: CatalogueModel[] = [];
      for (const [brandName, rows] of Object.entries(body.brands as Record<string, [string, string, number][]>)) {
        for (const [modelName, category, created] of rows) {
          models.push({
            _id: `${brandName}|${modelName}`,
            brandName,
            modelName,
            ...(category ? { category } : {}),
            isActive: true,
            _creationTime: created * 1000,
          });
        }
      }
      return { builtAt: body.builtAt as number, models };
    })
    .catch(() => null);
  return pendingModels;
}
