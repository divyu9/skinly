import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Normalize model name for matching (removes spaces, lowercase)
 */
function normalizeModelName(model: string): string {
  return model.toLowerCase().replace(/\s+/g, '');
}

/**
 * Get mockup file URL for a specific brand, model, and SKU
 * Returns the actual storage URL, not just the file ID
 * Uses space-insensitive matching for model names
 */
export const getMockupFileId = query({
  args: {
    brand: v.string(),
    model: v.string(),
    sku: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalize the search model name
    const normalizedSearchModel = normalizeModelName(args.model);
    
    // Get all mockups for this brand and SKU
    const mockups = await ctx.db
      .query("mockups")
      .withIndex("by_brand_model_sku", (q) =>
        q.eq("brand", args.brand)
      )
      .collect();
    
    // Find mockup with matching normalized model name and SKU
    const mockup = mockups.find((m) => 
      normalizeModelName(m.model) === normalizedSearchModel && m.sku === args.sku
    );

    if (!mockup) return null;
    
    // Get the actual storage URL
    const url = await ctx.storage.getUrl(mockup.fileId);
    return url;
  },
});

/**
 * Get all mockups (paginated)
 */
export const getAllMockups = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("mockups").collect();
  },
});

/**
 * Bulk import mockups from CSV data
 * Expected format: brand,model,sku,fileId
 * Uses space-insensitive matching for model names
 */
export const bulkImportMockups = mutation({
  args: {
    mockups: v.array(
      v.object({
        brand: v.string(),
        model: v.string(),
        sku: v.string(),
        fileId: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const mockup of args.mockups) {
      // Normalize model name for comparison
      const normalizedModel = normalizeModelName(mockup.model);
      
      // Check if mockup already exists (space-insensitive match)
      const allMockups = await ctx.db
        .query("mockups")
        .withIndex("by_brand_model_sku", (q) =>
          q.eq("brand", mockup.brand)
        )
        .collect();
      
      const existing = allMockups.find((m) => 
        normalizeModelName(m.model) === normalizedModel && m.sku === mockup.sku
      );

      if (existing) {
        // Update if fileId changed
        if (existing.fileId !== mockup.fileId) {
          await ctx.db.patch(existing._id, { fileId: mockup.fileId });
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Insert new mockup (preserve original model name formatting)
        await ctx.db.insert("mockups", mockup);
        imported++;
      }
    }

    return { imported, updated, skipped };
  },
});

/**
 * Delete a mockup
 */
export const deleteMockup = mutation({
  args: { id: v.id("mockups") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/**
 * Clear a batch of mockups (up to 1000 at a time)
 * Returns number deleted and whether more remain
 */
export const clearAllMockups = mutation({
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
 * Generate upload URL for mockup files
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Keep-alive ping mutation
 * Lightweight mutation to prevent dev machine from sleeping during uploads
 */
export const keepAlivePing = mutation({
  args: {},
  handler: async () => {
    // Do nothing - just keep the connection alive
    return { timestamp: Date.now() };
  },
});

/**
 * Get all products (SKUs) that have mockups for a specific model
 * Returns array of { sku, imageUrl }
 */
export const getProductsWithMockupsForModel = query({
  args: {
    model: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalize model name for search (remove spaces, lowercase)
    const normalizedSearch = args.model.toLowerCase().replace(/\s+/g, "");
    
    // Get all mockups
    const allMockups = await ctx.db.query("mockups").collect();
    
    // Filter mockups that match the model (case-insensitive, flexible matching)
    const matchingMockups = allMockups.filter((mockup) => {
      const normalizedMockupModel = mockup.model.toLowerCase().replace(/\s+/g, "");
      return normalizedMockupModel.includes(normalizedSearch) || 
             normalizedSearch.includes(normalizedMockupModel);
    });
    
    // Group by SKU to get unique products with their image URLs
    const uniqueProducts = new Map<string, string>();
    for (const mockup of matchingMockups) {
      if (!uniqueProducts.has(mockup.sku)) {
        const url = await ctx.storage.getUrl(mockup.fileId);
        if (url) {
          uniqueProducts.set(mockup.sku, url);
        }
      }
    }
    
    return Array.from(uniqueProducts.entries()).map(([sku, imageUrl]) => ({
      sku,
      imageUrl,
    }));
  },
});

/**
 * Verify all mockup file IDs and identify broken links
 * Returns list of mockups with broken file links
 */
export const verifyMockupFiles = query({
  args: {},
  handler: async (ctx) => {
    const mockups = await ctx.db.query("mockups").collect();
    const brokenMockups = [];
    
    for (const mockup of mockups) {
      try {
        // Try to get the storage URL - if file doesn't exist, this will be null
        const url = await ctx.storage.getUrl(mockup.fileId);
        if (!url) {
          brokenMockups.push({
            id: mockup._id,
            brand: mockup.brand,
            model: mockup.model,
            sku: mockup.sku,
            fileId: mockup.fileId,
          });
        }
      } catch (error) {
        // File definitely doesn't exist
        brokenMockups.push({
          id: mockup._id,
          brand: mockup.brand,
          model: mockup.model,
          sku: mockup.sku,
          fileId: mockup.fileId,
        });
      }
    }
    
    return {
      total: mockups.length,
      broken: brokenMockups.length,
      brokenMockups,
    };
  },
});

/**
 * Check which filenames already exist in the database
 * Used to resume interrupted uploads by skipping already uploaded files
 */
export const checkExistingMockupFilenames = query({
  args: {
    filenames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all mockups
    const allMockups = await ctx.db.query("mockups").collect();
    
    // Create a set of existing filename combinations for fast lookup
    // Normalize filenames: brand_model_sku format (case-insensitive, no extension)
    const existingSet = new Set<string>();
    
    for (const mockup of allMockups) {
      // Reconstruct the filename pattern from database records
      // Handle both formats: Brand_Model_SKU and Model_SKU (for Apple auto-detection)
      const normalizedModel = mockup.model.replace(/\s+/g, '_');
      const filename1 = `${mockup.brand}_${normalizedModel}_${mockup.sku}`.toLowerCase();
      const filename2 = `${normalizedModel}_${mockup.sku}`.toLowerCase(); // Without brand
      existingSet.add(filename1);
      existingSet.add(filename2);
    }
    
    // Check which input filenames already exist
    const existingFilenames: string[] = [];
    const missingFilenames: string[] = [];
    
    for (const filename of args.filenames) {
      // Remove extension and normalize
      const normalized = filename
        .replace(/\.(jpg|jpeg|png|webp)$/i, '')
        .toLowerCase();
      
      if (existingSet.has(normalized)) {
        existingFilenames.push(filename);
      } else {
        missingFilenames.push(filename);
      }
    }
    
    return {
      total: args.filenames.length,
      existing: existingFilenames.length,
      missing: missingFilenames.length,
      existingFilenames,
      missingFilenames,
    };
  },
});

/**
 * Get missing mockups by checking which phone model + SKU combinations lack mockup images
 * Returns models grouped by brand with their missing SKUs
 */
export const getMissingMockups = query({
  args: { 
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const category = args.category || "phone";
    
    // Get all supported models for the category
    const supportedModels = await ctx.db
      .query("supportedModels")
      .filter((q) => q.and(
        q.eq(q.field("category"), category),
        q.eq(q.field("isActive"), true)
      ))
      .collect();
    
    // Get all products first
    const allProducts = await ctx.db.query("products").collect();
    
    // Filter to only products with "Phone Skin" in the title
    const skinProducts = allProducts.filter(p => 
      p.title.toLowerCase().includes("phone skin")
    );
    const skinProductIds = new Set(skinProducts.map(p => p._id));
    
    // Get all product variants (SKUs) for skin products only
    const variants = await ctx.db.query("variants").collect();
    const allSKUs = new Set<string>();
    for (const variant of variants) {
      // Only include SKUs from products with "Skins" in the name
      if (skinProductIds.has(variant.productId)) {
        allSKUs.add(variant.sku);
      }
    }
    
    // Get all existing mockups
    const existingMockups = await ctx.db.query("mockups").collect();
    
    // Create a set of existing mockup combinations (normalized model + SKU)
    const existingCombos = new Set<string>();
    for (const mockup of existingMockups) {
      const key = `${normalizeModelName(mockup.model)}|${mockup.sku}`;
      existingCombos.add(key);
    }
    
    // Find missing combinations
    const missingByModel: Record<string, {
      brand: string;
      model: string;
      missingSKUs: string[];
      totalMissing: number;
    }> = {};
    
    for (const supportedModel of supportedModels) {
      const normalizedModel = normalizeModelName(supportedModel.modelName);
      const missingSKUs: string[] = [];
      
      for (const sku of allSKUs) {
        const key = `${normalizedModel}|${sku}`;
        if (!existingCombos.has(key)) {
          missingSKUs.push(sku);
        }
      }
      
      if (missingSKUs.length > 0) {
        const modelKey = `${supportedModel.brandName}|${supportedModel.modelName}`;
        missingByModel[modelKey] = {
          brand: supportedModel.brandName,
          model: supportedModel.modelName,
          missingSKUs,
          totalMissing: missingSKUs.length,
        };
      }
    }
    
    // Convert to array and sort by brand then model
    const results = Object.values(missingByModel).sort((a, b) => {
      if (a.brand !== b.brand) {
        return a.brand.localeCompare(b.brand);
      }
      return a.model.localeCompare(b.model);
    });
    
    // Calculate stats
    const totalMissingCombinations = results.reduce((sum, r) => sum + r.totalMissing, 0);
    const uniqueBrands = new Set(results.map(r => r.brand)).size;
    
    return {
      results,
      stats: {
        totalMissingCombinations,
        modelsAffected: results.length,
        brandsAffected: uniqueBrands,
        totalSKUs: allSKUs.size,
      }
    };
  },
});
