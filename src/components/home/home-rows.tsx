import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, FlameIcon, SmartphoneIcon, SparklesIcon } from "lucide-react";
import { responsiveImg } from "@/lib/image-cdn";
import { loadCatalogue, loadHomeProducts, type CatalogueProduct, type HomeRows } from "@/lib/catalogue";
import { readActiveDevice, type ActiveDevice } from "@/lib/active-device";
import { brandInScope } from "@/lib/device-fit";
import { designOfListing } from "@/lib/smart-setup";
import { ScrollNavButtons } from "@/components/ui/scroll-nav-buttons.tsx";
import { cn } from "@/lib/utils.ts";

/**
 * The homepage's product rows: Top Picks (Bestsellers · New drops · For your
 * phone), Shop by vibe, and Matching sets.
 *
 * The rows are picked at build time from the whole catalogue and real sales
 * (scripts/prerender.mjs homeRows → /data/home.json): one listing per design,
 * gadgets mixed, in stock. They replace rows built from hand-kept tags, which
 * showed eight cases and glass as "Bestsellers" and 28 Mac mini skins in a
 * row as "Most Trendy". Only "For your phone" needs the full catalogue, and
 * only once that tab is opened.
 */

type Home = { rows: HomeRows; byId: Map<string, CatalogueProduct> };
let homeOnce: Promise<Home | null> | null = null;
function useHome() {
  const [home, setHome] = useState<Home | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    (homeOnce ||= loadHomeProducts().then((h) => (h?.rows ? { rows: h.rows, byId: new Map(h.products.map((p) => [p._id, p])) } : null)))
      .then((h) => live && setHome(h));
    return () => { live = false; };
  }, []);
  return home;
}

/** The device the shopper chose (not a user-agent guess). */
function useMyDevice() {
  const [d, setD] = useState<ActiveDevice | null>(null);
  useEffect(() => {
    const a = readActiveDevice();
    setD(a && a.isConfirmed !== false ? a : null);
  }, []);
  return d;
}

const GADGET: Record<string, string> = {
  phone: "Phone", laptop: "Laptop", tablet: "Tablet", charger: "Charger", controller: "Controller", console: "Console",
  "mac-mini": "Mac mini", camera: "Camera", "action-camera": "Action cam", drone: "Drone", gimbals: "Gimbal", lens: "Lens",
};
const FINISH: Record<string, string> = { matte: "Matte", embossed: "3D Textured", "3d": "3D Textured", transparent: "Tranzy", glossy: "Gloss", leather: "Leather" };

/** A listing's page, with the shopper's device already chosen when it fits. */
function hrefFor(p: CatalogueProduct, device: ActiveDevice | null) {
  if (device && p.productCategory === "skin" && (p.gadgetCategory || "phone") === (device.category || "phone") && brandInScope(p, device.brand)) {
    return `/products/${p.slug}?${new URLSearchParams({ brand: device.brand, model: device.model })}`;
  }
  return `/products/${p.slug}`;
}

export function HomeProductCard({ p, device, badge }: { p: CatalogueProduct; device: ActiveDevice | null; badge?: ReactNode }) {
  const v = [...(p.variants || [])].filter((x) => x.price > 0).sort((a, b) => a.price - b.price)[0];
  const price = v?.price || 0;
  const mrp = Number(v?.compareAtPrice) || 0;
  const off = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const skin = p.productCategory === "skin";
  const chip = skin ? GADGET[String(p.gadgetCategory)] || "Skin" : "Accessory";
  const finish = skin ? FINISH[String(p.finishType || "").toLowerCase()] : "";
  return (
    <Link to={hrefFor(p, device)} className="group w-[164px] flex-shrink-0 snap-start md:w-[212px]">
      <div className="overflow-hidden rounded-2xl border-2 border-ink/15 bg-card transition-all group-hover:-translate-y-0.5 group-hover:border-ink group-hover:shadow-[3px_3px_0_0_var(--ink)]">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {p.images?.[0]?.url && (
            <img
              {...responsiveImg(p.images[0].url, [200, 320, 440], "(min-width: 768px) 212px, 164px")}
              alt={p.title} loading="lazy" decoding="async" width={212} height={212}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          <span className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold shadow-sm">{chip}</span>
          <div className="absolute left-2 top-2 flex flex-col gap-1">{badge}</div>
          {off > 0 && (
            <span className="absolute right-2 top-2 rounded-full border-2 border-ink bg-sunny px-1.5 py-0.5 text-[10px] font-extrabold text-ink">{off}% OFF</span>
          )}
        </div>
        <div className="space-y-1 p-2.5 md:p-3">
          <h3 className="line-clamp-2 min-h-[2.4em] text-[12.5px] font-semibold leading-tight md:text-[13px]">{p.title}</h3>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-extrabold">₹{price.toLocaleString("en-IN")}</span>
            {off > 0 && <span className="text-[11px] text-muted-foreground line-through">₹{mrp.toLocaleString("en-IN")}</span>}
            {finish && <span className="ml-auto truncate text-[10px] font-semibold text-muted-foreground">{finish}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

function RowHeader({ title, sub, scrollId, show }: { title: string; sub?: string; scrollId: string; show: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight md:text-4xl">{title}</h2>
        <div className="mt-1.5 h-1 w-12 rounded-full bg-brand" />
        {sub && <p className="mt-2 text-sm text-muted-foreground md:text-base">{sub}</p>}
      </div>
      {show && <ScrollNavButtons containerId={scrollId} />}
    </div>
  );
}

function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: ReactNode }>; value: T; onChange: (t: T) => void }) {
  return (
    <div data-drag-scroll className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors",
            value === t.id ? "border-ink bg-brand text-brand-foreground shadow-[2px_2px_0_0_var(--ink)]" : "border-ink/15 bg-card text-foreground/80 hover:border-ink/40",
          )}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Strip({ id, items, device, badgeFor }: { id: string; items: CatalogueProduct[]; device: ActiveDevice | null; badgeFor?: (i: number) => ReactNode }) {
  return (
    <div className="relative -mx-4 px-4">
      <div id={id} data-drag-scroll className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 md:gap-4">
        {items.map((p, i) => <HomeProductCard key={p._id} p={p} device={device} badge={badgeFor?.(i)} />)}
      </div>
    </div>
  );
}

function StripSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden pb-4 md:gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="w-[164px] flex-shrink-0 md:w-[212px]">
          <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

const ids = (list: string[], byId: Map<string, CatalogueProduct>) => list.map((i) => byId.get(i)).filter(Boolean) as CatalogueProduct[];

// ─── Top Picks ───────────────────────────────────────────────────────────────

type PickTab = "best" | "new" | "mine";

export function TopPicksRows({ title = "Top Picks For You" }: { title?: string }) {
  const home = useHome();
  const device = useMyDevice();
  const [tab, setTab] = useState<PickTab>("best");
  const [mine, setMine] = useState<CatalogueProduct[] | null>(null);

  // "For your phone": skins that fit the saved device, one per design, best-sellers first.
  useEffect(() => {
    if (tab !== "mine" || !device || mine) return;
    loadCatalogue().then((c) => {
      if (!c) { setMine([]); return; }
      const cat = device.category || "phone";
      const rank = new Map((home?.rows.bestsellers || []).map((id, i) => [id, i]));
      const fit = c.products.filter((p) =>
        p.productCategory === "skin" && (p.gadgetCategory || "phone") === cat && brandInScope(p, device.brand) &&
        p.images?.[0]?.url && (p.variants || []).some((v) => v.price > 0 && v.inventoryQuantity > 0));
      const byDesign = new Map<string, CatalogueProduct>();
      for (const p of fit) {
        const k = designOfListing(p) || p._id;
        const cur = byDesign.get(k);
        const specific = (x: CatalogueProduct) => (x.modelBrands || []).length > 0;
        if (!cur || (specific(p) && !specific(cur))) byDesign.set(k, p);
      }
      setMine([...byDesign.values()].sort((a, b) => (rank.get(a._id) ?? 999) - (rank.get(b._id) ?? 999) || (b._creationTime || 0) - (a._creationTime || 0)).slice(0, 16));
    });
  }, [tab, device, mine, home]);

  const items = useMemo(() => {
    if (!home) return [];
    if (tab === "best") return ids(home.rows.bestsellers, home.byId);
    if (tab === "new") return ids(home.rows.newDrops, home.byId);
    return mine || [];
  }, [home, tab, mine]);

  if (home === null) return null; // an older build without rows: nothing to show rather than a broken row

  const tabs: Array<{ id: PickTab; label: ReactNode }> = [
    { id: "best", label: <><FlameIcon className="size-4" /> Bestsellers</> },
    { id: "new", label: <><SparklesIcon className="size-4" /> New drops</> },
    ...(device ? [{ id: "mine" as const, label: <><SmartphoneIcon className="size-4" /> For your {device.model}</> }] : []),
  ];

  return (
    <section className="container mx-auto space-y-5 px-4 py-10 md:py-12">
      <RowHeader
        title={title}
        sub={tab === "best" ? "What customers are ordering right now — every gadget, every style." : tab === "new" ? "Fresh designs, just added." : `Designs cut for your ${device?.model}.`}
        scrollId="top-picks-scroll" show={items.length > 3}
      />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {home === undefined || (tab === "mine" && !mine) ? <StripSkeleton /> : (
        <Strip id="top-picks-scroll" items={items} device={device}
          badgeFor={tab === "best" ? (i) => (i < 3 ? <span className="rounded-full border-2 border-ink bg-card px-1.5 py-0.5 text-[10px] font-extrabold">#{i + 1}</span> : null) : undefined} />
      )}
      <div className="flex justify-center">
        <Link to="/products" className="sticker-sm sticker-press inline-flex items-center gap-1.5 rounded-full bg-card px-5 py-2 text-sm font-bold">
          Browse all designs <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </section>
  );
}

// ─── Shop by vibe ────────────────────────────────────────────────────────────

export function VibeRows({ title = "Shop by vibe", subtitle }: { title?: string; subtitle?: string }) {
  const home = useHome();
  const device = useMyDevice();
  const [slug, setSlug] = useState<string | null>(null);
  if (!home || !home.rows.vibes.length) return null;
  const vibe = home.rows.vibes.find((v) => v.slug === slug) || home.rows.vibes[0];
  const items = ids(vibe.ids, home.byId);
  return (
    <section className="container mx-auto space-y-5 px-4 py-10 md:py-12">
      <RowHeader title={title} sub={subtitle || "Pick a vibe — each one across phones, laptops and more."} scrollId="vibe-scroll" show={items.length > 3} />
      <Tabs tabs={home.rows.vibes.map((v) => ({ id: v.slug, label: v.name }))} value={vibe.slug} onChange={setSlug} />
      <Strip id="vibe-scroll" items={items} device={device} />
      <div className="flex justify-center">
        <Link to={`/${vibe.slug}`} className="sticker-sm sticker-press inline-flex items-center gap-1.5 rounded-full bg-card px-5 py-2 text-sm font-bold">
          See all {vibe.name} designs <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </section>
  );
}

// ─── Matching sets ───────────────────────────────────────────────────────────

export function MatchingSets() {
  const home = useHome();
  const device = useMyDevice();
  if (!home || !home.rows.sets.length) return null;
  const sets = home.rows.sets.map((s) => ({ ...s, items: ids(s.ids, home.byId) })).filter((s) => s.items.length >= 3);
  if (!sets.length) return null;
  return (
    <section className="container mx-auto space-y-5 px-4 py-10 md:py-12">
      <RowHeader title="Matching sets" sub="One design on your phone, laptop and charger — the setup that looks planned." scrollId="sets-scroll" show={sets.length > 2} />
      <div className="relative -mx-4 px-4">
        <div id="sets-scroll" data-drag-scroll className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
          {sets.map((s) => {
            const [lead, ...rest] = s.items;
            const name = lead.title.replace(/\s+(matte|3d|embossed|textured|glossy|tranzy)\b.*$/i, "").replace(/,.*$/, "").trim();
            const total = s.items.reduce((sum, p) => sum + Math.min(...(p.variants || []).map((v) => v.price).filter((n) => n > 0)), 0);
            return (
              <div key={s.design} className="w-[280px] flex-shrink-0 snap-start overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-[3px_3px_0_0_var(--ink)] md:w-[320px]">
                <Link to={hrefFor(lead, device)} className="relative block aspect-[4/3] overflow-hidden bg-muted">
                  {lead.images?.[0]?.url && <img {...responsiveImg(lead.images[0].url, [320, 480, 640], "320px")} alt={lead.title} loading="lazy" className="h-full w-full object-cover" />}
                  <span className="absolute left-2 top-2 rounded-full border-2 border-ink bg-sunny px-2 py-0.5 text-[11px] font-extrabold text-ink">{s.items.length} gadgets</span>
                </Link>
                <div className="space-y-2.5 p-3">
                  <p className="truncate text-sm font-extrabold">{name}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {rest.slice(0, 3).map((p) => (
                      <Link key={p._id} to={hrefFor(p, device)} className="group block">
                        <div className="aspect-square overflow-hidden rounded-lg border border-ink/15 bg-muted">
                          {p.images?.[0]?.url && <img {...responsiveImg(p.images[0].url, [120, 200], "96px")} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
                        </div>
                        <p className="mt-1 text-center text-[10px] font-bold text-muted-foreground">{GADGET[String(p.gadgetCategory)] || "Skin"}</p>
                      </Link>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Whole set from <b className="text-foreground">₹{total.toLocaleString("en-IN")}</b></span>
                    <Link to={hrefFor(lead, device)} className="inline-flex items-center gap-1 text-xs font-bold text-brand-deep hover:underline">
                      Shop the set <ArrowRightIcon className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
