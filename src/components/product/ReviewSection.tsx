import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { StarIcon } from "lucide-react";

interface Review {
  _id: string;
  _creationTime: number;
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
  reviewStats?: ReviewStats | null;
  onPostReview: () => void;
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
                <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded">
                  Verified Purchase
                </span>
              )}
            </div>
            <StarRating rating={review.rating} />
          </div>
          <span className="text-sm text-muted-foreground">
            {new Date(review._creationTime).toLocaleDateString()}
          </span>
        </div>
        
        <h4 className="font-semibold mb-2">{review.title}</h4>
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

export function ReviewSection({ reviews, reviewStats, onPostReview }: ReviewSectionProps) {
  const hasReviews = reviewStats && reviewStats.totalReviews > 0;
  
  return (
    <div className="border-t border-border pt-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Customer Reviews</h2>
        <Button onClick={onPostReview}>Post A Review</Button>
      </div>

      {hasReviews ? (
        <div className="space-y-6">
          {/* Rating Summary */}
          <Card>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold">{reviewStats.averageRating}</div>
                    <div className="flex items-center justify-center mt-1">
                      <StarRating rating={reviewStats.averageRating} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {reviewStats.totalReviews} reviews
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <RatingBar
                      key={rating}
                      rating={rating}
                      count={reviewStats.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5]}
                      total={reviewStats.totalReviews}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reviews List */}
          <div className="space-y-4">
            {reviews?.map((review) => (
              <ReviewCard key={review._id} review={review} />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-muted/30 rounded-lg p-8 text-center">
          <StarIcon className="size-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold mb-2">No reviews yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Be the first to review this product
          </p>
          <Button size="sm" onClick={onPostReview}>
            Post A Review
          </Button>
        </div>
      )}
    </div>
  );
}
