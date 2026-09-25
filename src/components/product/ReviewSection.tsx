import { Card, CardContent } from "@/components/ui/card.tsx";
import { StarIcon } from "lucide-react";

interface Review {
  _id: string;
  _creationTime?: number;
  createdAt?: number;
  device?: string;
  userName: string;
  verified: boolean;
  rating: number;
  title: string;
  comment: string;
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
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">{review.userName}</span>
              {review.verified && (
                <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded">
                  Verified Purchase
                </span>
              )}
            </div>
            <StarRating rating={review.rating} />
          </div>
          <span className="text-sm text-muted-foreground">
            {new Date(review.createdAt || review._creationTime || 0).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
        
        {review.device && <p className="text-xs text-muted-foreground mb-2">On {review.device}</p>}
        {review.title && <h4 className="font-semibold mb-2">{review.title}</h4>}
        <p className="text-sm text-muted-foreground mb-3">{review.comment}</p>
        
        {/* Review Media */}
        {((review.imageUrls && review.imageUrls.length > 0) ||
          (review.videoUrls && review.videoUrls.length > 0)) && (
          <div className="space-y-3 mt-4">
            {review.imageUrls && review.imageUrls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {review.imageUrls.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Review image ${idx + 1}`}
                    className="h-32 w-32 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(url, '_blank')}
                  />
                ))}
              </div>
            )}
            {review.videoUrls && review.videoUrls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {review.videoUrls.map((url, idx) => (
                  <video
                    key={idx}
                    src={url}
                    controls
                    className="h-40 rounded-lg"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
    <div className="border-t border-border pt-12">
      <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>

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
