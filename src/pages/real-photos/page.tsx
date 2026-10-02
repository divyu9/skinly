import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { db } from "@/lib/firebase-db";
import { responsiveImg, sizedImage } from "@/lib/image-cdn";
import { cutFor, type RealPhoto } from "@/lib/real-photos";
import { readActiveDevice } from "@/lib/active-device";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { cn } from "@/lib/utils.ts";

/**
 * /real-photos: every photo taken at the packing table, newest first.
 *
 * The homepage row shows the latest dozen; with a photo added for every skin
 * cut, the rest were unreachable. Filter by brand (or the shopper's own
 * phone), tap for the full photo, and go to the design from there.
 */

const PAGE = 36;

function useAllRealPhotos() {
  const [photos, setPhotos] = useState<RealPhoto[] | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getDocs(query(collection(db, "realPhotos"), orderBy("createdAt", "desc"), limit(600)))
      .then((s) => {
        const rows = s.docs.map((d) => ({ _id: d.id, ...d.data() } as RealPhoto)).filter((p) => !p.hidden && p.imageUrl);
        if (live) setPhotos(rows);
      })
      .catch(() => live && setPhotos([]));
    return () => { live = false; };
  }, []);
  return photos;
}

export default function RealPhotosPage() {
  const photos = useAllRealPhotos();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);
  const device = useMemo(() => {
    const d = readActiveDevice();
    return d && d.isConfirmed !== false ? d : null;
  }, []);

  const brands = useMemo(() => {
    const n = new Map<string, number>();
    (photos || []).forEach((p) => p.brand && n.set(p.brand, (n.get(p.brand) || 0) + 1));
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  }, [photos]);

  const list = useMemo(() => {
    const all = photos || [];
    if (filter === "all") return all;
    if (filter === "mine" && device) return all.filter((p) => p.model === device.model || (p.brand === device.brand && !p.model));
    if (filter.startsWith("gadget:")) return all.filter((p) => (p.gadget || "phone") === filter.slice(7));
    return all.filter((p) => p.brand === filter);
  }, [photos, filter, device]);
  const gadgets = useMemo(() => [...new Set((photos || []).map((p) => p.gadget || "phone"))].filter((g) => g !== "phone"), [photos]);

  useEffect(() => { setShown(PAGE); }, [filter]);
  // Keys in the lightbox: ← → to move, Esc to close.
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : Math.min(list.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, list.length]);

  const chip = (id: string, label: string) => (
    <button key={id} type="button" onClick={() => setFilter(id)}
      className={cn(
        "shrink-0 rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition-colors",
        filter === id ? "border-ink bg-brand text-brand-foreground shadow-[2px_2px_0_0_var(--ink)]" : "border-ink/15 bg-card hover:border-ink/40",
      )}>
      {label}
    </button>
  );
  const current = open !== null ? list[open] : null;

  return (
    <div className="halftone min-h-screen">
      <Helmet>
        <title>Real Photos of Our Skins, Cut for Real Orders | GoSkinly</title>
        <meta name="description" content="Photos of GoSkinly skins taken while packing real orders — every design printed and cut for the customer's exact phone, laptop or gadget." />
        <link rel="canonical" href="https://goskinly.com/real-photos" />
      </Helmet>
      <AnnouncementBar />
      <MobileHeader onMenuClick={() => setMenuOpen(true)} />
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />

      <main className="container mx-auto px-4 pb-16 pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sunny px-3 py-1 text-xs font-extrabold text-ink">
            <CameraIcon className="size-3.5" /> Straight from our packing table
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">Real photos, real orders</h1>
          <p className="mt-3 text-muted-foreground md:text-lg">
            {photos ? `${photos.length} skins` : "Every skin"} printed and cut for a customer's exact device, photographed before it shipped. No renders, no filters.
          </p>
        </div>

        <div data-drag-scroll className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 md:justify-center">
          {chip("all", "All")}
          {device && chip("mine", `Your ${device.model}`)}
          {brands.slice(0, 10).map((b) => chip(b, b))}
          {gadgets.map((g) => chip(`gadget:${g}`, g[0].toUpperCase() + g.slice(1)))}
        </div>

        {photos === undefined ? (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : list.length === 0 ? (
          <p className="mt-16 text-center text-muted-foreground">No photos here yet — we add one for every skin we cut.</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {list.slice(0, shown).map((p, i) => (
                <button key={p._id} type="button" onClick={() => setOpen(i)}
                  className="group overflow-hidden rounded-2xl border-2 border-ink/15 bg-card text-left transition-all hover:border-ink hover:shadow-[3px_3px_0_0_var(--ink)]">
                  <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                    <img {...responsiveImg(p.imageUrl, [240, 360, 480], "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw")}
                      alt={`${p.productTitle}, ${cutFor(p).toLowerCase()}`} loading="lazy" decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-[13px] font-bold text-brand-deep">{cutFor(p)}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{p.productTitle}</p>
                  </div>
                </button>
              ))}
            </div>
            {shown < list.length && (
              <div className="mt-8 flex justify-center">
                <button type="button" onClick={() => setShown((n) => n + PAGE)} className="sticker-sm sticker-press rounded-full bg-card px-6 py-2.5 text-sm font-bold">
                  Show more ({list.length - shown} left)
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {current && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button aria-label="Close" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/15 text-white" onClick={() => setOpen(null)}>
            <XIcon className="size-5" />
          </button>
          {open! > 0 && (
            <button aria-label="Previous" className="absolute left-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white md:left-6"
              onClick={(e) => { e.stopPropagation(); setOpen(open! - 1); }}>
              <ChevronLeftIcon className="size-6" />
            </button>
          )}
          {open! < list.length - 1 && (
            <button aria-label="Next" className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white md:right-6"
              onClick={(e) => { e.stopPropagation(); setOpen(open! + 1); }}>
              <ChevronRightIcon className="size-6" />
            </button>
          )}
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <img src={sizedImage(current.imageUrl, 900)} alt={current.productTitle} className="max-h-[70vh] w-full rounded-2xl object-contain" />
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-card p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-brand-deep">{cutFor(current)}</p>
                <p className="truncate text-xs text-muted-foreground">{current.productTitle}</p>
              </div>
              {current.productSlug && (
                <Link to={`/products/${current.productSlug}`} className="sticker-sm sticker-press shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-brand-foreground">
                  Shop this design
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
