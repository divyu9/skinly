import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// Helper: Parse SKU from filename (e.g., "iphone11_L-01.jpg" -> "L-01")
function parseSKUFromFilename(filename: string): string | null {
  // Match patterns like L-01, M-123, S-45, etc.
  const match = filename.match(/([LMSBF])-(\d+)/i);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Store mockup with advanced model linking
 */
export const storeMockupAdvanced = mutation({
  args: {
    brand: v.string(),
    model: v.string(),
    sku: v.string(),
    fileId: v.id("_storage"),
    supportedModelId: v.id("supportedModels"),
  },
  handler: async (ctx, args) => {
    // Check if mockup already exists
    const existing = await ctx.db
      .query("mockups")
      .withIndex("by_brand_model_sku", (q) =>
        q.eq("brand", args.brand).eq("model", args.model).eq("sku", args.sku)
      )
      .first();

    if (existing) {
      // Update with supportedModelId
      await ctx.db.patch(existing._id, {
        supportedModelId: args.supportedModelId,
      });
      return existing._id;
    }

    // Create new mockup
    return await ctx.db.insert("mockups", {
      brand: args.brand,
      model: args.model,
      sku: args.sku,
      fileId: args.fileId,
      supportedModelId: args.supportedModelId,
    });
  },
});

/**
 * Get models that have at least one mockup uploaded
 */
export const getModelsWithMockups = query({
  args: {
    brandFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all supported models
    let modelsQuery = ctx.db.query("supportedModels");
    const allModels = await modelsQuery.collect();

    // Filter by brand if specified
    const models = args.brandFilter
      ? allModels.filter(m => m.brandName === args.brandFilter)
      : allModels;

    // Get all mockups
    const allMockups = await ctx.db.query("mockups").collect();

    // Filter models that have mockups
    const modelsWithMockups = [];
    for (const model of models) {
      const modelMockups = allMockups.filter(
        m => m.supportedModelId === model._id
      );

      if (modelMockups.length > 0) {
        modelsWithMockups.push({
          _id: model._id,
          brandName: model.brandName,
          modelName: model.modelName,
          category: model.category,
          mockupCount: modelMockups.length,
        });
      }
    }

    return modelsWithMockups.sort((a, b) => 
      a.brandName.localeCompare(b.brandName) || a.modelName.localeCompare(b.modelName)
    );
  },
});

/**
 * Get models that are missing mockups (have 0 mockups)
 */
export const getModelsMissingMockups = query({
  args: {
    brandFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all supported models
    const allModels = await ctx.db.query("supportedModels").collect();

    // Filter by brand if specified
    const models = args.brandFilter
      ? allModels.filter(m => m.brandName === args.brandFilter)
      : allModels;

    // Get all mockups
    const allMockups = await ctx.db.query("mockups").collect();

    // Filter models with zero mockups
    const missingModels = [];
    for (const model of models) {
      const modelMockups = allMockups.filter(
        m => m.supportedModelId === model._id
      );

      if (modelMockups.length === 0) {
        missingModels.push({
          _id: model._id,
          brandName: model.brandName,
          modelName: model.modelName,
          category: model.category,
        });
      }
    }

    return missingModels.sort((a, b) => 
      a.brandName.localeCompare(b.brandName) || a.modelName.localeCompare(b.modelName)
    );
  },
});

/**
 * Get models with 100% mockup coverage
 */
export const getModelsWithFullCoverage = query({
  args: {
    brandFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all supported models
    const allModels = await ctx.db.query("supportedModels").collect();

    // Filter by brand if specified
    const models = args.brandFilter
      ? allModels.filter(m => m.brandName === args.brandFilter)
      : allModels;

    // Get all mockups and variants
    const allMockups = await ctx.db.query("mockups").collect();
    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const skinProducts = allProducts.filter(p => p.productCategory === "skin");
    const allVariants = await ctx.db.query("variants").collect();

    // Calculate total SKUs once
    const totalSKUs: string[] = [];
    for (const product of skinProducts) {
      const productVariants = allVariants.filter(v => v.productId === product._id);
      totalSKUs.push(...productVariants.map(v => v.sku));
    }
    const uniqueTotalSKUs = [...new Set(totalSKUs)];
    
    if (uniqueTotalSKUs.length === 0) return [];

    // Filter models with 100% coverage
    const fullCoverageModels = [];
    for (const model of models) {
      const modelMockups = allMockups.filter(
        m => m.supportedModelId === model._id
      );

      const uploadedSKUs = [...new Set(modelMockups.map(m => m.sku.toUpperCase()))];
      const coverage = (uploadedSKUs.length / uniqueTotalSKUs.length) * 100;

      if (coverage === 100) {
        fullCoverageModels.push({
          _id: model._id,
          brandName: model.brandName,
          modelName: model.modelName,
          category: model.category,
          mockupCount: modelMockups.length,
          totalSKUs: uniqueTotalSKUs.length,
        });
      }
    }

    return fullCoverageModels.sort((a, b) => 
      a.brandName.localeCompare(b.brandName) || a.modelName.localeCompare(b.modelName)
    );
  },
});

/**
 * Get mockup stats for a specific model
 */
export const getModelMockupStats = query({
  args: {
    modelId: v.id("supportedModels"),
  },
  handler: async (ctx, args) => {
    // Get total SKUs for this model by fetching all phone skin variants
    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    
    const skinProducts = allProducts.filter(p => p.productCategory === "skin");
    const allVariants = await ctx.db.query("variants").collect();
    
    const totalSKUs: string[] = [];
    for (const product of skinProducts) {
      const productVariants = allVariants.filter(v => v.productId === product._id);
      totalSKUs.push(...productVariants.map(v => v.sku));
    }
    const uniqueTotalSKUs = [...new Set(totalSKUs)];

    // Get uploaded mockups for this model
    const allMockups = await ctx.db.query("mockups").collect();
    const modelMockups = allMockups.filter(
      m => m.supportedModelId === args.modelId
    );

    const uploadedSKUs = [...new Set(modelMockups.map(m => m.sku.toUpperCase()))];
    const coverage = uniqueTotalSKUs.length > 0 
      ? (uploadedSKUs.length / uniqueTotalSKUs.length) * 100 
      : 0;

    // Find missing SKUs
    const missingSKUs = uniqueTotalSKUs.filter(
      sku => !uploadedSKUs.includes(sku.toUpperCase())
    );

    return {
      totalSKUs: uniqueTotalSKUs.length,
      uploadedSKUs: uploadedSKUs.length,
      missingSKUs,
      coverage: Math.round(coverage),
      mockups: modelMockups.map(m => ({
        _id: m._id,
        sku: m.sku,
        fileId: m.fileId,
      })),
    };
  },
});

/**
 * Get total phone skin SKU count across all products
 */
export const getTotalPhoneSkinSKUs = query({
  args: {},
  handler: async (ctx) => {
    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const skinProducts = allProducts.filter(p => p.productCategory === "skin");
    const allVariants = await ctx.db.query("variants").collect();

    let totalSKUs = 0;
    for (const product of skinProducts) {
      const productVariants = allVariants.filter(v => v.productId === product._id);
      totalSKUs += productVariants.length;
    }

    return totalSKUs;
  },
});

/**
 * Delete mockup
 */
export const deleteMockup = mutation({
  args: {
    mockupId: v.id("mockups"),
  },
  handler: async (ctx, args) => {
    const mockup = await ctx.db.get(args.mockupId);
    if (!mockup) {
      throw new Error("Mockup not found");
    }

    // Delete the file from storage
    await ctx.storage.delete(mockup.fileId);

    // Delete the mockup record
    await ctx.db.delete(args.mockupId);

    return { success: true };
  },
});

/**
 * Delete all mockups for a model
 */
export const deleteAllMockupsForModel = mutation({
  args: {
    modelId: v.id("supportedModels"),
  },
  handler: async (ctx, args) => {
    const allMockups = await ctx.db.query("mockups").collect();
    const modelMockups = allMockups.filter(
      m => m.supportedModelId === args.modelId
    );

    for (const mockup of modelMockups) {
      await ctx.storage.delete(mockup.fileId);
      await ctx.db.delete(mockup._id);
    }

    return { deleted: modelMockups.length };
  },
});

/**
 * Migrate existing mockups to link with supportedModels
 */
export const migrateMockupsToModels = mutation({
  args: {},
  handler: async (ctx) => {
    const allMockups = await ctx.db.query("mockups").collect();
    const allModels = await ctx.db.query("supportedModels").collect();

    let updated = 0;
    let noMatch = 0;

    for (const mockup of allMockups) {
      // Skip if already has supportedModelId
      if (mockup.supportedModelId) continue;

      // Find matching model (case-insensitive)
      const matchingModel = allModels.find(
        m =>
          m.brandName.toLowerCase() === mockup.brand.toLowerCase() &&
          m.modelName.toLowerCase() === mockup.model.toLowerCase()
      );

      if (matchingModel) {
        await ctx.db.patch(mockup._id, {
          supportedModelId: matchingModel._id,
        });
        updated++;
      } else {
        noMatch++;
      }
    }

    return { updated, noMatch, total: allMockups.length };
  },
});

/**
 * Get unique brands from supported models
 */
export const getUniqueBrands = query({
  args: {},
  handler: async (ctx) => {
    const allModels = await ctx.db.query("supportedModels").collect();
    const brands = [...new Set(allModels.map(m => m.brandName))];
    return brands.sort();
  },
});
