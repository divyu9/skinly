import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, BadgeCheckIcon, StarIcon } from "lucide-react";
import { responsiveImg } from "@/lib/image-cdn";
import { ReviewPhotoViewer } from "@/components/review-photo-viewer.tsx";
import { ScrollNavButtons } from "@/components/ui/scroll-nav-buttons.tsx";
import { reviewAge, reviewStats, useApprovedReviews, type PublicReview } from "@/lib/public-reviews";

/**
 * Homepage › Customer reviews: what buyers wrote, once an admin approved it
 * (Admin › Reviews). Photo reviews lead, then the newest. Hidden until there
 * is one to show. The average covers every approved review, low ones
 * included; only the cards are the four- and five-star ones with something
 * to read or see.
 */

export function Stars({ n, size = "size-4" }: { n: number; size?: string }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={`${size} ${i <= Math.round(n) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}`} />
      ))}
    </span>
  );
}

/** One review as a card: stars and age, photo, words, then who and where. */
export function ReviewCard({ r, clamp = true }: { r: PublicReview; clamp?: boolean }) {
  const photo = r.imageUrls?.[0];
  const [viewing, setViewing] = useState(false);
  const design = String(r.productTitle || "").replace(/\s+(matte|3d|embossed|textured|glossy|tranzy)\b.*$/i, "").replace(/,.*$/, "").trim();
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-ink/15 bg-card transition-all hover:border-ink hover:shadow-[3px_3px_0_0_var(--ink)]">
      {photo && (
        /* The whole photo, never cropped (phones are tall, the box is not):
           contained over a blurred copy of itself so the box isn't empty.
           Tapping opens every photo of the review — and doesn't follow the card's link. */
        <button type="button" aria-label={`View ${r.imageUrls!.length > 1 ? `all ${r.imageUrls!.length} photos` : "photo"}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewing(true); }}
          className="relative block aspect-[4/3] w-full overflow-hidden bg-muted">
          <img src={responsiveImg(photo, [320], "40px").src} alt="" aria-hidden="true" loading="lazy"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
          <img {...responsiveImg(photo, [320, 480, 640], "300px")} alt={`${r.productTitle || "Skin"}, customer photo`}
            loading="lazy" decoding="async" className="relative h-full w-full object-contain" />
          {(r.imageUrls?.length || 0) > 1 && (
            <span className="absolute bottom-2 right-2 rounded-full border border-ink/20 bg-background/90 px-2 py-0.5 text-[10px] font-bold">+{r.imageUrls!.length - 1} photos</span>
          )}
        </button>
      )}
      {photo && (
        <ReviewPhotoViewer photos={r.imageUrls!} start={0} open={viewing} onOpenChange={setViewing}
          caption={[r.userName, r.device, design].filter(Boolean).join(" · ")} />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <Stars n={r.rating} />
          <span className="text-[11px] text-muted-foreground">{reviewAge(r)}</span>
        </div>
        {r.title && <p className="text-sm font-bold">{r.title}</p>}
        {r.comment && <p className={`text-sm leading-relaxed text-foreground/85 ${clamp ? (photo ? "line-clamp-3" : "line-clamp-6") : ""}`}>“{r.comment}”</p>}
        <div className="mt-auto space-y-0.5 pt-2 text-xs">
          <p className="flex flex-wrap items-center gap-x-1.5 font-bold">
            {r.userName || "Verified buyer"}
            {r.city && <span className="font-normal text-muted-foreground">· {r.city}</span>}
          </p>
          <p className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
            <BadgeCheckIcon className="size-3.5" /> Verified Buyer
          </p>
          {(design || r.device) && <p className="line-clamp-1 text-muted-foreground">{[design, r.device].filter(Boolean).join(" · ")}</p>}
          {r.productSlug && (
            <span className="inline-flex items-center gap-0.5 pt-1 font-bold text-brand-deep">Shop this design <ArrowRightIcon className="size-3" /></span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CustomerReviews() {
  const all = useApprovedReviews();
  const { cards, stats } = useMemo(() => {
    const list = all || [];
    const good = list
      .filter((r) => r.rating >= 4 && (r.comment?.trim() || r.imageUrls?.length))
      .sort((a, b) => Number(!!b.imageUrls?.length) - Number(!!a.imageUrls?.length) || Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .slice(0, 16);
    return { cards: good, stats: reviewStats(list) };
  }, [all]);

  if (!cards.length) return null;

  return (
    <section className="container mx-auto space-y-5 px-4 py-10 md:py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight md:text-4xl">What our customers say</h2>
          <div className="mt-1.5 h-1 w-12 rounded-full bg-brand" />
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground md:text-base">
            <Stars n={stats.averageRating} />
            <b className="text-foreground">{stats.averageRating.toFixed(1)}</b> from {stats.total} verified {stats.total === 1 ? "buyer" : "buyers"}
          </p>
        </div>
        {cards.length > 2 && <ScrollNavButtons containerId="customer-reviews-scroll" />}
      </div>
      <div className="relative -mx-4 px-4">
        <div id="customer-reviews-scroll" data-drag-scroll className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
          {cards.map((r) => (
            <div key={r._id} className="w-[260px] shrink-0 snap-start md:w-[290px]">
              {r.productSlug ? <Link to={`/products/${r.productSlug}`} className="block h-full"><ReviewCard r={r} /></Link> : <ReviewCard r={r} />}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center">
        <Link to="/reviews" className="sticker-sm sticker-press inline-flex items-center gap-1.5 rounded-full bg-card px-5 py-2 text-sm font-bold">
          Read all reviews <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </section>
  );
}
