import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { StarIcon } from "lucide-react";

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formState: {
    rating: number;
    title: string;
    comment: string;
    images: File[];
    videos: File[];
    isUploading: boolean;
  };
  onUpdateForm: (updates: Partial<ReviewDialogProps["formState"]>) => void;
  onAddImages: (files: File[]) => void;
  onRemoveImage: (index: number) => void;
  onAddVideos: (files: File[]) => void;
  onRemoveVideo: (index: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function ReviewDialog({
  open,
  onOpenChange,
  formState,
  onUpdateForm,
  onAddImages,
  onRemoveImage,
  onAddVideos,
  onRemoveVideo,
  onSubmit,
  onClose,
}: ReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Write a Review</DialogTitle>
          <DialogDescription>Share your experience with this product</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Rating */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => onUpdateForm({ rating })}
                  className="transition-transform hover:scale-110"
                >
                  <StarIcon
                    className={`size-8 ${
                      rating <= formState.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-muted text-muted"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          
          {/* Title */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Title</label>
            <Input
              placeholder="Summarize your review"
              value={formState.title}
              onChange={(e) => onUpdateForm({ title: e.target.value })}
            />
          </div>
          
          {/* Comment */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Review</label>
            <Textarea
              placeholder="Share your thoughts about this product..."
              value={formState.comment}
              onChange={(e) => onUpdateForm({ comment: e.target.value })}
              rows={4}
            />
          </div>
          
          {/* Image Upload */}
          <div>
            <label className="text-sm font-semibold mb-2 block">
              Images {formState.images.length > 0 && `(${formState.images.length})`}
            </label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                onAddImages(files);
              }}
            />
            {formState.images.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {formState.images.map((file, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${idx + 1}`}
                      className="h-20 w-20 rounded object-cover"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -right-2 -top-2 size-6 rounded-full"
                      onClick={() => onRemoveImage(idx)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Video Upload */}
          <div>
            <label className="text-sm font-semibold mb-2 block">
              Videos {formState.videos.length > 0 && `(${formState.videos.length})`}
            </label>
            <Input
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                onAddVideos(files);
              }}
            />
            {formState.videos.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {formState.videos.map((file, idx) => (
                  <div key={idx} className="relative">
                    <video
                      src={URL.createObjectURL(file)}
                      className="h-20 rounded"
                      controls
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -right-2 -top-2 size-6 rounded-full"
                      onClick={() => onRemoveVideo(idx)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={formState.isUploading}>
              {formState.isUploading ? "Uploading..." : "Submit Review"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
