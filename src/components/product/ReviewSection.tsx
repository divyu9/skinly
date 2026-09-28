import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { BadgeCheckIcon, StarIcon, XIcon } from "lucide-react";
import { sizedImage } from "@/lib/image-cdn";
import { timeAgo } from "@/lib/public-reviews";

interface Review {
  _id: string;
  _creationTime?: number;
  createdAt?: number;
  device?: string;
  userName?: string;
  city?: string;
  verified?: boolean;
  rating: number;
  title?: string;
  comment?: string;
  imageUrls?: string[];
  videoUrls?: string[];
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

interface ReviewSectionProps {
  reviews?: Review[];
}

function StarRating({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center">
      {[...Array(5)].map((_, i) => (
        <StarIcon
          key={i}
          className={`size-${size} ${
            i < Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  );
}

function RatingBar({ rating, count, total }: { rating: number; count: number; total: number }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-3">{rating}</span>
      <StarIcon className="size-3 fill-yellow-400 text-yellow-400" />
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-muted-foreground w-8">{count}</span>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const [open, setOpen] = useState<string | null>(null);
  const when = timeAgo(Number(review.createdAt || review._creationTime || 0));
  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold">{review.userName || "Verified buyer"}</span>
            {review.city && <span className="text-sm text-muted-foreground">· {review.city}</span>}
          </div>
          {review.verified !== false && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <BadgeCheckIcon className="size-3.5" /> Verified Buyer
            </span>
          )}
        </div>
        {when && <span className="shrink-0 text-xs text-muted-foreground">{when}</span>}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <StarRating rating={review.rating} />
        {review.device && <span className="text-xs text-muted-foreground">on {review.device}</span>}
      </div>
      {review.title && <h4 className="mt-2 font-semibold">{review.title}</h4>}
      {review.comment && <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{review.comment}</p>}

      {review.imageUrls && review.imageUrls.length > 0 && (
        <div data-drag-scroll className="mt-3 flex gap-2 overflow-x-auto">
          {review.imageUrls.map((url, idx) => (
            <button key={idx} type="button" onClick={() => setOpen(url)} className="shrink-0 overflow-hidden rounded-xl border border-ink/10">
              <img src={sizedImage(url, 240)} alt={`Customer photo ${idx + 1}`} loading="lazy" className="size-24 object-cover transition-transform hover:scale-105 md:size-28" />
            </button>
          ))}
        </div>
      )}
      {review.videoUrls && review.videoUrls.length > 0 && (
        <div data-drag-scroll className="mt-3 flex gap-2 overflow-x-auto">
          {review.videoUrls.map((url, idx) => <video key={idx} src={url} controls className="h-40 rounded-lg" />)}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button aria-label="Close" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/15 text-white"><XIcon className="size-5" /></button>
          <img src={sizedImage(open, 1000)} alt="Customer photo" className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}

/*
 * Reviews come only from buyers, through the link sent after delivery
 * (src/pages/review). There is no "Post A Review" here any more: it let any
 * signed-in account post anything, and turned away guests, who are most of
 * the real buyers.
 *
 * With no reviews the section is not drawn at all. "No reviews yet — be the
 * first" under every product told each visitor that nobody had bought it.
 *
 * The figures are worked out here from the reviews themselves. The stats
 * query this used returned `count`, and this read `totalReviews`, so even a
 * product with reviews would have said it had none.
 */
export function ReviewSection({ reviews }: ReviewSectionProps) {
  const list = (reviews || []).filter((r) => Number(r.rating) >= 1);
  if (!list.length) return null;

  const total = list.length;
  const average = Math.round((list.reduce((sum, r) => sum + Number(r.rating), 0) / total) * 10) / 10;
  const distribution = [1, 2, 3, 4, 5].reduce(
    (acc, n) => ({ ...acc, [n]: list.filter((r) => Math.round(Number(r.rating)) === n).length }),
    {} as Record<number, number>,
  );
  // Photos first, then the newest.
  const sorted = [...list].sort((a, b) =>
    (b.imageUrls?.length ? 1 : 0) - (a.imageUrls?.length ? 1 : 0) ||
    (b.createdAt || b._creationTime || 0) - (a.createdAt || a._creationTime || 0));

  return (
    <div id="reviews" className="scroll-mt-24 border-t border-border pt-12">
      <h2 className="text-2xl font-bold mb-1">Customer Reviews</h2>
      <p className="mb-6 text-sm text-muted-foreground">From buyers of this design, on every phone it is cut for.</p>

      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-4xl font-bold">{average.toFixed(1)}</div>
                  <div className="flex items-center justify-center mt-1">
                    <StarRating rating={average} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {total} verified {total === 1 ? "review" : "reviews"}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <RatingBar key={rating} rating={rating} count={distribution[rating]} total={total} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {sorted.map((review) => (
            <ReviewCard key={review._id} review={review} />
          ))}
        </div>
      </div>
    </div>
  );
}
