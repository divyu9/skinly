import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { loadCatalogue, type CatalogueProduct } from "@/lib/catalogue";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";

export type PickedLine = {
  productId: string; productTitle: string; productImage: string; productSlug: string;
  variant: string; sku: string; price: number;
};

/**
 * Pick a product and one of its variants, from the built catalogue (no
 * Firestore round trips while typing). Searches title, slug and design code
 * ("R-76"), so a customer's "the blue topography one" or a SKU both find it.
 */
export function ProductLinePicker({ onPick, onCancel }: { onPick: (l: PickedLine) => void; onCancel: () => void }) {
  const [products, setProducts] = useState<CatalogueProduct[] | null>(null);
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<CatalogueProduct | null>(null);
  const [variantId, setVariantId] = useState("");
  useEffect(() => { void loadCatalogue().then((c) => setProducts(c?.products || [])); }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!products || needle.length < 2) return [];
    return products.filter((p) =>
      p.title.toLowerCase().includes(needle) || p.slug.includes(needle) ||
      String(p.design || "").toLowerCase() === needle ||
      p.variants.some((v) => String(v.sku || "").toLowerCase().includes(needle))
    ).slice(0, 12);
  }, [products, q]);

  if (chosen) {
    const v = chosen.variants.find((x) => x._id === variantId);
    return (
      <div className="space-y-2 rounded-lg border-2 border-ink/20 p-3">
        <p className="text-sm font-semibold">{chosen.title}</p>
        <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
          <option value="">Choose variant…</option>
          {chosen.variants.map((x) => (
            <option key={x._id} value={x._id}>{x.title} · ₹{x.price}{x.sku ? ` · ${x.sku}` : ""}{x.inventoryQuantity <= 0 ? " · out of stock" : ""}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button size="sm" disabled={!v} onClick={() => v && onPick({
            productId: chosen._id, productTitle: chosen.title, productSlug: chosen.slug,
            productImage: chosen.images?.[0]?.url || "", variant: v.title, sku: v.sku || "", price: v.price,
          })}>Use this</Button>
          <Button size="sm" variant="outline" onClick={() => setChosen(null)}>Back</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border-2 border-ink/20 p-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search design name, code (R-76) or SKU" className="pl-8" />
      </div>
      {!products && <p className="text-xs text-muted-foreground">Loading catalogue…</p>}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {results.map((p) => (
          <button key={p._id} type="button" onClick={() => { setChosen(p); setVariantId(p.variants.length === 1 ? p.variants[0]._id : ""); }}
            className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-muted">
            <img src={p.images?.[0]?.url} alt="" className="size-10 shrink-0 rounded object-cover" loading="lazy" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.title}</span>
              <span className="block text-[11px] text-muted-foreground">{[p.design, p.gadgetCategory, `${p.variants.length} variants`].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
        ))}
        {products && q.trim().length >= 2 && !results.length && <p className="text-xs text-muted-foreground">Nothing matches.</p>}
      </div>
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
    </div>
  );
}
