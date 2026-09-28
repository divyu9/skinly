import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, PlayIcon, ShoppingBagIcon, Volume2Icon, XIcon } from "lucide-react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { db } from "@/lib/firebase";
import { sizedImage } from "@/lib/image-cdn";
import { Skeleton } from "@/components/ui/skeleton.tsx";

/**
 * Homepage › Customer videos, as shoppable reels.
 *
 * The card in view plays muted, like a feed (preload none until then, and
 * not at all for data-saver or reduced-motion visitors); each carries the
 * product it shows, one tap from its page. Tapping a card opens it full
 * screen with sound, swipe or arrows to the next, and the product under it.
 * A video that is only an Instagram link opens on Instagram — a browser
 * cannot play a reel's page. The product links use the listing's slug; the
 * old /products/detail?id= links took a redirect first.
 */

type Video = { _id: string; videoUrl?: string; thumbnailUrl?: string; productId?: string; ctaText?: string; sourceType?: string };
type Product = { slug: string; title: string; image: string };

const playable = (url?: string) => !!url && !/instagram\.com|youtube\.com|youtu\.be/i.test(url);
const quiet = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || (navigator as any).connection?.saveData === true);

function useProducts(videos: Video[] | undefined) {
  const [byId, setById] = useState<Record<string, Product>>({});
  useEffect(() => {
    const ids = [...new Set((videos || []).map((v) => v.productId).filter(Boolean) as string[])];
    if (!ids.length) return;
    let live = true;
    Promise.all(ids.map((id) => getDoc(doc(db, "products", id)).then((d) => [id, d.data()] as const).catch(() => [id, null] as const)))
      .then((rows) => {
        const out: Record<string, Product> = {};
        for (const [id, p] of rows) {
          if (!p?.slug || p.status === "archived") continue;
          const img = p.images?.[0];
          out[id] = { slug: p.slug, title: String(p.title || ""), image: String(typeof img === "string" ? img : img?.url || "") };
        }
        if (live) setById(out);
      });
    return () => { live = false; };
  }, [videos]);
  return byId;
}

/** One card: plays muted while it is on screen. */
function ReelCard({ v, product, onOpen }: { v: Video; product?: Product; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const canPlay = playable(v.videoUrl) && !quiet();
  useEffect(() => {
    const el = ref.current;
    if (!el || !canPlay) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting && e.intersectionRatio >= 0.6), { threshold: [0, 0.6] });
    io.observe(el);
    return () => io.disconnect();
  }, [canPlay]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (inView) el.play().catch(() => {});
    else el.pause();
  }, [inView]);

  const external = !playable(v.videoUrl) && v.videoUrl;
  const body = (
    <>
      {canPlay ? (
        <video ref={ref} src={v.videoUrl} poster={v.thumbnailUrl} muted loop playsInline preload={inView ? "auto" : "none"}
          className="absolute inset-0 h-full w-full object-cover" />
      ) : v.thumbnailUrl ? (
        <img src={v.thumbnailUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : <div className="absolute inset-0 bg-ink/80" />}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
      <span className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-black/45 text-white">
        {external ? <ExternalLinkIcon className="size-4" /> : canPlay ? <Volume2Icon className="size-4" /> : <PlayIcon className="size-4 fill-current" />}
      </span>
    </>
  );

  return (
    <div className="relative aspect-[9/16] w-[180px] flex-shrink-0 snap-start overflow-hidden rounded-2xl border-2 border-ink bg-ink shadow-[3px_3px_0_0_var(--ink)] md:w-[220px]">
      {external ? (
        <a href={String(v.videoUrl)} target="_blank" rel="noreferrer" className="absolute inset-0" aria-label="Watch on Instagram">{body}</a>
      ) : (
        <button type="button" onClick={onOpen} className="absolute inset-0 text-left" aria-label="Watch with sound">{body}</button>
      )}
      {product && (
        <Link to={`/products/${product.slug}`}
          className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-xl border-2 border-ink bg-background/95 p-1.5 pr-2.5 shadow-sm">
          {product.image && <img src={sizedImage(product.image, 96)} alt="" className="size-9 shrink-0 rounded-lg object-cover" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-bold leading-tight">{product.title}</span>
            <span className="block text-[10px] font-extrabold text-brand-deep">Shop this →</span>
          </span>
        </Link>
      )}
    </div>
  );
}

/** Full screen, with sound; swipe or arrows move through the videos. */
function Player({ list, start, products, onClose }: { list: Video[]; start: number; products: Record<string, Product>; onClose: () => void }) {
  const [i, setI] = useState(start);
  const touch = useRef<number | null>(null);
  const v = list[i];
  const product = v.productId ? products[v.productId] : undefined;
  const go = (d: number) => setI((n) => Math.min(list.length - 1, Math.max(0, n + d)));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90" role="dialog" aria-modal="true"
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}>
      <button aria-label="Close" onClick={onClose} className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-white/15 text-white"><XIcon className="size-5" /></button>
      {i > 0 && <button aria-label="Previous" onClick={() => go(-1)} className="absolute left-2 z-10 hidden size-11 place-items-center rounded-full bg-white/15 text-white md:grid"><ChevronLeftIcon className="size-6" /></button>}
      {i < list.length - 1 && <button aria-label="Next" onClick={() => go(1)} className="absolute right-2 z-10 hidden size-11 place-items-center rounded-full bg-white/15 text-white md:grid"><ChevronRightIcon className="size-6" /></button>}
      <div className="relative flex h-full max-h-[92vh] w-full max-w-[420px] flex-col">
        <video key={v._id} src={v.videoUrl} poster={v.thumbnailUrl} autoPlay controls playsInline loop className="min-h-0 w-full flex-1 rounded-2xl bg-black object-contain" />
        {product && (
          <Link to={`/products/${product.slug}`} onClick={onClose}
            className="mx-2 mt-3 flex items-center gap-3 rounded-2xl border-2 border-ink bg-card p-2.5">
            {product.image && <img src={sizedImage(product.image, 120)} alt="" className="size-12 shrink-0 rounded-lg object-cover" />}
            <span className="min-w-0 flex-1 text-sm font-bold leading-tight">{product.title}</span>
            <span className="flex shrink-0 items-center gap-1 rounded-xl border-2 border-ink bg-brand px-3 py-2 text-xs font-extrabold text-brand-foreground">
              <ShoppingBagIcon className="size-3.5" /> Shop
            </span>
          </Link>
        )}
        <p className="mt-2 text-center text-[11px] text-white/60">{i + 1} / {list.length} · swipe for more</p>
      </div>
    </div>
  );
}

export function UgcVideos() {
  const videos = useQuery(api.homepage.getActiveUgcVideos) as Video[] | undefined | null;
  const products = useProducts(videos || undefined);
  const [open, setOpen] = useState<number | null>(null);

  // Same height as the loaded section, so nothing shifts when it arrives.
  if (videos === undefined) {
    return (
      <section className="container mx-auto px-4 py-10 md:py-12">
        <Skeleton className="mb-2 h-9 w-72" />
        <Skeleton className="mb-5 h-5 w-80 max-w-full" />
        <div className="flex gap-3 overflow-hidden pb-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[9/16] w-[180px] flex-shrink-0 rounded-2xl md:w-[220px]" />)}
        </div>
      </section>
    );
  }
  if (!videos || !videos.length) return null;

  const inApp = videos.filter((v) => playable(v.videoUrl));
  return (
    <section className="container mx-auto space-y-5 px-4 py-10 md:py-12">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight md:text-4xl">See it on real devices</h2>
        <div className="mt-1.5 h-1 w-12 rounded-full bg-brand" />
        <p className="mt-2 text-sm text-muted-foreground md:text-base">Videos from customers and our studio — tap one for sound, shop what you see.</p>
      </div>
      <div className="relative -mx-4 px-4">
        <div data-drag-scroll className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 md:gap-4">
          {videos.map((v) => (
            <ReelCard key={v._id} v={v} product={v.productId ? products[v.productId] : undefined}
              onOpen={() => { const k = inApp.findIndex((x) => x._id === v._id); if (k >= 0) setOpen(k); }} />
          ))}
        </div>
      </div>
      {open !== null && inApp[open] && <Player list={inApp} start={open} products={products} onClose={() => setOpen(null)} />}
    </section>
  );
}
