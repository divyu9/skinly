import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { ChevronLeftIcon, ChevronRightIcon, ImagesIcon, MessageCircleIcon, SearchIcon, ShoppingCartIcon, TagIcon, XIcon, ZapIcon } from "lucide-react";
import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { useAuth } from "@/hooks/use-auth";
import { useGuestCart } from "@/hooks/use-guest-cart";
import { sizedImage } from "@/lib/image-cdn";
import { searchRows } from "@/lib/search-match";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { ProductSheet } from "./ProductSheet.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { cn } from "@/lib/utils.ts";

type Piece = {
  id: string; productId: string; productTitle: string; productSlug?: string; productImage?: string;
  variant: string; phoneBrand: string; phoneModel: string; coverage?: string | null; lensModel?: string | null;
  price: number; originalPrice: number; createdAt: number;
  images?: string[]; condition?: string; description?: string; amazonUrl?: string; personal?: boolean; sold?: boolean; videoUrl?: string; pinned?: boolean;
};

/**
 * A clearance card's video: muted and looping, played only while the card is
 * on screen (a grid of playing videos would eat a phone's data and battery).
 */
function CardVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { v.play().catch(() => {}); } else { v.pause(); }
    }, { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <>
      {/* Absolute: a tall clip's own height would otherwise stretch the square card. */}
      <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" className="absolute inset-0 size-full object-cover" />
      <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">▶ Video</span>
    </>
  );
}

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
  const [designs, setDesigns] = useState<{ title: string; slug: string; price: number; image: string }[]>([]);
  const [error, setError] = useState("");
  const [brand, setBrand] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  // The photo viewer: which piece, which photo.
  const [view, setView] = useState<{ p: Piece & { pieces: Piece[]; soldOut?: boolean }; i: number } | null>(null);
  const { user } = useAuth();
  const { guestCart, addToGuestCart } = useGuestCart();
  const addToCartMutation = useMutation(api.cart.addToCart);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
        const res: any = await httpsCallable(functions, "listClearance")({});
        if (live) { setItems(res.data?.items || []); setDesigns(res.data?.designs || []); }
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

  // Alike pieces (same listing, variant, device, coverage and lens) are
  // one card with a count: ten pairs of the same glasses showed as ten cards.
  const groups = useMemo(() => {
    const m = new Map<string, Piece[]>();
    for (const p of items || []) {
      // Not by price: the Minion charger cover sold one at ₹99, was repriced to ₹89, and showed
      // as a "Sold out" card beside the ₹89 one. The card shows the price of the pieces still for sale.
      const k = [p.productId, p.variant, p.phoneBrand, p.phoneModel, p.coverage || "", p.lensModel || ""].join("|");
      m.set(k, [...(m.get(k) || []), p]);
    }
    // `pieces` are the ones still for sale; a kind with none left is a sold-out card, last.
    return [...m.values()]
      .map((ps) => {
        const open = ps.filter((x) => !x.sold);
        // First put up within two days (restocks copy the piece, so the oldest piece dates the kind).
        const listedAt = Math.min(...ps.map((x) => Number(x.createdAt) || Date.now()));
        return { ...(open[0] || ps[0]), pieces: open, soldOut: open.length === 0, listedAt, pinned: ps.some((x) => x.pinned), isNew: open.length > 0 && Date.now() - listedAt < 2 * 86400e3 };
      })
      // Pinned first (the Mystery Box), then newest listing first — by when the kind was first
      // put up, so a restock doesn't jump the queue — and sold-out cards last.
      .sort((a, b) => Number(a.soldOut) - Number(b.soldOut) || Number(b.pinned && !b.soldOut) - Number(a.pinned && !a.soldOut) || b.listedAt - a.listedAt)
      // "Just listed" on the four newest only: a whole photo batch put up the day before had
      // every card tagged, which says nothing. Not on the pinned card, which is always first.
      .map((g, _i, all) => {
        const newest = all.filter((x) => x.isNew && !x.pinned).slice(0, 4);
        return { ...g, isNew: newest.includes(g) };
      });
  }, [items]);

  const shown = useMemo(() => {
    let list = groups.filter((p) => brand === "all" || p.phoneBrand === brand);
    if (q.trim()) list = searchRows(list, q, (p) => device(p), (p) => `${device(p)} ${p.productTitle} ${p.variant}`);
    return list;
  }, [groups, brand, q]);

  const inCart = (id: string) => (guestCart || []).some((i: any) => i.clearanceItemId === id);
  /** A piece of this kind not already in the cart, or null when every one is. */
  const freePiece = (g: { pieces: Piece[] }) => g.pieces.find((x) => !inCart(x.id)) || null;

  const add = async (g: Piece & { pieces: Piece[] }, buyNow: boolean) => {
    const p = freePiece(g);
    if (!p) { if (buyNow) navigate("/checkout"); else toast.info("All of these are already in your cart"); return; }
    setBusy(g.id);
    const line: any = {
      productId: p.productId, productTitle: p.productTitle, productImage: p.productImage || "",
      variant: p.variant, price: p.price, quantity: 1,
      phoneBrand: p.phoneBrand, phoneModel: p.phoneModel,
      ...(p.coverage ? { coverage: p.coverage } : {}),
      ...(p.lensModel ? { lensModel: p.lensModel } : {}),
      clearanceItemId: p.id,
      ...(p.personal ? { clearancePersonal: true } : {}),
    };
    try {
      if (user) await addToCartMutation(line);
      else if (!inCart(p.id)) addToGuestCart(line);
      if (buyNow) navigate("/checkout");
      else toast.success(device(p) ? `Added — ${p.productTitle} for ${device(p)}` : `Added — ${p.productTitle}`);
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

        {designs.length > 0 && (
          <section className="mt-8">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-extrabold">Designs on sale — choose your model</h2>
              <span className="text-xs text-muted-foreground">Cut for your exact device</span>
            </div>
            <div data-drag-scroll className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
              {designs.map((d) => (
                <Link key={d.slug} to={`/products/${d.slug}`} className="tile w-40 shrink-0 overflow-hidden rounded-2xl">
                  <div className="aspect-square bg-muted">
                    {d.image && <img src={sizedImage(d.image, 320)} alt={d.title} loading="lazy" className="size-full object-cover" />}
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-xs font-bold leading-snug">{d.title.replace(/\s*[-–(]?\s*\(?[LM]-\d+\)?\s*[-–]?/g, " ").replace(/\s+/g, " ").trim()}</p>
                    <p className="mt-1 text-sm font-extrabold text-brand">₹{d.price}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

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
                {chip("all", `All (${items.filter((x) => !x.sold).length})`)}
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
            const left = p.pieces.length;
            const added = !freePiece(p);
            return (
              <div key={p.id} className={cn("tile relative flex flex-col overflow-hidden rounded-2xl", p.soldOut && "opacity-60 grayscale")}>
                {p.soldOut && (
                  <span className="absolute left-1/2 top-[30%] z-10 -translate-x-1/2 -rotate-6 rounded-lg border-2 border-ink bg-ink px-3 py-1 text-sm font-extrabold uppercase tracking-wide text-background shadow">Sold out</span>
                )}
                <button type="button" onClick={() => setView({ p, i: 0 })} className="relative block aspect-square w-full bg-muted" aria-label={`See photos of ${p.productTitle}`}>
                  {(p.images?.length || 0) > 1 && (
                    <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">
                      <ImagesIcon className="size-3" /> {p.images!.length}
                    </span>
                  )}
                  {p.videoUrl ? (
                    <CardVideo src={p.videoUrl} poster={p.productImage ? sizedImage(p.productImage, 480) : undefined} />
                  ) : p.productImage && (
                    <img src={sizedImage(p.productImage, 480)} alt={device(p) ? `${p.productTitle} for ${device(p)}` : p.productTitle} loading="lazy"
                      className="size-full object-cover" />
                  )}
                  {(off > 0 || p.isNew) && (
                    <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
                      {p.isNew && <span className="rounded-full border-2 border-ink bg-sunny px-2 py-0.5 text-xs font-extrabold text-ink">Just listed</span>}
                      {off > 0 && <span className="rounded-full border-2 border-ink bg-heart px-2 py-0.5 text-xs font-extrabold text-white">{off}% off</span>}
                    </span>
                  )}
                </button>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <button type="button" onClick={() => setView({ p, i: 0 })} className="text-left">
                    <p className="line-clamp-2 text-sm font-bold leading-snug">{p.productTitle}</p>
                  </button>
                  {device(p) && <p className="text-xs font-semibold text-brand">Cut for {device(p)}</p>}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.condition && <span className="rounded-full bg-sunny px-2 py-0.5 text-[11px] font-bold text-ink">{p.condition}</span>}
                    {p.soldOut ? (
                      <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-background">Sold out</span>
                    ) : (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", left <= 1 ? "bg-heart/15 text-heart" : "bg-muted text-foreground")}>
                        {/* The real count when it is low; a deep pile just reads "In stock". */}
                        {left <= 1 ? "Only 1 left" : left <= 5 ? `${left} left` : "In stock"}
                      </span>
                    )}
                  </div>
                  {p.description && <p className="whitespace-pre-line text-[11px] leading-snug text-muted-foreground">{p.description}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    {[p.variant && !/^default/i.test(p.variant) ? p.variant : "", coverageLabel(p.coverage), p.lensModel ? `Lens: ${p.lensModel}` : ""].filter(Boolean).join(" · ")}
                  </p>
                  {p.amazonUrl && (
                    <a href={p.amazonUrl} target="_blank" rel="nofollow sponsored noopener noreferrer"
                      className="w-fit text-[11px] font-semibold text-primary underline underline-offset-2">
                      Compare price on Amazon ↗
                    </a>
                  )}
                  <p className="mt-auto pt-1">
                    <span className="text-lg font-extrabold">₹{p.price}</span>
                    {p.originalPrice > p.price && <span className="ml-1.5 text-xs text-muted-foreground line-through">₹{p.originalPrice}</span>}
                  </p>
                  {p.soldOut ? (
                    <p className="rounded-xl border-2 border-ink/15 py-2 text-center text-xs font-bold text-muted-foreground">Sold out</p>
                  ) : (
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
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {view && (
          <ProductSheet
            p={view.p}
            device={device(view.p)}
            coverageLabel={coverageLabel(view.p.coverage)}
            busy={busy === view.p.id}
            added={!freePiece(view.p)}
            soldOut={(view.p as any).soldOut === true}
            onBuy={() => add(view.p, true)}
            onAdd={() => add(view.p, false)}
            onClose={() => setView(null)}
          />
        )}

        <div className="mx-auto mt-10 max-w-2xl space-y-2 rounded-2xl border-2 border-ink/15 bg-card p-4 text-sm">
          <p className="font-bold">Before you buy</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Gadgets here are <b className="text-foreground">open box and unused</b> — bought by us or sent by brands for our review videos.</li>
            <li><b className="text-foreground">No bill or warranty</b> comes with these products.</li>
            <li>Want to see it first? Ask for more photos, details or a video on <a href="https://wa.me/919761011121" className="font-semibold text-primary underline">WhatsApp support</a> before we dispatch.</li>
            <li>Clearance items are <b className="text-foreground">non-returnable and non-refundable</b>.</li>
          </ul>
          <a href="https://wa.me/919761011121?text=Hi%2C%20I%20have%20a%20question%20about%20a%20clearance%20product" className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
            <MessageCircleIcon className="size-4" /> Ask on WhatsApp
          </a>
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground">
          Each piece is printed and cut for the device shown and fits only that model. One of each; as soon as someone buys it, it's gone.
          Clearance items are final sale: non-returnable and non-refundable.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
