import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { AdminHeader } from "@/components/admin-header.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { StarIcon, TrashIcon, CheckCircleIcon, MessageSquareIcon } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function AdminReviews() {
  const reviews = useQuery(api.reviews.getAllReviews);
  const deleteReview = useMutation(api.reviews.deleteReview);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<Id<"reviews"> | null>(null);

  const handleDelete = async () => {
    if (!selectedReviewId) return;
    
    try {
      await deleteReview({ reviewId: selectedReviewId });
      toast.success("Review deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedReviewId(null);
    } catch (error) {
      toast.error("Failed to delete review");
    }
  };

  if (reviews === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="container mx-auto py-8 space-y-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const verifiedCount = reviews.filter((r) => r.verified).length;
  const totalRatings = reviews.reduce((sum, r) => sum + r.rating, 0);
  const averageRating = reviews.length > 0 ? (totalRatings / reviews.length).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customer Reviews</h1>
            <p className="text-muted-foreground">
              Manage and monitor all product reviews
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <MessageSquareIcon className="size-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Reviews</p>
                  <p className="text-2xl font-bold">{reviews.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-green-500/10 p-3">
                  <CheckCircleIcon className="size-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Verified Reviews</p>
                  <p className="text-2xl font-bold">{verifiedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-yellow-500/10 p-3">
                  <StarIcon className="size-6 text-yellow-600 fill-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Rating</p>
                  <p className="text-2xl font-bold">{averageRating} / 5</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquareIcon />
              </EmptyMedia>
              <EmptyTitle>No reviews yet</EmptyTitle>
              <EmptyDescription>
                Customer reviews will appear here once they start posting
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review._id}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{review.userName}</p>
                          {review.verified && (
                            <Badge variant="default" className="gap-1">
                              <CheckCircleIcon className="size-3" />
                              Verified Purchase
                            </Badge>
                          )}
                        </div>
                        {review.userEmail && (
                          <p className="text-sm text-muted-foreground">{review.userEmail}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {new Date(review._creationTime).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedReviewId(review._id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>

                    {/* Product */}
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-sm font-medium">{review.productTitle}</p>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <StarIcon
                          key={i}
                          className={`size-4 ${
                            i < review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-sm font-medium">{review.rating}.0</span>
                    </div>

                    {/* Review Content */}
                    <div>
                      <h3 className="font-semibold">{review.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
                    </div>

                    {/* Media (Images & Videos) */}
                    {((review.imageUrls && review.imageUrls.length > 0) ||
                      (review.videoUrls && review.videoUrls.length > 0)) && (
                      <div className="space-y-2">
                        {review.imageUrls && review.imageUrls.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto">
                            {review.imageUrls.map((url, idx) => (
                              <img
                                key={idx}
                                src={url}
                                alt={`Review image ${idx + 1}`}
                                className="h-24 w-24 rounded-lg object-cover"
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
                                className="h-32 rounded-lg"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this review? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
