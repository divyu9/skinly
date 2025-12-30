import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth.ts";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

interface ReviewFormState {
  dialogOpen: boolean;
  rating: number;
  title: string;
  comment: string;
  images: File[];
  videos: File[];
  isUploading: boolean;
}

export function useProductReviews(productId: Id<"products"> | null) {
  const { user } = useAuth();
  
  // Load reviews state - only load when product exists
  const [loadReviews] = useState(true);
  
  // Review form state
  const [formState, setFormState] = useState<ReviewFormState>({
    dialogOpen: false,
    rating: 5,
    title: "",
    comment: "",
    images: [],
    videos: [],
    isUploading: false,
  });
  
  // Queries
  const reviews = useQuery(
    api.reviews.getProductReviews,
    loadReviews && productId ? { productId } : "skip"
  );
  
  const reviewStats = useQuery(
    api.reviews.getReviewStats,
    loadReviews && productId ? { productId } : "skip"
  );
  
  // Mutations
  const addReview = useMutation(api.reviews.addReview);
  const generateUploadUrl = useMutation(api.reviews.generateUploadUrl);
  
  // Open review dialog
  const openReviewDialog = useCallback(() => {
    if (!user) {
      toast.error("Please sign in to post a review");
      return;
    }
    setFormState(prev => ({ ...prev, dialogOpen: true }));
  }, [user]);
  
  // Close review dialog
  const closeReviewDialog = useCallback(() => {
    setFormState({
      dialogOpen: false,
      rating: 5,
      title: "",
      comment: "",
      images: [],
      videos: [],
      isUploading: false,
    });
  }, []);
  
  // Update form state
  const updateForm = useCallback((updates: Partial<ReviewFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  }, []);
  
  // Add images
  const addImages = useCallback((files: File[]) => {
    setFormState(prev => ({ ...prev, images: [...prev.images, ...files] }));
  }, []);
  
  // Remove image
  const removeImage = useCallback((index: number) => {
    setFormState(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  }, []);
  
  // Add videos
  const addVideos = useCallback((files: File[]) => {
    setFormState(prev => ({ ...prev, videos: [...prev.videos, ...files] }));
  }, []);
  
  // Remove video
  const removeVideo = useCallback((index: number) => {
    setFormState(prev => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index),
    }));
  }, []);
  
  // Submit review
  const handleSubmitReview = useCallback(async () => {
    if (!productId) return;
    
    if (!formState.title.trim() || !formState.comment.trim()) {
      toast.error("Please fill in all review fields");
      return;
    }
    
    setFormState(prev => ({ ...prev, isUploading: true }));
    
    try {
      // Upload images
      const imageStorageIds: string[] = [];
      for (const image of formState.images) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": image.type },
          body: image,
        });
        const { storageId } = await result.json();
        imageStorageIds.push(storageId);
      }
      
      // Upload videos
      const videoStorageIds: string[] = [];
      for (const video of formState.videos) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": video.type },
          body: video,
        });
        const { storageId } = await result.json();
        videoStorageIds.push(storageId);
      }
      
      // Submit review
      await addReview({
        productId,
        rating: formState.rating,
        title: formState.title,
        comment: formState.comment,
        images: imageStorageIds.length > 0 ? imageStorageIds : undefined,
        videos: videoStorageIds.length > 0 ? videoStorageIds : undefined,
      });
      
      toast.success("Review added successfully!");
      closeReviewDialog();
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to add review");
      }
    } finally {
      setFormState(prev => ({ ...prev, isUploading: false }));
    }
  }, [productId, formState, generateUploadUrl, addReview, closeReviewDialog]);
  
  return {
    reviews,
    reviewStats,
    formState,
    openReviewDialog,
    closeReviewDialog,
    updateForm,
    addImages,
    removeImage,
    addVideos,
    removeVideo,
    handleSubmitReview,
  };
}
