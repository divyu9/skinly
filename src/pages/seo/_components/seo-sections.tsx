import { lazy, Suspense, useState } from "react";
import { loadCatalogue } from "@/lib/catalogue";
import { useLiveInStock } from "@/lib/live-stock";
import { Link } from "react-router-dom";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";
import { brandGadgetLabel, oneRowPerDesign } from "@/lib/seo-pages.mjs";
import { ProductCard } from "@/components/products/ProductCard.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import type { SeoPageData } from "../use-seo-page-data";

// Its own chunk: only the top model pages carry a buy box.
const ModelBuyBox = lazy(() => import("./model-buy-box.tsx"));

/**
 * The products an SEO page is about.
 *
 * These pages used to show the first eight products in the catalogue whatever
 * the page was for, from a live listener on every product and variant. Now the
 * list is the page's own — its device, brand, finish or theme — built with the
 * site's product card, so on a model page each design shows on that model when
 * we have the photo and opens with the model already chosen.
 */
export function SeoProductsSection({ data, heading, h1, intro }: {
  data: SeoPageData | undefined; heading: string;
  /** Set on a buy-box page: the page's H1 and intro, shown in the buy box instead of a hero. */
  h1?: string; intro?: string;
}) {
  /*
   * The device this visitor already told us about.
   *
   * A page named after a style names no device, so every card fell back to a
   * stock photo and /matte-phone-skins showed the same design on a Samsung, a
   * OnePlus and an iPhone in turn — to somebody who had picked an iPhone 13
   * Pro twenty seconds earlier. The page still lists exactly the products it
   * listed, so what a crawler was served does not change; the cards simply
   * render for the phone in the reader's pocket and carry it onward in their
   * links. A saved phone against a laptop page matches no variant, so those
   * cards are left alone by the fit check that was already there.
   */
  const { device: savedDevice } = useDeviceDetection();
  /*
   * Buy-box pages: every in-stock design is on this page. The grid starts with
   * the build's 48; the rest (data.more) come from catalogue.json, loaded once
   * when the shopper asks for more or picks a finish. `finish` is shared with
   * the buy box: its "+N more" scrolls here showing that tab's finish.
   */
  const [rest, setRest] = useState<any[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [finish, setFinish] = useState<string | null>(null);
  const [limit, setLimit] = useState(48);
  // Today's stock for the designs the build put on the page (the first 48).
  const liveStock = useLiveInStock(data?.target?.kind === "model" ? (data.products || []).map((p: any) => p._id) : []);
  const ensureRest = async () => {
    if (rest || !data?.more?.length) return;
    setLoadingMore(true);
    try {
      const cat = await loadCatalogue();
      const byId = new Map((cat?.products || []).map((p) => [p._id, p]));
      setRest(data.more.map(([id, mockupUrl]) => {
        const p: any = byId.get(id);
        if (!p) return null;
        // The grid's card reads `available` and `inventory_quantity`, as the build writes them.
        const variants = (p.variants || []).map((v: any) => ({ ...v, inventory_quantity: v.inventoryQuantity, available: Number(v.inventoryQuantity) > 0 }));
        return { ...p, variants, ...(mockupUrl ? { mockupUrl } : {}) };
      }).filter(Boolean));
    } finally {
      setLoadingMore(false);
    }
  };
  const chooseFinish = (f: string | null) => {
    setFinish(f);
    setLimit(48);
    if (f) void ensureRest();
  };
  const showMore = async () => {
    await ensureRest();
    setLimit((n) => n + 48);
  };
  const toGrid = (f: string | null) => {
    chooseFinish(f);
    document.getElementById("all-designs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // A buy-box page has no hero: its H1 must paint before the data arrives.
  const h1Block = h1 ? (
    <div className="container mx-auto max-w-6xl px-3 pt-5 sm:px-4 md:pt-8">
      <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl md:text-4xl">{h1}</h1>
      {intro && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground md:text-base">{intro}</p>}
    </div>
  ) : null;

  if (data === undefined && h1) {
    return (
      <>
        {h1Block}
        <div className="container mx-auto max-w-6xl px-3 py-5 sm:px-4">
          <Skeleton className="aspect-square w-full rounded-3xl md:aspect-[2/1]" />
        </div>
      </>
    );
  }

  if (data === undefined) {
    return (
      <section className="border-y-2 border-ink/10 bg-card/60">
        <div className="container mx-auto px-3 py-10 sm:px-4 md:py-14">
          <Skeleton className="mx-auto mb-8 h-8 w-64" />
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const t = data.target;
  const onDevice = t.kind === "model" && t.brand && t.model;
  /*
   * The brand to show each design on: the page's own if it names one, else
   * whatever the reader last told us they own.
   */
  const forBrand = t.brand ?? savedDevice?.brand ?? null;
  /*
   * One card per design, from the same function the build uses.
   *
   * The prerendered pages already arrive folded, so this changes nothing for
   * them; it is here for the pages the app resolves itself, and because two
   * copies of this rule would eventually disagree.
   */
  const cards = oneRowPerDesign(data.products as any[], forBrand) as typeof data.products;
  const finishTabs = (data.buyBox?.tabs || []).filter((x) => x.key !== "best");
  /*
   * Sold-out designs go to the very end of the grid, by today's stock where it
   * has been read (the first 48) and the build's flags for the rest (owner,
   * 10 Nov 2026). The order is otherwise the build's: best sellers first.
   */
  const inStockNow = (p: any) => {
    const known = liveStock?.get(p._id);
    if (known !== undefined) return known;
    return (p.variants || []).some((v: any) => v.available || Number(v.inventory_quantity ?? v.inventoryQuantity ?? 0) > 0);
  };
  const pool = [...cards, ...(rest || [])]
    .map((p, i) => ({ p, i, ok: inStockNow(p) }))
    .sort((a, b) => Number(b.ok) - Number(a.ok) || a.i - b.i)
    .map((x) => x.p) as typeof data.products;
  const matching = finish ? pool.filter((p: any) => p.finishType === finish) : pool;
  const visible = matching.slice(0, limit);
  // How many this view has in all, loaded or not: the tab's count once a finish is chosen.
  const allCount = finish
    ? (finishTabs.find((x) => x.key === finish)?.count ?? matching.length)
    : cards.length + (data.more?.length || 0);
  const left = Math.max(0, allCount - visible.length);

  if (data.total === 0) {
    return (
      <section className="border-y-2 border-ink/10 bg-card/60">
        <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
          <h2 className="mb-3 text-2xl font-bold">No designs in this style right now</h2>
          <p className="mb-6 text-muted-foreground">
            We print in small batches and this one is between runs. Browse what is in stock today.
          </p>
          <Link
            to="/products?productType=skin"
            className="sticker sticker-press inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-bold text-brand-foreground"
          >
            Shop all skins
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
    {h1Block}
    {onDevice && data.buyBox && data.buyBox.designs.length > 0 && (
      <Suspense fallback={<div className="min-h-[520px]" aria-hidden />}>
        <ModelBuyBox data={data} hasH1={!!h1} onSeeAll={data.more?.length ? toGrid : undefined} />
      </Suspense>
    )}
    <section id="all-designs" className="scroll-mt-20 border-y-2 border-ink/10 bg-card/60">
      <div className="container mx-auto px-3 py-10 sm:px-4 md:py-14">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl text-balance">{heading}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.more?.length ? allCount : cards.length} designs
            {data.minPrice ? ` · from ₹${data.minPrice}` : ""}
            {onDevice ? ` · each cut for the ${t.model}` : " · each cut for your exact device"}
          </p>
        </div>
        {finishTabs.length > 0 && (data.more?.length || 0) > 0 && (
          <div role="tablist" aria-label="Finish" className="-mx-1 mb-5 flex justify-start gap-2 overflow-x-auto px-1 pb-1 sm:justify-center">
            {[{ key: null as string | null, label: "All", count: cards.length + (data.more?.length || 0) }, ...finishTabs].map((x) => (
              <button
                key={x.key ?? "all"}
                type="button"
                role="tab"
                aria-selected={finish === x.key}
                onClick={() => chooseFinish(x.key)}
                className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition ${finish === x.key ? "border-ink bg-ink text-background" : "border-ink/20 bg-card hover:border-ink"}`}
              >
                {x.label} <span className={finish === x.key ? "opacity-80" : "text-muted-foreground"}>{x.count}</span>
              </button>
            ))}
          </div>
        )}
        {loadingMore && visible.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Loading designs…</p>}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              brandFilter={onDevice ? t.brand! : (savedDevice?.brand ?? null)}
              modelFilter={onDevice ? t.model! : (savedDevice?.model ?? null)}
              // A brand page knows the brand even when it names no model.
              brandHint={t.brand ?? savedDevice?.brand ?? null}
              deviceCategory={onDevice ? t.gadget : null}
              autoSortOOS={false}
            />
          ))}
        </div>
        {(data.more?.length || 0) > 0 && left > 0 && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={showMore}
              disabled={loadingMore}
              className="sticker sticker-press inline-flex h-12 items-center rounded-2xl border-2 border-ink bg-sunny px-6 font-extrabold text-ink disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : `Show more designs (${left} more)`}
            </button>
          </div>
        )}
        {data.total > data.products.length && !((data.more?.length || 0) > 0 && left > 0) && (
          <div className="mt-8 text-center">
            <Link
              to={data.listing}
              className="sticker sticker-press inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-bold text-brand-foreground"
            >
              See all {data.total} in this style
            </Link>
          </div>
        )}
      </div>
    </section>
    </>
  );
}

/**
 * The models a brand page covers, each linking to its own page where one
 * exists and otherwise to the listing already filtered to it.
 */
export function SeoModelsSection({ data }: { data: SeoPageData | undefined }) {
  const models = data?.models || [];
  if (!data || models.length === 0) return null;
  const brand = data.target.brand || "";
  return (
    <section className="container mx-auto px-4 py-10 md:py-14">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">{brand} models we cut for</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Pick yours — every design is printed and cut to its exact size.
        </p>
        <ul className="flex flex-wrap justify-center gap-2">
          {models.map((m) => (
            <li key={`${m.brand}-${m.model}`}>
              <Link
                to={m.href}
                className="inline-flex rounded-full border-2 border-ink/15 bg-card px-3 py-1.5 text-sm font-semibold text-ink/80 transition-colors hover:border-ink/40"
              >
                {m.model.toLowerCase().startsWith(brand.toLowerCase()) ? m.model : `${brand} ${m.model}`}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * The brand's other shelves.
 *
 * A brand page is about whichever gadget that brand mostly makes, so Samsung's
 * page is phones and its 74 tablets appear nowhere on it. What was offered
 * instead was the whole brand grid — every competitor's name on a page
 * somebody reached by searching for this one.
 */
export function SeoBrandGadgetsSection({ data }: { data: SeoPageData | undefined }) {
  const rows = data?.brandGadgets || [];
  const brand = data?.target?.brand || "";
  // One shelf is not a hub; it is the page you are already on.
  if (!data || !brand || rows.length < 2) return null;
  return (
    <section className="container mx-auto px-4 py-10 md:py-14">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">More from {brand}</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Every {brand} gadget we cut skins for.
        </p>
        <ul className="flex flex-wrap justify-center gap-3">
          {rows.map((g: any) => (
            <li key={g.gadget}>
              <Link
                to={g.href}
                className="inline-flex flex-col items-center rounded-xl border-2 border-ink/15 bg-card px-5 py-3 transition-colors hover:border-ink/40"
              >
                {/* "Apple Phones" is a phrase nobody says; it is iPhones. */}
                <span className="text-sm font-semibold">{brandGadgetLabel(brand, g.gadget, true)}</span>
                <span className="text-xs text-muted-foreground">{g.count} models</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * A model page without a buy box: a compact hero with that phone's own
 * mockup on the right, instead of a text-only block that filled a phone's
 * whole first screen. The H1 and intro are the page's own, unchanged.
 * `image` comes from the build (scripts/prerender.mjs marks the seed), so the
 * photo has its place on the first frame and nothing moves when data arrives.
 */
export function ModelHero({ h1, intro, image, alt, gridHref }: {
  h1: string; intro?: string; image: string; alt: string; gridHref: string;
}) {
  const toGrid = (e: React.MouseEvent) => {
    const el = document.getElementById("all-designs");
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <section className="relative overflow-hidden border-b-2 border-ink/10 bg-gradient-to-br from-sunny/25 via-background to-brand/10">
      <div className="container mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_40%] items-center gap-3 px-3 py-5 sm:px-4 md:grid-cols-[minmax(0,1fr)_340px] md:gap-10 md:py-10">
        <div className="min-w-0">
          <h1 className="text-[1.6rem] font-extrabold leading-[1.1] text-balance sm:text-4xl md:text-5xl">{h1}</h1>
          {intro && <p className="mt-2 line-clamp-3 text-[13px] text-muted-foreground sm:text-base md:mt-4 md:line-clamp-none md:text-lg">{intro}</p>}
          <div className="mt-3 flex flex-wrap gap-2 md:mt-6 md:gap-3">
            <a href={gridHref} onClick={toGrid}
              className="sticker sticker-press inline-flex h-10 items-center rounded-2xl border-2 border-ink bg-brand px-4 text-sm font-extrabold text-brand-foreground md:h-12 md:px-6 md:text-base">
              Shop designs ↓
            </a>
            <Link to="/devices"
              className="hidden h-12 items-center rounded-2xl border-2 border-ink/20 bg-card px-6 font-bold md:inline-flex">
              Find your device
            </Link>
          </div>
        </div>
        <img
          src={image}
          alt={alt}
          width={900}
          height={972}
          fetchPriority="high"
          className="mx-auto h-[210px] w-auto max-w-full object-contain mix-blend-multiply md:h-[380px] dark:mix-blend-normal"
        />
      </div>
    </section>
  );
}
