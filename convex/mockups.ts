import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get mockup file ID for a specific brand, model, and SKU
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

    return mockup?.fileId || null;
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
