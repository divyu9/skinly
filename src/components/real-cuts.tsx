import { Link } from "react-router-dom";
import { CameraIcon } from "lucide-react";
import { responsiveImg } from "@/lib/image-cdn";
import { ScrollNavButtons } from "@/components/ui/scroll-nav-buttons.tsx";
import { cutFor, photoLink, useLatestRealPhotos } from "@/lib/real-photos";

/**
 * Homepage › Real cuts: photos of skins cut for real orders, taken at the
 * packing table. Each names the phone it was cut for and opens its listing
 * with that phone already chosen. Hidden until there is a photo to show.
 */
export function RealCuts() {
  const photos = useLatestRealPhotos(20);
  if (!photos?.length) return null;

  return (
    <section className="container mx-auto px-4 py-12">
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-6">
          <div className="flex-1 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Fresh off the cutter</h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Real skins from real orders, each cut for one exact phone. Tap one to get yours.
            </p>
          </div>
          {photos.length > 3 && <ScrollNavButtons containerId="real-cuts-scroll" />}
        </div>

        <div id="real-cuts-scroll" className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
          {photos.map((p) => (
            <Link key={p._id} to={photoLink(p)} className="group w-[220px] flex-shrink-0 snap-start md:w-[260px]">
              <div className="overflow-hidden rounded-2xl border-2 border-ink/15 bg-card transition-shadow group-hover:shadow-xl">
                <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                  <img
                    {...responsiveImg(p.imageUrl, [240, 360, 480, 640], "(min-width: 768px) 260px, 220px")}
                    alt={`${p.productTitle}, ${cutFor(p).toLowerCase()}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold shadow-sm">
                    <CameraIcon className="size-3" /> Real photo
                  </span>
                </div>
                <div className="space-y-0.5 p-3">
                  <p className="text-sm font-bold text-brand-deep">{cutFor(p)}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{p.productTitle}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
