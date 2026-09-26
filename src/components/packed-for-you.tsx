import { useState } from "react";
import { CameraIcon, XIcon } from "lucide-react";
import { responsiveImg } from "@/lib/image-cdn";
import { cutFor, useOrderRealPhotos } from "@/lib/real-photos";

/**
 * "Packed for you": the photos taken of this order at the packing table
 * (Admin › Orders, the camera button beside each item), on the customer's own
 * order page. Nothing shows until there is a photo. A tap opens it full size.
 */
export function PackedForYou({ orderNumber }: { orderNumber?: string | null }) {
  const photos = useOrderRealPhotos(orderNumber);
  const [open, setOpen] = useState<string | null>(null);
  if (!photos.length) return null;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-brand/40 bg-brand/5">
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-background">
          <CameraIcon className="size-4" />
        </span>
        <div>
          <h2 className="text-base font-bold">Packed for you</h2>
          <p className="text-sm text-muted-foreground">
            {photos.length > 1 ? "Photos" : "A photo"} of your skin{photos.length > 1 ? "s" : ""}, taken as we packed your order.
          </p>
        </div>
      </div>
      <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-4">
        {photos.map((p) => (
          <button key={p._id} type="button" onClick={() => setOpen(p.imageUrl)}
            className="w-40 shrink-0 snap-start overflow-hidden rounded-xl border bg-card text-left sm:w-48">
            <div className="aspect-[4/5] bg-muted">
              <img {...responsiveImg(p.imageUrl, [240, 360, 480], "192px")} alt={`${p.productTitle}, ${cutFor(p).toLowerCase()}`}
                loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </div>
            <div className="p-2">
              <p className="text-xs font-bold text-brand-deep">{cutFor(p)}</p>
              <p className="line-clamp-1 text-[11px] text-muted-foreground">{p.productTitle}</p>
            </div>
          </button>
        ))}
      </div>
      {open && (
        <div role="dialog" aria-modal="true" onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <button type="button" aria-label="Close" onClick={() => setOpen(null)}
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/90 text-black">
            <XIcon className="size-5" />
          </button>
          <img src={open} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </section>
  );
}
