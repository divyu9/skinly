import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all supported models with filters
export const listAll = query({
  args: {
    category: v.optional(v.union(
      v.literal("phone"),
      v.literal("tablet"),
      v.literal("laptop"),
      v.literal("console"),
      v.literal("charger"),
      v.literal("drone"),
      v.literal("camera"),
      v.literal("lens"),
      v.literal("mac-mini")
    )),
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
  handler: async (ctx) => {
    const models = await ctx.db.query("supportedModels").collect();
    const brandSet = new Set(models.map((m) => m.brandName));
    return Array.from(brandSet).sort();
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

// Create a new model
export const create = mutation({
  args: {
    brandName: v.string(),
    modelName: v.string(),
    category: v.union(
      v.literal("phone"),
      v.literal("tablet"),
      v.literal("laptop"),
      v.literal("console"),
      v.literal("charger"),
      v.literal("drone"),
      v.literal("camera"),
      v.literal("lens"),
      v.literal("mac-mini")
    ),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const modelId = await ctx.db.insert("supportedModels", {
      brandName: args.brandName,
      modelName: args.modelName,
      category: args.category,
      isActive: args.isActive,
    });
    return modelId;
  },
});

// Update a model
export const update = mutation({
  args: {
    id: v.id("supportedModels"),
    brandName: v.optional(v.string()),
    modelName: v.optional(v.string()),
    category: v.optional(v.union(
      v.literal("phone"),
      v.literal("tablet"),
      v.literal("laptop"),
      v.literal("console"),
      v.literal("charger"),
      v.literal("drone"),
      v.literal("camera"),
      v.literal("lens"),
      v.literal("mac-mini")
    )),
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
  },
});

// Bulk create models
export const bulkCreate = mutation({
  args: {
    models: v.array(v.object({
      brandName: v.string(),
      modelName: v.string(),
      category: v.union(
        v.literal("phone"),
        v.literal("tablet"),
        v.literal("laptop"),
        v.literal("console"),
        v.literal("charger"),
        v.literal("drone"),
        v.literal("camera"),
        v.literal("lens"),
        v.literal("mac-mini")
      ),
      isActive: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const model of args.models) {
      const id = await ctx.db.insert("supportedModels", model);
      ids.push(id);
    }
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
