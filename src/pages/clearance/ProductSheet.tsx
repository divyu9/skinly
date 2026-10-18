import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ShoppingCartIcon, XIcon, ZapIcon } from "lucide-react";
import { sizedImage } from "@/lib/image-cdn";
import { cn } from "@/lib/utils.ts";

export type SheetPiece = {
  id: string; productTitle: string; productImage?: string; images?: string[];
  variant: string; coverage?: string | null; lensModel?: string | null;
  price: number; originalPrice: number; condition?: string; description?: string; amazonUrl?: string;
  pieces: unknown[];
};

/**
 * One clearance product, opened from its card: every photo in a swipeable
 * strip (scroll-snap, so a finger swipe or the arrows), a counter and dots,
 * thumbnails, the full details and Buy now / Add to cart. A bottom sheet on a
 * phone, a centred panel on a wider screen. The card showed only the first
 * photo and nothing said there were more.
 */
export function ProductSheet({ p, device, coverageLabel, busy, added, onBuy, onAdd, onClose }: {
  p: SheetPiece;
  device: string;
  coverageLabel: string;
  busy: boolean;
  added: boolean;
  onBuy: () => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const imgs = p.images?.length ? p.images : p.productImage ? [p.productImage] : [];
  const [at, setAt] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const left = p.pieces.length;
  const off = p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;

  // Close on Escape; keep the page behind from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(at + 1);
      if (e.key === "ArrowLeft") go(at - 1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (i: number) => {
    const n = Math.max(0, Math.min(imgs.length - 1, i));
    const el = strip.current;
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = strip.current;
    if (el && el.clientWidth) setAt(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={p.productTitle} onClick={onClose}>
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-background sm:max-w-3xl sm:flex-row sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        {/* Photos */}
        <div className="relative shrink-0 bg-muted sm:w-1/2">
          <div ref={strip} onScroll={onScroll} className="no-scrollbar flex aspect-square w-full snap-x snap-mandatory overflow-x-auto">
            {imgs.map((u, i) => (
              <div key={u + i} className="h-full w-full shrink-0 snap-center">
                <img src={sizedImage(u, 900)} alt={`${p.productTitle} — photo ${i + 1} of ${imgs.length}`} loading={i < 2 ? "eager" : "lazy"} className="size-full object-contain" />
              </div>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/60 text-white">
            <XIcon className="size-5" />
          </button>
          {off > 0 && (
            <span className="absolute left-3 top-3 rounded-full border-2 border-ink bg-heart px-2 py-0.5 text-xs font-extrabold text-white">{off}% off</span>
          )}
          {imgs.length > 1 && (
            <>
              <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white">{at + 1} / {imgs.length}</span>
              <button type="button" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Previous photo"
                className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow disabled:opacity-0">
                <ChevronLeftIcon className="size-5" />
              </button>
              <button type="button" onClick={() => go(at + 1)} disabled={at === imgs.length - 1} aria-label="Next photo"
                className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow disabled:opacity-0">
                <ChevronRightIcon className="size-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
                {imgs.map((_, i) => (
                  <span key={i} className={cn("h-1.5 rounded-full transition-all", i === at ? "w-4 bg-white" : "w-1.5 bg-white/60")} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Details */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {imgs.length > 1 && (
              <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {imgs.map((u, i) => (
                  <button key={u + i} type="button" onClick={() => go(i)} aria-label={`Photo ${i + 1}`}
                    className={cn("size-14 shrink-0 overflow-hidden rounded-lg border-2", i === at ? "border-ink" : "border-transparent opacity-70")}>
                    <img src={sizedImage(u, 120)} alt="" className="size-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            <h3 className="text-base font-extrabold leading-snug">{p.productTitle}</h3>
            {device && <p className="text-sm font-semibold text-brand">Cut for {device}</p>}
            <div className="flex flex-wrap items-center gap-1.5">
              {p.condition && <span className="rounded-full bg-sunny px-2 py-0.5 text-xs font-bold text-ink">{p.condition}</span>}
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", left <= 1 ? "bg-heart/15 text-heart" : "bg-muted text-foreground")}>
                {left <= 1 ? "Only 1 left" : `${left} left`}
              </span>
            </div>
            {[p.variant && !/^default/i.test(p.variant) ? p.variant : "", coverageLabel, p.lensModel ? `Lens: ${p.lensModel}` : ""].filter(Boolean).length > 0 && (
              <p className="text-xs text-muted-foreground">
                {[p.variant && !/^default/i.test(p.variant) ? p.variant : "", coverageLabel, p.lensModel ? `Lens: ${p.lensModel}` : ""].filter(Boolean).join(" · ")}
              </p>
            )}
            {p.description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{p.description}</p>}
            {p.amazonUrl && (
              <a href={p.amazonUrl} target="_blank" rel="nofollow sponsored noopener noreferrer" className="inline-block text-xs font-semibold text-primary underline underline-offset-2">
                Compare price on Amazon ↗
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 border-t-2 border-ink/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mr-auto">
              <p className="text-xl font-extrabold leading-none">₹{p.price}</p>
              {p.originalPrice > p.price && <p className="text-xs text-muted-foreground line-through">₹{p.originalPrice}</p>}
            </div>
            <button type="button" disabled={busy || added} onClick={onAdd} aria-label="Add to cart"
              className="grid size-11 place-items-center rounded-xl border-2 border-ink/20 disabled:opacity-50">
              <ShoppingCartIcon className="size-5" />
            </button>
            <button type="button" disabled={busy} onClick={onBuy}
              className="sticker-sm sticker-press flex items-center gap-1.5 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-brand-foreground disabled:opacity-60">
              <ZapIcon className="size-4" /> Buy now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
