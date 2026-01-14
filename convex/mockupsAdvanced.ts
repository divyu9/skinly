import { v } from "convex/values";
import { query, mutation, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import { internal } from "./_generated/api.js";

// Helper: Parse SKU from filename (e.g., "iphone11_L-01.jpg" -> "L-01")
function parseSKUFromFilename(filename: string): string | null {
  // Match patterns like L-01, M-123, S-45, R-123, A-01, T-50 etc.
  // Also supports optional suffixes like R-123-PH
  const match = filename.match(/([LMSBFART])-(\d+)(?:-[A-Z0-9]+)?/i);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Store mockup with advanced model linking and Cloudinary URL
 */
export const storeMockupAdvanced = mutation({
  args: {
    brand: v.string(),
    model: v.string(),
    sku: v.string(),
    cloudinaryUrl: v.string(),
    cloudinaryPublicId: v.string(),
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
      // Update with Cloudinary URL and supportedModelId
      await ctx.db.patch(existing._id, {
        cloudinaryUrl: args.cloudinaryUrl,
        cloudinaryPublicId: args.cloudinaryPublicId,
        supportedModelId: args.supportedModelId,
      });
      return existing._id;
    }

    // Create new mockup with Cloudinary data
    return await ctx.db.insert("mockups", {
      brand: args.brand,
      model: args.model,
      sku: args.sku,
      cloudinaryUrl: args.cloudinaryUrl,
      cloudinaryPublicId: args.cloudinaryPublicId,
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

    // Get ALL unique phone skin SKUs using helper
    const uniqueTotalSKUs = await getAllPhoneSkinSKUs(ctx);
    
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
    // Get ALL unique phone skin SKUs using helper
    const uniqueTotalSKUs = await getAllPhoneSkinSKUs(ctx);
    const uniqueTotalSKUsSet = new Set(uniqueTotalSKUs.map(s => s.toUpperCase()));

    // Get uploaded mockups for this model using the index
    const modelMockups = await ctx.db
      .query("mockups")
      .withIndex("by_supported_model", (q) => 
        q.eq("supportedModelId", args.modelId)
      )
      .collect();

    // Filter uploaded SKUs to only include valid phone skin SKUs
    // Note: We need flexible bidirectional matching to handle suffixes
    const allUploadedSKUs = [...new Set(modelMockups.map(m => m.sku.toUpperCase()))];
    
    // Create a set of covered DB SKUs
    const coveredDbSKUs = new Set<string>();

    for (const uploadedSkuRaw of allUploadedSKUs) {
      const uploadedSku = uploadedSkuRaw.trim();
      
      // Iterate through ALL valid SKUs to find matches
      // This is O(N*M) but M is small (~360) so it's efficient enough
      for (const dbSku of uniqueTotalSKUs) {
        const dbSkuUpper = dbSku.toUpperCase();
        
        // 1. Direct match (R-08 === R-08)
        if (dbSkuUpper === uploadedSku) {
          coveredDbSKUs.add(dbSku);
        }
        // 2. DB has suffix (DB: R-08-PH, Upload: R-08)
        // Check if DB SKU starts with "R-08-"
        else if (dbSkuUpper.startsWith(uploadedSku + "-")) {
          coveredDbSKUs.add(dbSku);
        }
        // 3. Upload has suffix (DB: R-08, Upload: R-08-PH)
        // Check if Upload SKU starts with "R-08-"
        else if (uploadedSku.startsWith(dbSkuUpper + "-")) {
          coveredDbSKUs.add(dbSku);
        }
      }
    }
    
    const validUploadedSKUs = Array.from(coveredDbSKUs);
    
    const coverage = uniqueTotalSKUs.length > 0 
      ? (validUploadedSKUs.length / uniqueTotalSKUs.length) * 100 
      : 0;

    // Find missing SKUs
    const missingSKUs = uniqueTotalSKUs.filter(
      sku => !coveredDbSKUs.has(sku.toUpperCase())
    );

    // Get inventory data for missing SKUs
    const missingSKUsInStock: string[] = [];
    const missingSKUsOutOfStock: string[] = [];

    for (const sku of missingSKUs) {
      // Get all variants with this SKU
      const variants = await ctx.db
        .query("variants")
        .withIndex("by_sku", (q) => q.eq("sku", sku))
        .collect();
      
      // Check if any variant has inventory > 0
      const hasStock = variants.some(v => v.inventoryQuantity > 0);
      
      if (hasStock) {
        missingSKUsInStock.push(sku);
      } else {
        missingSKUsOutOfStock.push(sku);
      }
    }

    return {
      totalSKUs: uniqueTotalSKUs.length,
      uploadedSKUs: validUploadedSKUs.length,
      missingSKUs,
      missingSKUsInStock,
      missingSKUsOutOfStock,
      coverage: Math.round(coverage),
      mockups: modelMockups.map(m => ({
        _id: m._id,
        sku: m.sku,
        fileId: m.fileId,
        cloudinaryUrl: m.cloudinaryUrl,
      })),
    };
  },
});

/**
 * Get ALL unique phone skin SKUs (helper for queries)
 */
async function getAllPhoneSkinSKUs(ctx: QueryCtx): Promise<string[]> {
  // Get phone gadget type ID
  const phoneGadgetType = await ctx.db
    .query("gadgetTypes")
    .withIndex("by_name", (q) => q.eq("name", "phone"))
    .first();
  
  if (!phoneGadgetType) return [];

  // Get ALL active products (collect should work for ~700 products)
  const allProducts = await ctx.db
    .query("products")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .collect();

  const phoneSkinProducts = allProducts.filter(p => 
    p.productCategory === "skin" && p.gadgetTypeId === phoneGadgetType._id
  );

  // Collect all SKUs from variants
  const allSKUs: string[] = [];
  for (const product of phoneSkinProducts) {
    const variants = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .collect();
    allSKUs.push(...variants.map(v => v.sku.toUpperCase()));
  }

  return [...new Set(allSKUs)];
}

/**
 * Get total phone skin SKU count across all products
 */
export const getTotalPhoneSkinSKUs = query({
  args: {},
  handler: async (ctx) => {
    const allSKUs = await getAllPhoneSkinSKUs(ctx);
    return allSKUs.length;
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

    // Delete from Cloudinary if cloudinaryPublicId exists
    if (mockup.cloudinaryPublicId) {
      try {
        await ctx.scheduler.runAfter(0, (internal as any).cloudinary.deleteFromCloudinary, {
          publicId: mockup.cloudinaryPublicId,
        });
      } catch (error) {
        console.error("Failed to delete from Cloudinary:", error);
      }
    }

    // Delete legacy file from Convex storage if it exists
    if (mockup.fileId) {
      try {
        await ctx.storage.delete(mockup.fileId);
      } catch (error) {
        console.error("Failed to delete from Convex storage:", error);
      }
    }

    // Delete the mockup record
    await ctx.db.delete(args.mockupId);

    return { success: true };
  },
});

export const deleteMockupsBySKU = mutation({
  args: {
    sku: v.string(),
  },
  handler: async (ctx, args) => {
    // Find all mockups with this SKU
    const mockups = await ctx.db
      .query("mockups")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .collect();

    if (mockups.length === 0) {
      return { deleted: 0 };
    }

    for (const mockup of mockups) {
      // Delete from Cloudinary if cloudinaryPublicId exists
      if (mockup.cloudinaryPublicId) {
        try {
          await ctx.scheduler.runAfter(0, (internal as any).cloudinary.deleteFromCloudinary, {
            publicId: mockup.cloudinaryPublicId,
          });
        } catch (error) {
          console.error("Failed to delete from Cloudinary:", error);
        }
      }

      // Delete legacy file from Convex storage if it exists
      if (mockup.fileId) {
        try {
          await ctx.storage.delete(mockup.fileId);
        } catch (error) {
          console.error("Failed to delete from Convex storage:", error);
        }
      }

      // Delete the mockup record
      await ctx.db.delete(mockup._id);
    }

    return { deleted: mockups.length };
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
      // Delete from Cloudinary if cloudinaryPublicId exists
      if (mockup.cloudinaryPublicId) {
        try {
          await ctx.scheduler.runAfter(0, (internal as any).cloudinary.deleteFromCloudinary, {
            publicId: mockup.cloudinaryPublicId,
          });
        } catch (error) {
          console.error("Failed to delete from Cloudinary:", error);
        }
      }

      // Delete legacy file from Convex storage if it exists
      if (mockup.fileId) {
        try {
          await ctx.storage.delete(mockup.fileId);
        } catch (error) {
          console.error("Failed to delete from Convex storage:", error);
        }
      }

      await ctx.db.delete(mockup._id);
    }

    return { deleted: modelMockups.length };
  },
});

/**
 * Delete ALL mockups in the system (Batched)
 * Also tries to delete associated storage files
 */
export const deleteAllMockups = mutation({
  args: {},
  handler: async (ctx) => {
    // Fetch a batch of mockups to delete (limit to prevent timeouts)
    const mockups = await ctx.db.query("mockups").take(200);

    for (const mockup of mockups) {
      // Delete from Cloudinary if cloudinaryPublicId exists
      if (mockup.cloudinaryPublicId) {
        try {
          await ctx.scheduler.runAfter(0, (internal as any).cloudinary.deleteFromCloudinary, {
            publicId: mockup.cloudinaryPublicId,
          });
        } catch (error) {
          console.error("Failed to delete from Cloudinary:", error);
        }
      }

      // Delete legacy file from Convex storage if it exists
      if (mockup.fileId) {
        try {
          await ctx.storage.delete(mockup.fileId);
        } catch (error) {
          // Ignore storage errors - file may not exist in this account
          console.log("Storage file not found (expected for migrated data):", mockup.fileId);
        }
      }

      // Delete the mockup record
      await ctx.db.delete(mockup._id);
    }

    return {
      deleted: mockups.length,
      hasMore: mockups.length === 200
    };
  },
});

/**
 * Purge ALL mockup database records WITHOUT deleting storage files
 * Use this for clearing imported data from old accounts where storage files don't exist
 * Deletes 1000 records per call for speed
 */
export const purgeAllMockupRecords = mutation({
  args: {},
  handler: async (ctx) => {
    const BATCH_SIZE = 1000;
    const mockups = await ctx.db.query("mockups").take(BATCH_SIZE);

    for (const mockup of mockups) {
      await ctx.db.delete(mockup._id);
    }

    // Check if there are more mockups remaining
    const remaining = await ctx.db.query("mockups").first();

    return {
      deleted: mockups.length,
      hasMore: remaining !== null
    };
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

/**
 * Get overview statistics for all mockups  
 * Ultra-simplified to avoid document read limits - uses hardcoded total SKU count
 */
export const getOverviewStats = query({
  args: {},
  handler: async (ctx) => {
    // Get mockups with a safe limit to avoid hitting read limits (16k limit)
    const mockupsSample = await ctx.db.query("mockups").take(15000);
    const totalMockups = mockupsSample.length;

    // Count unique SKUs from mockups sample
    const uniqueSKUsSet = new Set(mockupsSample.map(m => m.sku.toUpperCase()));
    const uniqueSKUs = uniqueSKUsSet.size;
    
    // Use hardcoded total SKU count to avoid expensive queries
    // This value represents the total number of unique phone skin SKUs in the system
    // Update this value manually if the product catalog changes significantly
    const TOTAL_PHONE_SKIN_SKUS = 359;
    
    // Calculate coverage
    const coverage = Math.round((uniqueSKUs / TOTAL_PHONE_SKIN_SKUS) * 100);

    return {
      totalMockups,
      uniqueSKUs,
      totalSKUs: TOTAL_PHONE_SKIN_SKUS,
      coverage: Math.min(coverage, 100), // Cap at 100%
    };
  },
});
