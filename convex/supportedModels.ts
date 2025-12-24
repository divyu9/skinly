import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Get all supported models with filters
export const listAll = query({
  args: {
    category: v.optional(v.string()),
    brandName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let models = await ctx.db.query("supportedModels").collect();

    // Apply filters
    if (args.category !== undefined) {
      models = models.filter((m) => m.category === args.category);
    }
    if (args.brandName !== undefined) {
      models = models.filter((m) => m.brandName === args.brandName);
    }
    if (args.isActive !== undefined) {
      models = models.filter((m) => m.isActive === args.isActive);
    }

    // Sort by creation time descending (newest first)
    return models.sort((a, b) => b._creationTime - a._creationTime);
  },
});

// Get latest N models (for homepage marquee)
export const getLatest = query({
  args: { count: v.number() },
  handler: async (ctx, args) => {
    const models = await ctx.db
      .query("supportedModels")
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("desc")
      .take(args.count);

    return models;
  },
});

// Get unique brands
export const getBrands = query({
  args: {},
  handler: async (ctx, args) => {
    const models = await ctx.db.query("supportedModels").collect();
    const brandSet = new Set(models.map((m) => m.brandName));
    return Array.from(brandSet).sort();
  },
});

// Get unique brand names (optimized - returns only brands, not full models)
export const getBrandsList = query({
  args: {},
  handler: async (ctx) => {
    const models = await ctx.db.query("supportedModels").collect();
    const brandSet = new Set(models.map((m) => m.brandName));
    return Array.from(brandSet).sort();
  },
});

// Count models by gadget type ID
export const getModelCountByGadgetType = query({
  args: { gadgetTypeId: v.id("gadgetTypes") },
  handler: async (ctx, args) => {
    const models = await ctx.db
      .query("supportedModels")
      .withIndex("by_gadget_type", (q) => q.eq("gadgetTypeId", args.gadgetTypeId))
      .collect();
    return models.length;
  },
});

// Get models by brand (for devices page)
export const getByBrand = query({
  args: { brandName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("supportedModels")
      .withIndex("by_brand", (q) => q.eq("brandName", args.brandName))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Get model info by brand and model name (for smart product filtering)
export const getModelInfo = query({
  args: { 
    brand: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const models = await ctx.db
      .query("supportedModels")
      .withIndex("by_brand", (q) => q.eq("brandName", args.brand))
      .filter((q) => q.eq(q.field("modelName"), args.model))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    return models;
  },
});

// Create a new model
export const create = mutation({
  args: {
    brandName: v.string(),
    modelName: v.string(),
    category: v.string(), // Keep for backwards compatibility
    gadgetTypeId: v.optional(v.id("gadgetTypes")), // New field - references gadgetTypes
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const modelId = await ctx.db.insert("supportedModels", {
      brandName: args.brandName,
      modelName: args.modelName,
      category: args.category,
      gadgetTypeId: args.gadgetTypeId,
      isActive: args.isActive,
    });
    
    // Trigger cache rebuild
    await ctx.scheduler.runAfter(0, internal.modelCache.rebuildCache);
    
    return modelId;
  },
});

// Update a model
export const update = mutation({
  args: {
    id: v.id("supportedModels"),
    brandName: v.optional(v.string()),
    modelName: v.optional(v.string()),
    category: v.optional(v.string()),
    gadgetTypeId: v.optional(v.id("gadgetTypes")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Delete a model
export const remove = mutation({
  args: { id: v.id("supportedModels") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    
    // Trigger cache rebuild
    await ctx.scheduler.runAfter(0, internal.modelCache.rebuildCache);
  },
});

// Bulk create models
export const bulkCreate = mutation({
  args: {
    models: v.array(v.object({
      brandName: v.string(),
      modelName: v.string(),
      category: v.string(),
      isActive: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const model of args.models) {
      const id = await ctx.db.insert("supportedModels", model);
      ids.push(id);
    }
    
    // Trigger cache rebuild after bulk insert
    await ctx.scheduler.runAfter(0, internal.modelCache.rebuildCache);
    
    return ids;
  },
});

// Get stats
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allModels = await ctx.db.query("supportedModels").collect();
    const activeModels = allModels.filter((m) => m.isActive);
    
    const categoryBreakdown: Record<string, number> = {};
    allModels.forEach((m) => {
      categoryBreakdown[m.category] = (categoryBreakdown[m.category] || 0) + 1;
    });

    return {
      total: allModels.length,
      active: activeModels.length,
      inactive: allModels.length - activeModels.length,
      categoryBreakdown,
    };
  },
});

// Get brands with counts and categories
export const getBrandsWithCounts = query({
  args: {},
  handler: async (ctx) => {
    const models = await ctx.db.query("supportedModels").collect();
    
    const brandMap = new Map<string, { count: number; categories: Set<string> }>();
    
    models.forEach((model) => {
      const existing = brandMap.get(model.brandName);
      if (existing) {
        existing.count++;
        existing.categories.add(model.category);
      } else {
        brandMap.set(model.brandName, {
          count: 1,
          categories: new Set([model.category]),
        });
      }
    });

    return Array.from(brandMap.entries())
      .map(([brand, data]) => ({
        brand,
        count: data.count,
        categories: Array.from(data.categories),
      }))
      .sort((a, b) => a.brand.localeCompare(b.brand));
  },
});

// Rename a brand across all models
export const renameBrand = mutation({
  args: {
    oldName: v.string(),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.oldName === args.newName) {
      throw new Error("Old and new brand names are the same");
    }
    
    if (!args.newName.trim()) {
      throw new Error("New brand name cannot be empty");
    }

    const modelsToUpdate = await ctx.db
      .query("supportedModels")
      .filter((q) => q.eq(q.field("brandName"), args.oldName))
      .collect();

    let count = 0;
    for (const model of modelsToUpdate) {
      await ctx.db.patch(model._id, { brandName: args.newName });
      count++;
    }

    return count;
  },
});

// Merge multiple brands into one
export const mergeBrands = mutation({
  args: {
    sourceNames: v.array(v.string()),
    targetName: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.targetName.trim()) {
      throw new Error("Target brand name cannot be empty");
    }

    let totalCount = 0;
    for (const sourceName of args.sourceNames) {
      const modelsToUpdate = await ctx.db
        .query("supportedModels")
        .filter((q) => q.eq(q.field("brandName"), sourceName))
        .collect();

      for (const model of modelsToUpdate) {
        await ctx.db.patch(model._id, { brandName: args.targetName });
        totalCount++;
      }
    }

    return totalCount;
  },
});

// Delete a brand (only if no models use it)
export const deleteBrand = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const modelsWithBrand = await ctx.db
      .query("supportedModels")
      .filter((q) => q.eq(q.field("brandName"), args.name))
      .collect();

    if (modelsWithBrand.length > 0) {
      throw new Error(`Cannot delete brand "${args.name}" because ${modelsWithBrand.length} model(s) are using it`);
    }

    return { success: true };
  },
});

// ===== OPTIMIZED CACHED QUERIES =====

// Get metadata from cache (super fast - no model scanning)
export const getMetadata = query({
  args: {},
  handler: async (ctx) => {
    const cache = await ctx.db
      .query("modelMetadata")
      .withIndex("by_key", (q) => q.eq("key", "current"))
      .first();

    // Return cache or empty fallback
    if (!cache) {
      return {
        brands: [],
        totalModels: 0,
        byCategory: {
          phone: { brands: [], count: 0 },
          laptop: { brands: [], count: 0 },
          tablet: { brands: [], count: 0 },
          camera: { brands: [], count: 0 },
          lens: { brands: [], count: 0 },
          drone: { brands: [], count: 0 },
          charger: { brands: [], count: 0 },
          console: { brands: [], count: 0 },
          macMini: { brands: [], count: 0 },
        },
        lastUpdated: 0,
      };
    }

    return cache;
  },
});

// Get models for a specific brand and category (lazy loading)
export const getBrandModels = query({
  args: {
    brand: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const models = await ctx.db
      .query("supportedModels")
      .withIndex("by_brand", (q) => q.eq("brandName", args.brand))
      .filter((q) => 
        q.and(
          q.eq(q.field("category"), args.category),
          q.eq(q.field("isActive"), true)
        )
      )
      .collect();

    return models.map((m) => ({
      _id: m._id,
      brandName: m.brandName,
      modelName: m.modelName,
      category: m.category,
    }));
  },
});

// Search models with server-side filtering (on-demand)
export const searchModels = query({
  args: {
    query: v.string(),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const searchQuery = args.query.toLowerCase().trim();
    if (searchQuery.length < 2) {
      return [];
    }

    // Fetch models (with optional category filter)
    let allModels;
    
    if (args.category !== undefined) {
      const category = args.category;
      allModels = await ctx.db
        .query("supportedModels")
        .withIndex("by_category", (q) => q.eq("category", category))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
    } else {
      allModels = await ctx.db
        .query("supportedModels")
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
    }

    // Filter by search query (brand or model name)
    const filtered = allModels.filter((model) => {
      const brandMatch = model.brandName.toLowerCase().includes(searchQuery);
      const modelMatch = model.modelName.toLowerCase().includes(searchQuery);
      return brandMatch || modelMatch;
    });

    // Sort by relevance (brand exact match first, then model match)
    const sorted = filtered.sort((a, b) => {
      const aBrandExact = a.brandName.toLowerCase() === searchQuery;
      const bBrandExact = b.brandName.toLowerCase() === searchQuery;
      if (aBrandExact && !bBrandExact) return -1;
      if (!aBrandExact && bBrandExact) return 1;
      return a.modelName.localeCompare(b.modelName);
    });

    // Apply limit
    const limit = args.limit || 50;
    return sorted.slice(0, limit).map((m) => ({
      _id: m._id,
      brandName: m.brandName,
      modelName: m.modelName,
      category: m.category,
    }));
  },
});
