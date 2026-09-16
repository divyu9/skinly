import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import type { Product } from "@/hooks/useProductsData";
import { resolveSeoTarget, selectSeoProducts, seoCopy, type SeoTarget } from "@/lib/seo-pages.mjs";

export interface SeoPageData {
  slug: string;
  target: SeoTarget;
  title: string;
  description: string;
  /** The /products listing this page's "shop all" should open. */
  listing: string;
  total: number;
  inStock: number;
  minPrice: number | null;
  finishes: string[];
  mockups: number;
  models: Array<{ brand: string; model: string; href: string }>;
  products: Product[];
}

type Page = { slug: string; pageType?: string; h1Heading?: string; metaTitle?: string; metaDescription?: string };

/**
 * An SEO page's device, products and copy.
 *
 * The build writes /seo-data/<slug>.json for every published page (see
 * scripts/prerender.mjs), so a visit costs one small cached request instead of
 * a live listener on the entire catalogue. A page published since the last
 * build has no file; for that one the same selection runs here, from the
 * catalogue, until the nightly rebuild catches up.
 */
export function useSeoPageData(page: Page | null | undefined): SeoPageData | undefined {
  const slug = page?.slug;
  const [fromFile, setFromFile] = useState<SeoPageData | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setFromFile(undefined);
    fetch(`/seo-data/${encodeURIComponent(slug)}.json`, { headers: { accept: "application/json" } })
      .then((r) => (r.ok && (r.headers.get("content-type") || "").includes("json") ? r.json() : null))
      .then((d) => { if (!cancelled) setFromFile(d && d.slug === slug ? d : null); })
      .catch(() => { if (!cancelled) setFromFile(null); });
    return () => { cancelled = true; };
  }, [slug]);

  const needFallback = fromFile === null && !!page;
  const products = useQuery(api.products.getAllProducts, needFallback ? {} : "skip");
  const models = useQuery(api.supportedModels.listAll, needFallback ? {} : "skip");
  const collections = useQuery(api.collections.getAllCollections, needFallback ? {} : "skip");

  const computed = useMemo((): SeoPageData | undefined => {
    if (!needFallback || !page || !products || !models || !collections) return undefined;
    const target = resolveSeoTarget(page, models as any[], (collections as any[]).map((c) => c.name));
    const names = new Map((collections as any[]).map((c) => [c._id, c.name]));
    const variantsBy = new Map<string, any[]>();
    const collectionsBy = new Map<string, Set<string>>();
    for (const p of products as any[]) {
      variantsBy.set(p._id, p.variants || []);
      collectionsBy.set(p._id, new Set((p.collectionIds || []).map((id: string) => names.get(id)).filter(Boolean)));
    }
    const sel = selectSeoProducts(target, products as any[], variantsBy, collectionsBy);
    const copy = seoCopy(page, target, sel);
    return {
      slug: page.slug,
      target,
      ...copy,
      total: sel.total,
      inStock: sel.inStock,
      minPrice: sel.minPrice,
      finishes: sel.finishes,
      mockups: 0,
      models: (target.models || []).slice(0, 80).map((m) => ({
        brand: m.brand,
        model: m.model,
        href: `/products?${new URLSearchParams({
          productType: "skin", gadget: m.category || target.gadget || "phone", brand: m.brand, model: m.model,
        }).toString()}`,
      })),
      products: sel.products.slice(0, 48) as Product[],
    };
  }, [needFallback, page, products, models, collections]);

  return fromFile || computed;
}
