import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, BadgeCheckIcon, QuoteIcon, StarIcon } from "lucide-react";
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

/*
 * A review without a photo gets its words where the photo would be: a block
 * in one of the packaging's colours with the quote set large. Laid out like
 * a photo card, the words sat in the top corner of a tall white card with
 * nothing above them — "Very cool" and a blank 250px.
 */
const QUOTE_TONES = ["bg-blush/45", "bg-sunny/45", "bg-brand/20"];
const toneFor = (id: string) => QUOTE_TONES[[...String(id)].reduce((n, c) => n + c.charCodeAt(0), 0) % QUOTE_TONES.length];

/** One review as a card: stars and age, photo (or the quote, large), words, then who and where. */
export function ReviewCard({ r, clamp = true, showShop = true }: { r: PublicReview; clamp?: boolean; showShop?: boolean }) {
  const photo = r.imageUrls?.[0];
  const quote = !photo && r.comment?.trim() ? r.comment.trim() : "";
  // Short praise reads as a headline; a paragraph steps down so it still fits.
  const quoteSize = quote.length <= 40 ? "text-2xl md:text-[26px]" : quote.length <= 110 ? "text-lg" : "text-[15px]";
  // Stars and nothing else: the rating is the content, said as a rating —
  // never words put in the buyer's mouth.
  const ratingOnly = !photo && !quote && !r.title;
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
      {quote && (
        /* Fills the card down to the buyer's name, so a short review leaves no
           blank stretch beside its photo-card neighbours. */
        <div className={`relative flex w-full flex-1 flex-col overflow-hidden border-b-2 border-ink/10 px-5 pb-5 pt-4 ${clamp ? "min-h-[220px]" : "min-h-[180px]"} ${toneFor(r._id)}`}>
          <QuoteIcon aria-hidden className="pointer-events-none absolute -right-2 -top-2 size-24 fill-ink/10 text-transparent" />
          <div className="relative flex items-center justify-between gap-2">
            <Stars n={r.rating} />
            <span className="text-[11px] font-medium text-ink/60">{reviewAge(r)}</span>
          </div>
          {r.title && <p className="relative mt-3 text-sm font-bold text-ink/80">{r.title}</p>}
          <p className={`relative my-auto pt-4 font-extrabold leading-snug tracking-tight text-ink ${quoteSize} ${clamp ? "line-clamp-6" : ""}`}>“{quote}”</p>
        </div>
      )}
      {ratingOnly && (
        <div className={`relative flex w-full flex-1 flex-col items-center justify-center gap-2 overflow-hidden border-b-2 border-ink/10 px-5 py-6 text-center ${clamp ? "min-h-[220px]" : "min-h-[180px]"} ${toneFor(r._id)}`}>
          <span className="absolute right-3 top-3 text-[11px] font-medium text-ink/60">{reviewAge(r)}</span>
          <p className="text-5xl font-extrabold leading-none tracking-tight text-ink">{Number(r.rating).toFixed(1)}</p>
          <Stars n={r.rating} size="size-6" />
          <p className="mt-1 text-sm font-bold text-ink/80">Rated {Math.round(r.rating)} out of 5</p>
          {(design || r.device) && (
            <p className="line-clamp-2 max-w-[90%] text-xs text-ink/60">for {[design, r.device].filter(Boolean).join(" on ")}</p>
          )}
        </div>
      )}
      {photo && (
        <ReviewPhotoViewer photos={r.imageUrls!} start={0} open={viewing} onOpenChange={setViewing}
          caption={[r.userName, r.device, design].filter(Boolean).join(" · ")} />
      )}
      <div className={`flex flex-col gap-2 p-4 ${quote || ratingOnly ? "" : "flex-1"}`}>
        {!quote && !ratingOnly && (
          <div className="flex items-center justify-between gap-2">
            <Stars n={r.rating} />
            <span className="text-[11px] text-muted-foreground">{reviewAge(r)}</span>
          </div>
        )}
        {r.title && !quote && <p className="text-sm font-bold">{r.title}</p>}
        {r.comment && !quote && <p className={`text-sm leading-relaxed text-foreground/85 ${clamp ? "line-clamp-3" : ""}`}>“{r.comment}”</p>}
        <div className={`mt-auto space-y-0.5 text-xs ${quote || ratingOnly ? "" : "pt-2"}`}>
          <p className="flex flex-wrap items-center gap-x-1.5 font-bold">
            {r.userName || "Verified buyer"}
            {r.city && <span className="font-normal text-muted-foreground">· {r.city}</span>}
          </p>
          <p className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
            <BadgeCheckIcon className="size-3.5" /> Verified Buyer
          </p>
          {(design || r.device) && !ratingOnly && <p className="line-clamp-1 text-muted-foreground">{[design, r.device].filter(Boolean).join(" · ")}</p>}
          {r.productSlug && showShop && (
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
