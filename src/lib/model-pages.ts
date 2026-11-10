/**
 * Each phone's own landing page, written by the build (scripts/prerender.mjs):
 * dist/data/model-pages.json = { pages: { "Brand|Model": slug }, buyBox: ["Brand|Model", ...] }.
 * Fetched only when needed (a model chosen in search, or "change model" in a
 * buy box), and once per visit.
 */
type ModelPages = { pages: Record<string, string>; buyBox: Set<string> };
let pending: Promise<ModelPages> | null = null;

export function loadModelPages(): Promise<ModelPages> {
  if (!pending) {
    pending = fetch("/data/model-pages.json", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d: any) => ({
        pages: (d && typeof d.pages === "object" && d.pages) || {},
        buyBox: new Set<string>(Array.isArray(d?.buyBox) ? d.buyBox : []),
      }));
  }
  return pending;
}

/**
 * Where "change model" on a product page should go: that model's own page
 * when it has a buy box, on this design as sold for that model (the same
 * design code, the same finish when there is one), e.g. a MacBook listing's
 * Black Triangle Affair → the Mac mini page on the Mac mini listing of it
 * (owner, 10 Nov 2026). null when the model has no buy-box page: the product
 * page then stays, cut for that model, as before.
 */
export async function modelPageFor(brand: string, model: string, productSlug?: string | null): Promise<string | null> {
  const { pages, buyBox } = await loadModelPages();
  const key = `${brand}|${model}`;
  const page = pages[key];
  if (!page || !buyBox.has(key)) return null;
  if (!productSlug) return `/${page}`;
  try {
    const [{ loadCatalogue }, seo] = await Promise.all([
      import("./catalogue"),
      fetch(`/seo-data/${encodeURIComponent(page)}.json`, { headers: { accept: "application/json" } }).then((r) => (r.ok ? r.json() : null)),
    ]);
    const designs: Array<{ _id: string; slug: string; finish?: string }> = seo?.buyBox?.designs || seo?._buyBox?.designs || [];
    if (designs.some((d) => d.slug === productSlug)) return `/${page}?${new URLSearchParams({ design: productSlug })}`;
    const cat = await loadCatalogue();
    const me: any = cat?.products.find((p: any) => p.slug === productSlug);
    const code = String(me?.design || "").trim().toUpperCase();
    if (code) {
      const byId = new Map((cat?.products || []).map((p: any) => [p._id, p]));
      const same = designs.filter((d) => String((byId.get(d._id) as any)?.design || "").trim().toUpperCase() === code);
      const pick = same.find((d) => String((byId.get(d._id) as any)?.finishType || "").toLowerCase() === String(me?.finishType || "").toLowerCase()) || same[0];
      if (pick) return `/${page}?${new URLSearchParams({ design: pick.slug })}`;
    }
  } catch { /* the page alone is still the right place */ }
  return `/${page}`;
}
