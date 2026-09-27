import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadCatalogue, type CatalogueProduct } from "@/lib/catalogue";
import { brandInScope } from "@/lib/device-fit";
import { designNameOf } from "@/lib/pack-list";
import { ProductThumb } from "@/components/product-thumb.tsx";
import { ScrollNavButtons } from "@/components/ui/scroll-nav-buttons.tsx";

/**
 * "Aurora Arches for your other gadgets": the same design on every other
 * kind of device it is made for, one card per gadget, most-owned first.
 *
 * This used to be the head of the "Check out these" row, but the product
 * document carries no design code, so the row never found any and showed
 * other phone designs only. It reads the catalogue, where every listing has
 * one. A charger (or any per-brand listing) is the one for the shopper's
 * brand where the page knows it.
 */

const ORDER = ["laptop", "tablet", "charger", "phone", "controller", "console", "mac-mini", "camera", "action-camera", "drone", "gimbals", "lens"];
const LABEL: Record<string, string> = {
  phone: "Phone", laptop: "Laptop", tablet: "Tablet", charger: "Charger", controller: "Controller", console: "Console",
  "mac-mini": "Mac mini", camera: "Camera", "action-camera": "Action camera", drone: "Drone", gimbals: "Gimbal", lens: "Lens",
};

export function SameDesignOtherGadgets({ productId, brand }: { productId: string; brand?: string | null }) {
  const [rows, setRows] = useState<{ name: string; items: CatalogueProduct[] } | null>(null);

  useEffect(() => {
    let live = true;
    loadCatalogue().then((c) => {
      if (!live || !c) return;
      const self = c.products.find((p) => p._id === productId);
      if (!self?.design || self.productCategory !== "skin") { setRows(null); return; }
      const family = c.products.filter((p) =>
        p.design === self.design && p._id !== productId && p.productCategory === "skin" && p.status !== "draft" &&
        p.gadgetCategory && p.gadgetCategory !== self.gadgetCategory && p.images?.[0]?.url &&
        (p.variants || []).some((v) => Number(v.price) > 0));
      const perGadget = new Map<string, CatalogueProduct>();
      for (const p of family) {
        const g = String(p.gadgetCategory);
        const cur = perGadget.get(g);
        const fits = brand ? brandInScope(p, brand) && !!(p.modelBrands || []).length : false;
        const curFits = cur && brand ? brandInScope(cur, brand) && !!(cur.modelBrands || []).length : false;
        if (!cur || (fits && !curFits)) perGadget.set(g, p);
      }
      const rank = (g?: string) => { const i = ORDER.indexOf(String(g)); return i < 0 ? 99 : i; };
      const items = [...perGadget.values()].sort((a, b) => rank(a.gadgetCategory) - rank(b.gadgetCategory));
      setRows(items.length ? { name: designNameOf(self.title), items } : null);
    });
    return () => { live = false; };
  }, [productId, brand]);

  if (!rows) return null;

  return (
    <section className="py-8 md:py-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">{rows.name} for your other gadgets</h2>
          <p className="mt-1 text-muted-foreground">Same design, cut for your laptop, charger and more — a matching set.</p>
        </div>
        {rows.items.length > 3 && <ScrollNavButtons containerId="same-design-scroll" />}
      </div>
      <div className="relative -mx-4 px-4">
        <div id="same-design-scroll" data-drag-scroll className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
          {rows.items.map((p) => {
            const prices = (p.variants || []).map((v) => Number(v.price)).filter((n) => n > 0);
            const from = prices.length ? Math.min(...prices) : 0;
            const q = brand && (p.modelBrands || []).length && brandInScope(p, brand) ? `?brand=${encodeURIComponent(brand)}` : "";
            return (
              <Link key={p._id} to={`/products/${p.slug}${q}`} className="group w-[170px] flex-shrink-0 snap-start md:w-[210px]">
                <div className="overflow-hidden rounded-2xl border-2 border-ink/15 bg-card transition-shadow group-hover:shadow-xl">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    <ProductThumb src={p.images?.[0]?.url} alt={p.title} className="transition-transform group-hover:scale-105" />
                    <span className="absolute left-2 top-2 rounded-full border-2 border-ink bg-sunny px-2 py-0.5 text-[11px] font-bold text-ink">
                      {LABEL[String(p.gadgetCategory)] || p.gadgetCategory}
                    </span>
                  </div>
                  <div className="space-y-0.5 p-3">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.title}</p>
                    {from > 0 && <p className="text-sm font-extrabold">from ₹{from}</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
