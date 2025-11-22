import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get mockup file URL for a specific brand, model, and SKU
 * Returns the actual storage URL, not just the file ID
 */
export const getMockupFileId = query({
  args: {
    brand: v.string(),
    model: v.string(),
    sku: v.string(),
  },
  handler: async (ctx, args) => {
    const mockup = await ctx.db
      .query("mockups")
      .withIndex("by_brand_model_sku", (q) =>
        q.eq("brand", args.brand).eq("model", args.model).eq("sku", args.sku)
      )
      .first();

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
      // Check if mockup already exists
      const existing = await ctx.db
        .query("mockups")
        .withIndex("by_brand_model_sku", (q) =>
          q
            .eq("brand", mockup.brand)
            .eq("model", mockup.model)
            .eq("sku", mockup.sku)
        )
        .first();

      if (existing) {
        // Update if fileId changed
        if (existing.fileId !== mockup.fileId) {
          await ctx.db.patch(existing._id, { fileId: mockup.fileId });
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Insert new mockup
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
 * Clear all mockups
 */
export const clearAllMockups = mutation({
  args: {},
  handler: async (ctx) => {
    const mockups = await ctx.db.query("mockups").collect();
    for (const mockup of mockups) {
      await ctx.db.delete(mockup._id);
    }
    return { deleted: mockups.length };
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
