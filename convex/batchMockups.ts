// convex/mockups.ts
// Add this function to your existing mockups.ts file
// OR create new file if doesn't exist

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Batch fetch mockups for multiple SKUs at once
 * This replaces N individual queries with 1 batch query
 * 
 * @param brand - Selected device brand (e.g., "Samsung")
 * @param model - Selected device model (e.g., "Galaxy S24 Ultra")
 * @param skus - Array of product SKUs to fetch mockups for
 * @returns Object mapping SKU to mockup URL: { "SKU123": "https://...", ... }
 */
export const getBatchMockups = query({
  args: {
    brand: v.string(),
    model: v.string(),
    skus: v.array(v.string()),
  },
  handler: async (ctx, { brand, model, skus }) => {
    // Early return if no SKUs provided
    if (!skus || skus.length === 0) {
      return {};
    }

    // Fetch all mockups for this brand + model combination
    // This is more efficient than querying per SKU
    const mockups = await ctx.db
      .query("mockups")
      .withIndex("by_brand_model_sku", (q) =>
        q.eq("brand", brand).eq("model", model)
      )
      .collect();

    // Build result map: { sku: fileUrl }
    const result: Record<string, string> = {};

    for (const mockup of mockups) {
      if (!skus.includes(mockup.sku)) continue;

      // Prefer Cloudinary URL, fallback to Convex storage
      let url: string | null = null;
      if (mockup.cloudinaryUrl) {
        url = mockup.cloudinaryUrl;
      } else if (mockup.fileId) {
        url = await ctx.storage.getUrl(mockup.fileId);
      }

      if (url) {
        result[mockup.sku] = url;
      }
    }

    return result;
  },
});

/**
 * Alternative: If you don't have by_brand_model index, use this version
 * Less efficient but works without index changes
 */
export const getBatchMockupsNoIndex = query({
  args: {
    brand: v.string(),
    model: v.string(),
    skus: v.array(v.string()),
  },
  handler: async (ctx, { brand, model, skus }) => {
    if (!skus || skus.length === 0) {
      return {};
    }

    // Filter approach (works without specific index)
    const mockups = await ctx.db
      .query("mockups")
      .filter((q) =>
        q.and(
          q.eq(q.field("brand"), brand),
          q.eq(q.field("model"), model)
        )
      )
      .collect();

    const result: Record<string, string> = {};

    for (const mockup of mockups) {
      if (!skus.includes(mockup.sku)) continue;

      // Prefer Cloudinary URL, fallback to Convex storage
      let url: string | null = null;
      if (mockup.cloudinaryUrl) {
        url = mockup.cloudinaryUrl;
      } else if (mockup.fileId) {
        url = await ctx.storage.getUrl(mockup.fileId);
      }

      if (url) {
        result[mockup.sku] = url;
      }
    }

    return result;
  },
});
