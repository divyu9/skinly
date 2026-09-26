import { useCallback, useEffect, useState } from "react";
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { responsiveImg } from "@/lib/image-cdn";
import { cutFor, useOrderRealPhotos } from "@/lib/real-photos";
import { ScrollNavButtons } from "@/components/ui/scroll-nav-buttons.tsx";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";

/**
 * "Packed for you": the photos taken of this order at the packing table
 * (Admin › Orders, the camera button beside each item), on the customer's own
 * order page. Nothing shows until there is a photo. The strip scrolls by
 * swipe or its arrows; a tap opens the photo full size, where left and right
 * (swipe, arrows or keys) go through the rest.
 */
export function PackedForYou({ orderNumber }: { orderNumber?: string | null }) {
  const photos = useOrderRealPhotos(orderNumber);
  const [open, setOpen] = useState<number | null>(null);
  const many = photos.length > 1;
  const stripId = "packed-for-you-strip";

  const step = useCallback((d: number) => {
    setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length));
  }, [photos.length]);
  const swipe = useSwipeNavigation(() => step(1), () => step(-1));

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  if (!photos.length) return null;
  const current = open === null ? null : photos[open];

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-brand/40 bg-brand/5">
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-background">
          <CameraIcon className="size-4" />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-bold">Packed for you</h2>
          <p className="text-sm text-muted-foreground">
            {many ? `${photos.length} photos` : "A photo"} of your skin{many ? "s" : ""}, taken as we packed your order.
            {many && " Swipe to see them all."}
          </p>
        </div>
        {many && <ScrollNavButtons containerId={stripId} />}
      </div>
      <div id={stripId} className="no-scrollbar flex touch-pan-x snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-4">
        {photos.map((p, i) => (
          <button key={p._id} type="button" onClick={() => setOpen(i)}
            className="w-40 shrink-0 snap-start overflow-hidden rounded-xl border bg-card text-left sm:w-48">
            <div className="aspect-[4/5] bg-muted">
              <img {...responsiveImg(p.imageUrl, [240, 360, 480], "192px")} alt={`${p.productTitle}, ${cutFor(p).toLowerCase()}`}
                loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
            </div>
            <div className="p-2">
              <p className="text-xs font-bold text-brand-deep">{cutFor(p)}</p>
              <p className="line-clamp-1 text-[11px] text-muted-foreground">{p.productTitle}</p>
            </div>
          </button>
        ))}
      </div>

      {current && (
        <div role="dialog" aria-modal="true" aria-label="Packing photo" onClick={() => setOpen(null)} {...swipe}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
          <button type="button" aria-label="Close" onClick={() => setOpen(null)}
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/90 text-black">
            <XIcon className="size-5" />
          </button>
          <img src={current.imageUrl} alt={`${current.productTitle}, ${cutFor(current).toLowerCase()}`} draggable={false}
            className="max-h-[80vh] max-w-full select-none rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <p className="mt-3 text-center text-sm text-white" onClick={(e) => e.stopPropagation()}>
            <b>{cutFor(current)}</b> · {current.productTitle}{many && <span className="text-white/70"> · {open! + 1} / {photos.length}</span>}
          </p>
          {many && (
            <>
              <button type="button" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); step(-1); }}
                className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black">
                <ChevronLeftIcon className="size-6" />
              </button>
              <button type="button" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); step(1); }}
                className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black">
                <ChevronRightIcon className="size-6" />
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
