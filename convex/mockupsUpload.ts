import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Normalize model name for matching (removes spaces, lowercase)
 */
function normalizeModelName(model: string): string {
  return model.toLowerCase().replace(/\s+/g, '');
}

/**
 * Store mockup file with metadata
 * Called after file is uploaded to storage
 */
export const storeMockupFile = mutation({
  args: {
    fileId: v.string(),
    filename: v.string(),
  },
  handler: async (ctx, args) => {
    // Parse filename: Brand_Model_SKU.jpg or Model_SKU.jpg
    const nameWithoutExt = args.filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const parts = nameWithoutExt.split('_');
    
    if (parts.length < 2) {
      throw new Error(`Invalid filename format: ${args.filename}. Expected at least Model_SKU.jpg`);
    }
    
    // Last part is always SKU
    const sku = parts[parts.length - 1];
    
    // Check if filename contains iPhone or iPad to auto-detect Apple brand
    const filenameLower = nameWithoutExt.toLowerCase();
    const isAppleDevice = filenameLower.includes('iphone') || filenameLower.includes('ipad');
    
    let brand: string;
    let model: string;
    
    if (isAppleDevice) {
      // Auto-detect Apple brand
      brand = 'Apple';
      // Model is everything except the last part (SKU)
      model = parts.slice(0, -1).join(' ');
    } else if (parts.length === 2) {
      // Format: Model_SKU.jpg (no brand specified)
      throw new Error(`Invalid filename format: ${args.filename}. Non-Apple devices must include brand: Brand_Model_SKU.jpg`);
    } else {
      // Format: Brand_Model_SKU.jpg (3+ parts)
      brand = parts[0];
      // Model is everything between brand and SKU
      model = parts.slice(1, -1).join(' ');
    }
    
    // Validate we have all required parts
    if (!brand || !model || !sku) {
      throw new Error(`Invalid filename format: ${args.filename}. Could not extract brand, model, and SKU.`);
    }
    
    // Normalize model name for comparison
    const normalizedModel = normalizeModelName(model);
    
    // Check if mockup already exists (space-insensitive match)
    const allMockups = await ctx.db
      .query("mockups")
      .withIndex("by_brand_model_sku", (q) =>
        q.eq("brand", brand)
      )
      .collect();
    
    const existing = allMockups.find((m) => 
      normalizeModelName(m.model) === normalizedModel && m.sku === sku
    );
    
    if (existing) {
      // Update file ID if changed
      if (existing.fileId !== args.fileId) {
        await ctx.db.patch(existing._id, { fileId: args.fileId });
        return { action: "updated", brand, model, sku };
      }
      return { action: "skipped", brand, model, sku };
    }
    
    // Insert new mockup (preserve original model name formatting)
    await ctx.db.insert("mockups", {
      brand,
      model,
      sku,
      fileId: args.fileId,
    });
    
    return { action: "created", brand, model, sku };
  },
});
