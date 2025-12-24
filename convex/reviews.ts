import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

export const getProductReviews = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .order("desc")
      .collect();
    
    // Get image and video URLs if they exist
    const reviewsWithMedia = await Promise.all(
      reviews.map(async (review) => {
        const imageUrls = review.images
          ? await Promise.all(
              review.images.map((storageId) => ctx.storage.getUrl(storageId))
            )
          : [];
        
        const videoUrls = review.videos
          ? await Promise.all(
              review.videos.map((storageId) => ctx.storage.getUrl(storageId))
            )
          : [];
        
        return {
          ...review,
          imageUrls: imageUrls.filter((url): url is string => url !== null),
          videoUrls: videoUrls.filter((url): url is string => url !== null),
        };
      })
    );
    
    return reviewsWithMedia;
  },
});

export const addReview = mutation({
  args: {
    productId: v.id("products"),
    rating: v.number(),
    title: v.string(),
    comment: v.string(),
    images: v.optional(v.array(v.string())),
    videos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Check if user already reviewed this product
    const existingReview = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("productId"), args.productId))
      .first();

    if (existingReview) {
      throw new ConvexError({
        message: "You have already reviewed this product",
        code: "CONFLICT",
      });
    }

    // Check if user has purchased this product
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const hasPurchased = orders.some((order) =>
      order.items.some((item) => item.productId === args.productId)
    );

    const reviewId = await ctx.db.insert("reviews", {
      productId: args.productId,
      userId: user._id,
      userName: user.name || "Anonymous",
      userEmail: user.email,
      rating: args.rating,
      title: args.title,
      comment: args.comment,
      verified: hasPurchased,
      images: args.images,
      videos: args.videos,
    });

    return reviewId;
  },
});

export const getReviewStats = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    const totalReviews = reviews.length;
    if (totalReviews === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / totalReviews;

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((review) => {
      const rating = Math.round(review.rating) as 1 | 2 | 3 | 4 | 5;
      ratingDistribution[rating]++;
    });

    return {
      averageRating: Number(averageRating.toFixed(1)),
      totalReviews,
      ratingDistribution,
    };
  },
});

/**
 * Generate upload URL for review images
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get all reviews with product info for admin
 */
export const getAllReviews = query({
  args: {},
  handler: async (ctx) => {
    const reviews = await ctx.db.query("reviews").order("desc").collect();
    
    // Get product info for each review
    const reviewsWithProducts = await Promise.all(
      reviews.map(async (review) => {
        const product = await ctx.db.get(review.productId);
        
        // Get image URLs if they exist
        const imageUrls = review.images
          ? await Promise.all(
              review.images.map((storageId) => ctx.storage.getUrl(storageId))
            )
          : [];
        
        // Get video URLs if they exist
        const videoUrls = review.videos
          ? await Promise.all(
              review.videos.map((storageId) => ctx.storage.getUrl(storageId))
            )
          : [];
        
        return {
          ...review,
          productTitle: product?.title || "Unknown Product",
          imageUrls: imageUrls.filter((url): url is string => url !== null),
          videoUrls: videoUrls.filter((url): url is string => url !== null),
        };
      })
    );
    
    return reviewsWithProducts;
  },
});

/**
 * Get verified reviews for homepage showcase
 */
export const getVerifiedReviews = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_verified", (q) => q.eq("verified", true))
      .order("desc")
      .take(limit);
    
    // Get image and video URLs if they exist
    const reviewsWithMedia = await Promise.all(
      reviews.map(async (review) => {
        const imageUrls = review.images
          ? await Promise.all(
              review.images.map((storageId) => ctx.storage.getUrl(storageId))
            )
          : [];
        
        const videoUrls = review.videos
          ? await Promise.all(
              review.videos.map((storageId) => ctx.storage.getUrl(storageId))
            )
          : [];
        
        return {
          ...review,
          imageUrls: imageUrls.filter((url): url is string => url !== null),
          videoUrls: videoUrls.filter((url): url is string => url !== null),
        };
      })
    );
    
    return reviewsWithMedia;
  },
});

/**
 * Delete a review (admin only)
 */
export const deleteReview = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.reviewId);
  },
});
