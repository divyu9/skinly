import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { SearchIcon, ShoppingCartIcon, TagIcon, ZapIcon } from "lucide-react";
import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { useAuth } from "@/hooks/use-auth";
import { useGuestCart } from "@/hooks/use-guest-cart";
import { sizedImage } from "@/lib/image-cdn";
import { searchRows } from "@/lib/search-match";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { cn } from "@/lib/utils.ts";

type Piece = {
  id: string; productId: string; productTitle: string; productSlug?: string; productImage?: string;
  variant: string; phoneBrand: string; phoneModel: string; coverage?: string | null; lensModel?: string | null;
  price: number; originalPrice: number; createdAt: number;
};

const coverageLabel = (c?: string | null) => (c === "only_back" ? "Back only" : c === "full_body_wrap" ? "Full body wrap" : "");
const device = (p: Piece) => {
  const b = (p.phoneBrand || "").trim(), m = (p.phoneModel || "").trim();
  return b && m.toLowerCase().startsWith(b.toLowerCase()) ? m : [b, m].filter(Boolean).join(" ");
};

/**
 * Clearance: skins that came back from the courier, each already printed and
 * cut for one device (functions/src/clearance.ts). One piece per card, for
 * that device only — no model to choose — at the clearance price. The piece
 * is held for the order that buys it, so two people cannot buy the same one.
 */
export default function ClearancePage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [items, setItems] = useState<Piece[] | null>(null);
  const [error, setError] = useState("");
  const [brand, setBrand] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const { user } = useAuth();
  const { guestCart, addToGuestCart } = useGuestCart();
  const addToCartMutation = useMutation(api.cart.addToCart);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
        const res: any = await httpsCallable(functions, "listClearance")({});
        if (live) setItems(res.data?.items || []);
      } catch (e: any) {
        if (live) setError(e?.message || "Could not load the clearance sale");
      }
    })();
    return () => { live = false; };
  }, []);

  const brands = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of items || []) if (p.phoneBrand) m.set(p.phoneBrand, (m.get(p.phoneBrand) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  }, [items]);

  const shown = useMemo(() => {
    let list = (items || []).filter((p) => brand === "all" || p.phoneBrand === brand);
    if (q.trim()) list = searchRows(list, q, (p) => device(p), (p) => `${device(p)} ${p.productTitle} ${p.variant}`);
    return list;
  }, [items, brand, q]);

  const inCart = (id: string) => (guestCart || []).some((i: any) => i.clearanceItemId === id);

  const add = async (p: Piece, buyNow: boolean) => {
    setBusy(p.id);
    const line: any = {
      productId: p.productId, productTitle: p.productTitle, productImage: p.productImage || "",
      variant: p.variant, price: p.price, quantity: 1,
      phoneBrand: p.phoneBrand, phoneModel: p.phoneModel,
      ...(p.coverage ? { coverage: p.coverage } : {}),
      ...(p.lensModel ? { lensModel: p.lensModel } : {}),
      clearanceItemId: p.id,
    };
    try {
      if (user) await addToCartMutation(line);
      else if (!inCart(p.id)) addToGuestCart(line);
      if (buyNow) navigate("/checkout");
      else toast.success(`Added — ${p.productTitle} for ${device(p)}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not add it to the cart");
    } finally {
      setBusy("");
    }
  };

  const chip = (id: string, label: string) => (
    <button key={id} type="button" onClick={() => setBrand(id)}
      className={cn("shrink-0 rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition-colors",
        brand === id ? "border-ink bg-brand text-brand-foreground shadow-[2px_2px_0_0_var(--ink)]" : "border-ink/15 bg-card hover:border-ink/40")}>
      {label}
    </button>
  );

  return (
    <div className="halftone min-h-screen">
      <Helmet>
        <title>Clearance Sale: Ready-Cut Skins at Low Prices | GoSkinly</title>
        <meta name="description" content="Clearance sale on GoSkinly skins already printed and cut for a specific phone, laptop or camera. One piece each, at a clearance price — if it fits your device, it's yours." />
        <link rel="canonical" href="https://goskinly.com/clearance" />
      </Helmet>
      <AnnouncementBar />
      <MobileHeader onMenuClick={() => setMenuOpen(true)} />
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />

      <main className="container mx-auto px-4 pb-16 pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sunny px-3 py-1 text-xs font-extrabold text-ink">
            <TagIcon className="size-3.5" /> One piece each · while they last
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">Clearance sale</h1>
          <p className="mt-3 text-muted-foreground md:text-lg">
            Skins already printed and cut for one exact device. If yours is listed, it's ready to ship — at a clearance price.
          </p>
        </div>

        {items && items.length > 0 && (
          <>
            <div className="mx-auto mt-6 max-w-md">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find your device, e.g. iphone 15, s24fe, a7iii"
                  className="w-full rounded-full border-2 border-ink/15 bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus:border-ink" />
              </div>
            </div>
            {brands.length > 1 && (
              <div data-drag-scroll className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 md:justify-center">
                {chip("all", `All (${items.length})`)}
                {brands.map((b) => chip(b, b))}
              </div>
            )}
          </>
        )}

        {error && <p className="mt-10 text-center text-sm text-heart">{error}</p>}
        {!items && !error && <p className="mt-10 text-center text-sm text-muted-foreground">Loading…</p>}
        {items && items.length === 0 && (
          <p className="mx-auto mt-10 max-w-md text-center text-muted-foreground">Nothing on clearance right now. Check back soon — pieces are added as they come in.</p>
        )}
        {items && items.length > 0 && shown.length === 0 && (
          <p className="mt-10 text-center text-muted-foreground">No clearance piece for that device right now.</p>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => {
            const off = p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
            const added = inCart(p.id);
            return (
              <div key={p.id} className="tile flex flex-col overflow-hidden rounded-2xl">
                <div className="relative aspect-square bg-muted">
                  {p.productImage && (
                    <img src={sizedImage(p.productImage, 480)} alt={`${p.productTitle} for ${device(p)}`} loading="lazy"
                      className="size-full object-cover" />
                  )}
                  {off > 0 && (
                    <span className="absolute left-2 top-2 rounded-full border-2 border-ink bg-heart px-2 py-0.5 text-xs font-extrabold text-white">{off}% off</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p className="line-clamp-2 text-sm font-bold leading-snug">{p.productTitle}</p>
                  <p className="text-xs font-semibold text-brand">Cut for {device(p)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {[p.variant && !/^default/i.test(p.variant) ? p.variant : "", coverageLabel(p.coverage), p.lensModel ? `Lens: ${p.lensModel}` : ""].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-auto pt-1">
                    <span className="text-lg font-extrabold">₹{p.price}</span>
                    {p.originalPrice > p.price && <span className="ml-1.5 text-xs text-muted-foreground line-through">₹{p.originalPrice}</span>}
                  </p>
                  <div className="flex gap-1.5">
                    <button type="button" disabled={busy === p.id} onClick={() => add(p, true)}
                      className="sticker-sm sticker-press flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand px-2 py-2 text-xs font-bold text-brand-foreground disabled:opacity-60">
                      <ZapIcon className="size-3.5" /> Buy now
                    </button>
                    <button type="button" disabled={busy === p.id || added} onClick={() => add(p, false)} aria-label="Add to cart"
                      className="grid size-9 place-items-center rounded-xl border-2 border-ink/20 disabled:opacity-50">
                      <ShoppingCartIcon className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
          Each piece is printed and cut for the device shown and fits only that model. One of each; as soon as someone buys it, it's gone.
          Clearance pieces are final sale except for damage in transit.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
