import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get homepage settings
 */
export const getHomepageSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("homepageSettings").first();
    
    // Return default settings if none exist
    if (!settings) {
      return {
        logoImageUrl: undefined,
        logoRedirectLink: "/",
        showSearchIcon: true,
        marqueeEnabled: true,
        marqueeMaxModels: 20,
        announcementEnabled: false,
        announcementText: undefined,
        announcementLink: undefined,
      };
    }
    
    return settings;
  },
});

/**
 * Get hero slides (active only, sorted by order)
 */
export const getActiveHeroSlides = query({
  args: {},
  handler: async (ctx) => {
    const slides = await ctx.db
      .query("heroSlides")
      .withIndex("by_active_and_order", (q) => q.eq("isActive", true))
      .collect();
    
    return slides.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get all hero slides (for admin)
 */
export const getAllHeroSlides = query({
  args: {},
  handler: async (ctx) => {
    const slides = await ctx.db
      .query("heroSlides")
      .order("desc")
      .collect();
    
    return slides.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get homepage sections (active only, sorted by order)
 */
export const getActiveHomepageSections = query({
  args: {},
  handler: async (ctx) => {
    const sections = await ctx.db
      .query("homepageSections")
      .withIndex("by_active_and_order", (q) => q.eq("isActive", true))
      .collect();
    
    return sections.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get all homepage sections (for admin)
 */
export const getAllHomepageSections = query({
  args: {},
  handler: async (ctx) => {
    const sections = await ctx.db
      .query("homepageSections")
      .order("desc")
      .collect();
    
    return sections.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get UGC videos (approved and active only, sorted by order)
 */
export const getActiveUgcVideos = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db
      .query("ugcVideos")
      .withIndex("by_approved_and_active", (q) => 
        q.eq("isApproved", true).eq("isActive", true)
      )
      .collect();
    
    return videos.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get all UGC videos (for admin)
 */
export const getAllUgcVideos = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db
      .query("ugcVideos")
      .order("desc")
      .collect();
    
    return videos.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get category display settings (active only, sorted by order)
 */
export const getActiveCategoryDisplaySettings = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("categoryDisplaySettings")
      .withIndex("by_active_and_order", (q) => q.eq("isActive", true))
      .collect();
    
    return categories.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get all category display settings (for admin)
 */
export const getAllCategoryDisplaySettings = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("categoryDisplaySettings")
      .order("desc")
      .collect();
    
    return categories.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get latest supported models for marquee
 */
export const getMarqueeModels = query({
  args: { maxModels: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.maxModels || 20;
    
    const models = await ctx.db
      .query("supportedModels")
      .order("desc")
      .take(limit);
    
    // Return model names formatted as "Brand Model"
    return models.map((model) => `${model.brandName} ${model.modelName}`);
  },
});

/**
 * Get feature banners (active only, sorted by order)
 */
export const getActiveFeatureBanners = query({
  args: {},
  handler: async (ctx) => {
    const banners = await ctx.db
      .query("featureBanners")
      .withIndex("by_active_and_order", (q) => q.eq("isActive", true))
      .collect();
    
    return banners.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get all feature banners (for admin)
 */
export const getAllFeatureBanners = query({
  args: {},
  handler: async (ctx) => {
    const banners = await ctx.db
      .query("featureBanners")
      .order("desc")
      .collect();
    
    return banners.sort((a, b) => a.order - b.order);
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Update homepage settings
 */
export const updateHomepageSettings = mutation({
  args: {
    logoImageUrl: v.optional(v.string()),
    logoRedirectLink: v.optional(v.string()),
    showSearchIcon: v.optional(v.boolean()),
    marqueeEnabled: v.optional(v.boolean()),
    marqueeMaxModels: v.optional(v.number()),
    announcementEnabled: v.optional(v.boolean()),
    announcementText: v.optional(v.string()),
    announcementLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existingSettings = await ctx.db.query("homepageSettings").first();
    
    const now = Date.now();
    const updates = {
      ...args,
      updatedBy: identity.email,
      updatedAt: now,
    };
    
    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, updates);
      return existingSettings._id;
    } else {
      // Create new settings with defaults
      const newSettings = {
        logoImageUrl: args.logoImageUrl || undefined,
        logoRedirectLink: args.logoRedirectLink || "/",
        showSearchIcon: args.showSearchIcon ?? true,
        marqueeEnabled: args.marqueeEnabled ?? true,
        marqueeMaxModels: args.marqueeMaxModels || 20,
        announcementEnabled: args.announcementEnabled ?? false,
        announcementText: args.announcementText || undefined,
        announcementLink: args.announcementLink || undefined,
        updatedBy: identity.email,
        updatedAt: now,
      };
      
      return await ctx.db.insert("homepageSettings", newSettings);
    }
  },
});

/**
 * Create hero slide
 */
export const createHeroSlide = mutation({
  args: {
    imageUrl: v.string(),
    heading: v.optional(v.string()),
    subheading: v.optional(v.string()),
    ctaText: v.optional(v.string()),
    ctaLink: v.optional(v.string()),
    isActive: v.boolean(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    return await ctx.db.insert("heroSlides", {
      ...args,
      createdBy: identity.email,
      createdAt: now,
    });
  },
});

/**
 * Update hero slide
 */
export const updateHeroSlide = mutation({
  args: {
    slideId: v.id("heroSlides"),
    imageUrl: v.optional(v.string()),
    heading: v.optional(v.string()),
    subheading: v.optional(v.string()),
    ctaText: v.optional(v.string()),
    ctaLink: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { slideId, ...updates } = args;
    const now = Date.now();
    
    await ctx.db.patch(slideId, {
      ...updates,
      updatedBy: identity.email,
      updatedAt: now,
    });
    
    return slideId;
  },
});

/**
 * Delete hero slide
 */
export const deleteHeroSlide = mutation({
  args: { slideId: v.id("heroSlides") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.db.delete(args.slideId);
    return { success: true };
  },
});

/**
 * Create homepage section
 */
export const createHomepageSection = mutation({
  args: {
    sectionType: v.union(
      v.literal("top_picks"),
      v.literal("why_skinly"),
      v.literal("feature_banner"),
      v.literal("explore_models"),
      v.literal("category_explorer")
    ),
    sectionName: v.string(),
    isActive: v.boolean(),
    order: v.number(),
    config: v.optional(v.string()), // JSON string
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    
    // Parse config JSON if provided
    let configObject = undefined;
    if (args.config) {
      try {
        configObject = JSON.parse(args.config);
      } catch {
        throw new Error("Invalid config JSON");
      }
    }
    
    return await ctx.db.insert("homepageSections", {
      sectionType: args.sectionType,
      sectionName: args.sectionName,
      isActive: args.isActive,
      order: args.order,
      config: configObject,
      createdBy: identity.email,
      createdAt: now,
    });
  },
});

/**
 * Update homepage section
 */
export const updateHomepageSection = mutation({
  args: {
    sectionId: v.id("homepageSections"),
    sectionName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
    config: v.optional(v.string()), // JSON string
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { sectionId, config, ...otherUpdates } = args;
    const now = Date.now();
    
    // Parse config JSON if provided
    let configObject = undefined;
    if (config) {
      try {
        configObject = JSON.parse(config);
      } catch {
        throw new Error("Invalid config JSON");
      }
    }
    
    const updates: Record<string, unknown> = {
      ...otherUpdates,
      updatedBy: identity.email,
      updatedAt: now,
    };
    
    if (configObject !== undefined) {
      updates.config = configObject;
    }
    
    await ctx.db.patch(sectionId, updates);
    return sectionId;
  },
});

/**
 * Delete homepage section
 */
export const deleteHomepageSection = mutation({
  args: { sectionId: v.id("homepageSections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.db.delete(args.sectionId);
    return { success: true };
  },
});

/**
 * Create UGC video
 */
export const createUgcVideo = mutation({
  args: {
    videoUrl: v.string(),
    thumbnailUrl: v.optional(v.string()),
    sourceType: v.union(v.literal("instagram"), v.literal("manual")),
    socialMediaId: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    ctaText: v.optional(v.string()),
    isApproved: v.boolean(),
    isActive: v.boolean(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    return await ctx.db.insert("ugcVideos", {
      ...args,
      createdBy: identity.email,
      createdAt: now,
    });
  },
});

/**
 * Update UGC video
 */
export const updateUgcVideo = mutation({
  args: {
    videoId: v.id("ugcVideos"),
    videoUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    ctaText: v.optional(v.string()),
    isApproved: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { videoId, ...updates } = args;
    const now = Date.now();
    
    await ctx.db.patch(videoId, {
      ...updates,
      updatedBy: identity.email,
      updatedAt: now,
    });
    
    return videoId;
  },
});

/**
 * Delete UGC video
 */
export const deleteUgcVideo = mutation({
  args: { videoId: v.id("ugcVideos") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.db.delete(args.videoId);
    return { success: true };
  },
});

/**
 * Create feature banner
 */
export const createFeatureBanner = mutation({
  args: {
    backgroundImage: v.string(),
    heading: v.optional(v.string()),
    subheading: v.optional(v.string()),
    ctaText: v.optional(v.string()),
    ctaLink: v.optional(v.string()),
    isActive: v.boolean(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    return await ctx.db.insert("featureBanners", {
      ...args,
      createdBy: identity.email,
      createdAt: now,
    });
  },
});

/**
 * Update feature banner
 */
export const updateFeatureBanner = mutation({
  args: {
    bannerId: v.id("featureBanners"),
    backgroundImage: v.optional(v.string()),
    heading: v.optional(v.string()),
    subheading: v.optional(v.string()),
    ctaText: v.optional(v.string()),
    ctaLink: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { bannerId, ...updates } = args;
    const now = Date.now();
    
    await ctx.db.patch(bannerId, {
      ...updates,
      updatedBy: identity.email,
      updatedAt: now,
    });
    
    return bannerId;
  },
});

/**
 * Delete feature banner
 */
export const deleteFeatureBanner = mutation({
  args: { bannerId: v.id("featureBanners") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.db.delete(args.bannerId);
    return { success: true };
  },
});

/**
 * Update category display settings
 */
export const updateCategoryDisplaySettings = mutation({
  args: {
    categoryName: v.string(),
    displayName: v.string(),
    imageUrl: v.optional(v.string()),
    linkUrl: v.optional(v.string()),
    buttonText: v.optional(v.string()),
    isActive: v.boolean(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existingCategory = await ctx.db
      .query("categoryDisplaySettings")
      .withIndex("by_category_name", (q) => 
        q.eq("categoryName", args.categoryName)
      )
      .first();
    
    const now = Date.now();
    const updates = {
      ...args,
      updatedBy: identity.email,
      updatedAt: now,
    };
    
    if (existingCategory) {
      await ctx.db.patch(existingCategory._id, updates);
      return existingCategory._id;
    } else {
      return await ctx.db.insert("categoryDisplaySettings", updates);
    }
  },
});

/**
 * Bulk update category display settings
 */
export const bulkUpdateCategoryDisplaySettings = mutation({
  args: {
    categories: v.array(v.object({
      categoryName: v.string(),
      displayName: v.string(),
      imageUrl: v.optional(v.string()),
      linkUrl: v.optional(v.string()),
      buttonText: v.optional(v.string()),
      isActive: v.boolean(),
      order: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const results = [];
    
    for (const category of args.categories) {
      const existingCategory = await ctx.db
        .query("categoryDisplaySettings")
        .withIndex("by_category_name", (q) => 
          q.eq("categoryName", category.categoryName)
        )
        .first();
      
      const now = Date.now();
      const updates = {
        ...category,
        updatedBy: identity.email,
        updatedAt: now,
      };
      
      if (existingCategory) {
        await ctx.db.patch(existingCategory._id, updates);
        results.push(existingCategory._id);
      } else {
        const id = await ctx.db.insert("categoryDisplaySettings", updates);
        results.push(id);
      }
    }
    
    return { success: true, count: results.length };
  },
});
