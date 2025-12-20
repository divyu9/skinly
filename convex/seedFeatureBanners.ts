import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Seed default feature banners
 * Run once from the dashboard to populate initial banners
 */
export const seedDefaultFeatureBanners = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if banners already exist
    const existingBanners = await ctx.db.query("featureBanners").first();
    if (existingBanners) {
      return { 
        message: "Feature banners already exist. Delete existing banners first if you want to re-seed.",
        success: false 
      };
    }

    const now = Date.now();
    const defaultBanners = [
      {
        backgroundImage: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1920&h=800&fit=crop",
        heading: "Premium Protection",
        subheading: "Protect your device in style with our premium skins",
        ctaText: "Shop Now",
        ctaLink: "/products",
        isActive: true,
        order: 0,
        createdBy: "system",
        createdAt: now,
      },
      {
        backgroundImage: "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=1920&h=800&fit=crop",
        heading: "New Designs Drop",
        subheading: "Fresh patterns and finishes for your favorite devices",
        ctaText: "Explore Collection",
        ctaLink: "/products",
        isActive: true,
        order: 1,
        createdBy: "system",
        createdAt: now,
      },
      {
        backgroundImage: "https://images.unsplash.com/photo-1610792516286-524726503fb2?w=1920&h=800&fit=crop",
        heading: "Perfect Fit Guaranteed",
        subheading: "Precision-cut skins for 1000+ device models",
        ctaText: "Find Your Model",
        ctaLink: "/products",
        isActive: true,
        order: 2,
        createdBy: "system",
        createdAt: now,
      },
    ];

    const ids = [];
    for (const banner of defaultBanners) {
      const id = await ctx.db.insert("featureBanners", banner);
      ids.push(id);
    }

    return { 
      message: `Successfully seeded ${ids.length} feature banners`,
      success: true,
      bannerIds: ids
    };
  },
});

/**
 * Clear all feature banners
 * Use this if you want to start fresh
 */
export const clearAllFeatureBanners = mutation({
  args: { confirm: v.boolean() },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      return { 
        message: "Set confirm: true to delete all banners",
        success: false 
      };
    }

    const allBanners = await ctx.db.query("featureBanners").collect();
    
    for (const banner of allBanners) {
      await ctx.db.delete(banner._id);
    }

    return { 
      message: `Successfully deleted ${allBanners.length} feature banners`,
      success: true 
    };
  },
});
