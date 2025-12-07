import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Category type
type Category = "phone" | "tablet" | "laptop" | "console" | "charger" | "drone" | "camera" | "lens" | "mac-mini";

// Rebuild the entire cache from scratch
export const rebuildCache = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Fetch all active models
    const allModels = await ctx.db
      .query("supportedModels")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Calculate global brands
    const globalBrandSet = new Set<string>();
    allModels.forEach((model) => globalBrandSet.add(model.brandName));
    const brands = Array.from(globalBrandSet).sort();

    // Calculate per-category data
    const categories: Category[] = ["phone", "tablet", "laptop", "console", "charger", "drone", "camera", "lens", "mac-mini"];
    const byCategory: Record<string, { brands: string[]; count: number }> = {};

    categories.forEach((category) => {
      const categoryModels = allModels.filter((m) => m.category === category);
      const categoryBrandSet = new Set<string>();
      categoryModels.forEach((model) => categoryBrandSet.add(model.brandName));
      
      byCategory[category] = {
        brands: Array.from(categoryBrandSet).sort(),
        count: categoryModels.length,
      };
    });

    // Check if cache exists
    const existingCache = await ctx.db
      .query("modelMetadata")
      .withIndex("by_key", (q) => q.eq("key", "current"))
      .first();

    const cacheData = {
      key: "current",
      brands,
      totalModels: allModels.length,
      byCategory: {
        phone: byCategory.phone,
        laptop: byCategory.laptop,
        tablet: byCategory.tablet,
        camera: byCategory.camera,
        lens: byCategory.lens,
        drone: byCategory.drone,
        charger: byCategory.charger,
        console: byCategory.console,
        macMini: byCategory["mac-mini"],
      },
      lastUpdated: Date.now(),
    };

    if (existingCache) {
      // Update existing cache
      await ctx.db.patch(existingCache._id, cacheData);
    } else {
      // Create new cache
      await ctx.db.insert("modelMetadata", cacheData);
    }

    return {
      success: true,
      totalModels: allModels.length,
      brandsCount: brands.length,
    };
  },
});

// Get the current cache (fast query)
export const getCache = query({
  args: {},
  handler: async (ctx) => {
    const cache = await ctx.db
      .query("modelMetadata")
      .withIndex("by_key", (q) => q.eq("key", "current"))
      .first();

    // If cache doesn't exist, trigger rebuild (this shouldn't happen in production)
    if (!cache) {
      return null;
    }

    return cache;
  },
});

// Public mutation to trigger cache rebuild (admin only)
export const triggerRebuild = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if user is admin
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user?.isAdmin) {
      throw new Error("Not authorized - admin only");
    }

    // Schedule internal mutation to rebuild cache
    await ctx.scheduler.runAfter(0, internal.modelCache.rebuildCache);

    return { success: true };
  },
});

// Get cache statistics
export const getCacheStats = query({
  args: {},
  handler: async (ctx) => {
    const cache = await ctx.db
      .query("modelMetadata")
      .withIndex("by_key", (q) => q.eq("key", "current"))
      .first();

    if (!cache) {
      return {
        exists: false,
        lastUpdated: null,
        totalModels: 0,
        brandsCount: 0,
      };
    }

    return {
      exists: true,
      lastUpdated: new Date(cache.lastUpdated).toISOString(),
      totalModels: cache.totalModels,
      brandsCount: cache.brands.length,
      categoryBreakdown: Object.entries(cache.byCategory).map(([category, data]) => ({
        category,
        brands: data.brands.length,
        models: data.count,
      })),
    };
  },
});
