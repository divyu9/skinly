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
    // Get models based on brand filter
    const brandFilter = args.brandFilter;
    const models = brandFilter
      ? await ctx.db
          .query("supportedModels")
          .withIndex("by_brand", (q) => q.eq("brandName", brandFilter))
          .take(200)
      : await ctx.db.query("supportedModels").take(200);

    // For each model, check if it has mockups using the index
    const modelsWithMockups = [];
    for (const model of models) {
      const firstMockup = await ctx.db
        .query("mockups")
        .withIndex("by_supported_model", (q) => 
          q.eq("supportedModelId", model._id)
        )
        .first();

      if (firstMockup) {
        // Count mockups for this model
        const modelMockups = await ctx.db
          .query("mockups")
          .withIndex("by_supported_model", (q) => 
            q.eq("supportedModelId", model._id)
          )
          .collect();

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
    // Get models based on brand filter
    const brandFilter = args.brandFilter;
    const models = brandFilter
      ? await ctx.db
          .query("supportedModels")
          .withIndex("by_brand", (q) => q.eq("brandName", brandFilter))
          .take(200)
      : await ctx.db.query("supportedModels").take(200);

    // For each model, check if it has any mockups using the index
    const missingModels = [];
    for (const model of models) {
      const firstMockup = await ctx.db
        .query("mockups")
        .withIndex("by_supported_model", (q) => 
          q.eq("supportedModelId", model._id)
        )
        .first();

      if (!firstMockup) {
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
    // Get models based on brand filter
    const brandFilter = args.brandFilter;
    const models = brandFilter
      ? await ctx.db
          .query("supportedModels")
          .withIndex("by_brand", (q) => q.eq("brandName", brandFilter))
          .take(200)
      : await ctx.db.query("supportedModels").take(200);

    // Calculate total SKUs once (limit to first 100 products to avoid read limits)
    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(100);
    const skinProducts = allProducts.filter(p => p.productCategory === "skin");
    
    const totalSKUs: string[] = [];
    for (const product of skinProducts) {
      const productVariants = await ctx.db
        .query("variants")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();
      totalSKUs.push(...productVariants.map(v => v.sku));
    }
    const uniqueTotalSKUs = [...new Set(totalSKUs)];
    
    if (uniqueTotalSKUs.length === 0) return [];

    // For each model, check mockup coverage using the index
    const fullCoverageModels = [];
    for (const model of models) {
      const modelMockups = await ctx.db
        .query("mockups")
        .withIndex("by_supported_model", (q) => 
          q.eq("supportedModelId", model._id)
        )
        .collect();

      if (modelMockups.length === 0) continue;

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
    // Get total SKUs for this model by fetching all phone skin variants (limit to 100 products)
    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(100);
    
    const skinProducts = allProducts.filter(p => p.productCategory === "skin");
    
    const totalSKUs: string[] = [];
    for (const product of skinProducts) {
      const productVariants = await ctx.db
        .query("variants")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();
      totalSKUs.push(...productVariants.map(v => v.sku));
    }
    const uniqueTotalSKUs = [...new Set(totalSKUs)];

    // Get uploaded mockups for this model using the index
    const modelMockups = await ctx.db
      .query("mockups")
      .withIndex("by_supported_model", (q) => 
        q.eq("supportedModelId", args.modelId)
      )
      .collect();

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
    // Limit to 100 products to avoid read limits
    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(100);

    const skinProducts = allProducts.filter(p => p.productCategory === "skin");

    let totalSKUs = 0;
    for (const product of skinProducts) {
      const productVariants = await ctx.db
        .query("variants")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();
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
    // Use the index to get only this model's mockups
    const modelMockups = await ctx.db
      .query("mockups")
      .withIndex("by_supported_model", (q) => 
        q.eq("supportedModelId", args.modelId)
      )
      .collect();

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
    // Get mockups without supportedModelId (limit to 1000 to avoid read limits)
    const allMockups = await ctx.db
      .query("mockups")
      .filter((q) => q.eq(q.field("supportedModelId"), undefined))
      .take(1000);
    
    // Get models (limit to 200)
    const allModels = await ctx.db.query("supportedModels").take(200);

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
