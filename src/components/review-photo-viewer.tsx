import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { productImageUrl, responsiveImg } from "@/lib/image-cdn";

/**
 * A review's photos, full size, one at a time: arrows, thumbnails, keyboard.
 * Cards show only the first photo (whole, not cropped); this is how a buyer
 * sees the rest.
 */
export function ReviewPhotoViewer({ photos, start, open, onOpenChange, caption }: {
  photos: string[]; start: number; open: boolean; onOpenChange: (o: boolean) => void; caption?: string;
}) {
  const [i, setI] = useState(start);
  useEffect(() => { if (open) setI(start); }, [open, start]);
  const n = photos.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  useEffect(() => {
    if (!open || n < 2) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!n) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-2 border-ink bg-background p-3 sm:p-4 [&>button]:hidden">
        <DialogTitle className="sr-only">{caption || "Customer photos"}</DialogTitle>
        <div className="relative flex items-center justify-center rounded-xl bg-muted">
          <img src={productImageUrl(photos[i], 960)} alt={`${caption || "Customer photo"} ${i + 1} of ${n}`}
            className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain" />
          {n > 1 && (
            <>
              <button type="button" aria-label="Previous photo" onClick={() => go(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-background/90 p-1.5 shadow-[2px_2px_0_0_var(--ink)]">
                <ChevronLeftIcon className="size-5" />
              </button>
              <button type="button" aria-label="Next photo" onClick={() => go(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-background/90 p-1.5 shadow-[2px_2px_0_0_var(--ink)]">
                <ChevronRightIcon className="size-5" />
              </button>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-bold">{i + 1} / {n}</span>
            </>
          )}
          <button type="button" aria-label="Close" onClick={() => onOpenChange(false)}
            className="absolute right-2 top-2 rounded-full border-2 border-ink bg-background/90 p-1">
            <XIcon className="size-4" />
          </button>
        </div>
        {n > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, k) => (
              <button key={p + k} type="button" onClick={() => setI(k)} aria-label={`Photo ${k + 1}`}
                className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${k === i ? "border-ink" : "border-transparent opacity-70 hover:opacity-100"}`}>
                <img src={responsiveImg(p, [160], "64px").src} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        {caption && <p className="mt-2 text-center text-xs text-muted-foreground">{caption}</p>}
      </DialogContent>
    </Dialog>
  );
}
