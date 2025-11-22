import { v } from "convex/values";
import { mutation } from "./_generated/server";

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
    // Parse filename: Brand_Model_SKU.jpg or iPhone_Model_SKU.jpg
    const nameWithoutExt = args.filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const parts = nameWithoutExt.split('_');
    
    if (parts.length < 2) {
      throw new Error(`Invalid filename format: ${args.filename}. Expected: Brand_Model_SKU.jpg or iPhone_Model_SKU.jpg`);
    }
    
    let brand = parts[0];
    let sku = parts[parts.length - 1];
    let model = parts.slice(1, -1).join(' ');
    
    // Auto-detect Apple brand if filename contains "iPhone" or "iPad"
    const filenameLower = nameWithoutExt.toLowerCase();
    if (filenameLower.includes('iphone') || filenameLower.includes('ipad')) {
      // If brand is "iPhone" or "iPad", it means the filename is like "iPhone16_M-75.jpg"
      if (brand.toLowerCase() === 'iphone' || brand.toLowerCase() === 'ipad') {
        // Reconstruct: brand = Apple, model = iPhone + rest
        brand = 'Apple';
        model = parts.slice(0, -1).join(' ');
      } else {
        // If brand is something else but model contains iPhone/iPad, still use Apple
        brand = 'Apple';
      }
    }
    
    // Validate we have all required parts
    if (!brand || !model || !sku) {
      throw new Error(`Invalid filename format: ${args.filename}. Could not extract brand, model, and SKU.`);
    }
    
    // Check if mockup already exists
    const existing = await ctx.db
      .query("mockups")
      .withIndex("by_brand_model_sku", (q) =>
        q.eq("brand", brand).eq("model", model).eq("sku", sku)
      )
      .first();
    
    if (existing) {
      // Update file ID if changed
      if (existing.fileId !== args.fileId) {
        await ctx.db.patch(existing._id, { fileId: args.fileId });
        return { action: "updated", brand, model, sku };
      }
      return { action: "skipped", brand, model, sku };
    }
    
    // Insert new mockup
    await ctx.db.insert("mockups", {
      brand,
      model,
      sku,
      fileId: args.fileId,
    });
    
    return { action: "created", brand, model, sku };
  },
});
